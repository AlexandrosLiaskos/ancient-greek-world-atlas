import csv
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agw_data.release import build_release  # noqa: E402


class RelationshipTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        raw = ROOT / "data" / "raw" / "archaios_ellinikos_kosmos_entities_v0_1.csv"
        cls.release = build_release(raw, ROOT)

    def test_every_relationship_has_exactly_one_valid_target(self) -> None:
        entity_ids = {row["entity_id"] for row in self.release["entities"]}
        authority_ids = {row["authority_id"] for row in self.release["authorities"]}
        for relation in self.release["relationships"]:
            targets = bool(relation["object_entity_id"]) + bool(relation["object_authority_id"])
            self.assertEqual(targets, 1, relation["relationship_id"])
            if relation["object_entity_id"]:
                self.assertIn(relation["object_entity_id"], entity_ids)
            if relation["object_authority_id"]:
                self.assertIn(relation["object_authority_id"], authority_ids)

    def test_explicit_sanctuary_settlement_links_are_migrated(self) -> None:
        links = {
            (row["subject_entity_id"], row["predicate"], row["object_entity_id"])
            for row in self.release["relationships"]
        }
        self.assertIn(
            (
                "sanctuary-athens-acropolis-sacred-center",
                "associated_with_settlement",
                "city-athens-attica",
            ),
            links,
        )
        self.assertIn(
            (
                "sanctuary-naukratis-hellenion",
                "associated_with_settlement",
                "colony-naucratis",
            ),
            links,
        )

    def test_relationship_override_targets_and_sources_are_declared(self) -> None:
        path = ROOT / "data" / "research" / "relationship-overrides.csv"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
        self.assertGreaterEqual(len(rows), 20)
        self.assertTrue(all(row["object_entity_id"] for row in rows))
        self.assertTrue(all(row["reason_el"] and row["reason_en"] for row in rows))


if __name__ == "__main__":
    unittest.main()
