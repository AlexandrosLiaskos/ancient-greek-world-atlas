from __future__ import annotations

import argparse
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agw_data.io import read_csv  # noqa: E402
from agw_data.translate import TranslationCache, collect_texts, populate_cache  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Populate the checked-in Greek-to-English translation cache")
    parser.add_argument(
        "--raw",
        type=Path,
        default=ROOT / "data" / "raw" / "archaios_ellinikos_kosmos_entities_v0_1.csv",
    )
    parser.add_argument(
        "--cache",
        type=Path,
        default=ROOT / "data" / "research" / "translations-el-en.json",
    )
    parser.add_argument("--workers", type=int, default=12)
    args = parser.parse_args()

    rows = read_csv(args.raw)
    cache = TranslationCache(args.cache)
    completed, total = populate_cache(cache, collect_texts(rows), workers=args.workers)
    print(f"translations_added={completed} translations_total={total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
