# Source Policy / Πολιτική Πηγών

## Principles / Αρχές

1. A source supports a stated claim; it does not automatically validate every field in a record.
2. Authority is assessed from publisher, scholarly role, specificity and relevance, not from search ranking or HTTP status.
3. Canonical identifiers and stable institutional records are preferred to secondary summaries.
4. Accessibility and scholarly validity are stored separately.
5. All source corrections are additive and auditable; the raw research file is never rewritten.

1. Μια πηγή υποστηρίζει συγκεκριμένο ισχυρισμό και όχι αυτομάτως κάθε πεδίο μιας εγγραφής.
2. Η εγκυρότητα κρίνεται από τον φορέα, τον επιστημονικό ρόλο, την ειδικότητα και τη συνάφεια, όχι από την κατάταξη αναζήτησης ή την κατάσταση HTTP.
3. Προτιμώνται σταθερά αναγνωριστικά και θεσμικές εγγραφές.
4. Η προσβασιμότητα και η επιστημονική εγκυρότητα καταγράφονται χωριστά.

## Preferred hierarchy / Προτιμώμενη ιεράρχηση

The hierarchy guides selection but is not mechanical; a monument-specific excavation record may be more relevant than a broad national page.

1. current canonical gazetteer or authority record;
2. national archaeological service, official excavation project or site corpus;
3. UNESCO nomination/site documentation;
4. museum collection or curatorial essay;
5. peer-reviewed article, academic monograph or university publication;
6. edited scholarly reference work;
7. discovery-only knowledge graphs or aggregators, which must be replaced for substantive claims where possible.

Η ιεράρχηση καθοδηγεί αλλά δεν εφαρμόζεται μηχανικά: μια ειδική ανασκαφική δημοσίευση μπορεί να είναι καταλληλότερη από μια γενική κρατική σελίδα.

## Pleiades

Pleiades is used as the principal external place authority. The canonical resource is `https://pleiades.stoa.org/places/{id}` and its JSON serialization is cached with title, description, representative point, place types, names, contributors, modification date and retrieval date. Pleiades content remains under CC BY 3.0 and must retain attribution.

The release does not assume that a Pleiades representative point is a surveyed monument location. Geometry roles and certainty are evaluated separately. A polity's identifier may be attached to its representative-centre place assertion rather than to the polity entity itself.

Το Pleiades χρησιμοποιείται ως βασική εξωτερική αρχή τόπων. Η αντιπροσωπευτική του συντεταγμένη δεν θεωρείται αυτομάτως ακριβές σημείο μνημείου.

## URL normalization

Normalization is deliberately conservative:

- surrounding whitespace is removed;
- host names are case-folded;
- Pleiades is normalized to HTTPS;
- a trailing slash is removed except at a domain root;
- query parameters are preserved because they may identify a record;
- fragments are removed from source-record URLs.

No tracking parameter is removed unless an explicit reviewed override says the resulting URL is equivalent.

## URL status

`url_status` has operational meaning only:

- `ok`: the automated request returned a successful non-redirect response;
- `redirected`: it resolved successfully at another URL;
- `unavailable`: timeout, connection refusal, HTTP error, anti-bot rule or rate limit prevented retrieval;
- `unchecked`: no cached automated check exists.

`http_status` records the returned HTTP code when available. A blank code with `unavailable` records a network-level failure. `accessed_on` is the check or reconciliation date, not the publication date.

The 2026-08-15 check encountered rate limiting at the Metropolitan Museum, access denial at several museum/university records, and transient failures on a small number of pages. These remain warnings because the source identities were independently reconciled or manually titled. They are not promoted to “verified” merely by a later HTTP success.

Η κατάσταση URL είναι λειτουργική ένδειξη. Δεν αποτελεί βαθμό επιστημονικής εγκυρότητας.

## Source metadata and overrides

- `source-checks.csv` stores the mechanical retrieval result.
- `source-overrides.csv` supplies reviewed titles, publishers, classes, languages, licences or notes when HTML metadata is absent or misleading.
- `entity-source-overrides.csv` replaces a source only when it is irrelevant or demonstrably wrong for that entity.

One submitted source for the Kingdom of Cyrene under Magas was a UCL PDF about Demetrios of Byzantion. It was rejected and replaced by a peer-reviewed epigraphic study specifically concerning King Magas, with a Cambridge historical synthesis as secondary support. The rejected URL remains recorded in the research override for auditability but is absent from the public source registry.

Μια λανθασμένη πηγή για το βασίλειο της Κυρήνης υπό τον Μάγα απορρίφθηκε και αντικαταστάθηκε με ειδική επιστημονική μελέτη και δευτερεύουσα ακαδημαϊκή σύνθεση. Η απόρριψη παραμένει ορατή στο ερευνητικό αρχείο.

## Claim scopes

`entity_sources` assigns sources to controlled support scopes:

- `identity`
- `names`
- `description`
- `chronology`
- `geometry`
- `classification`
- `relationships`

Version 1.0.0 preserves the submitted primary-source intent across all seven scopes and attaches submitted secondary references with `is_primary=0`. Future specialist editing may narrow individual sources to more specific scopes; it must never remove the last supporting source for a required scope.

## Citation and licensing

Every source record has a citation string, URL, publisher and access date. A licence is populated only when the source or cached authority record states one clearly. Blank licence fields mean “not recorded here”, not “public domain”.

The original database compilation, schema and editorial additions have their own repository licences. Third-party content keeps its original terms. In particular, Pleiades extracts remain CC BY 3.0; this repository cannot relicense them under the database compilation licence.

Κενό πεδίο άδειας σημαίνει «δεν καταγράφηκε εδώ» και όχι «δημόσιος τομέας». Οι όροι τρίτων πηγών διατηρούνται ανεξάρτητα από την άδεια της πρωτότυπης σύνθεσης.

## Acceptance gate / Πύλη αποδοχής

A public record must have:

- at least one source for every required support scope;
- a non-empty source title, publisher, class, URL, access date and citation;
- an explicit URL status;
- no source known to be irrelevant to that entity;
- a documented override whenever automated metadata is replaced.

Records may still carry warnings for inaccessible URLs, proxy geometry, approximate dates or medium certainty. Those warnings preserve evidence quality instead of hiding it.
