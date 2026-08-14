from __future__ import annotations

import hashlib
import json
import sqlite3
from collections import defaultdict
from pathlib import Path

from .io import read_csv
from .validate import validate_release


EXPORT_NAMES = (
    "ancient-greek-world.sqlite",
    "ancient-greek-world.json",
    "ancient-greek-world.geojson",
    "ancient-greek-world-linked-places.jsonld",
)

INSERT_ORDER = (
    "sources",
    "authorities",
    "entities",
    "names",
    "places",
    "chronologies",
    "relationships",
    "entity_sources",
    "external_ids",
)


def _load_contract(root: Path) -> dict:
    return json.loads((root / "schema" / "tables.json").read_text(encoding="utf-8"))["tables"]


def _load_tables(canonical: Path, contract: dict) -> dict[str, list[dict[str, str]]]:
    return {table: read_csv(canonical / f"{table}.csv") for table in contract}


def _typed_value(value: str, spec: dict):
    if value == "":
        return None
    kind = spec.get("type")
    if kind == "integer":
        return int(value)
    if kind == "number":
        return float(value)
    if kind == "boolean":
        return value == "1"
    if kind == "json":
        return json.loads(value)
    return value


def _typed_row(row: dict[str, str], schema: dict) -> dict:
    return {column: _typed_value(row.get(column, ""), spec) for column, spec in schema["columns"].items()}


