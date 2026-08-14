import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agw_data.release import build_release  # noqa: E402


class TranslationQualityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        raw = ROOT / "data" / "raw" / "archaios_ellinikos_kosmos_entities_v0_1.csv"
        cls.release = build_release(raw, ROOT)
        cls.entities = {row["entity_id"]: row for row in cls.release["entities"]}

    def test_known_archaeological_terms_are_post_edited(self) -> None:
        self.assertIn("multiple sacred precincts", self.entities["sanctuary-athens-acropolis-sacred-center"]["description_en"])
        self.assertIn("abaton", self.entities["sanctuary-epidauros-asklepios-sanctuary"]["description_en"])
        self.assertIn("terraces", self.entities["sanctuary-kos-asklepieion"]["description_en"])
        self.assertIn("Abai", self.entities["sanctuary-kalapodi-artemis-apollo-sanctuary"]["description_en"])

    def test_known_proper_names_are_post_edited(self) -> None:
        self.assertIn("Aeolian", self.entities["city-mytilene"]["description_en"])
        self.assertIn("Jason of Pherae", self.entities["city-pherae-thessaly"]["description_en"])
        self.assertIn("Black Sea", self.entities["colony-heraclea-pontica"]["description_en"])
        self.assertIn("Milesian colony", self.entities["colony-olbia-pontica"]["description_en"])

    def test_banned_machine_translation_failures_do_not_survive(self) -> None:
        banned = (
            "mosque",
            "abattoir",
            "ancient Aves",
            "three men",
            "successive ages",
            "speaking colony",
            "Peanuts",
        )
        text = "\n".join(
            value
            for table in ("entities", "places", "chronologies", "relationships", "authorities")
            for row in self.release[table]
            for key, value in row.items()
            if key.endswith("_en") or key in {"description_en", "label_en", "note_en"}
        )
        for phrase in banned:
            self.assertNotIn(phrase.casefold(), text.casefold(), phrase)

    def test_display_cutoff_note_is_idiomatic_and_semantically_exact(self) -> None:
        row = next(row for row in self.release["chronologies"] if row["entity_id"] == "city-athens-attica")
        self.assertEqual(
            row["note_en"],
            "The year 600 CE is the conventional upper limit of this ancient timeline, not a date of destruction or abandonment.",
        )


if __name__ == "__main__":
    unittest.main()
