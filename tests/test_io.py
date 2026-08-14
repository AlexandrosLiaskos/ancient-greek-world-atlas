import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agw_data.io import read_csv  # noqa: E402


class CsvIoTests(unittest.TestCase):
    def test_read_csv_rejects_extra_fields(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "extra.csv"
            path.write_text("a,b\n1,2,3\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, r"extra\.csv:2.*more fields"):
                read_csv(path)

    def test_read_csv_rejects_missing_fields(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "missing.csv"
            path.write_text("a,b\n1\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, r"missing\.csv:2.*fewer fields"):
                read_csv(path)


if __name__ == "__main__":
    unittest.main()
