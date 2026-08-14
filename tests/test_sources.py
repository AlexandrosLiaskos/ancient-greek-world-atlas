import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agw_data.release import build_release, source_id_for_url  # noqa: E402
from agw_data.sources import canonicalize_url, classify_http_status  # noqa: E402


class SourceTests(unittest.TestCase):
    def test_url_canonicalization_is_conservative(self) -> None:
        self.assertEqual(
            canonicalize_url("HTTP://Pleiades.Stoa.Org/places/579885/"),
            "https://pleiades.stoa.org/places/579885",
        )
        self.assertEqual(
            canonicalize_url("https://example.org/path?a=1&b=2"),
            "https://example.org/path?a=1&b=2",
        )

    def test_http_status_is_not_confused_with_scholarly_verification(self) -> None:
        self.assertEqual(classify_http_status(200, False), "ok")
        self.assertEqual(classify_http_status(200, True), "redirected")
        self.assertEqual(classify_http_status(403, False), "unavailable")

    def test_source_ids_are_stable(self) -> None:
        self.assertEqual(
            source_id_for_url("https://pleiades.stoa.org/places/579885"),
            "src-pleiades-579885",
        )

    def test_every_external_identifier_references_a_source(self) -> None:
        raw = ROOT / "data" / "raw" / "archaios_ellinikos_kosmos_entities_v0_1.csv"
        release = build_release(raw, ROOT)
        source_ids = {row["source_id"] for row in release["sources"]}
        self.assertTrue(release["external_ids"])
        self.assertFalse([row for row in release["external_ids"] if row["source_id"] not in source_ids])

    def test_cached_authoritative_metadata_enriches_sources(self) -> None:
        raw = ROOT / "data" / "raw" / "archaios_ellinikos_kosmos_entities_v0_1.csv"
        release = build_release(raw, ROOT)
        sources = {row["source_id"]: row for row in release["sources"]}
        athens = sources["src-pleiades-579885"]
        self.assertEqual(athens["title"], "Athenae")
        self.assertEqual(athens["publisher"], "Pleiades")
        self.assertEqual(athens["license"], "CC BY 3.0")
        self.assertEqual(athens["accessed_on"], "2026-08-15")
        self.assertIn(athens["url_status"], {"ok", "redirected", "unavailable"})

    def test_incorrect_ucl_pdf_is_replaced_for_magas(self) -> None:
        raw = ROOT / "data" / "raw" / "archaios_ellinikos_kosmos_entities_v0_1.csv"
        release = build_release(raw, ROOT)
        entity_sources = {
            (row["entity_id"], row["source_id"])
            for row in release["entity_sources"]
        }
        sources = {row["source_id"]: row for row in release["sources"]}
        magas_sources = [
            sources[source_id]
            for entity_id, source_id in entity_sources
            if entity_id == "kingdom-cyrene-magas"
        ]
        self.assertTrue(magas_sources)
        self.assertFalse(any("discovery.ucl.ac.uk" in row["url"] for row in magas_sources))
        self.assertTrue(any("Magas" in row["title"] for row in magas_sources))


if __name__ == "__main__":
    unittest.main()
