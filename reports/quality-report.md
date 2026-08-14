# Quality Report / Αναφορά Ποιότητας

**Dataset version / Έκδοση:** 1.0.0  
**Generated / Παραγωγή:** 2026-08-15  
**Status / Κατάσταση:** PASS  
**Errors / Σφάλματα:** 0  
**Warnings / Προειδοποιήσεις:** 43

Warnings preserve uncertainty and URL-access conditions; they do not invalidate a zero-error release. / Οι προειδοποιήσεις διατηρούν την αβεβαιότητα και τις συνθήκες πρόσβασης URL· δεν ακυρώνουν έκδοση χωρίς σφάλματα.

## Canonical tables / Κανονικοί πίνακες

| Table | Rows |
|---|---:|
| `authorities` | 312 |
| `chronologies` | 226 |
| `entities` | 226 |
| `entity_sources` | 1589 |
| `external_ids` | 184 |
| `names` | 671 |
| `places` | 226 |
| `relationships` | 326 |
| `sources` | 213 |

## Coverage / Κάλυψη

- Bilingual entity completeness: **100.0%** (226/226)
- Complete seven-scope source support: **100.0%** (226/226)
- Pleiades alignments matched: **184/184**
- Internal relationship targets: **88**
- Stable authority targets: **238**

## Warning classes / Κατηγορίες προειδοποιήσεων

| Code | Count |
|---|---:|
| `PLEIADES_COORDINATE_OFFSET` | 1 |
| `PROXY_GEOMETRY` | 8 |
| `RETAINED_UNCERTAINTY` | 19 |
| `SOURCE_URL_ACCESS` | 15 |

## Interpretation / Ερμηνεία

- `RETAINED_UNCERTAINTY`: reviewed record whose historical or spatial confidence intentionally remains medium.
- `PROXY_GEOMETRY`: approximate marker, not a surveyed monument footprint.
- `SOURCE_URL_ACCESS`: access failure or unchecked URL; not a scholarly rejection.
- `PLEIADES_COORDINATE_OFFSET`: measured coordinate difference retained for transparency.

Canonical CSV remains the source of truth. Full machine-readable metrics and issue records are in `quality-report.json`; actionable rows are in `review-queue.csv`.
