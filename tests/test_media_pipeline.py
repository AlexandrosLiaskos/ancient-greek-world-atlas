import importlib.util
import tempfile
import unittest
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "build_media.py"


def load_module():
    if not MODULE_PATH.exists():
        return None
    spec = importlib.util.spec_from_file_location("build_media", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class MediaPipelineTests(unittest.TestCase):
    def test_pipeline_exposes_safe_metadata_and_image_helpers(self) -> None:
        module = load_module()
        self.assertIsNotNone(module, "scripts/build_media.py must exist")
        for name in ("clean_html", "normalize_license", "score_candidate", "media_copy", "optimize_image"):
            self.assertTrue(callable(getattr(module, name, None)), name)

    def test_metadata_is_cleaned_and_only_reusable_licenses_are_accepted(self) -> None:
        module = load_module()
        self.assertIsNotNone(module)
        self.assertEqual(module.clean_html('<a href="/wiki/User:Jane">Jane &amp; John</a>'), "Jane & John")
        self.assertEqual(
            module.normalize_license("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"),
            ("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"),
        )
        with self.assertRaises(ValueError):
            module.normalize_license("All rights reserved", "")

    def test_retry_delay_honours_server_backoff_for_rate_limits(self) -> None:
        module = load_module()
        self.assertIsNotNone(module)
        self.assertTrue(callable(getattr(module, "retry_delay", None)))
        self.assertEqual(module.retry_delay(0, None), 2.0)
        self.assertEqual(module.retry_delay(3, "15"), 15.0)
        self.assertEqual(module.retry_delay(9, None), 30.0)

    def test_media_overrides_preserve_commas_inside_commons_titles(self) -> None:
        module = load_module()
        self.assertIsNotNone(module)
        overrides = module.load_overrides(ROOT / "data" / "research" / "media-overrides.csv")
        self.assertEqual(
            overrides[("city-naxos-cyclades", 1)],
            "File:Entrance Roman era, Grotta Naxos 091424.jpg",
        )

    def test_curated_overrides_disambiguate_known_homonyms(self) -> None:
        module = load_module()
        self.assertIsNotNone(module)
        overrides = module.load_overrides(ROOT / "data" / "research" / "media-overrides.csv")
        self.assertIn("Ruines d'Abydos", overrides[("colony-abydos", 1)])
        self.assertEqual(overrides[("colony-issa-vis", 1)], "File:Ruiny rzymskich łaźni w vis.jpg")
        self.assertIn("Ольвія", overrides[("colony-olbia-pontica", 1)])
        self.assertNotIn("butterfly", overrides[("city-olynthus", 2)].casefold())
        self.assertEqual(
            overrides[("sanctuary-chersonesos-parthenos-sanctuary", 1)],
            "File:Изображение Девы в Херсонесе.jpg",
        )
        self.assertIn("Kom el Dikka", overrides[("city-alexandria-egypt", 2)])
        self.assertIn("Ancient-theater", overrides[("city-larissa-thessaly", 1)])
        self.assertIn("Temple of Apollo", overrides[("city-rhodes-city", 1)])
        self.assertIn("Stari Grad Plain", overrides[("colony-pharos-hvar", 1)])
        self.assertIn("Selinunte", overrides[("colony-selinus", 1)])
        self.assertIn("Kouros of Naucratis", overrides[("colony-naucratis", 1)])
        self.assertIn("Capo Colonna", overrides[("sanctuary-croton-hera-lacinia-sanctuary", 1)].title())
        self.assertIn("Teatro greco", overrides[("colony-syracuse", 1)])

    def test_candidate_scoring_prefers_relevant_ancient_subjects(self) -> None:
        module = load_module()
        self.assertIsNotNone(module)
        entity = {"preferred_name_en": "Athens", "entity_class": "settlement"}
        temple = {
            "title": "File:Ancient Agora of Athens and Temple of Hephaestus.jpg",
            "width": 3000,
            "height": 2000,
            "source": "search",
        }
        skyline = {
            "title": "File:Modern Athens skyline and traffic.jpg",
            "width": 4000,
            "height": 2000,
            "source": "wikidata",
        }
        self.assertGreater(module.score_candidate(entity, temple), module.score_candidate(entity, skyline))

        polity = {"preferred_name_en": "Kingdom of Bithynia", "entity_class": "polity"}
        coin = {
            "title": "File:Ancient coin of the Kingdom of Bithynia.jpg",
            "width": 1800,
            "height": 1800,
            "source": "search",
        }
        self.assertGreater(module.score_candidate(polity, coin), module.score_candidate(polity, skyline))

        chalcis = {"preferred_name_en": "Chalcis", "entity_class": "settlement"}
        flower = {
            "title": "File:Chalcis flower specimen.jpg",
            "width": 2400,
            "height": 1600,
            "source": "wikidata",
        }
        ancient_coin = {
            "title": "File:Ancient coin of Chalcis.jpg",
            "width": 1800,
            "height": 1800,
            "source": "search",
        }
        self.assertGreater(module.score_candidate(chalcis, ancient_coin), module.score_candidate(chalcis, flower))

        demetrias = {"preferred_name_en": "Demetrias", "entity_class": "settlement"}
        taxon = {
            "title": "File:Demetrias atricapillus (Linnaeus, 1758).png",
            "width": 2200,
            "height": 1400,
            "source": "search",
        }
        demetrias_coin = {
            "title": "File:Ancient coin of Demetrias 300 BC.jpg",
            "width": 1600,
            "height": 1200,
            "source": "search",
        }
        self.assertGreater(module.score_candidate(demetrias, demetrias_coin), module.score_candidate(demetrias, taxon))
        self.assertTrue(callable(getattr(module, "candidate_is_relevant", None)))
        self.assertFalse(module.candidate_is_relevant(demetrias, taxon))
        self.assertTrue(module.candidate_is_relevant(demetrias, demetrias_coin))

        megara = {"preferred_name_en": "Megara", "entity_class": "settlement"}
        unrelated_mosaic = {
            "title": "File:Roman mosaic from the Villa Torre de Palma.jpg",
            "width": 3200,
            "height": 2100,
            "source": "search",
        }
        megara_coin = {
            "title": "File:Ancient coin of Megara.jpg",
            "width": 1500,
            "height": 1100,
            "source": "search",
        }
        self.assertGreater(module.score_candidate(megara, megara_coin), module.score_candidate(megara, unrelated_mosaic))
        self.assertFalse(module.candidate_is_relevant(megara, unrelated_mosaic))

        wrong_abydos = {
            "entity_id": "colony-abydos",
            "preferred_name_en": "Abydos",
            "entity_class": "settlement",
        }
        egyptian_temple = {
            "title": "File:Abydos Egypt Temple of Seti I.jpg",
            "width": 2400,
            "height": 1600,
            "source": "search",
        }
        self.assertFalse(module.candidate_is_relevant(wrong_abydos, egyptian_temple))

        wrong_olbia = {
            "entity_id": "colony-olbia-pontica",
            "preferred_name_en": "Olbia Pontica",
            "entity_class": "settlement",
        }
        sardinian_town = {
            "title": "File:Olbia Sardinia modern town waterfront.jpg",
            "width": 2400,
            "height": 1600,
            "source": "wikidata",
        }
        self.assertFalse(module.candidate_is_relevant(wrong_olbia, sardinian_town))

    def test_search_ladder_drops_editorial_taxonomy_and_accepts_historical_aliases(self) -> None:
        module = load_module()
        self.assertIsNotNone(module)
        self.assertTrue(callable(getattr(module, "search_queries", None)))
        athens = {
            "entity_id": "kingdom-athens-mycenaean",
            "preferred_name_en": "Mycenaean Athens Polity",
            "entity_class": "polity",
        }
        self.assertIn("Mycenaean Athens", module.search_queries(athens))

        acropolis = {
            "entity_id": "sanctuary-athens-acropolis-sacred-center",
            "preferred_name_en": "Sacred Center of the Athenian Acropolis",
            "entity_class": "sanctuary",
        }
        self.assertIn("Athenian Acropolis", module.search_queries(acropolis))

        chalcis = {
            "entity_id": "city-chalcis-euboea",
            "preferred_name_en": "Chalcis",
            "entity_class": "settlement",
        }
        self.assertIn("Chalcis ancient coin", module.search_queries(chalcis))

        amyklaion = {
            "entity_id": "sanctuary-amyklaion-apollo-sanctuary",
            "preferred_name_en": "Amyklaion Sanctuary of Apollo",
            "entity_class": "sanctuary",
        }
        self.assertIn("Amyclae Apollo", module.search_queries(amyklaion, ["Amyclae Apollo"]))

    def test_known_homonyms_are_rejected_before_media_selection(self) -> None:
        module = load_module()
        self.assertIsNotNone(module)
        cases = (
            ("city-alexandria-egypt", "Alexandria", "File:Alexandria Troas ruins.jpg"),
            ("city-larissa-thessaly", "Larissa", "File:Castle Larissa of Argos.jpg"),
            ("city-rhodes-city", "Rhodes", "File:Ancient Kameiros Rhodes.jpg"),
            ("colony-neapolis-campania", "Neapolis", "File:Neapolis Macedonia 2019.jpg"),
            ("colony-naucratis", "Naucratis", "File:Vase by the Naucratis Painter.jpg"),
            ("colony-pharos-hvar", "Pharos", "File:Pharos of Alexandria.jpg"),
            ("colony-selinus", "Selinus", "File:Selinus Cilicia ruins.jpg"),
            ("colony-taras", "Taras", "File:Taras Shevchenko portrait.jpg"),
            (
                "colony-syracuse",
                "Syracuse",
                "File:Saint Paul statue and Syracuse Cathedral Baroque facade.jpg",
            ),
            (
                "kingdom-athens-mycenaean",
                "Mycenaean Athens Polity",
                "File:Model of Mycenaean Tiryns.jpg",
            ),
            (
                "sanctuary-croton-hera-lacinia-sanctuary",
                "Hera Lacinia Sanctuary at Croton",
                "File:Temple of Hera Lacinia Agrigentum.jpg",
            ),
            (
                "sanctuary-naukratis-hellenion",
                "Hellenion at Naukratis",
                "File:Vase by the Naucratis Painter.jpg",
            ),
        )
        for entity_id, name, title in cases:
            with self.subTest(entity_id=entity_id):
                entity = {
                    "entity_id": entity_id,
                    "preferred_name_en": name,
                    "entity_class": "sanctuary" if entity_id.startswith("sanctuary-") else "settlement",
                }
                candidate = {
                    "title": title,
                    "width": 2400,
                    "height": 1600,
                    "source": "search",
                }
                self.assertFalse(module.candidate_is_relevant(entity, candidate))

    def test_media_copy_is_bilingual_and_image_output_is_bounded_webp(self) -> None:
        module = load_module()
        self.assertIsNotNone(module)
        copy = module.media_copy(
            {"preferred_name_el": "Αθήνα", "preferred_name_en": "Athens"},
            "File:Ancient Athens map.jpg",
        )
        self.assertEqual(copy["caption_el"], "Αθήνα · Ιστορικός χάρτης")
        self.assertEqual(copy["caption_en"], "Athens · Historical map")

        with tempfile.TemporaryDirectory(prefix="agw-media-test-") as temp:
            source = Path(temp) / "source.jpg"
            target = Path(temp) / "output.webp"
            Image.new("RGB", (2400, 1200), "#325844").save(source, "JPEG")
            metadata = module.optimize_image(source, target, max_dimension=1600)
            self.assertEqual(metadata["width"], 1600)
            self.assertEqual(metadata["height"], 800)
            self.assertEqual(len(metadata["sha256"]), 64)
            with Image.open(target) as optimized:
                self.assertEqual(optimized.format, "WEBP")

    def test_targeted_media_rebuild_replaces_only_requested_entities(self) -> None:
        module = load_module()
        self.assertIsNotNone(module)
        existing = [
            {"entity_id": "city-a", "position": "1", "title": "old-a"},
            {"entity_id": "city-b", "position": "1", "title": "old-b"},
        ]
        replacement = [
            {"entity_id": "city-a", "position": 1, "title": "new-a"},
            {"entity_id": "city-a", "position": 2, "title": "new-a-2"},
        ]
        merged = module.merge_media_rows(existing, replacement, {"city-a"})
        self.assertEqual(
            [(row["entity_id"], int(row["position"]), row["title"]) for row in merged],
            [
                ("city-a", 1, "new-a"),
                ("city-a", 2, "new-a-2"),
                ("city-b", 1, "old-b"),
            ],
        )

    def test_complete_overrides_can_skip_candidate_discovery(self) -> None:
        module = load_module()
        self.assertIsNotNone(module)
        overrides = {
            ("city-a", 1): "File:First.jpg",
            ("city-a", 2): "File:Second.jpg",
            ("city-b", 1): "File:Only.jpg",
        }
        self.assertTrue(module.entity_has_complete_overrides("city-a", overrides, 2))
        self.assertFalse(module.entity_has_complete_overrides("city-b", overrides, 2))


if __name__ == "__main__":
    unittest.main()
