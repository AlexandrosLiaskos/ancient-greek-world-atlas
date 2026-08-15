import sys
import unittest
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agw_data.io import read_csv  # noqa: E402
from agw_data.release import build_release  # noqa: E402


class ImportReleaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.raw_path = ROOT / "data" / "raw" / "archaios_ellinikos_kosmos_entities_v0_1.csv"
        cls.release = build_release(cls.raw_path, ROOT)

    def test_release_preserves_all_legacy_entities(self) -> None:
        legacy_ids = {row["id"] for row in read_csv(self.raw_path)}
        entities = self.release["entities"]
        self.assertEqual(len(entities), 226)
        self.assertEqual({row["entity_id"] for row in entities}, legacy_ids)

    def test_canonical_classes_replace_mutually_exclusive_colony_type(self) -> None:
        counts = Counter(row["entity_class"] for row in self.release["entities"])
        self.assertEqual(counts, {"settlement": 119, "sanctuary": 70, "polity": 37})
        colonies = [row for row in self.release["entities"] if row["collections"] == "colony"]
        self.assertEqual(len(colonies), 78)
        self.assertTrue(all(row["entity_class"] == "settlement" for row in colonies))

    def test_every_entity_has_greek_and_english_public_text(self) -> None:
        for row in self.release["entities"]:
            self.assertTrue(row["preferred_name_el"].strip(), row["entity_id"])
            self.assertTrue(row["preferred_name_en"].strip(), row["entity_id"])
            self.assertTrue(row["description_el"].strip(), row["entity_id"])
            self.assertTrue(row["description_en"].strip(), row["entity_id"])

    def test_release_separates_entity_space_time_and_names(self) -> None:
        self.assertEqual(len(self.release["places"]), 226)
        self.assertEqual(len(self.release["chronologies"]), 226)
        self.assertGreaterEqual(len(self.release["names"]), 452)
        self.assertGreaterEqual(len(self.release["authorities"]), 18)
        self.assertGreaterEqual(len(self.release["sources"]), 17)

    def test_public_bilingual_notes_have_parity(self) -> None:
        for row in self.release["places"]:
            self.assertEqual(bool(row["spatial_note_el"]), bool(row["spatial_note_en"]), row["entity_id"])
        for row in self.release["chronologies"]:
            self.assertTrue(row["label_el"], row["entity_id"])
            self.assertTrue(row["label_en"], row["entity_id"])
            self.assertEqual(bool(row["note_el"]), bool(row["note_en"]), row["entity_id"])

    def test_media_manifest_covers_every_entity_with_an_ordered_primary_image(self) -> None:
        self.assertIn("media", self.release)
        media = self.release["media"]
        entity_ids = {row["entity_id"] for row in self.release["entities"]}
        covered = {row["entity_id"] for row in media}
        self.assertEqual(covered, entity_ids)
        self.assertGreaterEqual(len(media), len(entity_ids))
        self.assertLessEqual(len(media), len(entity_ids) * 4)
        for entity_id in entity_ids:
            rows = sorted(
                (row for row in media if row["entity_id"] == entity_id),
                key=lambda row: int(row["position"]),
            )
            self.assertEqual([int(row["position"]) for row in rows], list(range(1, len(rows) + 1)))
            self.assertEqual(rows[0]["role"], "primary")
            self.assertTrue(all(row["role"] == "gallery" for row in rows[1:]))


if __name__ == "__main__":
    unittest.main()
