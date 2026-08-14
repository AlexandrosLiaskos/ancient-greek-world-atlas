import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agw_data.normalize import (  # noqa: E402
    normalize_entity,
    normalize_place,
    normalize_text,
    stable_id,
)


class NormalizeTests(unittest.TestCase):
    def test_colony_becomes_settlement_and_keeps_collection(self) -> None:
        entity = normalize_entity(
            {
                "id": "colony-cyme",
                "entity_type": "colony",
                "subtype": "apoikia",
                "name_el": "Κύμη",
                "name_en": "Cyme",
                "name_ancient": "Κύμη",
                "description_el": "Αποικία.",
                "ancient_region": "Αιολίδα",
                "temporal_precision": "approximate",
                "location_certainty": "high",
                "review_status": "curated_initial",
                "data_version": "0.1 — 2026-08-14",
            },
            description_en="Colony.",
        )
        self.assertEqual(entity["entity_class"], "settlement")
        self.assertEqual(entity["entity_subtype"], "polis")
        self.assertIn("colony", entity["collections"].split("|"))

    def test_kingdom_point_is_representative_center(self) -> None:
        place = normalize_place(
            {
                "id": "kingdom-test",
                "entity_type": "kingdom",
                "latitude": "38.1",
                "longitude": "23.2",
                "geometry_wkt": "POINT (23.2 38.1)",
                "geometry_role": "representative_center",
                "location_certainty": "high",
                "pleiades_location_precision": "",
                "modern_country": "Ελλάδα",
                "modern_country_iso3": "GRC",
                "modern_locality": "",
                "coordinate_source": "curated point",
                "spatial_note_el": "",
            },
            country={"iso2": "GR", "name_en": "Greece"},
            source_id="src-test",
            spatial_note_en="",
        )
        self.assertEqual(place["geometry_role"], "representative_center")
        self.assertEqual(place["geometry_geojson"], '{"coordinates":[23.2,38.1],"type":"Point"}')

    def test_unicode_and_whitespace_are_normalized(self) -> None:
        self.assertEqual(normalize_text("  Αθήνα\r\n πόλις  "), "Αθήνα πόλις")

    def test_stable_id_ignores_accents_and_punctuation(self) -> None:
        self.assertEqual(stable_id("authority", "Αθήνα / Athḗna"), "authority-athena-athena")


if __name__ == "__main__":
    unittest.main()
