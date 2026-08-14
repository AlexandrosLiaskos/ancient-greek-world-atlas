# Ancient Greek World Atlas Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the submitted 226-row research CSV into a normalized, bilingual, source-aware, validated, and reproducible scholarly database release for a future static WebGIS.

**Architecture:** Preserve the submitted file byte-for-byte, then use a deterministic Python standard-library pipeline to create Git-friendly canonical CSV tables and generated SQLite/JSON/GeoJSON exports. Separate entities from spatial assertions, chronology, names, relationships, authorities, and sources; record uncertainty instead of forcing false precision. Build a human-review XLSX artifact with the bundled spreadsheet runtime after machine validation succeeds.

**Tech Stack:** Python 3.11+ standard library, SQLite, JSON Schema documents, GeoJSON, CSV, `unittest`, bundled Node.js plus `@oai/artifact-tool` for the editorial workbook, Git.

**Spec:** `docs/design/data-foundation.md`

## Global Constraints

- No WebGIS, UI, media acquisition, Supabase, authentication, or server implementation in this phase.
- Greek remains the authoritative editorial language; every public-facing Greek text field receives an English counterpart.
- The four editorial collections remain cities, colonies, sanctuaries, and kingdoms/polities; canonical classes are settlement, sanctuary, and polity.
- Colony is modeled as a settlement classification and historical relationship, not as a mutually exclusive physical class.
- BCE years are negative, CE years positive, and year zero is prohibited.
- Points for polities must be explicitly marked as representative centers, never territorial geometries.
- Raw source data is immutable and checksum-verified.
- Generated outputs must be deterministic and pass all validation gates.

---

### Task 1: Repository and provenance root

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Create: `pyproject.toml`
- Create: `data/raw/archaios_ellinikos_kosmos_entities_v0_1.csv`
- Create: `data/raw/SHA256SUMS`
- Test: `tests/test_raw_provenance.py`

**Interfaces:**
- Consumes: the user-supplied CSV at `C:/Users/alexl/Downloads/archaios_ellinikos_kosmos_entities_v0_1.csv`.
- Produces: an immutable raw input and `python -m unittest` test entry point used by every later task.

- [ ] **Step 1: Initialize the new Git repository on `codex/data-foundation`**

Run:

```powershell
git init -b main
git switch -c codex/data-foundation
```

Expected: an empty repository whose active branch is `codex/data-foundation`.

- [ ] **Step 2: Copy the source file and write its SHA-256 checksum**

Run a byte-preserving copy, then compute the checksum with `Get-FileHash -Algorithm SHA256`. The checksum line must use the form:

```text
<lowercase-sha256>  archaios_ellinikos_kosmos_entities_v0_1.csv
```

- [ ] **Step 3: Write the failing provenance test**

```python
def test_raw_csv_matches_recorded_sha256(self):
    expected = CHECKSUM_FILE.read_text(encoding="utf-8").split()[0]
    actual = hashlib.sha256(RAW_FILE.read_bytes()).hexdigest()
    self.assertEqual(actual, expected)
```

- [ ] **Step 4: Run the test and verify the expected failure**

Run: `python -m unittest tests.test_raw_provenance -v`  
Expected: FAIL because the checksum file or project metadata is not yet present.

- [ ] **Step 5: Add the checksum and minimal project metadata**

Set `requires-python = ">=3.11"`, configure unittest discovery, document that raw data must never be edited, and ignore temporary downloads, caches, rendered previews, and local build scratch space.

- [ ] **Step 6: Re-run the test**

Run: `python -m unittest tests.test_raw_provenance -v`  
Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add .gitignore README.md pyproject.toml data/raw tests/test_raw_provenance.py docs
git commit -m "chore: establish immutable research source"
```

### Task 2: Controlled vocabularies and relational schemas

**Files:**
- Create: `schema/tables.json`
- Create: `schema/database.sql`
- Create: `data/vocabularies/entity_classes.csv`
- Create: `data/vocabularies/entity_subtypes.csv`
- Create: `data/vocabularies/collection_types.csv`
- Create: `data/vocabularies/relationship_types.csv`
- Create: `data/vocabularies/chronology_bases.csv`
- Create: `data/vocabularies/precision_terms.csv`
- Create: `data/vocabularies/certainty_terms.csv`
- Create: `data/vocabularies/review_states.csv`
- Create: `tests/test_schema_contract.py`

**Interfaces:**
- Consumes: the data-foundation specification.
- Produces: exact table columns, enums, SQL constraints, and foreign-key contracts used by import and export code.

- [ ] **Step 1: Write failing tests for vocabulary and schema invariants**

```python
def test_colony_is_not_an_entity_class(self):
    self.assertEqual(load_codes("entity_classes"), {"settlement", "sanctuary", "polity"})
    self.assertNotIn("colony", load_codes("entity_classes"))

