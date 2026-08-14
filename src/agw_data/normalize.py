from __future__ import annotations

import json
import re
import unicodedata
from typing import Mapping


_GREEK_TO_LATIN = {
    "α": "a",
    "β": "b",
    "γ": "g",
    "δ": "d",
    "ε": "e",
    "ζ": "z",
    "η": "e",
    "θ": "th",
    "ι": "i",
    "κ": "k",
    "λ": "l",
    "μ": "m",
    "ν": "n",
    "ξ": "x",
    "ο": "o",
    "π": "p",
    "ρ": "r",
    "σ": "s",
    "ς": "s",
    "τ": "t",
    "υ": "y",
    "φ": "ph",
    "χ": "ch",
    "ψ": "ps",
    "ω": "o",
}


def normalize_text(value: object) -> str:
    """Return NFC text with control whitespace collapsed and ends trimmed."""
    if value is None:
        return ""
    text = unicodedata.normalize("NFC", str(value))
    return re.sub(r"\s+", " ", text).strip()


def stable_id(prefix: str, label: str) -> str:
    decomposed = unicodedata.normalize("NFKD", normalize_text(label).casefold())
    pieces: list[str] = []
    for char in decomposed:
        if unicodedata.combining(char):
            continue
        pieces.append(_GREEK_TO_LATIN.get(char, char))
    slug = "".join(pieces)
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")
    slug = re.sub(r"-+", "-", slug)
    if not slug:
        raise ValueError(f"Cannot create stable ID from {label!r}")
    return f"{prefix}-{slug}"


def canonical_class(legacy_type: str) -> str:
    mapping = {
        "city": "settlement",
        "colony": "settlement",
        "sanctuary": "sanctuary",
        "kingdom": "polity",
    }
    try:
        return mapping[normalize_text(legacy_type)]
    except KeyError as exc:
        raise ValueError(f"Unsupported legacy entity type: {legacy_type!r}") from exc


def canonical_subtype(legacy_type: str, legacy_subtype: str) -> str:
    entity_type = normalize_text(legacy_type)
    subtype = normalize_text(legacy_subtype)
    if entity_type in {"city", "colony"}:
        return "polis"
    if entity_type == "sanctuary":
        mapping = {
            "healing": "healing_sanctuary",
            "healing_oracle": "healing_sanctuary",
            "oracle": "oracle",
            "panhellenic_oracle": "oracle",
            "mystery": "mystery_sanctuary",
            "peak": "peak_sanctuary",
            "cave": "cave_sanctuary",
            "hero_cult": "hero_shrine",
        }
        return mapping.get(subtype, "cult_place")
    if entity_type == "kingdom":
        if "mycenaean_palatial" in subtype:
            return "palatial_state"
        if subtype == "conquest_empire":
            return "empire"
        if subtype == "cypriot_city_kingdom":
            return "city_kingdom"
        if "client_kingdom" in subtype:
            return "client_kingdom"
        if subtype == "aggregate_regional_monarchies":
            return "aggregate_polities"
        if "phase" in subtype:
            return "dynastic_phase"
        return "kingdom"
    raise ValueError(f"Unsupported legacy entity type: {legacy_type!r}")


def collection_for(legacy_type: str) -> str:
    legacy_type = normalize_text(legacy_type)
    if legacy_type not in {"city", "colony", "sanctuary", "kingdom"}:
        raise ValueError(f"Unsupported collection: {legacy_type!r}")
    return legacy_type


def map_review_state(value: str) -> str:
    return {
        "curated_initial": "reviewed",
        "needs_review": "needs_review",
    }.get(normalize_text(value), "draft")


def normalize_entity(row: Mapping[str, object], *, description_en: str) -> dict[str, str]:
    legacy_type = normalize_text(row.get("entity_type", ""))
    review_state = map_review_state(normalize_text(row.get("review_status", "")))
    location_certainty = normalize_text(row.get("location_certainty", "")) or "unknown"
    record_confidence = "high" if review_state == "reviewed" and location_certainty == "high" else "medium"
    return {
        "entity_id": normalize_text(row.get("id", "")),
        "legacy_id": normalize_text(row.get("id", "")),
        "entity_class": canonical_class(legacy_type),
        "entity_subtype": canonical_subtype(legacy_type, normalize_text(row.get("subtype", ""))),
        "legacy_subtype": normalize_text(row.get("subtype", "")),
        "collections": collection_for(legacy_type),
        "preferred_name_el": normalize_text(row.get("name_el", "")),
        "preferred_name_en": normalize_text(row.get("name_en", "")),
        "ancient_name_grc": normalize_text(row.get("name_ancient", "")),
        "description_el": normalize_text(row.get("description_el", "")),
        "description_en": normalize_text(description_en),
        "sanctuary_scope": normalize_text(row.get("sanctuary_scope", "")),
        "sanctuary_setting": normalize_text(row.get("sanctuary_setting", "")),
        "sanctuary_function_tags": normalize_text(row.get("sanctuary_function_tags", "")),
        "ancient_region_authority_id": stable_id("region", normalize_text(row.get("ancient_region", ""))),
        "temporal_precision": normalize_text(row.get("temporal_precision", "")) or "unknown",
        "location_certainty": location_certainty,
        "record_confidence": record_confidence,
        "review_state": review_state,
        "translation_status": "machine_assisted_unreviewed",
        "data_version": "1.0.0",
        "source_origin": "archaios_ellinikos_kosmos_entities_v0_1.csv",
        "last_reviewed": "2026-08-14",
        "reviewer": "Codex-assisted normalization of user research",
    }


def normalize_place(
    row: Mapping[str, object],
    *,
    country: Mapping[str, str],
    source_id: str,
    spatial_note_en: str,
) -> dict[str, str]:
    latitude = float(normalize_text(row.get("latitude", "")))
    longitude = float(normalize_text(row.get("longitude", "")))
    role = normalize_text(row.get("geometry_role", ""))
    if normalize_text(row.get("entity_type", "")) == "kingdom" and role != "representative_center":
        raise ValueError(f"Polity {row.get('id')} must use a representative-center point")
    precision = {
        "precise": "exact",
        "rough": "approximate",
        "": "unknown",
    }.get(normalize_text(row.get("pleiades_location_precision", "")), "unknown")
    geometry = json.dumps(
        {"coordinates": [longitude, latitude], "type": "Point"},
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return {
        "place_id": f"place-{normalize_text(row.get('id', ''))}",
        "entity_id": normalize_text(row.get("id", "")),
        "latitude": format(latitude, ".8f").rstrip("0").rstrip("."),
        "longitude": format(longitude, ".8f").rstrip("0").rstrip("."),
        "geometry_wkt": normalize_text(row.get("geometry_wkt", "")),
        "geometry_geojson": geometry,
        "geometry_role": role,
        "location_certainty": normalize_text(row.get("location_certainty", "")) or "unknown",
        "location_precision": precision,
        "modern_country_el": normalize_text(row.get("modern_country", "")),
        "modern_country_en": normalize_text(country["name_en"]),
        "country_iso3": normalize_text(row.get("modern_country_iso3", "")),
        "country_iso2": normalize_text(country["iso2"]),
        "modern_locality": normalize_text(row.get("modern_locality", "")),
        "coordinate_source_text": normalize_text(row.get("coordinate_source", "")),
        "spatial_note_el": normalize_text(row.get("spatial_note_el", "")),
        "spatial_note_en": normalize_text(spatial_note_en),
        "source_id": source_id,
        "review_state": map_review_state(normalize_text(row.get("review_status", ""))),
    }
