from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Iterable, Mapping


def read_csv(path: Path) -> list[dict[str, str]]:
    with Path(path).open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def load_table_contract(root: Path) -> dict[str, dict]:
    payload = json.loads((Path(root) / "schema" / "tables.json").read_text(encoding="utf-8"))
    return payload["tables"]


def write_csv(path: Path, rows: Iterable[Mapping[str, object]], fieldnames: list[str]) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    sorted_rows = list(rows)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n", extrasaction="raise")
        writer.writeheader()
        for row in sorted_rows:
            writer.writerow({field: row.get(field, "") for field in fieldnames})


def write_release(root: Path, output_dir: Path, release: Mapping[str, list[dict[str, str]]]) -> None:
    contract = load_table_contract(root)
    output_dir = Path(output_dir)
    for table_name, table in contract.items():
        primary_key = table["primary_key"]
        rows = sorted(release[table_name], key=lambda row: row[primary_key])
        write_csv(output_dir / f"{table_name}.csv", rows, list(table["columns"]))
