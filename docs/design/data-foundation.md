# Ancient Greek World Atlas — Data Foundation Specification

**Status:** Approved for implementation  
**Date:** 2026-08-14  
**Phase:** Scholarly data foundation only

## 1. Objective

Create a versioned, bilingual, source-aware, machine-validated database for a future WebGIS of the ancient Greek world. The submitted 226-row CSV is preserved unchanged as the provenance root, then transformed into a normalized canonical dataset and reproducible static exports.

This phase ends with a trustworthy data release, documentation, validation reports, and an editorial workbook. It does **not** implement the map, interface, media gallery, hosting, or GitHub Pages site.

## 2. Scope

The atlas retains the four editorial collections present in the research file:

1. cities;
2. colonies;
3. sanctuaries;
4. kingdoms and polities.

The canonical ontology separates what an entity *is* from how it is grouped in the atlas:

- `settlement`: cities, poleis, ports, and settlements;
- `sanctuary`: sacred complexes, cult places, and oracle sites;
- `polity`: kingdoms, empires, city-kingdoms, and palatial states.

“Colony” is not treated as a mutually exclusive physical entity class. A colony is a settlement with a historically attested colonial foundation classification and, where known, a typed relationship to one or more metropoleis. This prevents Ephesus, Syracuse, Miletus, and similar places from becoming ontologically incompatible with cities.

Supporting authorities such as deities, dynasties, ancient regions, and external predecessor/successor polities may appear in controlled authority tables but are not map entities in this phase.

## 3. Chronological and geographic boundary

- Display chronology: approximately 1600 BCE through 600 CE.
- Signed integer convention: BCE years are negative, CE years are positive, and year zero is prohibited.
- A display cutoff is never represented as a destruction, abandonment, or political termination date.
- The corpus covers the Mediterranean, Black Sea, Near East, Central Asia, and northwestern South Asia where the selected entities belong to Greek, Macedonian, Hellenistic, or Greek-colonial historical contexts.
- Modern-country fields describe present-day location only. Ancient regions are separate authorities and are never inferred from modern borders.

## 4. Canonical data model

The editable source of truth is a set of UTF-8 relational CSV tables. They remain easy to review in Git and spreadsheets. A deterministic build produces SQLite, JSON, GeoJSON, and an editorial XLSX workbook.

### 4.1 `entities.csv`

One row per scholarly entity.

Required fields include:

- stable `entity_id`;
- `entity_class` and `entity_subtype` from controlled vocabularies;
- preferred Greek and English labels;
- Ancient Greek label where supported;
- concise Greek and English descriptions;
- editorial collection membership;
- temporal/spatial summary status;
- record confidence and review state;
- origin and last-reviewed metadata.

Existing IDs are retained unless demonstrably invalid. IDs are identifiers, not labels, and must remain stable when names change.

### 4.2 `names.csv`

Alternative, ancient, modern, and transliterated names with:

- stable name ID and owning entity;
- value, BCP 47 language tag, and script;
- name type;
- preferred flag;
- optional temporal scope;
- source attribution.

### 4.3 `places.csv`

One row per spatial assertion rather than one row per entity. It records:

- coordinates in WGS84;
- GeoJSON geometry type and geometry role;
- site, proxy, or representative-center semantics;
- location certainty and precision;
- modern locality and ISO 3166-1 country code;
- source and spatial note in Greek and English.

Polities are never implied to occupy a point. Their point is explicitly a `representative_center`. Territorial polygons are excluded until sourced, time-scoped boundaries can be supplied.

### 4.4 `chronologies.csv`

One or more temporal assertions per entity with:

- signed start and end year;
- start/end qualifiers and overall precision;
- chronology basis, such as occupation, cult activity, political phase, or display cutoff;
- bilingual display labels and notes;
- source and confidence.

Open, disputed, approximate, mixed, and display-cutoff values remain explicit; uncertain dates are never silently converted to exact dates.

### 4.5 `relationships.csv`

Typed edges replace text-only relationship columns. Predicates include:

- `founded_from`;
- `associated_with_settlement`;
- `representative_center`;
- `predecessor_of` and `successor_of`;
- `cult_of`;
- `dynasty`;
- `part_of`.

Where the target is in the corpus, a foreign key is mandatory. Otherwise a stable authority ID and bilingual label are used. Free-text labels are retained only as migration evidence.

### 4.6 `authorities.csv`

