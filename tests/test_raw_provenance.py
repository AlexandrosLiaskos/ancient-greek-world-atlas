import hashlib
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAW_FILE = ROOT / "data" / "raw" / "archaios_ellinikos_kosmos_entities_v0_1.csv"
CHECKSUM_FILE = ROOT / "data" / "raw" / "SHA256SUMS"


class RawProvenanceTests(unittest.TestCase):
    def test_raw_csv_matches_recorded_sha256(self) -> None:
        expected = CHECKSUM_FILE.read_text(encoding="utf-8").split()[0]
        actual = hashlib.sha256(RAW_FILE.read_bytes()).hexdigest()
        self.assertEqual(actual, expected)

    def test_raw_csv_has_expected_shape(self) -> None:
        import csv

        with RAW_FILE.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            rows = list(reader)
        self.assertEqual(len(rows), 226)
        self.assertEqual(len(reader.fieldnames or []), 42)
        self.assertEqual(len({row["id"] for row in rows}), 226)


if __name__ == "__main__":
    unittest.main()
