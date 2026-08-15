from __future__ import annotations

import csv
import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from typing import Iterable

from .io import read_csv


REQUIRED_SUPPORT_SCOPES = (
    "identity",
    "names",
    "description",
    "chronology",
    "geometry",
    "classification",
    "relationships",
)

PUBLIC_REVIEW_STATES = {"machine_checked", "reviewed", "verified"}
ALLOWED_URL_STATUSES = {"ok", "redirected", "unavailable", "unchecked"}
ALLOWED_MEDIA_LICENSES = {
    "CC BY 2.0",
    "CC BY 2.5",
    "CC BY 3.0",
    "CC BY 4.0",
    "CC BY-SA 1.0",
    "CC BY-SA 2.0",
    "CC BY-SA 2.5",
    "CC BY-SA 3.0",
    "CC BY-SA 4.0",
    "CC0 1.0",
    "Public domain",
}


@dataclass(frozen=True)
class ValidationIssue:
    severity: str
    code: str
    table: str
    record_id: str
    message: str
    recommendation: str = ""

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


@dataclass
class ValidationReport:
    dataset_version: str
    generated_on: str
    canonical_path: str
    metrics: dict
    issues: list[ValidationIssue]

    @property
    def errors(self) -> list[ValidationIssue]:
        return [issue for issue in self.issues if issue.severity == "error"]

    @property
    def warnings(self) -> list[ValidationIssue]:
        return [issue for issue in self.issues if issue.severity == "warning"]

    @property
    def error_count(self) -> int:
        return len(self.errors)

    @property
    def warning_count(self) -> int:
        return len(self.warnings)

    @property
    def error_codes(self) -> set[str]:
        return {issue.code for issue in self.errors}

    def to_dict(self) -> dict:
        return {
            "dataset_version": self.dataset_version,
            "generated_on": self.generated_on,
            "canonical_path": self.canonical_path,
            "summary": {
                "errors": self.error_count,
                "warnings": self.warning_count,
                "status": "pass" if self.error_count == 0 else "fail",
            },
            "metrics": self.metrics,
            "issues": [issue.to_dict() for issue in self.issues],
        }


def _issue(
    issues: list[ValidationIssue],
    severity: str,
    code: str,
    table: str,
    record_id: str,
    message: str,
    recommendation: str = "",
) -> None:
    issues.append(ValidationIssue(severity, code, table, record_id, message, recommendation))


def _load_vocabularies(root: Path) -> dict[str, set[str]]:
    vocabularies: dict[str, set[str]] = {}
    for path in sorted((root / "data" / "vocabularies").glob("*.csv")):
        rows = read_csv(path)
        if rows and "code" in rows[0]:
            vocabularies[path.stem] = {row["code"] for row in rows}
    return vocabularies


def _record_id(table_schema: dict, row: dict[str, str], fallback: int) -> str:
    primary_key = table_schema.get("primary_key", "")
    return row.get(primary_key, "") or f"row-{fallback}"


def _is_date(value: str) -> bool:
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def _validate_scalar(
    issues: list[ValidationIssue],
    table: str,
    record_id: str,
    column: str,
    value: str,
    spec: dict,
) -> None:
    if not value:
        if spec.get("required"):
            _issue(
                issues,
                "error",
                "REQUIRED_FIELD",
                table,
                record_id,
                f"Required field {column} is empty.",
                "Populate the required field and rebuild the release.",
            )
        return
    kind = spec.get("type")
    try:
        if kind == "integer":
            int(value)
        elif kind == "number":
            number = float(value)
            if not math.isfinite(number):
                raise ValueError
        elif kind == "boolean" and value not in {"0", "1"}:
            raise ValueError
        elif kind == "date" and not _is_date(value):
            raise ValueError
        elif kind == "json":
            json.loads(value)
    except (TypeError, ValueError, json.JSONDecodeError):
        _issue(
            issues,
            "error",
            "INVALID_SCALAR_TYPE",
            table,
            record_id,
            f"Field {column} is not a valid {kind}: {value!r}.",
            "Correct the canonical value or its normalization rule.",
        )


def _count(rows: Iterable[dict[str, str]], field: str) -> dict[str, int]:
    return dict(sorted(Counter(row.get(field, "") or "(blank)" for row in rows).items()))


