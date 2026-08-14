from __future__ import annotations

import argparse
import csv
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agw_data.io import read_csv, write_csv  # noqa: E402
from agw_data.pleiades import compare_points, fetch_place  # noqa: E402
from agw_data.sources import check_url  # noqa: E402


RETRIEVED_ON = "2026-08-15"


def fetch_pleiades(rows: list[dict[str, str]], *, workers: int) -> dict[str, dict]:
    ids = sorted({row["pleiades_id"] for row in rows if row["pleiades_id"]})
    records: dict[str, dict] = {}
    failures: list[str] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fetch_place, pid, retrieved_on=RETRIEVED_ON): pid for pid in ids}
        for future in as_completed(futures):
            pid = futures[future]
            try:
                records[pid] = future.result()
            except Exception:
                failures.append(pid)
    if failures:
        raise RuntimeError("Pleiades fetch failed for: " + ", ".join(sorted(failures)))
    path = ROOT / "data" / "reference" / "pleiades" / "records.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "dataset": "Pleiades individual canonical place records",
        "license": "CC BY 3.0",
        "retrieved_on": RETRIEVED_ON,
        "record_count": len(records),
        "records": dict(sorted(records.items())),
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return records


def write_reconciliation(rows: list[dict[str, str]], records: dict[str, dict]) -> None:
    output = []
    for row in rows:
        pid = row["pleiades_id"]
        if not pid:
            continue
        record = records[pid]
        reference = record.get("representative_point")
        distance = ""
        if reference:
            distance = f"{compare_points((float(row['longitude']), float(row['latitude'])), (float(reference[0]), float(reference[1]))).distance_m:.2f}"
        output.append(
            {
                "entity_id": row["id"],
                "pleiades_id": pid,
                "status": "matched" if record["pleiades_id"] == pid else "id_mismatch",
                "local_longitude": row["longitude"],
                "local_latitude": row["latitude"],
                "pleiades_longitude": reference[0] if reference else "",
                "pleiades_latitude": reference[1] if reference else "",
                "distance_m": distance,
                "geometry_role": row["geometry_role"],
                "local_location_certainty": row["location_certainty"],
                "pleiades_title": record["title"],
                "pleiades_modified": record["modified"],
                "retrieved_on": RETRIEVED_ON,
                "decision": "retain_local_and_report_distance",
            }
        )
    fields = list(output[0])
    write_csv(ROOT / "data" / "research" / "pleiades-reconciliation.csv", output, fields)


def check_sources(rows: list[dict[str, str]], *, workers: int) -> None:
    urls = sorted(
        {
            url
            for row in rows
            for url in (row["source_url"], row["secondary_source_url"])
            if url
        }
    )
    checks = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(check_url, url, checked_on=RETRIEVED_ON): url for url in urls}
        for future in as_completed(futures):
            checks.append(future.result())
    output = [
        {
            "url": item.url,
            "checked_on": item.checked_on,
            "http_status": item.http_status if item.http_status is not None else "",
            "url_status": item.url_status,
            "final_url": item.final_url,
            "title": item.title,
            "error": item.error,
        }
        for item in sorted(checks, key=lambda item: item.url)
    ]
    write_csv(ROOT / "data" / "research" / "source-checks.csv", output, list(output[0]))


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch and cache authoritative reference metadata")
    parser.add_argument("--pleiades", action="store_true")
    parser.add_argument("--check-sources", action="store_true")
    parser.add_argument("--workers", type=int, default=12)
    args = parser.parse_args()
    if not args.pleiades and not args.check_sources:
        parser.error("select --pleiades and/or --check-sources")
    rows = read_csv(ROOT / "data" / "raw" / "archaios_ellinikos_kosmos_entities_v0_1.csv")
    records: dict[str, dict] = {}
    if args.pleiades:
        records = fetch_pleiades(rows, workers=args.workers)
        write_reconciliation(rows, records)
    if args.check_sources:
        check_sources(rows, workers=args.workers)
    print(f"pleiades_records={len(records)} source_urls={len({r['source_url'] for r in rows})}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
