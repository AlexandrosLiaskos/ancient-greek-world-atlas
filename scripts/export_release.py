from __future__ import annotations

import argparse
import filecmp
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agw_data.export import EXPORT_NAMES, build_exports  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Build static Ancient Greek World data exports")
    parser.add_argument("--canonical", type=Path, required=True)
    parser.add_argument("--dist", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    if args.check:
        with tempfile.TemporaryDirectory(prefix="agw-export-check-") as temp:
            candidate = Path(temp)
            build_exports(args.canonical, candidate, root=ROOT)
            names = (*EXPORT_NAMES, "SHA256SUMS")
            mismatches = [
                name
                for name in names
                if not (args.dist / name).exists()
                or not filecmp.cmp(candidate / name, args.dist / name, shallow=False)
            ]
            if mismatches:
                print("distribution is stale: " + ", ".join(mismatches), file=sys.stderr)
                return 1
            print(f"status=match files={len(names)}")
            return 0

    hashes = build_exports(args.canonical, args.dist, root=ROOT)
    print(f"status=built files={len(hashes)} entities=226")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
