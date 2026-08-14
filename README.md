# Ancient Greek World Atlas — Data Foundation

A bilingual, source-aware and reproducible data foundation for a future static WebGIS of the ancient Greek world. Version **1.0.0** contains **226 canonical entities**: 119 settlements, 70 sanctuaries and 37 polities.

This repository is intentionally limited to research and data engineering. It contains no map interface, image collection, Supabase project, server runtime or frontend framework yet.

## Ελληνικά

Δίγλωσση, τεκμηριωμένη και αναπαραγώγιμη βάση δεδομένων για έναν μελλοντικό στατικό WebGIS του αρχαίου ελληνικού κόσμου. Η έκδοση **1.0.0** περιλαμβάνει **226 κανονικές οντότητες**: 119 οικισμούς, 70 ιερά και 37 πολιτικές οντότητες.

Το αποθετήριο καλύπτει αποκλειστικά τη φάση έρευνας και οργάνωσης των δεδομένων. Η ελληνική είναι η κύρια επιμελητική γλώσσα, ενώ τα δημόσια ονόματα, οι περιγραφές και τα ελεγχόμενα λεξιλόγια παρέχονται στα ελληνικά και στα αγγλικά.

## Release quality / Ποιότητα έκδοσης

| Measure / Μέτρο | Result / Αποτέλεσμα |
|---|---:|
| Canonical entities / Κανονικές οντότητες | 226 |
| Bilingual entity completeness / Δίγλωσση πληρότητα | 100% |
| Complete seven-scope source support / Πλήρης τεκμηρίωση επτά πεδίων | 226/226 |
| Pleiades alignments reconciled / Αντιστοιχίσεις Pleiades | 184/184 |
| Typed relationships / Τυποποιημένες σχέσεις | 326 |
| Validation errors / Σφάλματα επικύρωσης | 0 |
| Transparent warnings / Διαφανείς προειδοποιήσεις | 43 |

The warnings are deliberate records of uncertainty and access conditions: 19 reviewed entities retain medium confidence, 8 points are explicit spatial proxies, 15 source URLs were unavailable or unchecked on the dated test, and one Pleiades comparison differs by more than 500 metres. They are not validation failures.

## Data model / Μοντέλο δεδομένων

The canonical CSV layer is the source of truth and consists of nine normalized tables:

- `entities`, `names`, `places`, `chronologies`;
- `authorities`, `relationships`;
- `sources`, `entity_sources`, `external_ids`.

Settlement, sanctuary and polity are the canonical entity classes. “City”, “colony”, “sanctuary” and “kingdom” are editorial collections rather than mutually exclusive historical categories. Polity coordinates are explicitly representative centres, never territorial geometries. BCE years are negative, CE years positive, and year zero is prohibited.

See [Methodology](docs/METHODOLOGY.md), [Data Dictionary](docs/DATA_DICTIONARY.md) and [Source Policy](docs/SOURCE_POLICY.md) for the full bilingual rules.

## Repository layers / Επίπεδα αποθετηρίου

- `data/raw`: immutable submitted research and its recorded checksum;
- `data/research`: explicit overrides, translations, reconciliation, review decisions and expansion candidates;
- `data/vocabularies`: controlled bilingual terms;
- `data/canonical`: normalized, Git-reviewable source of truth;
- `schema`: machine-readable table contracts;
- `dist`: generated SQLite, JSON, GeoJSON and Linked Places JSON-LD;
- `reports`: machine-readable and human-readable quality reports;
- `outputs/agw-data-foundation`: editorial review workbook;
- `scripts` and `src/agw_data`: deterministic build, validation and export tooling.

The submitted CSV remains unchanged at `data/raw/archaios_ellinikos_kosmos_entities_v0_1.csv`; its SHA-256 digest is recorded in `data/raw/SHA256SUMS`. Corrections belong in the research layer, never in the raw file.

## Reproduce the release / Αναπαραγωγή έκδοσης

Python 3.11 or later is required. The workbook builder additionally needs Node.js and `@oai/artifact-tool`.

```powershell
python scripts/build_data.py --raw data/raw/archaios_ellinikos_kosmos_entities_v0_1.csv --canonical data/canonical --check
python scripts/validate_release.py --canonical data/canonical --report-dir reports
python scripts/export_release.py --canonical data/canonical --dist dist --check
python -m unittest discover -s tests -v
node scripts/build_editorial_workbook.mjs
```

`--check` verifies that generated canonical data and public exports are byte-for-byte reproducible. Export checksums are in `dist/SHA256SUMS`. The release gate requires zero validation errors; historical uncertainty remains visible as structured warnings.

## Outputs / Παραδοτέα

- `dist/ancient-greek-world.sqlite` — indexed relational database;
- `dist/ancient-greek-world.json` — complete structured release;
- `dist/ancient-greek-world.geojson` — map-ready point features;
- `dist/ancient-greek-world-linked-places.jsonld` — Linked Places JSON-LD;
- `outputs/agw-data-foundation/Ancient_Greek_World_Data_Review.xlsx` — 14-sheet editorial workbook;
- `reports/quality-report.md`, `quality-report.json` and `review-queue.csv` — release evidence.

## Known limits / Γνωστοί περιορισμοί

- Points represent sites, explicit proxies or representative centres; they are not monument footprints or political boundaries.
- Chronological ranges summarize attested activity or editorial display windows and are not automatically destruction dates.
- URL availability is a dated operational check, not a judgment of scholarly authority.
- Fifteen material expansion candidates are recorded in `data/research/candidates.csv`; none is silently added without complete bilingual, chronological, spatial and source evidence.
- Pleiades is used for reconciliation where a defensible match exists; local coordinates are never silently replaced.

## Licensing and attribution / Άδειες και αναφορά

Project code is released under the MIT License in `LICENSE-CODE`. Original dataset compilation and editorial contributions are released under CC BY 4.0 as described in `LICENSE-DATA`. Reused Pleiades content remains under CC BY 3.0 and must retain its own attribution. Linked publications, museum pages and other sources are cited but are not relicensed by this repository.

Preferred citation metadata is supplied in `CITATION.cff`. Release history is in `CHANGELOG.md`.
