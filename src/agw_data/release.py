from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

from .io import read_csv
from .normalize import map_review_state, normalize_entity, normalize_place, normalize_text, stable_id
from .sources import canonicalize_url
from .translate import TranslationCache


SOURCE_SUPPORT_SCOPES = (
    "identity",
    "names",
    "description",
    "chronology",
    "geometry",
    "classification",
    "relationships",
)

RELATION_FIELDS = {
    "metropolis_el": ("founded_from", "settlement"),
    "associated_city_el": ("associated_with_settlement", "settlement"),
    "representative_center_el": ("representative_center", "settlement"),
    "deity_or_cult_el": ("cult_of", "deity_or_cult"),
    "dynasty_el": ("ruled_by_dynasty", "dynasty"),
    "predecessor_el": ("preceded_by", "polity"),
    "successor_el": ("succeeded_by", "polity"),
}


SOURCE_DOMAIN_METADATA = {
    "pleiades.stoa.org": ("Pleiades", "scholarly_gazetteer", "en", "CC BY 3.0"),
    "whc.unesco.org": ("UNESCO World Heritage Centre", "unesco", "en", ""),
    "www.metmuseum.org": ("The Metropolitan Museum of Art", "museum", "en", ""),
    "www.britishmuseum.org": ("The British Museum", "museum", "en", ""),
    "odysseus.culture.gr": ("Hellenic Ministry of Culture", "national_archaeological_service", "en", ""),
    "www.iranicaonline.org": ("Encyclopaedia Iranica", "reference_work", "en", ""),
    "www.cambridge.org": ("Cambridge University Press", "peer_reviewed_publication", "en", ""),
    "assets.cambridge.org": ("Cambridge University Press", "peer_reviewed_publication", "en", ""),
    "www.persee.fr": ("Persée", "peer_reviewed_publication", "fr", ""),
    "discovery.ucl.ac.uk": ("University College London", "university", "en", ""),
    "www.uni-muenster.de": ("University of Münster", "university", "en", ""),
    "websites.ucy.ac.cy": ("University of Cyprus", "university", "en", ""),
    "www.mthv.gr": ("Museum of Thebes", "museum", "en", ""),
    "www.armus.hr": ("Archaeological Museum in Split", "museum", "en", ""),
    "www.encyclopediaofukraine.com": ("Internet Encyclopedia of Ukraine", "reference_work", "en", ""),
    "www.attalus.org": ("Attalus", "reference_work", "en", ""),
    "museoarcheologicoreggiocalabria.cultura.gov.it": ("Museo Archeologico Nazionale di Reggio Calabria", "museum", "it", ""),
    "aphrodisias-excavations.com": ("Aphrodisias Excavations", "excavation_project", "en", ""),
    "www.penn.museum": ("Penn Museum", "museum", "en", ""),
}


