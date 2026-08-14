import csv
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agw_data.io import read_csv  # noqa: E402
from agw_data.release import build_release  # noqa: E402


class EditorialGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        raw = ROOT / "data" / "raw" / "archaios_ellinikos_kosmos_entities_v0_1.csv"
        cls.raw_rows = read_csv(raw)
        cls.release = build_release(raw, ROOT)

    def test_every_legacy_review_flag_has_a_documented_decision(self) -> None:
        expected = {row["id"] for row in self.raw_rows if row["review_status"] == "needs_review"}
        path = ROOT / "data" / "research" / "review-decisions.csv"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            decisions = list(csv.DictReader(handle))
        self.assertEqual({row["entity_id"] for row in decisions}, expected)
        self.assertEqual(len(decisions), 19)
        self.assertTrue(all(row["evidence_url"] for row in decisions))
        self.assertTrue(all(row["decision_el"] and row["decision_en"] for row in decisions))

    def test_no_public_record_remains_needs_review_or_draft(self) -> None:
        for table in ("entities", "names", "places", "chronologies", "relationships", "authorities"):
            unresolved = [
                row
                for row in self.release[table]
                if row.get("review_state") in {"needs_review", "draft"}
            ]
            self.assertFalse(unresolved, table)

    def test_reviewed_uncertainty_is_not_erased(self) -> None:
        entities = {row["entity_id"]: row for row in self.release["entities"]}
        self.assertEqual(entities["colony-phasis-city"]["location_certainty"], "medium")
        self.assertEqual(entities["kingdom-indo-greek-late"]["record_confidence"], "medium")
        places = {row["entity_id"]: row for row in self.release["places"]}
        self.assertEqual(places["sanctuary-golgoi-aphrodite-sanctuary"]["geometry_role"], "proxy")

    def test_candidate_audit_has_explicit_decisions(self) -> None:
        candidates = read_csv(ROOT / "data" / "research" / "candidates.csv")
        self.assertGreaterEqual(len(candidates), 12)
        self.assertTrue(all(row["decision"] in {"include", "defer", "exclude"} for row in candidates))
        self.assertTrue(all(row["reason_el"] and row["reason_en"] for row in candidates))


if __name__ == "__main__":
    unittest.main()
