import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agw_data.pleiades import (  # noqa: E402
    compare_points,
    extract_record,
    pleiades_id_from_uri,
    reconcile_pleiades,
)


ATHENS_JSON = {
    "id": "579885",
    "title": "Athenae",
    "description": "The ancient city of Athens.",
    "reprPoint": [23.728, 37.972],
    "features": [],
    "names": [{"attested": "Ἀθῆναι", "romanized": "Athenae"}],
    "placeTypes": ["settlement"],
    "creators": [{"username": "example", "fullname": "Example Editor"}],
    "modified": "2025-01-01T00:00:00Z",
    "uri": "https://pleiades.stoa.org/places/579885",
}


class PleiadesTests(unittest.TestCase):
    def test_pleiades_id_is_extracted_only_from_canonical_place_uri(self) -> None:
        self.assertEqual(pleiades_id_from_uri("https://pleiades.stoa.org/places/579885"), "579885")
        self.assertIsNone(pleiades_id_from_uri("https://pleiades.stoa.org/places/579885/json"))
        self.assertIsNone(pleiades_id_from_uri("https://example.com/places/579885"))

    def test_extract_record_keeps_scholarly_fields(self) -> None:
        record = extract_record(ATHENS_JSON, retrieved_on="2026-08-15")
        self.assertEqual(record["pleiades_id"], "579885")
        self.assertEqual(record["title"], "Athenae")
        self.assertEqual(record["representative_point"], [23.728, 37.972])
        self.assertEqual(record["retrieved_on"], "2026-08-15")

    def test_distance_is_reported_not_silently_overwritten(self) -> None:
        comparison = compare_points((23.72, 37.97), (23.73, 37.98))
        self.assertGreater(comparison.distance_m, 0)
        self.assertLess(comparison.distance_m, 2000)

    def test_reconciliation_requires_matching_id_and_uri(self) -> None:
        result = reconcile_pleiades(
            pleiades_id="579885",
            canonical_uri="https://pleiades.stoa.org/places/579885",
            payload=ATHENS_JSON,
            local_point=(23.728, 37.972),
        )
        self.assertEqual(result.status, "matched")
        self.assertAlmostEqual(result.distance_m, 0.0)


if __name__ == "__main__":
    unittest.main()
