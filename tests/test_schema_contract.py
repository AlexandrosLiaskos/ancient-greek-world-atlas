import csv
import json
import sqlite3
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VOCAB = ROOT / "data" / "vocabularies"
DATABASE_SQL = ROOT / "schema" / "database.sql"
TABLES_JSON = ROOT / "schema" / "tables.json"


def load_codes(name: str) -> set[str]:
    with (VOCAB / f"{name}.csv").open("r", encoding="utf-8-sig", newline="") as handle:
        return {row["code"] for row in csv.DictReader(handle)}


class SchemaContractTests(unittest.TestCase):
    def test_colony_is_not_an_entity_class(self) -> None:
        self.assertEqual(load_codes("entity_classes"), {"settlement", "sanctuary", "polity"})
        self.assertNotIn("colony", load_codes("entity_classes"))

    def test_required_controlled_terms_exist(self) -> None:
        self.assertGreaterEqual(len(load_codes("entity_subtypes")), 10)
        self.assertEqual(load_codes("collection_types"), {"city", "colony", "sanctuary", "kingdom"})
        self.assertTrue({"site", "proxy", "representative_center"} <= load_codes("geometry_roles"))
        self.assertTrue({"draft", "reviewed", "verified", "excluded"} <= load_codes("review_states"))

    def test_table_contract_declares_all_canonical_tables(self) -> None:
        contract = json.loads(TABLES_JSON.read_text(encoding="utf-8"))
        expected = {
            "entities",
            "names",
            "places",
            "chronologies",
            "authorities",
            "relationships",
            "sources",
            "entity_sources",
            "external_ids",
            "media",
        }
        self.assertEqual(set(contract["tables"]), expected)
        for table in contract["tables"].values():
            self.assertTrue(table["primary_key"])
            self.assertTrue(table["columns"])

    def test_sql_enforces_core_constraints(self) -> None:
        sql = DATABASE_SQL.read_text(encoding="utf-8")
        self.assertIn("start_year <> 0", sql)
        self.assertIn("end_year <> 0", sql)
        self.assertIn("latitude BETWEEN -90 AND 90", sql)
        self.assertIn("longitude BETWEEN -180 AND 180", sql)
        self.assertIn("position BETWEEN 1 AND 4", sql)
        self.assertIn("position = 1 AND role = 'primary'", sql)
        self.assertIn("position > 1 AND role = 'gallery'", sql)

        db = sqlite3.connect(":memory:")
        db.execute("PRAGMA foreign_keys = ON")
        db.executescript(sql)
        rows = db.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
        names = {row[0] for row in rows}
        self.assertTrue({"entities", "places", "chronologies", "relationships", "media"} <= names)
        self.assertEqual(db.execute("PRAGMA foreign_key_check").fetchall(), [])


if __name__ == "__main__":
    unittest.main()