def _sqlite_value(value: str, spec: dict):
    typed = _typed_value(value, spec)
    if isinstance(typed, bool):
        return int(typed)
    if isinstance(typed, (dict, list)):
        return json.dumps(typed, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return typed


def _write_json(path: Path, payload: dict) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _build_sqlite(
    path: Path,
    tables: dict[str, list[dict[str, str]]],
    contract: dict,
    root: Path,
) -> None:
    if path.exists():
        path.unlink()
    database = sqlite3.connect(path)
    try:
        database.execute("PRAGMA page_size = 4096")
        database.execute("PRAGMA journal_mode = OFF")
        database.execute("PRAGMA synchronous = OFF")
        database.executescript((root / "schema" / "database.sql").read_text(encoding="utf-8"))
        database.execute("PRAGMA application_id = 1095190321")  # ASCII-ish AGW1
        database.execute("PRAGMA user_version = 10000")
        for table in INSERT_ORDER:
            schema = contract[table]
            columns = list(schema["columns"])
            placeholders = ",".join("?" for _ in columns)
            sql = f"INSERT INTO {table} ({','.join(columns)}) VALUES ({placeholders})"
            primary_key = schema["primary_key"]
            values = [
                tuple(_sqlite_value(row.get(column, ""), schema["columns"][column]) for column in columns)
                for row in sorted(tables[table], key=lambda item: item[primary_key])
            ]
            database.executemany(sql, values)
        violations = database.execute("PRAGMA foreign_key_check").fetchall()
        if violations:
            raise ValueError(f"SQLite foreign-key violations: {violations!r}")
        database.commit()
        database.execute("VACUUM")
    finally:
        database.close()


def _group(rows: list[dict[str, str]], field: str) -> dict[str, list[dict[str, str]]]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        grouped[row.get(field, "")].append(row)
    return grouped


def _entity_json(tables: dict[str, list[dict[str, str]]], contract: dict, version: str, generated_on: str) -> dict:
    names = _group(tables["names"], "entity_id")
    places = _group(tables["places"], "entity_id")
    chronologies = _group(tables["chronologies"], "entity_id")
    relationships = _group(tables["relationships"], "subject_entity_id")
    support = _group(tables["entity_sources"], "entity_id")
    sources = {row["source_id"]: row for row in tables["sources"]}
    external_by_entity = _group(tables["external_ids"], "entity_id")
    external_by_place = _group(tables["external_ids"], "place_id")
    place_schema = contract["places"]

    entities = []
    for entity_row in sorted(tables["entities"], key=lambda row: row["entity_id"]):
        entity_id = entity_row["entity_id"]
        item = _typed_row(entity_row, contract["entities"])
        item["names"] = [
            _typed_row(row, contract["names"])
            for row in sorted(names.get(entity_id, []), key=lambda row: row["name_id"])
        ]
        item["places"] = [
            _typed_row(row, place_schema)
            for row in sorted(places.get(entity_id, []), key=lambda row: row["place_id"])
        ]
        item["chronologies"] = [
            _typed_row(row, contract["chronologies"])
            for row in sorted(chronologies.get(entity_id, []), key=lambda row: row["chronology_id"])
        ]
        item["relationships"] = [
            _typed_row(row, contract["relationships"])
            for row in sorted(relationships.get(entity_id, []), key=lambda row: row["relationship_id"])
        ]
        item["source_support"] = []
        for link in sorted(support.get(entity_id, []), key=lambda row: row["entity_source_id"]):
            source = sources[link["source_id"]]
            item["source_support"].append(
                {
                    "source_id": link["source_id"],
                    "support_scope": link["support_scope"],
                    "is_primary": link["is_primary"] == "1",
                    "title": source["title"],
                    "publisher": source["publisher"],
                    "url": source["url"],
                    "citation": source["citation"],
                }
            )
        external = list(external_by_entity.get(entity_id, []))
        for place in places.get(entity_id, []):
            external.extend(external_by_place.get(place["place_id"], []))
        item["external_ids"] = [
            _typed_row(row, contract["external_ids"])
            for row in sorted(external, key=lambda row: row["external_id"])
        ]
        entities.append(item)

    return {
        "dataset": {
            "title_el": "Άτλας του Αρχαίου Ελληνικού Κόσμου — Βάση δεδομένων",
            "title_en": "Ancient Greek World Atlas — Data Foundation",
            "version": version,
            "generated_on": generated_on,
            "license_note": "Original compilation and third-party records retain their respective licences; see LICENSE-DATA.",
            "entity_count": len(entities),
        },
        "entities": entities,
        "authorities": [
            _typed_row(row, contract["authorities"])
            for row in sorted(tables["authorities"], key=lambda row: row["authority_id"])
        ],
        "sources": [
            _typed_row(row, contract["sources"])
            for row in sorted(tables["sources"], key=lambda row: row["source_id"])
        ],
    }


def _geojson(tables: dict[str, list[dict[str, str]]], version: str, generated_on: str) -> dict:
    entities = {row["entity_id"]: row for row in tables["entities"]}
    chronology = {row["entity_id"]: row for row in tables["chronologies"]}
    external_by_entity = _group(tables["external_ids"], "entity_id")
    external_by_place = _group(tables["external_ids"], "place_id")
    features = []
    for place in sorted(tables["places"], key=lambda row: row["entity_id"]):
        entity = entities[place["entity_id"]]
        temporal = chronology[place["entity_id"]]
        external = list(external_by_entity.get(place["entity_id"], [])) + list(
            external_by_place.get(place["place_id"], [])
        )
        features.append(
            {
                "type": "Feature",
                "id": entity["entity_id"],
                "geometry": json.loads(place["geometry_geojson"]),
                "properties": {
                    "entity_id": entity["entity_id"],
                    "name_el": entity["preferred_name_el"],
                    "name_en": entity["preferred_name_en"],
                    "ancient_name_grc": entity["ancient_name_grc"] or None,
                    "description_el": entity["description_el"],
                    "description_en": entity["description_en"],
                    "entity_class": entity["entity_class"],
                    "entity_subtype": entity["entity_subtype"],
                    "collections": entity["collections"].split("|") if entity["collections"] else [],
                    "start_year": int(temporal["start_year"]),
                    "end_year": int(temporal["end_year"]),
                    "chronology_basis": temporal["chronology_basis"],
                    "date_label_el": temporal["label_el"],
                    "date_label_en": temporal["label_en"],
                    "geometry_role": place["geometry_role"],
                    "location_certainty": place["location_certainty"],
                    "spatial_note_el": place["spatial_note_el"] or None,
                    "spatial_note_en": place["spatial_note_en"] or None,
                    "country_iso3": place["country_iso3"],
                    "country_iso2": place["country_iso2"],
                    "modern_country_el": place["modern_country_el"],
                    "modern_country_en": place["modern_country_en"],
                    "modern_locality": place["modern_locality"] or None,
                    "record_confidence": entity["record_confidence"],
                    "review_state": entity["review_state"],
                    "source_id": place["source_id"],
                    "external_links": [row["uri"] for row in sorted(external, key=lambda row: row["uri"])],
                },
            }
        )
    longitudes = [feature["geometry"]["coordinates"][0] for feature in features]
    latitudes = [feature["geometry"]["coordinates"][1] for feature in features]
    return {
        "type": "FeatureCollection",
        "name": "Ancient Greek World Atlas Data Foundation",
        "version": version,
        "generated_on": generated_on,
        "bbox": [min(longitudes), min(latitudes), max(longitudes), max(latitudes)],
        "features": features,
    }


def _linked_places(tables: dict[str, list[dict[str, str]]], version: str, generated_on: str) -> dict:
    entities = {row["entity_id"]: row for row in tables["entities"]}
    names = _group(tables["names"], "entity_id")
    chronology = {row["entity_id"]: row for row in tables["chronologies"]}
    relationships = _group(tables["relationships"], "subject_entity_id")
    support = _group(tables["entity_sources"], "entity_id")
    sources = {row["source_id"]: row for row in tables["sources"]}
    external_by_entity = _group(tables["external_ids"], "entity_id")
    external_by_place = _group(tables["external_ids"], "place_id")

    features = []
    for place in sorted(tables["places"], key=lambda row: row["entity_id"]):
        entity_id = place["entity_id"]
        entity = entities[entity_id]
        temporal = chronology[entity_id]
        citation_ids = sorted({row["source_id"] for row in support.get(entity_id, [])})
        external = list(external_by_entity.get(entity_id, [])) + list(
            external_by_place.get(place["place_id"], [])
        )
        links = [
            {"identifier": row["uri"], "type": "closeMatch"}
            for row in sorted(external, key=lambda row: row["uri"])
        ]
        links.extend(
            {"identifier": sources[source_id]["url"], "type": "source"}
            for source_id in citation_ids
        )
        feature_relations = []
        for relation in sorted(relationships.get(entity_id, []), key=lambda row: row["relationship_id"]):
            target = (
                f"urn:agw:{relation['object_entity_id']}"
                if relation["object_entity_id"]
                else f"urn:agw:authority:{relation['object_authority_id']}"
            )
            feature_relations.append(
                {
                    "relationType": relation["predicate"],
                    "relationTo": target,
                    "label": {
                        "el": relation["object_label_el"],
                        "en": relation["object_label_en"],
                    },
                    "certainty": relation["certainty"],
                    "citations": [sources[relation["source_id"]]["url"]],
                }
            )
        features.append(
            {
                "@id": f"urn:agw:{entity_id}",
                "type": "Feature",
                "properties": {
                    "identifier": entity_id,
                    "title": entity["preferred_name_en"],
                    "title_el": entity["preferred_name_el"],
                    "description": entity["description_en"],
                    "description_el": entity["description_el"],
                    "ccodes": [place["country_iso2"]],
                    "fclasses": [entity["entity_class"]],
                    "geometry_role": place["geometry_role"],
                    "certainty": entity["record_confidence"],
                },
                "geometry": json.loads(place["geometry_geojson"]),
                "names": [
                    {
                        "toponym": row["name"],
                        "lang": row["language"],
                        "nameType": row["name_type"],
                        "citations": [sources[row["source_id"]]["url"]],
                    }
                    for row in sorted(names.get(entity_id, []), key=lambda row: row["name_id"])
                ],
                "types": [
                    {
                        "identifier": f"urn:agw:type:{entity['entity_subtype']}",
                        "label": entity["entity_subtype"].replace("_", " "),
                        "sourceLabel": entity["entity_class"],
                    }
                ],
                "when": {
                    "timespans": [
                        {
                            "start": {"in": int(temporal["start_year"])},
                            "end": {"in": int(temporal["end_year"])},
                            "label": temporal["label_en"],
                            "label_el": temporal["label_el"],
                            "basis": temporal["chronology_basis"],
                            "precision": temporal["temporal_precision"],
                        }
                    ]
                },
                "relations": feature_relations,
                "links": links,
            }
        )
    return {
        "@context": [
            "https://linkedpasts.org/assets/linkedplaces-context-v1.1.jsonld",
            {"agw": "urn:agw:"},
        ],
        "@id": "urn:agw:dataset:ancient-greek-world-1.0.0",
        "type": "FeatureCollection",
        "title": "Ancient Greek World Atlas Data Foundation",
        "version": version,
        "generated_on": generated_on,
        "features": features,
    }


def _write_manifest(dist: Path) -> dict[str, str]:
    hashes = {
        name: hashlib.sha256((dist / name).read_bytes()).hexdigest()
        for name in sorted(EXPORT_NAMES)
    }
    (dist / "SHA256SUMS").write_text(
        "".join(f"{digest}  {name}\n" for name, digest in hashes.items()),
        encoding="utf-8",
    )
    return hashes


def build_exports(canonical: Path, dist: Path, *, root: Path | None = None) -> dict[str, str]:
    canonical = Path(canonical)
    dist = Path(dist)
    root = Path(root) if root else Path(__file__).resolve().parents[2]
    report = validate_release(canonical, root=root)
    if report.error_count:
        codes = ", ".join(sorted(report.error_codes))
        raise ValueError(f"Canonical release has {report.error_count} validation errors: {codes}")
    contract = _load_contract(root)
    tables = _load_tables(canonical, contract)
    dist.mkdir(parents=True, exist_ok=True)
    version = report.dataset_version
    generated_on = report.generated_on

    _build_sqlite(dist / "ancient-greek-world.sqlite", tables, contract, root)
    _write_json(
        dist / "ancient-greek-world.json",
        _entity_json(tables, contract, version, generated_on),
    )
    _write_json(
        dist / "ancient-greek-world.geojson",
        _geojson(tables, version, generated_on),
    )
    _write_json(
        dist / "ancient-greek-world-linked-places.jsonld",
        _linked_places(tables, version, generated_on),
    )
    return _write_manifest(dist)
