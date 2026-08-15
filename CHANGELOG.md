# Changelog

All notable changes to the Ancient Greek World Atlas and its data foundation are documented here.

## 1.0.0 — 2026-08-15

### Added

- Released a Greek-first, fully bilingual static WebGIS with catalogue, map, filters, search, statistics and source-rich record views.
- Added count-only clustering and unnumbered class-shaped symbols for settlements, sanctuaries and polities, including explicit proxy and representative-centre treatments.
- Added shareable URL state for language, filters, search, selected record, basemap and map viewport, with Back/Forward restoration.
- Added responsive desktop and mobile workbenches, keyboard tab control, native dialogs, focus restoration and non-blocking map failure fallback.
- Added deterministic GitHub Pages packaging and a least-privilege verification/deployment workflow.
- Added browser regression coverage at desktop, tablet, mobile and 200% effective zoom viewports.
- Added 452 reviewed Wikimedia Commons images (two per entity), stored as optimized local WebP files with bilingual captions, accessible gallery controls and per-work attribution.
- Added normalized media records, reusable-licence enforcement, local-path safety, contiguous gallery ordering and SHA-256 file verification.
- Preserved the submitted 226-row research CSV as an immutable, checksummed source.
- Defined a normalized ten-table scholarly model for entities, names, places, chronology, authorities, relationships, sources, claim support, external identifiers and media.
- Added authoritative Greek and public English names, descriptions and controlled vocabularies.
- Reconciled 184 Pleiades identifiers against canonical place records without silently replacing local coordinates.
- Added 326 typed internal and authority-backed relationships.
- Added complete source support across seven claim scopes for every entity.
- Recorded 15 expansion candidates with explicit include, defer or exclude decisions.
- Added deterministic SQLite, JSON, GeoJSON and Linked Places JSON-LD exports with SHA-256 checksums.
- Added bilingual methodology, source policy and data dictionary documentation.
- Added a 14-sheet editorial review workbook with formula-driven release metrics and a review queue.
- Added automated schema, provenance, translation, relationship, source, spatial, export and CSV-integrity tests.

### Quality status

- 226/226 bilingual entities.
- 226/226 entities with complete seven-scope source support.
- 184/184 submitted Pleiades identifiers reconciled.
- 226/226 entities with two reviewed bilingual media items (452/452 files).
- Zero validation errors.
- 43 transparent warnings retained for documented uncertainty, proxy geometry, dated URL-access conditions and one coordinate comparison.
- 56 frontend unit/integration checks and 13 active browser workflow checks passing at release preparation.
