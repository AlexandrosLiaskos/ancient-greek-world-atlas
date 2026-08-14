from __future__ import annotations

import argparse
import filecmp
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agw_data.io import write_release  # noqa: E402
from agw_data.release import build_release  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Build canonical Ancient Greek World Atlas data tables")
    parser.add_argument("--raw", type=Path, required=True)
    parser.add_argument("--canonical", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    release = build_release(args.raw, ROOT)
    if args.check:
        with tempfile.TemporaryDirectory(prefix="agw-build-check-") as temp:
            candidate = Path(temp)
            write_release(ROOT, candidate, release)
            expected_files = sorted(candidate.glob("*.csv"))
            mismatches = [
                path.name
                for path in expected_files
                if not (args.canonical / path.name).exists()
                or not filecmp.cmp(path, args.canonical / path.name, shallow=False)
            ]
            if mismatches:
                print("canonical tables are stale: " + ", ".join(mismatches), file=sys.stderr)
                return 1
    else:
        write_release(ROOT, args.canonical, release)
    print(" ".join(f"{table}={len(rows)}" for table, rows in sorted(release.items())))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