def test_sql_enforces_no_year_zero(self):
    sql = DATABASE_SQL.read_text(encoding="utf-8")
    self.assertIn("start_year <> 0", sql)
    self.assertIn("end_year <> 0", sql)
```

- [ ] **Step 2: Verify RED**

Run: `python -m unittest tests.test_schema_contract -v`  
Expected: FAIL because schemas and vocabularies do not exist.

- [ ] **Step 3: Add complete controlled vocabularies**

Every vocabulary row must include `code`, `label_el`, `label_en`, `definition_el`, `definition_en`, and `sort_order`. Relationship predicates must declare allowed source and target kinds.

- [ ] **Step 4: Add `tables.json` and constrained SQLite DDL**

Define `entities`, `names`, `places`, `chronologies`, `authorities`, `relationships`, `sources`, `entity_sources`, and `external_ids`. Add primary keys, unique constraints, enum checks, coordinate checks, year-zero checks, start/end ordering, indexes, and foreign keys.

- [ ] **Step 5: Verify GREEN**

Run: `python -m unittest tests.test_schema_contract -v`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add schema data/vocabularies tests/test_schema_contract.py
git commit -m "feat: define canonical scholarly data model"
```

### Task 3: Deterministic import and normalization pipeline

**Files:**
- Create: `src/agw_data/__init__.py`
- Create: `src/agw_data/io.py`
- Create: `src/agw_data/normalize.py`
- Create: `src/agw_data/translate.py`
- Create: `scripts/build_data.py`
- Create: `tests/test_normalize.py`
- Create: `tests/test_import_release.py`
- Generate: `data/canonical/*.csv`

**Interfaces:**
- Consumes: raw CSV, schema contracts, vocabularies, and an optional checked-in translation cache.
- Produces: `build_release(raw_path, output_dir, translation_cache) -> ReleaseTables` and canonical CSV tables with stable ordering and UTF-8 line endings.

- [ ] **Step 1: Write failing unit tests for semantic normalization**

```python
def test_colony_becomes_settlement_and_keeps_collection(self):
    entity = normalize_entity({"id": "colony-cyme", "entity_type": "colony", "subtype": "apoikia"})
    self.assertEqual(entity["entity_class"], "settlement")
    self.assertIn("colony", entity["collections"].split("|"))

def test_kingdom_point_is_representative_center(self):
    place = normalize_place({"entity_type": "kingdom", "geometry_role": "representative_center"})
    self.assertEqual(place["geometry_role"], "representative_center")
```

- [ ] **Step 2: Verify RED**

Run: `python -m unittest tests.test_normalize -v`  
Expected: FAIL because normalization functions do not exist.

- [ ] **Step 3: Implement CSV I/O and pure normalization functions**

Functions must normalize whitespace and Unicode NFC, preserve Greek text, parse numbers without locale ambiguity, map legacy types to canonical classes/collections, split multi-value fields deterministically, and generate stable IDs without using row order.

- [ ] **Step 4: Verify GREEN**

Run: `python -m unittest tests.test_normalize -v`  
Expected: PASS.

- [ ] **Step 5: Write failing whole-release tests**

```python
def test_release_preserves_all_legacy_entities(self):
    release = build_fixture_release()
    self.assertEqual(len(release.entities), 226)
    self.assertEqual({e["entity_id"] for e in release.entities}, LEGACY_IDS)

def test_every_entity_has_greek_and_english_public_text(self):
    for row in build_fixture_release().entities:
        self.assertTrue(row["preferred_name_el"].strip())
        self.assertTrue(row["preferred_name_en"].strip())
        self.assertTrue(row["description_el"].strip())
        self.assertTrue(row["description_en"].strip())
```

- [ ] **Step 6: Verify RED for missing bilingual output**

