from __future__ import annotations

import argparse
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agw_data.validate import validate_release, write_reports  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate the canonical Ancient Greek World release")
    parser.add_argument("--canonical", type=Path, required=True)
    parser.add_argument("--report-dir", type=Path, required=True)
    args = parser.parse_args()

    report = validate_release(args.canonical, root=ROOT)
    write_reports(report, args.report_dir)
    print(
        f"status={'pass' if report.error_count == 0 else 'fail'} "
        f"errors={report.error_count} warnings={report.warning_count}"
    )
    for issue in report.errors:
        print(f"ERROR {issue.code} {issue.table} {issue.record_id}: {issue.message}", file=sys.stderr)
    return 0 if report.error_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
