# Changelog

All notable changes to the Ancient Greek World Atlas data foundation are documented here.

## 1.0.0 — 2026-08-15

### Added

- Preserved the submitted 226-row research CSV as an immutable, checksummed source.
- Defined a normalized nine-table scholarly model for entities, names, places, chronology, authorities, relationships, sources, claim support and external identifiers.
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
- Zero validation errors.
- 43 transparent warnings retained for documented uncertainty, proxy geometry, dated URL-access conditions and one coordinate comparison.