Run: `python -m unittest tests.test_import_release -v`  
Expected: FAIL because translation-backed English fields and canonical tables are incomplete.

- [ ] **Step 7: Implement cached machine-assisted translation with provenance**

Translations are fetched only when absent from `data/research/translations-el-en.json`; every cached entry stores source text, translated text, method, date, and review status. Build execution is offline and deterministic once the cache exists.

- [ ] **Step 8: Generate canonical tables and verify GREEN**

Run:

```powershell
python scripts/build_data.py --raw data/raw/archaios_ellinikos_kosmos_entities_v0_1.csv --canonical data/canonical
python -m unittest tests.test_import_release -v
```

Expected: 226 canonical entities and PASS.

- [ ] **Step 9: Commit**

```powershell
git add src scripts data/canonical data/research/translations-el-en.json tests
git commit -m "feat: normalize and bilingualize source corpus"
```

### Task 4: Pleiades reconciliation and source registry

**Files:**
- Create: `src/agw_data/pleiades.py`
- Create: `src/agw_data/sources.py`
- Create: `scripts/fetch_references.py`
- Create: `data/reference/pleiades/records.json`
- Create: `data/research/source-overrides.csv`
- Create: `data/research/source-checks.csv`
- Create: `tests/test_pleiades.py`
- Create: `tests/test_sources.py`

**Interfaces:**
- Consumes: canonical entity/external-ID tables and authoritative URLs.
- Produces: cached Pleiades JSON subset, deduplicated source metadata, distance reconciliation, URL status, and source-support links.

- [ ] **Step 1: Write failing Pleiades reconciliation tests**

```python
def test_pleiades_id_matches_canonical_uri(self):
    result = reconcile_pleiades("579885", "https://pleiades.stoa.org/places/579885", ATHENS_JSON)
    self.assertEqual(result.status, "matched")

def test_distance_is_reported_not_silently_overwritten(self):
    result = compare_points((23.72, 37.97), (23.73, 37.98))
    self.assertGreater(result.distance_m, 0)
```

- [ ] **Step 2: Verify RED**

Run: `python -m unittest tests.test_pleiades tests.test_sources -v`  
Expected: FAIL because reconciliation and source registries do not exist.

- [ ] **Step 3: Implement current-record retrieval and immutable caching**

Fetch `https://pleiades.stoa.org/places/{id}/json` for each distinct Pleiades ID, retain canonical URI, title, description, representative point, feature names, place types, creators, modified date, and retrieval timestamp. Retry transient failures with bounded exponential backoff and never substitute a search result for a failed canonical record.

- [ ] **Step 4: Implement source registry and checks**

Deduplicate URLs after safe canonicalization, classify institutions, store access date/status separately from scholarly role, and support explicit overrides for titles, publishers, licences, and claim groups.

- [ ] **Step 5: Run reconciliation and inspect all exceptions**

Run:

```powershell
python scripts/fetch_references.py --pleiades --check-sources
python scripts/build_data.py --raw data/raw/archaios_ellinikos_kosmos_entities_v0_1.csv --canonical data/canonical
```

Expected: all declared Pleiades IDs resolve or appear as explicit errors; every coordinate difference is measured; no coordinate is silently changed.

- [ ] **Step 6: Verify GREEN**

Run: `python -m unittest tests.test_pleiades tests.test_sources -v`  
Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src scripts data/reference data/research data/canonical tests
git commit -m "feat: reconcile places and normalize provenance"
```

### Task 5: Relationship migration, editorial review, and bounded expansion

**Files:**
- Create: `data/research/relationship-overrides.csv`
- Create: `data/research/entity-overrides.csv`
- Create: `data/research/candidates.csv`
- Create: `docs/METHODOLOGY.md`
- Create: `docs/DATA_DICTIONARY.md`
- Create: `docs/SOURCE_POLICY.md`
- Create: `tests/test_relationships.py`
- Create: `tests/test_editorial_gates.py`

**Interfaces:**
- Consumes: normalized legacy relationship labels, canonical entities, authority candidates, and source reconciliation.
- Produces: typed relationships/authorities, resolved review states, documented exclusions, and no unreviewed record in public exports.

- [ ] **Step 1: Write failing tests for relationship and review integrity**

```python
def test_internal_relationship_targets_exist(self):
    ids = {row["entity_id"] for row in load_table("entities")}
    for rel in load_table("relationships"):
        if rel["object_entity_id"]:
            self.assertIn(rel["object_entity_id"], ids)