Controlled supporting concepts and external targets: ancient regions, deities/cults, dynasties, metropoleis not yet in the corpus, and external political entities. Each authority has a stable ID, type, bilingual labels, optional URI, and source.

### 4.7 `sources.csv` and `entity_sources.csv`

Sources are deduplicated into a registry with:

- stable source ID;
- title, publisher/institution, URL, source class, language, licence where known;
- access date and URL-check status;
- notes and citation text.

The junction table records which claim groups a source supports: identity, names, description, chronology, geometry, classification, and relationships. URL reachability is recorded separately from scholarly verification.

## 5. Interoperability

- Coordinates and GeoJSON follow longitude/latitude order in WGS84.
- Modern countries use ISO 3166-1 alpha-3 codes in the canonical tables and alpha-2 codes in Linked Places exports.
- Languages use BCP 47 tags (`el`, `en`, `grc`).
- Pleiades place IDs and canonical URIs remain first-class external identifiers.
- The GeoJSON export is compatible with RFC 7946.
- A Linked Places–inspired JSON-LD/GeoJSON export preserves names, links, relations, chronology, citations, and certainty without forcing the editing model to be JSON-LD.

## 6. Bilingual policy

- Greek is the authoritative editorial language of the submitted research.
- Every public-facing label, description, chronology note, and spatial note must have an English counterpart.
- Machine-assisted translations are allowed only when marked with their method and language-review status.
- Structure, identifiers, dates, coordinates, and citations are language-neutral.
- Translation must not introduce stronger certainty than the Greek source text.

## 7. Research and source policy

Source priority:

1. scholarly gazetteers and structured research datasets, especially Pleiades;
2. UNESCO, national archaeological services, excavation projects, museums, universities, and peer-reviewed publications;
3. reputable reference works for discovery and secondary corroboration;
4. collaborative knowledge bases only as discovery or identifier-linking aids, never as the sole support for a disputed historical claim.

Pleiades records are reconciled against the current canonical JSON representation. The imported coordinate is compared with the Pleiades representative point, but is not automatically replaced when the source describes a proxy, a sanctuary within a city, or a representative center.

Every unresolved disagreement is preserved in the review queue. “Perfect” means no hidden uncertainty or broken integrity, not pretending that all ancient evidence is certain.

## 8. Corpus expansion policy

The 226 submitted records form release 1’s reviewed core. Expansion is permitted only when a candidate:

- belongs to one of the retained editorial collections;
- is a material omission for interpreting the Greek world at atlas scale;
- has a stable location and at least one authoritative source;
- can meet the same bilingual and provenance requirements as existing records.

Unverified candidates remain in a separate candidate ledger and never enter canonical exports. Reclassification and relationship normalization may increase the amount of information without duplicating the same historical place as both an unrelated “city” and “colony.”

## 9. Validation and release gates

A data release fails if any of the following occurs:

- duplicate or malformed stable IDs;
- missing required bilingual fields;
- invalid foreign keys or uncontrolled vocabulary values;
- invalid coordinate ranges, reversed coordinate order, or geometry/coordinate mismatch;
- year zero, start after end, or a display cutoff presented as a terminal historical event;
- duplicate primary names within an entity/language/name type;
- missing source support for identity, geometry, or chronology;
- Pleiades ID/URL mismatch;
- unmarked proxy or representative-center points;
- unresolved `needs_review` records in the public release;
- invalid JSON, GeoJSON, or SQLite foreign-key checks;
- non-deterministic generated outputs.

Warnings are allowed only for documented historical uncertainty, missing territorial polygons, unavailable external URLs, or machine-assisted text awaiting optional stylistic review. Warnings must appear in the release report.

## 10. Outputs

- preserved raw CSV with checksum;
- normalized canonical CSV tables;
- controlled vocabularies and JSON Schemas;
- SQLite database with foreign keys, indexes, and views;
- compact JSON and GeoJSON exports for the future WebGIS;
- source/reconciliation ledger;
- review queue and candidate ledger;
- bilingual data dictionary and methodology;
- automated validation suite and machine-readable quality report;
- styled editorial XLSX workbook for manual inspection.

## 11. Non-goals for this phase

- no map interface or frontend framework;
- no image acquisition or media licensing work;
- no Supabase, remote database, authentication, or server runtime;
- no speculative kingdom polygons;
- no attempt to model every monument, battle, person, route, or archaeological object;
- no claim that a curated atlas selection is an exhaustive gazetteer of all Greek antiquity.