def _pct(numerator: int, denominator: int) -> float:
    return round(100.0 * numerator / denominator, 2) if denominator else 100.0


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def validate_release(
    canonical_path: Path,
    *,
    root: Path | None = None,
) -> ValidationReport:
    canonical_path = Path(canonical_path)
    root = Path(root) if root else Path(__file__).resolve().parents[2]
    contract = json.loads((root / "schema" / "tables.json").read_text(encoding="utf-8"))
    table_contracts: dict[str, dict] = contract["tables"]
    vocabularies = _load_vocabularies(root)
    issues: list[ValidationIssue] = []
    tables: dict[str, list[dict[str, str]]] = {}

    for table, table_schema in table_contracts.items():
        path = canonical_path / f"{table}.csv"
        if not path.exists():
            _issue(
                issues,
                "error",
                "TABLE_MISSING",
                table,
                "",
                f"Canonical table {path.name} is missing.",
                "Run the canonical data build.",
            )
            tables[table] = []
            continue
        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            rows = list(reader)
            actual_columns = list(reader.fieldnames or [])
        expected_columns = list(table_schema["columns"])
        if actual_columns != expected_columns:
            _issue(
                issues,
                "error",
                "TABLE_COLUMNS",
                table,
                "",
                f"Columns differ from the schema contract: {actual_columns!r}.",
                f"Use the exact column order {expected_columns!r}.",
            )
        tables[table] = rows
        primary_key = table_schema["primary_key"]
        seen: set[str] = set()
        for index, row in enumerate(rows, start=2):
            record_id = _record_id(table_schema, row, index)
            for column, spec in table_schema["columns"].items():
                _validate_scalar(issues, table, record_id, column, row.get(column, ""), spec)
                vocabulary = spec.get("vocabulary")
                value = row.get(column, "")
                if value and vocabulary and value not in vocabularies.get(vocabulary, set()):
                    _issue(
                        issues,
                        "error",
                        "VOCABULARY_VALUE",
                        table,
                        record_id,
                        f"{column}={value!r} is not in vocabulary {vocabulary}.",
                        "Use a declared controlled term or update the vocabulary and schema deliberately.",
                    )
            key = row.get(primary_key, "")
            if key in seen:
                _issue(
                    issues,
                    "error",
                    "DUPLICATE_PRIMARY_KEY",
                    table,
                    key,
                    f"Primary key {key!r} occurs more than once.",
                    "Assign a unique stable identifier.",
                )
            seen.add(key)

    indexes = {
        table: {row.get(schema["primary_key"], "") for row in tables.get(table, [])}
        for table, schema in table_contracts.items()
    }
    for table, schema in table_contracts.items():
        for row_number, row in enumerate(tables.get(table, []), start=2):
            record_id = _record_id(schema, row, row_number)
            for column, spec in schema["columns"].items():
                foreign_key = spec.get("foreign_key")
                value = row.get(column, "")
                if not foreign_key or not value:
                    continue
                target_table, _target_column = foreign_key.split(".", 1)
                if value not in indexes.get(target_table, set()):
                    _issue(
                        issues,
                        "error",
                        "FOREIGN_KEY",
                        table,
                        record_id,
                        f"{column} references missing {foreign_key} value {value!r}.",
                        "Repair the relationship or restore the referenced record.",
                    )

    entities = tables.get("entities", [])
    entities_by_id = {row["entity_id"]: row for row in entities if row.get("entity_id")}
    places = tables.get("places", [])
    places_by_entity: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in places:
        places_by_entity[row.get("entity_id", "")].append(row)
    chronologies = tables.get("chronologies", [])
    chronologies_by_entity: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in chronologies:
        chronologies_by_entity[row.get("entity_id", "")].append(row)

    for entity in entities:
        entity_id = entity["entity_id"]
        if not entity.get("preferred_name_el") or not entity.get("preferred_name_en"):
            _issue(
                issues,
                "error",
                "BILINGUAL_ENTITY_NAME",
                "entities",
                entity_id,
                "Preferred Greek and English names are both required.",
                "Supply both public name fields.",
            )
        if not entity.get("description_el") or not entity.get("description_en"):
            _issue(
                issues,
                "error",
                "BILINGUAL_ENTITY_DESCRIPTION",
                "entities",
                entity_id,
                "Greek and English descriptions are both required.",
                "Supply and review the missing language version.",
            )
        if entity.get("review_state") not in PUBLIC_REVIEW_STATES:
            _issue(
                issues,
                "error",
                "PUBLIC_REVIEW_STATE",
                "entities",
                entity_id,
                f"Public entity remains {entity.get('review_state')!r}.",
                "Document an editorial decision before public release.",
            )
        if len(places_by_entity.get(entity_id, [])) != 1:
            _issue(
                issues,
                "error",
                "ENTITY_PLACE_CARDINALITY",
                "entities",
                entity_id,
                "Version 1.0.0 requires exactly one primary place row per entity.",
                "Add or deduplicate the primary spatial assertion.",
            )
        if len(chronologies_by_entity.get(entity_id, [])) != 1:
            _issue(
                issues,
                "error",
                "ENTITY_CHRONOLOGY_CARDINALITY",
                "entities",
                entity_id,
                "Version 1.0.0 requires exactly one primary chronology per entity.",
                "Add or deduplicate the primary chronology.",
            )
        if entity.get("record_confidence") == "medium":
            _issue(
                issues,
                "warning",
                "RETAINED_UNCERTAINTY",
                "entities",
                entity_id,
                "The record is reviewed but intentionally retains medium confidence.",
                "Revisit only when stronger entity-specific evidence becomes available.",
            )

    media = tables.get("media", [])
    media_by_entity: dict[str, list[dict[str, str]]] = defaultdict(list)
    media_root = (root / "assets" / "media").resolve()
    for row in media:
        record_id = row.get("media_id", "")
        entity_id = row.get("entity_id", "")
        media_by_entity[entity_id].append(row)
        if row.get("review_state") not in PUBLIC_REVIEW_STATES:
            _issue(
                issues,
                "error",
                "PUBLIC_REVIEW_STATE",
                "media",
                record_id,
                f"Public media remains {row.get('review_state')!r}.",
                "Review the media selection and its attribution before release.",
            )
        if not all(str(row.get(field) or "").strip() for field in ("caption_el", "caption_en", "alt_el", "alt_en")):
            _issue(
                issues,
                "error",
                "BILINGUAL_MEDIA_TEXT",
                "media",
                record_id,
                "Media captions and alternative text must be complete in Greek and English.",
                "Supply all four public text fields.",
            )
        if row.get("license") not in ALLOWED_MEDIA_LICENSES:
            _issue(
                issues,
                "error",
                "MEDIA_LICENSE",
                "media",
                record_id,
                f"Media licence {row.get('license')!r} is not on the reusable-media allowlist.",
                "Use a verified reusable Commons file or document a deliberate licence-policy change.",
            )
        for field in ("source_url", "original_url", "license_url"):
            if not str(row.get(field) or "").startswith("https://"):
                _issue(
                    issues,
                    "error",
                    "MEDIA_HTTPS_URL",
                    "media",
                    record_id,
                    f"{field} must be an HTTPS URL.",
                    "Record the canonical secure source or licence URL.",
                )
        try:
            width = int(row.get("width", ""))
            height = int(row.get("height", ""))
            if width <= 0 or height <= 0 or max(width, height) > 1600:
                raise ValueError
        except (TypeError, ValueError):
            _issue(
                issues,
                "error",
                "MEDIA_DIMENSIONS",
                "media",
                record_id,
                "Media dimensions must be positive and bounded to 1600 pixels.",
                "Rebuild the optimized local WebP.",
            )

        local_file: Path | None = None
        file_path = str(row.get("file_path") or "").strip()
        try:
            local_file = (root / file_path).resolve()
            local_file.relative_to(media_root)
            if local_file.suffix.casefold() != ".webp" or not local_file.is_file():
                raise ValueError
        except (OSError, ValueError):
            local_file = None
            _issue(
                issues,
                "error",
                "MEDIA_FILE_PATH",
                "media",
                record_id,
                f"Local media path is missing, unsafe, or not WebP: {file_path!r}.",
                "Keep optimized files below assets/media and regenerate the manifest.",
            )
        expected_hash = str(row.get("sha256") or "").casefold()
        if local_file and (not re.fullmatch(r"[0-9a-f]{64}", expected_hash) or _sha256(local_file) != expected_hash):
            _issue(
                issues,
                "error",
                "MEDIA_CHECKSUM",
                "media",
                record_id,
                "Local media bytes do not match the recorded SHA-256 checksum.",
                "Rebuild the media manifest from the reviewed source file.",
            )

    for entity in entities:
        entity_id = entity["entity_id"]
        entity_media = media_by_entity.get(entity_id, [])
        if not 1 <= len(entity_media) <= 4:
            _issue(
                issues,
                "error",
                "MEDIA_ENTITY_COVERAGE",
                "media",
                entity_id,
                f"Entity has {len(entity_media)} media items; the release requires one to four.",
                "Curate at least one reviewed primary image and no more than four total items.",
            )
            continue
        try:
            positions = sorted(int(row["position"]) for row in entity_media)
        except (KeyError, TypeError, ValueError):
            positions = []
        if positions != list(range(1, len(entity_media) + 1)):
            _issue(
                issues,
                "error",
                "MEDIA_POSITION_ORDER",
                "media",
                entity_id,
                f"Media positions are not a unique contiguous sequence: {positions!r}.",
                "Number the reviewed gallery from one without gaps or duplicates.",
            )
        for row in entity_media:
            try:
                position = int(row["position"])
            except (KeyError, TypeError, ValueError):
                continue
            expected_role = "primary" if position == 1 else "gallery"
            if row.get("role") != expected_role:
                _issue(
                    issues,
                    "error",
                    "MEDIA_ROLE_ORDER",
                    "media",
                    row.get("media_id", ""),
                    f"Position {position} must use role {expected_role!r}.",
                    "Keep exactly one primary image first and gallery images after it.",
                )

    for place in places:
        record_id = place.get("place_id", "")
        entity = entities_by_id.get(place.get("entity_id", ""), {})
        if entity.get("entity_class") == "polity" and place.get("geometry_role") != "representative_center":
            _issue(
                issues,
                "error",
                "POLITY_POINT_ROLE",
                "places",
                record_id,
                "A polity point must be marked representative_center.",
                "Set the role correctly; do not present a capital point as territorial geometry.",
            )
        if entity.get("entity_class") != "polity" and place.get("geometry_role") == "representative_center":
            _issue(
                issues,
                "error",
                "NON_POLITY_REPRESENTATIVE_CENTER",
                "places",
                record_id,
                "Only polity records may use representative_center in this release.",
                "Use site or proxy for settlement and sanctuary entities.",
            )
        if bool(place.get("spatial_note_el")) != bool(place.get("spatial_note_en")):
            _issue(
                issues,
                "error",
                "BILINGUAL_SPATIAL_NOTE",
                "places",
                record_id,
                "Spatial note exists in only one public language.",
                "Supply or remove both language versions together.",
            )
        try:
            latitude = float(place["latitude"])
            longitude = float(place["longitude"])
            if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
                raise ValueError
            geometry = json.loads(place["geometry_geojson"])
            coordinates = geometry.get("coordinates", [])
            if geometry.get("type") != "Point" or len(coordinates) != 2:
                raise ValueError
            if not math.isclose(float(coordinates[0]), longitude, abs_tol=1e-8) or not math.isclose(
                float(coordinates[1]), latitude, abs_tol=1e-8
            ):
                _issue(
                    issues,
                    "error",
                    "GEOJSON_COORDINATE_MISMATCH",
                    "places",
                    record_id,
                    "GeoJSON coordinates do not match longitude/latitude fields.",
                    "Regenerate geometry from the canonical numeric fields.",
                )
            wkt = re.fullmatch(
                r"POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)",
                place.get("geometry_wkt", ""),
                re.IGNORECASE,
            )
            if not wkt or not math.isclose(float(wkt.group(1)), longitude, abs_tol=1e-8) or not math.isclose(
                float(wkt.group(2)), latitude, abs_tol=1e-8
            ):
                _issue(
                    issues,
                    "error",
                    "WKT_COORDINATE_MISMATCH",
                    "places",
                    record_id,
                    "WKT does not match longitude/latitude fields.",
                    "Regenerate WKT in longitude-latitude order.",
                )
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            _issue(
                issues,
                "error",
                "GEOMETRY_INVALID",
                "places",
                record_id,
                "Point geometry or coordinate range is invalid.",
                "Supply a valid WGS 84 Point in longitude-latitude order.",
            )
        if place.get("geometry_role") == "proxy":
            _issue(
                issues,
                "warning",
                "PROXY_GEOMETRY",
                "places",
                record_id,
                "The point is intentionally an approximate proxy, not a surveyed footprint.",
                "Replace only with a monument-specific coordinate supported by an authoritative source.",
            )

    for chronology in chronologies:
        record_id = chronology.get("chronology_id", "")
        try:
            start_year = int(chronology["start_year"])
            end_year = int(chronology["end_year"])
            if start_year == 0 or end_year == 0:
                _issue(
                    issues,
                    "error",
                    "CHRONOLOGY_YEAR_ZERO",
                    "chronologies",
                    record_id,
                    "Chronology uses prohibited year zero.",
                    "Use -1 for 1 BCE and 1 for 1 CE.",
                )
            if start_year > end_year:
                _issue(
                    issues,
                    "error",
                    "CHRONOLOGY_ORDER",
                    "chronologies",
                    record_id,
                    "Chronology starts after it ends.",
                    "Correct the signed year bounds.",
                )
        except (KeyError, ValueError):
            pass
        cutoff = chronology.get("display_cutoff") == "1"
        if cutoff != (chronology.get("end_precision") == "display_cutoff"):
            _issue(
                issues,
                "error",
                "DISPLAY_CUTOFF_CONSISTENCY",
                "chronologies",
                record_id,
                "display_cutoff and end_precision disagree.",
                "Set both fields from the same chronology rule.",
            )
        if bool(chronology.get("note_el")) != bool(chronology.get("note_en")):
            _issue(
                issues,
                "error",
                "BILINGUAL_CHRONOLOGY_NOTE",
                "chronologies",
                record_id,
                "Chronology note exists in only one public language.",
                "Supply or remove both language versions together.",
            )

    for authority in tables.get("authorities", []):
        if not authority.get("preferred_label_el") or not authority.get("preferred_label_en"):
            _issue(
                issues,
                "error",
                "BILINGUAL_AUTHORITY_LABEL",
                "authorities",
                authority.get("authority_id", ""),
                "Authority labels must be bilingual.",
                "Supply reviewed Greek and English labels.",
            )
        if authority.get("review_state") not in PUBLIC_REVIEW_STATES:
            _issue(
                issues,
                "error",
                "PUBLIC_REVIEW_STATE",
                "authorities",
                authority.get("authority_id", ""),
                f"Authority remains {authority.get('review_state')!r}.",
                "Resolve the authority before public release.",
            )

    for table in ("names", "places", "chronologies", "relationships"):
        primary_key = table_contracts[table]["primary_key"]
        for row in tables.get(table, []):
            if row.get("review_state") not in PUBLIC_REVIEW_STATES:
                _issue(
                    issues,
                    "error",
                    "PUBLIC_REVIEW_STATE",
                    table,
                    row.get(primary_key, ""),
                    f"Public assertion remains {row.get('review_state')!r}.",
                    "Resolve the editorial state before public release.",
                )

    relationship_triples: set[tuple[str, str, str, str]] = set()
    for relation in tables.get("relationships", []):
        record_id = relation.get("relationship_id", "")
        target_count = bool(relation.get("object_entity_id")) + bool(relation.get("object_authority_id"))
        if target_count != 1:
            _issue(
                issues,
                "error",
                "RELATIONSHIP_TARGET_CARDINALITY",
                "relationships",
                record_id,
                "A relationship must have exactly one entity or authority target.",
                "Populate one target field and clear the other.",
            )
        if not relation.get("object_label_el") or not relation.get("object_label_en"):
            _issue(
                issues,
                "error",
                "BILINGUAL_RELATIONSHIP_LABEL",
                "relationships",
                record_id,
                "Relationship object labels must be bilingual.",
                "Supply reviewed Greek and English labels.",
            )
        if relation.get("subject_entity_id") == relation.get("object_entity_id"):
            _issue(
                issues,
                "error",
                "RELATIONSHIP_SELF_LINK",
                "relationships",
                record_id,
                "Relationship links an entity to itself.",
                "Remove or correct the target.",
            )
        triple = (
            relation.get("subject_entity_id", ""),
            relation.get("predicate", ""),
            relation.get("object_entity_id", ""),
            relation.get("object_authority_id", ""),
        )
        if triple in relationship_triples:
            _issue(
                issues,
                "error",
                "DUPLICATE_RELATIONSHIP",
                "relationships",
                record_id,
                "The same subject, predicate and target occurs more than once.",
                "Keep one sourced assertion or model genuinely distinct claims explicitly.",
            )
        relationship_triples.add(triple)

    support = defaultdict(set)
    primary_entities: set[str] = set()
    for link in tables.get("entity_sources", []):
        support[link.get("entity_id", "")].add(link.get("support_scope", ""))
        if link.get("is_primary") == "1":
            primary_entities.add(link.get("entity_id", ""))
    for entity in entities:
        entity_id = entity["entity_id"]
        for scope in REQUIRED_SUPPORT_SCOPES:
            if scope not in support.get(entity_id, set()):
                _issue(
                    issues,
                    "error",
                    f"SOURCE_SUPPORT_{scope.upper()}",
                    "entity_sources",
                    entity_id,
                    f"Entity has no source support for {scope}.",
                    "Attach at least one relevant source to this claim scope.",
                )
        if entity_id not in primary_entities:
            _issue(
                issues,
                "error",
                "PRIMARY_SOURCE_MISSING",
                "entity_sources",
                entity_id,
                "Entity has no source marked primary.",
                "Designate the principal reconciled source.",
            )

    sources = tables.get("sources", [])
    for source in sources:
        record_id = source.get("source_id", "")
        status = source.get("url_status", "")
        if status not in ALLOWED_URL_STATUSES:
            _issue(
                issues,
                "error",
                "SOURCE_URL_STATUS",
                "sources",
                record_id,
                f"Unknown URL status {status!r}.",
                "Use the controlled operational URL statuses.",
            )
        elif status in {"unavailable", "unchecked"}:
            _issue(
                issues,
                "warning",
                "SOURCE_URL_ACCESS",
                "sources",
                record_id,
                f"Source URL is {status}; this is an accessibility warning, not a scholarly verdict.",
                "Recheck periodically without discarding relevant institutional evidence.",
            )
        if re.search(r"(?:source record$|^Pleiades place \d+$)", source.get("title", "")):
            _issue(
                issues,
                "error",
                "SOURCE_GENERIC_TITLE",
                "sources",
                record_id,
                "Source still has a generated generic title.",
                "Reconcile authoritative title metadata before release.",
            )

    for external in tables.get("external_ids", []):
        record_id = external.get("external_id", "")
        owners = bool(external.get("entity_id")) + bool(external.get("place_id"))
        if owners != 1:
            _issue(
                issues,
                "error",
                "EXTERNAL_ID_OWNER_CARDINALITY",
                "external_ids",
                record_id,
                "External identifier must belong to exactly one entity or place assertion.",
                "Set one owner field only.",
            )
        if external.get("scheme") == "pleiades":
            identifier = external.get("identifier", "")
            expected_uri = f"https://pleiades.stoa.org/places/{identifier}"
            if not identifier.isdigit() or external.get("uri") != expected_uri:
                _issue(
                    issues,
                    "error",
                    "PLEIADES_IDENTIFIER_URI",
                    "external_ids",
                    record_id,
                    "Pleiades identifier and canonical URI do not agree.",
                    "Use a numeric ID and its canonical HTTPS place URI.",
                )

    reconciliation_path = root / "data" / "research" / "pleiades-reconciliation.csv"
    reconciliation = read_csv(reconciliation_path) if reconciliation_path.exists() else []
    for row in reconciliation:
        if row.get("status") != "matched":
            _issue(
                issues,
                "error",
                "PLEIADES_RECONCILIATION",
                "external_ids",
                row.get("entity_id", ""),
                f"Pleiades reconciliation status is {row.get('status')!r}.",
                "Resolve the canonical identifier or remove the unsupported alignment.",
            )
        try:
            if float(row.get("distance_m", "0") or 0) > 500:
                _issue(
                    issues,
                    "warning",
                    "PLEIADES_COORDINATE_OFFSET",
                    "places",
                    row.get("entity_id", ""),
                    f"Local and Pleiades representative points differ by {row.get('distance_m')} metres.",
                    "Keep the measured difference visible and review only with monument-specific evidence.",
                )
        except ValueError:
            pass

    country_map_path = root / "data" / "vocabularies" / "country_codes.csv"
    countries = {row["iso3"]: row for row in read_csv(country_map_path)}
    for place in places:
        country = countries.get(place.get("country_iso3", ""))
        if not country or any(
            (
                place.get("country_iso2") != country.get("iso2"),
                place.get("modern_country_el") != country.get("name_el"),
                place.get("modern_country_en") != country.get("name_en"),
            )
        ):
            _issue(
                issues,
                "error",
                "COUNTRY_CODE_ALIGNMENT",
                "places",
                place.get("place_id", ""),
                "Country names and ISO codes do not match the controlled country table.",
                "Regenerate country fields from the ISO mapping.",
            )

    entity_count = len(entities)
    bilingual_complete = sum(
        bool(row.get("preferred_name_el"))
        and bool(row.get("preferred_name_en"))
        and bool(row.get("description_el"))
        and bool(row.get("description_en"))
        for row in entities
    )
    relation_internal = sum(bool(row.get("object_entity_id")) for row in tables.get("relationships", []))
    candidates_path = root / "data" / "research" / "candidates.csv"
    candidates = read_csv(candidates_path) if candidates_path.exists() else []
    bilingual_media = sum(
        all(str(row.get(field) or "").strip() for field in ("caption_el", "caption_en", "alt_el", "alt_en"))
        for row in media
    )
    media_entities_covered = sum(bool(media_by_entity.get(row["entity_id"])) for row in entities)
    metrics = {
        "table_counts": {table: len(rows) for table, rows in sorted(tables.items())},
        "entities": {
            "by_class": _count(entities, "entity_class"),
            "by_collection": _count(entities, "collections"),
            "by_review_state": _count(entities, "review_state"),
            "by_record_confidence": _count(entities, "record_confidence"),
        },
        "geography": {
            "by_country_iso3": _count(places, "country_iso3"),
            "by_geometry_role": _count(places, "geometry_role"),
            "by_location_certainty": _count(places, "location_certainty"),
        },
        "chronology": {
            "by_basis": _count(chronologies, "chronology_basis"),
            "by_precision": _count(chronologies, "temporal_precision"),
            "display_cutoff_count": sum(row.get("display_cutoff") == "1" for row in chronologies),
        },
        "relationships": {
            "by_predicate": _count(tables.get("relationships", []), "predicate"),
            "internal_targets": relation_internal,
            "authority_targets": len(tables.get("relationships", [])) - relation_internal,
        },
        "sources": {
            "by_class": _count(sources, "source_class"),
            "by_url_status": _count(sources, "url_status"),
            "with_recorded_license": sum(bool(row.get("license")) for row in sources),
        },
        "media": {
            "items": len(media),
            "entities_covered": media_entities_covered,
            "entities_covered_percent": _pct(media_entities_covered, entity_count),
            "bilingual_items": bilingual_media,
            "bilingual_items_percent": _pct(bilingual_media, len(media)),
            "by_license": _count(media, "license"),
        },
        "coverage": {
            "bilingual_entities_complete": bilingual_complete,
            "bilingual_entities_percent": _pct(bilingual_complete, entity_count),
            "entities_with_all_source_scopes": sum(
                set(REQUIRED_SUPPORT_SCOPES).issubset(support.get(row["entity_id"], set()))
                for row in entities
            ),
            "entities_with_all_source_scopes_percent": _pct(
                sum(
                    set(REQUIRED_SUPPORT_SCOPES).issubset(support.get(row["entity_id"], set()))
                    for row in entities
                ),
                entity_count,
            ),
            "pleiades_identifiers": len(tables.get("external_ids", [])),
            "pleiades_reconciled_matched": sum(row.get("status") == "matched" for row in reconciliation),
        },
        "candidate_audit": _count(candidates, "decision"),
    }
    versions = sorted({row.get("data_version", "") for row in entities if row.get("data_version")})
    dataset_version = versions[0] if len(versions) == 1 else "+".join(versions) or contract.get("version", "")
    review_dates = [row.get("last_reviewed", "") for row in entities if row.get("last_reviewed")]
    generated_on = max(review_dates) if review_dates else date.today().isoformat()
    issues.sort(key=lambda item: (item.severity != "error", item.code, item.table, item.record_id))
    try:
        report_path = canonical_path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        report_path = str(canonical_path.resolve())
    return ValidationReport(
        dataset_version=dataset_version,
        generated_on=generated_on,
        canonical_path=report_path,
        metrics=metrics,
        issues=issues,
    )