def test_no_public_record_is_needs_review(self):
    self.assertFalse([r for r in load_table("entities") if r["review_state"] == "needs_review"])
```

- [ ] **Step 2: Verify RED**

Run: `python -m unittest tests.test_relationships tests.test_editorial_gates -v`  
Expected: FAIL on text-only legacy links and 19 legacy `needs_review` records.

- [ ] **Step 3: Resolve names to internal entities or stable authorities**

Use explicit override rows for ambiguous labels. Create internal links for metropoleis, associated settlements, and representative centers that are in the corpus. Create typed authority nodes for deities, dynasties, and external predecessor/successor polities. Never infer a target solely from fuzzy string similarity.

- [ ] **Step 4: Review every legacy `needs_review` record**

For each of the 19 records, record the issue, evidence consulted, decision, resulting certainty, reviewer, and date. Preserve proxies where no defensible site point is available. Split a record only if the source demonstrates that it conflates distinct entities.

- [ ] **Step 5: Audit material omissions**

Record candidates with inclusion rationale, class, collection, authoritative source, place identifier, and decision. Add only candidates satisfying every expansion criterion in the specification; otherwise record `defer` or `exclude` with a reason.

- [ ] **Step 6: Complete bilingual documentation and rebuild**

Document every table/column, chronology convention, geometry role, source class, translation method, review workflow, and known limitation. Re-run the deterministic build.

- [ ] **Step 7: Verify GREEN**

Run: `python -m unittest tests.test_relationships tests.test_editorial_gates -v`  
Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add data/research data/canonical docs tests
git commit -m "feat: resolve relationships and scholarly review"
```

### Task 6: Validation engine and release reports

**Files:**
- Create: `src/agw_data/validate.py`
- Create: `scripts/validate_release.py`
- Create: `tests/test_validation.py`
- Generate: `reports/quality-report.json`
- Generate: `reports/quality-report.md`
- Generate: `reports/review-queue.csv`

**Interfaces:**
- Consumes: all canonical tables, schemas, vocabularies, and source checks.
- Produces: `validate_release(path) -> ValidationReport` with errors, warnings, counts, coverage metrics, and deterministic report files.

- [ ] **Step 1: Write failing tests for each hard gate**

```python
def test_validator_rejects_year_zero(self):
    report = validate_fixture("chronology_year_zero")
    self.assertIn("CHRONOLOGY_YEAR_ZERO", report.error_codes)

def test_validator_rejects_unmarked_polity_point(self):
    report = validate_fixture("polity_site_point")
    self.assertIn("POLITY_POINT_ROLE", report.error_codes)

def test_validator_rejects_missing_source_support(self):
    report = validate_fixture("missing_geometry_source")
    self.assertIn("SOURCE_SUPPORT_GEOMETRY", report.error_codes)
```

- [ ] **Step 2: Verify RED**

Run: `python -m unittest tests.test_validation -v`  
Expected: FAIL because the validator does not exist.

- [ ] **Step 3: Implement structural, semantic, spatial, temporal, bilingual, and provenance checks**

Checks must have stable codes and severities. Reports must include entity counts, collection/class/country distributions, bilingual completeness, source coverage, Pleiades reconciliation, coordinate certainty, chronology precision, relationship resolution, and review-state totals.

- [ ] **Step 4: Verify GREEN and generate reports**

Run:

```powershell
python -m unittest tests.test_validation -v
python scripts/validate_release.py --canonical data/canonical --report-dir reports
```

Expected: tests PASS and release validation exits 0 with zero errors.

- [ ] **Step 5: Commit**

```powershell
git add src scripts tests reports
git commit -m "feat: enforce data release quality gates"
```

### Task 7: SQLite, JSON, GeoJSON, and Linked Places exports

**Files:**
- Create: `src/agw_data/export.py`
- Create: `scripts/export_release.py`
- Create: `tests/test_exports.py`
- Generate: `dist/ancient-greek-world.sqlite`
- Generate: `dist/ancient-greek-world.json`
- Generate: `dist/ancient-greek-world.geojson`
- Generate: `dist/ancient-greek-world-linked-places.jsonld`
- Generate: `dist/SHA256SUMS`