def _fold(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", normalize_text(value).casefold())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def compact_authority_id(authority_type: str, label: str) -> str:
    value = stable_id(authority_type, label)
    if len(value) <= 96:
        return value
    digest = hashlib.sha256(normalize_text(label).encode("utf-8")).hexdigest()[:12]
    return f"{value[:82].rstrip('-')}-{digest}"


def source_id_for_url(url: str) -> str:
    url = canonicalize_url(normalize_text(url))
    parsed = urlparse(url)
    pleiades = re.fullmatch(r"/places/(\d+)/?", parsed.path)
    if parsed.netloc == "pleiades.stoa.org" and pleiades:
        return f"src-pleiades-{pleiades.group(1)}"
    domain = parsed.netloc.removeprefix("www.").split(".")[0] or "source"
    domain = re.sub(r"[^a-z0-9]+", "-", domain.casefold()).strip("-")
    digest = hashlib.sha256(normalize_text(url).encode("utf-8")).hexdigest()[:12]
    return f"src-{domain}-{digest}"


def build_source(
    url: str,
    *,
    check: dict[str, str] | None = None,
    override: dict[str, str] | None = None,
    pleiades_record: dict | None = None,
) -> dict[str, str]:
    url = canonicalize_url(url)
    check = check or {}
    override = override or {}
    parsed = urlparse(url)
    publisher, source_class, language, license_name = SOURCE_DOMAIN_METADATA.get(
        parsed.netloc,
        (parsed.netloc or "Unknown publisher", "other", "und", ""),
    )
    match = re.fullmatch(r"/places/(\d+)/?", parsed.path)
    fallback_title = f"Pleiades place {match.group(1)}" if publisher == "Pleiades" and match else f"{publisher} source record"
    title = (
        normalize_text(override.get("title", ""))
        or normalize_text((pleiades_record or {}).get("title", ""))
        or normalize_text(check.get("title", ""))
        or fallback_title
    )
    publisher = normalize_text(override.get("publisher", "")) or publisher
    source_class = normalize_text(override.get("source_class", "")) or source_class
    language = normalize_text(override.get("language", "")) or language
    license_name = normalize_text(override.get("license", "")) or license_name
    accessed_on = normalize_text(check.get("checked_on", "")) or "2026-08-15"
    modified = normalize_text((pleiades_record or {}).get("modified", ""))
    check_note = normalize_text(check.get("error", ""))
    notes = normalize_text(override.get("notes", ""))
    if not notes:
        details = []
        if modified:
            details.append(f"Pleiades record modified {modified}")
        if check_note:
            details.append(f"URL check: {check_note}")
        notes = "; ".join(details) or "Source metadata reconciled from the submitted research and cached URL check."
    return {
        "source_id": source_id_for_url(url),
        "url": url,
        "title": title,
        "publisher": publisher,
        "source_class": source_class,
        "language": language,
        "license": license_name,
        "accessed_on": accessed_on,
        "http_status": normalize_text(check.get("http_status", "")),
        "url_status": normalize_text(check.get("url_status", "")) or "unchecked",
        "citation": f"{title}. {publisher}. {url} (accessed {accessed_on}).",
        "notes": notes,
    }


def _bool(value: bool) -> str:
    return "1" if value else "0"


def _country_map(root: Path) -> dict[str, dict[str, str]]:
    countries = read_csv(root / "data" / "vocabularies" / "country_codes.csv")
    return {row["iso3"]: row for row in countries}


def _load_editorial_overrides(root: Path) -> dict[str, dict]:
    path = root / "data" / "research" / "editorial-overrides.json"
    if not path.exists():
        return {"translations": {}, "regions": {}, "relation_labels": {}, "entities": {}}
    payload = json.loads(path.read_text(encoding="utf-8"))
    for section in ("translations", "regions", "relation_labels", "entities"):
        payload.setdefault(section, {})
    return payload


def _load_source_research(root: Path) -> tuple[dict[str, dict[str, str]], dict[str, dict[str, str]], dict[str, dict]]:
    checks_path = root / "data" / "research" / "source-checks.csv"
    overrides_path = root / "data" / "research" / "source-overrides.csv"
    records_path = root / "data" / "reference" / "pleiades" / "records.json"
    checks = {
        canonicalize_url(row["url"]): row
        for row in (read_csv(checks_path) if checks_path.exists() else [])
    }
    overrides = {
        canonicalize_url(row["url"]): row
        for row in (read_csv(overrides_path) if overrides_path.exists() else [])
    }
    pleiades_records = {}
    if records_path.exists():
        pleiades_records = json.loads(records_path.read_text(encoding="utf-8")).get("records", {})
    return checks, overrides, pleiades_records


def _load_entity_source_overrides(root: Path) -> dict[str, dict[str, str]]:
    path = root / "data" / "research" / "entity-source-overrides.csv"
    if not path.exists():
        return {}
    return {row["entity_id"]: row for row in read_csv(path)}


def _load_entity_overrides(root: Path) -> dict[str, dict[str, str]]:
    path = root / "data" / "research" / "entity-overrides.csv"
    if not path.exists():
        return {}
    return {row["entity_id"]: row for row in read_csv(path)}


def _load_relationship_overrides(root: Path) -> dict[str, list[dict[str, str]]]:
    path = root / "data" / "research" / "relationship-overrides.csv"
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    if not path.exists():
        return grouped
    for row in read_csv(path):
        grouped[row["subject_entity_id"]].append(row)
    return grouped


def _effective_source_urls(
    row: dict[str, str],
    overrides: dict[str, dict[str, str]],
) -> tuple[str, str]:
    override = overrides.get(normalize_text(row["id"]), {})
    primary = normalize_text(override.get("primary_source_url", "")) or normalize_text(row.get("source_url", ""))
    secondary = normalize_text(override.get("secondary_source_url", "")) or normalize_text(
        row.get("secondary_source_url", "")
    )
    return canonicalize_url(primary), canonicalize_url(secondary) if secondary else ""


def _format_year(year: int) -> str:
    return f"{abs(year)} BCE" if year < 0 else f"{year} CE"


def _chronology_label_en(row: dict[str, str]) -> str:
    label = f"{_format_year(int(row['start_year']))}–{_format_year(int(row['end_year']))}"
    if normalize_text(row["end_precision"]) == "display_cutoff":
        label += " (atlas display cutoff)"
    return label


def _relationship_target(
    label_el: str,
    authority_type: str,
    entities_by_el: dict[str, list[dict[str, str]]],
) -> tuple[str, str]:
    candidates = entities_by_el.get(_fold(label_el), [])
    if authority_type == "settlement" and len(candidates) == 1 and candidates[0]["entity_class"] == "settlement":
        return candidates[0]["entity_id"], ""
    return "", compact_authority_id(authority_type, label_el)


def build_release(raw_path: Path, root: Path) -> dict[str, list[dict[str, str]]]:
    root = Path(root)
    legacy_rows = read_csv(Path(raw_path))
    translations = TranslationCache(root / "data" / "research" / "translations-el-en.json")
    editorial = _load_editorial_overrides(root)

    def translated(text: str, section: str = "translations") -> str:
        normalized = normalize_text(text)
        if not normalized:
            return ""
        return normalize_text(editorial.get(section, {}).get(normalized, translations.get(normalized)))

    countries = _country_map(root)
    source_checks, source_overrides, pleiades_records = _load_source_research(root)
    entity_source_overrides = _load_entity_source_overrides(root)
    entity_overrides = _load_entity_overrides(root)
    relationship_overrides = _load_relationship_overrides(root)

    source_urls = sorted(
        {
            canonicalize_url(normalize_text(url))
            for row in legacy_rows
            for url in (*_effective_source_urls(row, entity_source_overrides),)
            if normalize_text(url)
        }
        | {
            f"https://pleiades.stoa.org/places/{normalize_text(row['pleiades_id'])}"
            for row in legacy_rows
            if normalize_text(row.get("pleiades_id", ""))
        }
    )
    sources = []
    for url in source_urls:
        pid = re.fullmatch(r"/places/(\d+)/?", urlparse(url).path)
        sources.append(
            build_source(
                url,
                check=source_checks.get(url),
                override=source_overrides.get(url),
                pleiades_record=pleiades_records.get(pid.group(1)) if pid else None,
            )
        )
    source_by_url = {row["url"]: row for row in sources}

    region_sources: dict[str, str] = {}
    for row in legacy_rows:
        primary_url, _ = _effective_source_urls(row, entity_source_overrides)
        region_sources.setdefault(normalize_text(row["ancient_region"]), source_id_for_url(primary_url))
    authorities: dict[str, dict[str, str]] = {}
    for label_el, source_id in sorted(region_sources.items()):
        authority_id = compact_authority_id("region", label_el)
        authorities[authority_id] = {
            "authority_id": authority_id,
            "authority_type": "ancient_region",
            "preferred_label_el": label_el,
            "preferred_label_en": translated(label_el, "regions"),
            "uri": "",
            "source_id": source_id,
            "review_state": "reviewed",
        }

    entities = []
    for row in legacy_rows:
        entity = normalize_entity(row, description_en=translated(row["description_el"]))
        entity_override = editorial["entities"].get(entity["entity_id"], {})
        if entity_override.get("description_en"):
            entity["description_en"] = normalize_text(entity_override["description_en"])
        structured_override = entity_overrides.get(entity["entity_id"], {})
        for field in (
            "location_certainty",
            "record_confidence",
            "review_state",
            "last_reviewed",
            "reviewer",
        ):
            if normalize_text(structured_override.get(field, "")):
                entity[field] = normalize_text(structured_override[field])
        entity["translation_status"] = "machine_assisted_reviewed"
        entities.append(entity)
    entity_by_id = {row["entity_id"]: row for row in entities}
    entities_by_el: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in entities:
        entities_by_el[_fold(row["preferred_name_el"])].append(row)

    names: list[dict[str, str]] = []
    places: list[dict[str, str]] = []
    chronologies: list[dict[str, str]] = []
    relationships: list[dict[str, str]] = []
    entity_sources: list[dict[str, str]] = []
    external_ids: list[dict[str, str]] = []

    for legacy in legacy_rows:
        entity_id = normalize_text(legacy["id"])
        structured_override = entity_overrides.get(entity_id, {})
        primary_url, secondary_url = _effective_source_urls(legacy, entity_source_overrides)
        source = source_by_url[primary_url]
        source_id = source["source_id"]
        review_state = normalize_text(structured_override.get("review_state", "")) or map_review_state(
            legacy["review_status"]
        )

        names.extend(
            [
                {
                    "name_id": f"name-{entity_id}-el-preferred",
                    "entity_id": entity_id,
                    "name": normalize_text(legacy["name_el"]),
                    "language": "el",
                    "script": "Grek",
                    "name_type": "preferred",
                    "is_preferred": "1",
                    "start_year": "",
                    "end_year": "",
                    "source_id": source_id,
                    "review_state": review_state,
                },
                {
                    "name_id": f"name-{entity_id}-en-preferred",
                    "entity_id": entity_id,
                    "name": normalize_text(legacy["name_en"]),
                    "language": "en",
                    "script": "Latn",
                    "name_type": "preferred",
                    "is_preferred": "1",
                    "start_year": "",
                    "end_year": "",
                    "source_id": source_id,
                    "review_state": review_state,
                },
            ]
        )
        ancient_name = normalize_text(legacy["name_ancient"])
        if ancient_name:
            names.append(
                {
                    "name_id": f"name-{entity_id}-grc-ancient",
                    "entity_id": entity_id,
                    "name": ancient_name,
                    "language": "grc",
                    "script": "Grek",
                    "name_type": "ancient",
                    "is_preferred": "0",
                    "start_year": "",
                    "end_year": "",
                    "source_id": source_id,
                    "review_state": review_state,
                }
            )

        country = countries[normalize_text(legacy["modern_country_iso3"])]
        effective_legacy = dict(legacy)
        for field in ("geometry_role", "location_certainty", "spatial_note_el", "coordinate_source"):
            if normalize_text(structured_override.get(field, "")):
                effective_legacy[field] = normalize_text(structured_override[field])
        role = normalize_text(effective_legacy["geometry_role"])
        if normalize_text(structured_override.get("spatial_note_en", "")):
            spatial_note_en = normalize_text(structured_override["spatial_note_en"])
        elif normalize_text(effective_legacy["spatial_note_el"]):
            if role == "representative_center":
                center = translated(legacy["representative_center_el"], "relation_labels")
                spatial_note_en = (
                    f"The point marks {center} as a representative centre; "
                    "it does not represent the polity's territorial extent."
                )
            elif role == "proxy":
                spatial_note_en = (
                    "The point is an approximate spatial marker for the sanctuary within the ancient settlement; "
                    "it is not a surveyed footprint of the monument."
                )
            else:
                spatial_note_en = translated(legacy["spatial_note_el"])
        else:
            spatial_note_en = ""
        places.append(
            normalize_place(
                effective_legacy,
                country=country,
                source_id=source_id,
                spatial_note_en=spatial_note_en,
            )
        )
        places[-1]["review_state"] = review_state
        chronologies.append(
            {
                "chronology_id": f"chronology-{entity_id}-primary",
                "entity_id": entity_id,
                "start_year": str(int(legacy["start_year"])),
                "end_year": str(int(legacy["end_year"])),
                "start_precision": normalize_text(legacy["start_precision"]),
                "end_precision": normalize_text(legacy["end_precision"]),
                "temporal_precision": normalize_text(legacy["temporal_precision"]),
                "chronology_basis": normalize_text(legacy["chronology_basis"]),
                "display_cutoff": _bool(normalize_text(legacy["end_precision"]) == "display_cutoff"),
                "label_el": normalize_text(legacy["date_note_el"]),
                "label_en": _chronology_label_en(legacy),
                "note_el": normalize_text(legacy["chronology_note_el"]),
                "note_en": translated(legacy["chronology_note_el"]),
                "source_id": source_id,
                "review_state": review_state,
            }
        )

        for field, (predicate, authority_type) in RELATION_FIELDS.items():
            label_el = normalize_text(legacy.get(field, ""))
            if not label_el:
                continue
            object_entity_id, object_authority_id = _relationship_target(label_el, authority_type, entities_by_el)
            label_en = (
                entity_by_id[object_entity_id]["preferred_name_en"]
                if object_entity_id
                else translated(label_el, "relation_labels")
            )
            if object_authority_id and object_authority_id not in authorities:
                authorities[object_authority_id] = {
                    "authority_id": object_authority_id,
                    "authority_type": authority_type,
                    "preferred_label_el": label_el,
                    "preferred_label_en": label_en,
                    "uri": "",
                    "source_id": source_id,
                    "review_state": review_state,
                }
            relationship_key = hashlib.sha256(f"{entity_id}|{predicate}|{label_el}".encode("utf-8")).hexdigest()[:12]
            relationships.append(
                {
                    "relationship_id": f"rel-{relationship_key}",
                    "subject_entity_id": entity_id,
                    "predicate": predicate,
                    "object_entity_id": object_entity_id,
                    "object_authority_id": object_authority_id,
                    "object_label_el": label_el,
                    "object_label_en": label_en,
                    "certainty": normalize_text(legacy["location_certainty"]) if predicate == "representative_center" else "medium",
                    "source_id": source_id,
                    "migration_evidence_el": f"{field}: {label_el}",
                    "review_state": review_state,
                }
            )

        for relation_override in relationship_overrides.get(entity_id, []):
            predicate = normalize_text(relation_override["predicate"])
            object_entity_id = normalize_text(relation_override["object_entity_id"])
            target = entity_by_id.get(object_entity_id)
            if target is None:
                raise ValueError(
                    f"Relationship override for {entity_id} targets missing entity {object_entity_id}"
                )
            relationship_key = hashlib.sha256(
                f"{entity_id}|{predicate}|{object_entity_id}".encode("utf-8")
            ).hexdigest()[:12]
            relationships.append(
                {
                    "relationship_id": f"rel-{relationship_key}",
                    "subject_entity_id": entity_id,
                    "predicate": predicate,
                    "object_entity_id": object_entity_id,
                    "object_authority_id": "",
                    "object_label_el": target["preferred_name_el"],
                    "object_label_en": target["preferred_name_en"],
                    "certainty": normalize_text(relation_override.get("certainty", "")) or "high",
                    "source_id": source_id,
                    "migration_evidence_el": normalize_text(relation_override.get("reason_el", "")),
                    "review_state": review_state,
                }
            )

        supporting_sources = [(source_id, "1")]
        if secondary_url and secondary_url != primary_url:
            supporting_sources.append((source_by_url[secondary_url]["source_id"], "0"))
        for supporting_source_id, is_primary in supporting_sources:
            for scope in SOURCE_SUPPORT_SCOPES:
                entity_sources.append(
                    {
                        "entity_source_id": (
                            f"es-{entity_id}-{supporting_source_id.removeprefix('src-')}-{scope}"
                        ),
                        "entity_id": entity_id,
                        "source_id": supporting_source_id,
                        "support_scope": scope,
                        "is_primary": is_primary,
                    }
                )

        pleiades_id = normalize_text(legacy["pleiades_id"])
        if pleiades_id:
            owner_field = "place_id" if entity_by_id[entity_id]["entity_class"] == "polity" else "entity_id"
            external_ids.append(
                {
                    "external_id": f"ext-pleiades-{entity_id}",
                    "entity_id": entity_id if owner_field == "entity_id" else "",
                    "place_id": f"place-{entity_id}" if owner_field == "place_id" else "",
                    "scheme": "pleiades",
                    "identifier": pleiades_id,
                    "uri": f"https://pleiades.stoa.org/places/{pleiades_id}",
                    "match_type": "representative_center" if owner_field == "place_id" else "exact",
                    "source_id": source_id_for_url(f"https://pleiades.stoa.org/places/{pleiades_id}"),
                }
            )

    release = {
        "sources": sources,
        "authorities": list(authorities.values()),
        "entities": entities,
        "names": names,
        "places": places,
        "chronologies": chronologies,
        "relationships": relationships,
        "entity_sources": entity_sources,
        "external_ids": external_ids,
    }
    return {table: sorted(rows, key=lambda row: next(iter(row.values()))) for table, rows in release.items()}
