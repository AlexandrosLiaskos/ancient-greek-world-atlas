import hashlib
import json
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agw_data.export import build_exports  # noqa: E402


class ExportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="agw-exports-")
        self.dist = Path(self.temp.name) / "dist"
        build_exports(ROOT / "data" / "canonical", self.dist, root=ROOT)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_sqlite_foreign_keys_are_clean_and_counts_match(self) -> None:
        with closing(sqlite3.connect(self.dist / "ancient-greek-world.sqlite")) as database:
            self.assertEqual(database.execute("PRAGMA foreign_key_check").fetchall(), [])
            self.assertEqual(database.execute("SELECT COUNT(*) FROM entities").fetchone()[0], 226)
            self.assertEqual(database.execute("SELECT COUNT(*) FROM relationships").fetchone()[0], 326)

    def test_geojson_uses_longitude_latitude_order(self) -> None:
        payload = json.loads((self.dist / "ancient-greek-world.geojson").read_text(encoding="utf-8"))
        feature = next(item for item in payload["features"] if item["id"] == "city-athens-attica")
        longitude, latitude = feature["geometry"]["coordinates"]
        self.assertAlmostEqual(longitude, 23.7, delta=1.0)
        self.assertAlmostEqual(latitude, 38.0, delta=1.0)
        self.assertEqual(feature["properties"]["geometry_role"], "site")

    def test_entity_json_is_bilingual_and_relational(self) -> None:
        payload = json.loads((self.dist / "ancient-greek-world.json").read_text(encoding="utf-8"))
        athens = next(item for item in payload["entities"] if item["entity_id"] == "city-athens-attica")
        self.assertTrue(athens["preferred_name_el"])
        self.assertTrue(athens["preferred_name_en"])
        self.assertTrue(athens["names"])
        self.assertEqual(len(athens["places"]), 1)
        self.assertEqual(len(athens["chronologies"]), 1)
        self.assertTrue(athens["source_support"])

    def test_linked_places_export_has_timespans_links_and_relations(self) -> None:
        payload = json.loads(
            (self.dist / "ancient-greek-world-linked-places.jsonld").read_text(encoding="utf-8")
        )
        feature = next(
            item
            for item in payload["features"]
            if item["properties"]["identifier"] == "sanctuary-naukratis-hellenion"
        )
        self.assertTrue(feature["names"])
        self.assertTrue(feature["when"]["timespans"])
        self.assertTrue(feature["relations"])
        self.assertTrue(feature["links"])

    def test_sha256_manifest_matches_every_distribution_file(self) -> None:
        manifest = {}
        for line in (self.dist / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
            digest, name = line.split("  ", 1)
            manifest[name] = digest
        expected_names = {
            "ancient-greek-world.sqlite",
            "ancient-greek-world.json",
            "ancient-greek-world.geojson",
            "ancient-greek-world-linked-places.jsonld",
        }
        self.assertEqual(set(manifest), expected_names)
        for name, digest in manifest.items():
            self.assertEqual(hashlib.sha256((self.dist / name).read_bytes()).hexdigest(), digest)

    def test_exports_are_byte_reproducible(self) -> None:
        repeat = Path(self.temp.name) / "repeat"
        build_exports(ROOT / "data" / "canonical", repeat, root=ROOT)
        for path in sorted(self.dist.iterdir()):
            self.assertEqual(path.read_bytes(), (repeat / path.name).read_bytes(), path.name)


if __name__ == "__main__":
    unittest.main()
