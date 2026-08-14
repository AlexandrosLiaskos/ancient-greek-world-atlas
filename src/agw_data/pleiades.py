from __future__ import annotations

import json
import math
import re
import time
import urllib.request
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse


@dataclass(frozen=True)
class PointComparison:
    distance_m: float


@dataclass(frozen=True)
class ReconciliationResult:
    status: str
    distance_m: float | None
    record: dict[str, Any]
    note: str


def pleiades_id_from_uri(uri: str) -> str | None:
    parsed = urlparse(uri.strip())
    if parsed.netloc.casefold() != "pleiades.stoa.org":
        return None
    match = re.fullmatch(r"/places/(\d+)/?", parsed.path)
    return match.group(1) if match else None


def _latest_modified(payload: dict[str, Any]) -> str:
    if payload.get("modified"):
        return str(payload["modified"])
    values = [
        str(event["modified"])
        for event in payload.get("history", [])
        if isinstance(event, dict) and event.get("modified")
    ]
    return max(values, default="")


def extract_record(payload: dict[str, Any], *, retrieved_on: str) -> dict[str, Any]:
    names = []
    for item in payload.get("names", []):
        if not isinstance(item, dict):
            continue
        names.append(
            {
                "attested": item.get("attested", ""),
                "romanized": item.get("romanized", ""),
                "language": item.get("language", ""),
                "name_type": item.get("nameType", ""),
                "start": item.get("start"),
                "end": item.get("end"),
                "uri": item.get("uri", ""),
            }
        )
    contributors = []
    for item in [*payload.get("creators", []), *payload.get("contributors", [])]:
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("fullname") or item.get("username")
        if name and name not in contributors:
            contributors.append(name)
    point = payload.get("reprPoint")
    if not (
        isinstance(point, list)
        and len(point) >= 2
        and all(isinstance(value, (int, float)) for value in point[:2])
    ):
        point = None
    return {
        "pleiades_id": str(payload.get("id", "")),
        "uri": str(payload.get("uri", "")),
        "title": str(payload.get("title", "")),
        "description": str(payload.get("description", "")),
        "representative_point": point[:2] if point else None,
        "bbox": payload.get("bbox"),
        "place_types": list(payload.get("placeTypes", [])),
        "place_type_uris": list(payload.get("placeTypeURIs", [])),
        "names": names,
        "contributors": contributors,
        "review_state": str(payload.get("review_state", "")),
        "rights": str(payload.get("rights", "")),
        "created": str(payload.get("created", "")),
        "modified": _latest_modified(payload),
        "retrieved_on": retrieved_on,
    }


def compare_points(local_point: tuple[float, float], reference_point: tuple[float, float]) -> PointComparison:
    """Compare (longitude, latitude) points using a haversine distance."""
    lon1, lat1 = local_point
    lon2, lat2 = reference_point
    radius_m = 6_371_008.8
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    distance = 2 * radius_m * math.asin(math.sqrt(a))
    return PointComparison(distance_m=distance)


def reconcile_pleiades(
    *,
    pleiades_id: str,
    canonical_uri: str,
    payload: dict[str, Any],
    local_point: tuple[float, float],
) -> ReconciliationResult:
    record = extract_record(payload, retrieved_on="2026-08-15")
    if str(record["pleiades_id"]) != str(pleiades_id):
        return ReconciliationResult("id_mismatch", None, record, "Payload ID differs from declared ID")
    if pleiades_id_from_uri(canonical_uri) != str(pleiades_id):
        return ReconciliationResult("uri_mismatch", None, record, "Canonical URI differs from declared ID")
    if pleiades_id_from_uri(record["uri"]) != str(pleiades_id):
        return ReconciliationResult("uri_mismatch", None, record, "Payload URI differs from declared ID")
    point = record["representative_point"]
    if point is None:
        return ReconciliationResult("matched_without_point", None, record, "Pleiades record has no representative point")
    distance = compare_points(local_point, (float(point[0]), float(point[1]))).distance_m
    return ReconciliationResult("matched", distance, record, "Coordinates compared; local data not overwritten")


def fetch_place(pleiades_id: str, *, retrieved_on: str, retries: int = 4) -> dict[str, Any]:
    uri = f"https://pleiades.stoa.org/places/{pleiades_id}/json"
    request = urllib.request.Request(
        uri,
        headers={"User-Agent": "AncientGreekWorldAtlasData/1.0 (+scholarly-data-build)"},
    )
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = json.loads(response.read().decode("utf-8"))
            return extract_record(payload, retrieved_on=retrieved_on)
        except Exception as exc:
            last_error = exc
            time.sleep(0.75 * (2**attempt))
    raise RuntimeError(f"Unable to fetch Pleiades {pleiades_id}") from last_error
