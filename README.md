# Ancient Greek World Atlas — Data Foundation

A bilingual, source-aware data foundation for a future static WebGIS of the ancient Greek world.

This repository currently contains the research/database phase only. It deliberately includes no map interface, frontend framework, image collection, Supabase project, or server runtime.

## Provenance

The submitted research file is preserved unchanged at `data/raw/archaios_ellinikos_kosmos_entities_v0_1.csv`. Its SHA-256 digest is recorded alongside it in `data/raw/SHA256SUMS`. Never edit the raw file; all corrections and enrichments belong in the canonical or research layers.

## Data layers

- `data/raw`: immutable submitted material;
- `data/research`: explicit editorial overrides, translations, source checks, and candidate decisions;
- `data/vocabularies`: controlled bilingual terms;
- `data/canonical`: normalized, Git-reviewable source of truth;
- `dist`: generated SQLite, JSON, GeoJSON, and linked-place exports;
- `reports`: machine-readable and human-readable quality reports;
- `outputs`: editorial workbook for manual review.

The governing design is documented in `docs/design/data-foundation.md`.

## Verification

```powershell
python -m unittest discover -s tests -v
python scripts/validate_release.py --canonical data/canonical --report-dir reports
```

The public release must contain zero validation errors. Historical uncertainty is retained as structured data and may appear as an explicit warning.
