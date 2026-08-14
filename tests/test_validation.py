import csv
import shutil
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agw_data.validate import validate_release  # noqa: E402


class ValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="agw-validation-")
        self.canonical = Path(self.temp.name) / "canonical"
        shutil.copytree(ROOT / "data" / "canonical", self.canonical)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def _mutate(self, table: str, mutate) -> None:
        path = self.canonical / f"{table}.csv"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            rows = list(reader)
            fields = list(reader.fieldnames or [])
        mutate(rows)
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)

    def test_canonical_release_has_no_validation_errors(self) -> None:
        report = validate_release(self.canonical, root=ROOT)
        self.assertEqual(report.error_count, 0, report.errors)

    def test_validator_rejects_year_zero(self) -> None:
        self._mutate("chronologies", lambda rows: rows[0].update(start_year="0"))
        report = validate_release(self.canonical, root=ROOT)
        self.assertIn("CHRONOLOGY_YEAR_ZERO", report.error_codes)

    def test_validator_rejects_unmarked_polity_point(self) -> None:
        entity_id = next(
            row["entity_id"]
            for row in self._read("entities")
            if row["entity_class"] == "polity"
        )
        self._mutate(
            "places",
            lambda rows: next(row for row in rows if row["entity_id"] == entity_id).update(
                geometry_role="site"
            ),
        )
        report = validate_release(self.canonical, root=ROOT)
        self.assertIn("POLITY_POINT_ROLE", report.error_codes)

    def test_validator_rejects_missing_geometry_source_support(self) -> None:
        entity_id = self._read("entities")[0]["entity_id"]
        self._mutate(
            "entity_sources",
            lambda rows: rows.__setitem__(
                slice(None),
                [
                    row
                    for row in rows
                    if not (row["entity_id"] == entity_id and row["support_scope"] == "geometry")
                ],
            ),
        )
        report = validate_release(self.canonical, root=ROOT)
        self.assertIn("SOURCE_SUPPORT_GEOMETRY", report.error_codes)

    def test_validator_rejects_bilingual_description_gap(self) -> None:
        self._mutate("entities", lambda rows: rows[0].update(description_en=""))
        report = validate_release(self.canonical, root=ROOT)
        self.assertIn("BILINGUAL_ENTITY_DESCRIPTION", report.error_codes)

    def test_validator_rejects_relationship_with_two_targets(self) -> None:
        authority_id = self._read("authorities")[0]["authority_id"]
        self._mutate(
            "relationships",
            lambda rows: next(row for row in rows if row["object_entity_id"]).update(
                object_authority_id=authority_id
            ),
        )
        report = validate_release(self.canonical, root=ROOT)
        self.assertIn("RELATIONSHIP_TARGET_CARDINALITY", report.error_codes)

    def _read(self, table: str) -> list[dict[str, str]]:
        path = self.canonical / f"{table}.csv"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            return list(csv.DictReader(handle))


if __name__ == "__main__":
    unittest.main()