def write_reports(report: ValidationReport, report_dir: Path) -> None:
    report_dir = Path(report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    json_path = report_dir / "quality-report.json"
    json_path.write_text(
        json.dumps(report.to_dict(), ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    metrics = report.metrics
    table_lines = "\n".join(
        f"| `{name}` | {count} |" for name, count in metrics["table_counts"].items()
    )
    warning_counts = Counter(issue.code for issue in report.warnings)
    warning_lines = "\n".join(
        f"| `{code}` | {count} |" for code, count in sorted(warning_counts.items())
    ) or "| — | 0 |"
    markdown = f"""# Quality Report / Αναφορά Ποιότητας

**Dataset version / Έκδοση:** {report.dataset_version}  
**Generated / Παραγωγή:** {report.generated_on}  
**Status / Κατάσταση:** {'PASS' if report.error_count == 0 else 'FAIL'}  
**Errors / Σφάλματα:** {report.error_count}  
**Warnings / Προειδοποιήσεις:** {report.warning_count}

Warnings preserve uncertainty and URL-access conditions; they do not invalidate a zero-error release. / Οι προειδοποιήσεις διατηρούν την αβεβαιότητα και τις συνθήκες πρόσβασης URL· δεν ακυρώνουν έκδοση χωρίς σφάλματα.

## Canonical tables / Κανονικοί πίνακες

| Table | Rows |
|---|---:|
{table_lines}

## Coverage / Κάλυψη

- Bilingual entity completeness: **{metrics['coverage']['bilingual_entities_percent']}%** ({metrics['coverage']['bilingual_entities_complete']}/{metrics['table_counts']['entities']})
- Complete seven-scope source support: **{metrics['coverage']['entities_with_all_source_scopes_percent']}%** ({metrics['coverage']['entities_with_all_source_scopes']}/{metrics['table_counts']['entities']})
- Pleiades alignments matched: **{metrics['coverage']['pleiades_reconciled_matched']}/{metrics['coverage']['pleiades_identifiers']}**
- Entities with reviewed local media: **{metrics['media']['entities_covered_percent']}%** ({metrics['media']['entities_covered']}/{metrics['table_counts']['entities']})
- Bilingual media items: **{metrics['media']['bilingual_items_percent']}%** ({metrics['media']['bilingual_items']}/{metrics['media']['items']})
- Internal relationship targets: **{metrics['relationships']['internal_targets']}**
- Stable authority targets: **{metrics['relationships']['authority_targets']}**

## Warning classes / Κατηγορίες προειδοποιήσεων

| Code | Count |
|---|---:|
{warning_lines}

## Interpretation / Ερμηνεία

- `RETAINED_UNCERTAINTY`: reviewed record whose historical or spatial confidence intentionally remains medium.
- `PROXY_GEOMETRY`: approximate marker, not a surveyed monument footprint.
- `SOURCE_URL_ACCESS`: access failure or unchecked URL; not a scholarly rejection.
- `PLEIADES_COORDINATE_OFFSET`: measured coordinate difference retained for transparency.

Canonical CSV remains the source of truth. Full machine-readable metrics and issue records are in `quality-report.json`; actionable rows are in `review-queue.csv`.
"""
    (report_dir / "quality-report.md").write_text(markdown, encoding="utf-8")

    fields = ["severity", "code", "table", "record_id", "message", "recommendation"]
    with (report_dir / "review-queue.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        for issue in report.issues:
            writer.writerow(issue.to_dict())