**Interfaces:**
- Consumes: a zero-error canonical release and `schema/database.sql`.
- Produces: deterministic static distribution files for scholarship and future WebGIS consumption.

- [ ] **Step 1: Write failing export tests**

```python
def test_sqlite_foreign_keys_are_clean(self):
    build_exports(self.temp_dir)
    with sqlite3.connect(self.temp_dir / "ancient-greek-world.sqlite") as db:
        self.assertEqual(db.execute("PRAGMA foreign_key_check").fetchall(), [])

def test_geojson_uses_longitude_latitude_order(self):
    feature = load_export_feature("city-athens")
    self.assertAlmostEqual(feature["geometry"]["coordinates"][0], 23.7, delta=1.0)
```

- [ ] **Step 2: Verify RED**

Run: `python -m unittest tests.test_exports -v`  
Expected: FAIL because exporters do not exist.

- [ ] **Step 3: Implement deterministic exports**

Insert canonical rows into SQLite in stable primary-key order, enable foreign keys, add read views, serialize JSON with sorted keys, emit valid RFC 7946 GeoJSON, and generate a Linked Places–inspired FeatureCollection with names, links, relations, citations, timespans, and certainty.

- [ ] **Step 4: Verify GREEN and reproducibility**

Run:

```powershell
python -m unittest tests.test_exports -v
python scripts/export_release.py --canonical data/canonical --dist dist
python scripts/export_release.py --canonical data/canonical --dist build/repeat
```

Compare SHA-256 hashes between `dist` and `build/repeat`, excluding SQLite header bytes only if the SQLite library introduces a documented nondeterministic field; otherwise require exact byte equality.

- [ ] **Step 5: Commit**

```powershell
git add src scripts tests dist
git commit -m "feat: publish static scholarly database exports"
```

### Task 8: Editorial workbook and final release audit

**Files:**
- Create: `scripts/build_editorial_workbook.mjs`
- Generate: `outputs/agw-data-foundation/Ancient_Greek_World_Data_Review.xlsx`
- Generate: `outputs/agw-data-foundation/preview-*.png`
- Create: `CHANGELOG.md`
- Create: `CITATION.cff`
- Create: `LICENSE-CODE`
- Create: `LICENSE-DATA`

**Interfaces:**
- Consumes: validated canonical tables and quality report.
- Produces: a visually reviewed XLSX editorial artifact and release documentation.

- [ ] **Step 1: Mark the spreadsheet operation exactly once**

Run from the spreadsheets skill directory:

```powershell
node container_tools/mark_artifact_operation_started.mjs --operation-kind create --expected-output-count 1 --output-format xlsx
```

Expected: success. Do not run this marker again.

- [ ] **Step 2: Build the workbook using the bundled runtime**

Create sheets `Read Me`, `Quality Summary`, `Entities`, `Places`, `Chronologies`, `Relationships`, `Sources`, `Review Queue`, and `Vocabularies`. Use filters, frozen headers, typed values, restrained status colors, readable widths, and source URLs in cells. The workbook is an editorial view; canonical CSV remains the source of truth.

- [ ] **Step 3: Inspect values and scan formula errors**

Use `workbook.inspect` on the summary and representative table ranges, then scan for `#REF!|#DIV/0!|#VALUE!|#NAME\?|#N/A`. Expected: no formula errors and counts equal the machine-readable report.

- [ ] **Step 4: Render every sheet and visually inspect it**

Render every populated sheet at readable scale. Fix clipped headers, unreadable wrapping, excessive widths, missing filters, and broken status formatting. Expected: all sheets legible with no blank default sheet.

- [ ] **Step 5: Run the complete release gate**

Run:

```powershell
python -m unittest discover -s tests -v
python scripts/build_data.py --raw data/raw/archaios_ellinikos_kosmos_entities_v0_1.csv --canonical data/canonical --check
python scripts/validate_release.py --canonical data/canonical --report-dir reports
python scripts/export_release.py --canonical data/canonical --dist dist --check
git status --short
```

Expected: all tests PASS, validators exit 0, exports match canonical data, and only intended release files are modified.

- [ ] **Step 6: Complete release documentation and commit**

Document dataset title, version, creators, scope, citation, licences, source attribution obligations, build commands, verification results, and known historical limitations.

```powershell
git add .
git commit -m "release: complete ancient Greek world data foundation"
```

