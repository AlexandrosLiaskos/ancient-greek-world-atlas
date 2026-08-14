const LANGUAGES = Object.freeze(['el', 'en']);

const MESSAGES = Object.freeze({
  el: Object.freeze({
    appTitle: 'Άτλας του Αρχαίου Ελληνικού Κόσμου',
    metaDescription: 'Δίγλωσσος διαδραστικός άτλας 226 τόπων και πολιτειών του αρχαίου ελληνικού κόσμου.',
    skipToAtlas: 'Μετάβαση στον άτλαντα',
    about: 'Σχετικά με τον άτλαντα',
    closeAbout: 'Κλείσιμο πληροφοριών',
    switchLanguage: 'Switch to English',
    workbench: 'Εργαλεία άτλαντα',
    tabsLabel: 'Ενότητες άτλαντα',
    catalogue: 'Κατάλογος',
    filters: 'Φίλτρα',
    search: 'Αναζήτηση',
    statistics: 'Στατιστικά',
    closePanel: 'Κλείσιμο καταλόγου',
    clear: 'Καθαρισμός',
    clearFilters: 'Καθαρισμός φίλτρων',
    showResults: 'Προβολή {count} εγγραφών',
    loadingRecords: 'Φόρτωση {count} εγγραφών…',
    noResultsTitle: 'Δεν βρέθηκαν εγγραφές',
    noResultsBody: 'Αλλάξτε την αναζήτηση ή καθαρίστε τα φίλτρα για να εμφανιστεί ξανά ο κατάλογος.',
    searchLabel: 'Όνομα, τόπος ή λέξη',
    searchPlaceholder: 'π.χ. Αθήνα, Athenae, Ιωνία',
    clearSearch: 'Καθαρισμός αναζήτησης',
    searchHint: 'Αναζήτηση σε ελληνικά, αγγλικά και αρχαία ονόματα.',
    statisticsHint: 'Οι κατανομές ενημερώνονται μαζί με τον ορατό κατάλογο.',
    mapLabel: 'Διαδραστικός χάρτης',
    mapRegionLabel: 'Χάρτης αρχαίου ελληνικού κόσμου',
    mapLoading: 'Προετοιμασία χάρτη…',
    mapError: 'Ο χάρτης δεν φορτώθηκε. Ο κατάλογος και οι εγγραφές παραμένουν διαθέσιμα.',
    mapTileError: 'Ο χαρτογραφικός χάρτης βάσης δεν είναι διαθέσιμος αυτή τη στιγμή.',
    legend: 'Υπόμνημα',
    settlements: 'Οικισμοί',
    sanctuaries: 'Ιερά',
    polities: 'Πολιτείες',
    cluster: 'Συγκέντρωση',
    uncertainPoint: 'Προσεγγιστικό ή αντιπροσωπευτικό σημείο',
    visibleStatus: '{visible} από {total} εγγραφές',
    viewRecord: 'Προβολή εγγραφής',
    openRecord: 'Άνοιγμα εγγραφής',
    record: 'Εγγραφή',
    closeRecord: 'Κλείσιμο εγγραφής',
    description: 'Περιγραφή',
    chronology: 'Χρονολόγηση',
    geography: 'Γεωγραφία',
    relationships: 'Σχέσεις',
    sources: 'Πηγές',
    identifiers: 'Αναγνωριστικά',
    editorialStatus: 'Επιμελητική κατάσταση',
    modernLocality: 'Σύγχρονη τοποθεσία',
    modernCountry: 'Σύγχρονη χώρα',
    ancientRegion: 'Αρχαία περιοχή',
    spatialRole: 'Χωρικός ρόλος',
    coordinateSource: 'Πηγή συντεταγμένων',
    locationPrecision: 'Ακρίβεια θέσης',
    recordConfidence: 'Τεκμηρίωση εγγραφής',
    reviewState: 'Κατάσταση ελέγχου',
    translationStatus: 'Κατάσταση μετάφρασης',
    lastReviewed: 'Τελευταίος έλεγχος',
    reviewer: 'Επιμέλεια',
    dataVersion: 'Έκδοση δεδομένων',
    sourceScopes: 'Τεκμηριώνει',
    primarySource: 'Κύρια πηγή',
    openSource: 'Άνοιγμα πηγής',
    noDescription: 'Δεν έχει καταχωριστεί περιγραφή.',
    noRelationships: 'Δεν έχουν καταχωριστεί συνδεδεμένες εγγραφές.',
    noSources: 'Δεν έχουν καταχωριστεί πηγές.',
    aliases: 'Άλλα ονόματα',
    copyCoordinates: 'Αντιγραφή συντεταγμένων',
    coordinatesCopied: 'Οι συντεταγμένες αντιγράφηκαν.',
    coordinatesCopyFailed: 'Δεν ήταν δυνατή η αντιγραφή. Επιλέξτε τις συντεταγμένες και αντιγράψτε τις χειροκίνητα.',
    externalLink: 'Εξωτερικός σύνδεσμος',
    activeFilters: 'Ενεργά φίλτρα',
    filterField: 'Πεδίο φίλτρου',
    filterOptions: 'Επιλογές φίλτρου',
    optionSearch: 'Αναζήτηση επιλογών',
    chronologyFrom: 'Από',
    chronologyTo: 'Έως',
    allRecords: 'Όλες οι εγγραφές',
    dataLoadErrorTitle: 'Τα δεδομένα δεν φορτώθηκαν',
    dataLoadErrorBody: 'Ελέγξτε τη σύνδεση ή ανοίξτε ξανά τη σελίδα. Ο άτλας δεν εμφανίζει ελλιπή δεδομένα.',
    retry: 'Νέα προσπάθεια',
    resultCount: ({ count }) => `${formatInteger(count, 'el')} ${Number(count) === 1 ? 'εγγραφή' : 'εγγραφές'}`,
  }),
  en: Object.freeze({
    appTitle: 'Ancient Greek World Atlas',
    metaDescription: 'A bilingual interactive atlas of 226 places and polities of the ancient Greek world.',
    skipToAtlas: 'Skip to the atlas',
    about: 'About the atlas',
    closeAbout: 'Close information',
    switchLanguage: 'Μετάβαση στα ελληνικά',
    workbench: 'Atlas tools',
    tabsLabel: 'Atlas sections',
    catalogue: 'Catalogue',
    filters: 'Filters',
    search: 'Search',
    statistics: 'Statistics',
    closePanel: 'Close catalogue',
    clear: 'Clear',
    clearFilters: 'Clear filters',
    showResults: 'Show {count} records',
    loadingRecords: 'Loading {count} records…',
    noResultsTitle: 'No records found',
    noResultsBody: 'Change the search or clear the filters to restore the catalogue.',
    searchLabel: 'Name, place, or word',
    searchPlaceholder: 'e.g. Athens, Athenae, Ionia',
    clearSearch: 'Clear search',
    searchHint: 'Search Greek, English, and ancient names.',
    statisticsHint: 'Distributions update with the visible catalogue.',
    mapLabel: 'Interactive map',
    mapRegionLabel: 'Map of the ancient Greek world',
    mapLoading: 'Preparing map…',
    mapError: 'The map could not load. The catalogue and records remain available.',
    mapTileError: 'The map basemap is currently unavailable.',
    legend: 'Legend',
    settlements: 'Settlements',
    sanctuaries: 'Sanctuaries',
    polities: 'Polities',
    cluster: 'Cluster',
    uncertainPoint: 'Approximate or representative point',
    visibleStatus: '{visible} of {total} records',
    viewRecord: 'View record',
    openRecord: 'Open record',
    record: 'Record',
    closeRecord: 'Close record',
    description: 'Description',
    chronology: 'Chronology',
    geography: 'Geography',
    relationships: 'Relationships',
    sources: 'Sources',
    identifiers: 'Identifiers',
    editorialStatus: 'Editorial status',
    modernLocality: 'Modern locality',
    modernCountry: 'Modern country',
    ancientRegion: 'Ancient region',
    spatialRole: 'Spatial role',
    coordinateSource: 'Coordinate source',
    locationPrecision: 'Location precision',
    recordConfidence: 'Record confidence',
    reviewState: 'Review state',
    translationStatus: 'Translation status',
    lastReviewed: 'Last reviewed',
    reviewer: 'Reviewed by',
    dataVersion: 'Data version',
    sourceScopes: 'Supports',
    primarySource: 'Primary source',
    openSource: 'Open source',
    noDescription: 'No description has been recorded.',
    noRelationships: 'No related records have been recorded.',
    noSources: 'No sources have been recorded.',
    aliases: 'Other names',
    copyCoordinates: 'Copy coordinates',
    coordinatesCopied: 'Coordinates copied.',
    coordinatesCopyFailed: 'Copying failed. Select the coordinates and copy them manually.',
    externalLink: 'External link',
    activeFilters: 'Active filters',
    filterField: 'Filter field',
    filterOptions: 'Filter options',
    optionSearch: 'Search options',
    chronologyFrom: 'From',
    chronologyTo: 'To',
    allRecords: 'All records',
    dataLoadErrorTitle: 'The data did not load',
    dataLoadErrorBody: 'Check the connection or reopen the page. The atlas will not display incomplete data.',
    retry: 'Try again',
    resultCount: ({ count }) => `${formatInteger(count, 'en')} ${Number(count) === 1 ? 'record' : 'records'}`,
  }),
});

const VOCABULARY = Object.freeze({
  entityClass: Object.freeze({
    settlement: Object.freeze({ el: 'Οικισμός', en: 'Settlement' }),
    sanctuary: Object.freeze({ el: 'Ιερό', en: 'Sanctuary' }),
    polity: Object.freeze({ el: 'Πολιτεία', en: 'Polity' }),
  }),
  collection: Object.freeze({
    city: Object.freeze({ el: 'Πόλη', en: 'City' }),
    colony: Object.freeze({ el: 'Αποικία', en: 'Colony' }),
    sanctuary: Object.freeze({ el: 'Ιερό', en: 'Sanctuary' }),
    kingdom: Object.freeze({ el: 'Βασίλειο / πολιτεία', en: 'Kingdom / polity' }),
  }),
  geometryRole: Object.freeze({
    site: Object.freeze({ el: 'Θέση', en: 'Site' }),
    proxy: Object.freeze({ el: 'Προσεγγιστικό σημείο', en: 'Approximate point' }),
    representative_center: Object.freeze({ el: 'Αντιπροσωπευτικό κέντρο', en: 'Representative centre' }),
  }),
  confidence: Object.freeze({
    high: Object.freeze({ el: 'Υψηλή τεκμηρίωση', en: 'High confidence' }),
    medium: Object.freeze({ el: 'Μέτρια τεκμηρίωση', en: 'Medium confidence' }),
    low: Object.freeze({ el: 'Χαμηλή τεκμηρίωση', en: 'Low confidence' }),
  }),
  facet: Object.freeze({
    entityClass: Object.freeze({ el: 'Κατηγορία', en: 'Class' }),
    collection: Object.freeze({ el: 'Συλλογή', en: 'Collection' }),
    country: Object.freeze({ el: 'Σύγχρονη χώρα', en: 'Modern country' }),
    ancientRegion: Object.freeze({ el: 'Αρχαία περιοχή', en: 'Ancient region' }),
    confidence: Object.freeze({ el: 'Τεκμηρίωση', en: 'Confidence' }),
    geometryRole: Object.freeze({ el: 'Χωρικός ρόλος', en: 'Spatial role' }),
    chronology: Object.freeze({ el: 'Χρονολογία', en: 'Chronology' }),
  }),
  predicate: Object.freeze({
    founded_from: Object.freeze({ el: 'Ιδρύθηκε από', en: 'Founded from' }),
    associated_with_settlement: Object.freeze({ el: 'Συνδέεται με οικισμό', en: 'Associated with settlement' }),
    representative_center: Object.freeze({ el: 'Έχει αντιπροσωπευτικό κέντρο', en: 'Has representative centre' }),
    predecessor_of: Object.freeze({ el: 'Προκάτοχος του', en: 'Predecessor of' }),
    successor_of: Object.freeze({ el: 'Διάδοχος του', en: 'Successor of' }),
    cult_of: Object.freeze({ el: 'Λατρεία', en: 'Cult of' }),
    dynasty: Object.freeze({ el: 'Δυναστεία', en: 'Dynasty' }),
    part_of: Object.freeze({ el: 'Μέρος του', en: 'Part of' }),
    preceded_by: Object.freeze({ el: 'Προηγήθηκε', en: 'Preceded by' }),
    succeeded_by: Object.freeze({ el: 'Διαδέχθηκε', en: 'Succeeded by' }),
    ruled_by_dynasty: Object.freeze({ el: 'Κυβερνήθηκε από δυναστεία', en: 'Ruled by dynasty' }),
  }),
  chronologyBasis: Object.freeze({
    occupation_window: Object.freeze({ el: 'Περίοδος κατοίκησης', en: 'Occupation window' }),
    cult_activity_window: Object.freeze({ el: 'Περίοδος λατρευτικής δραστηριότητας', en: 'Cult activity window' }),
    political_phase: Object.freeze({ el: 'Πολιτική φάση', en: 'Political phase' }),
  }),
  precision: Object.freeze({
    exact: Object.freeze({ el: 'Ακριβής', en: 'Exact' }),
    approximate: Object.freeze({ el: 'Κατά προσέγγιση', en: 'Approximate' }),
    uncertain: Object.freeze({ el: 'Αβέβαιη', en: 'Uncertain' }),
    display_cutoff: Object.freeze({ el: 'Όριο προβολής άτλαντα', en: 'Atlas display cutoff' }),
    broad_range: Object.freeze({ el: 'Ευρύ χρονικό εύρος', en: 'Broad range' }),
    mixed: Object.freeze({ el: 'Μικτή ακρίβεια', en: 'Mixed precision' }),
    disputed: Object.freeze({ el: 'Αμφισβητούμενη', en: 'Disputed' }),
    unknown: Object.freeze({ el: 'Άγνωστη', en: 'Unknown' }),
  }),
  sourceScope: Object.freeze({
    identity: Object.freeze({ el: 'Ταυτότητα', en: 'Identity' }),
    names: Object.freeze({ el: 'Ονόματα', en: 'Names' }),
    classification: Object.freeze({ el: 'Ταξινόμηση', en: 'Classification' }),
    description: Object.freeze({ el: 'Περιγραφή', en: 'Description' }),
    geometry: Object.freeze({ el: 'Γεωμετρία', en: 'Geometry' }),
    chronology: Object.freeze({ el: 'Χρονολόγηση', en: 'Chronology' }),
    relationships: Object.freeze({ el: 'Σχέσεις', en: 'Relationships' }),
  }),
  reviewState: Object.freeze({
    reviewed: Object.freeze({ el: 'Ελεγμένη', en: 'Reviewed' }),
    pending: Object.freeze({ el: 'Σε αναμονή ελέγχου', en: 'Pending review' }),
  }),
  translationStatus: Object.freeze({
    machine_assisted_reviewed: Object.freeze({ el: 'Υποβοηθούμενη μετάφραση, ελεγμένη', en: 'Machine-assisted, reviewed' }),
    human_reviewed: Object.freeze({ el: 'Ανθρώπινη μετάφραση, ελεγμένη', en: 'Human-reviewed' }),
  }),
  period: Object.freeze({
    bronze: Object.freeze({ el: 'Εποχή του Χαλκού', en: 'Bronze Age' }),
    archaic: Object.freeze({ el: 'Αρχαϊκή περίοδος', en: 'Archaic period' }),
    classical: Object.freeze({ el: 'Κλασική περίοδος', en: 'Classical period' }),
    hellenistic: Object.freeze({ el: 'Ελληνιστική περίοδος', en: 'Hellenistic period' }),
    roman: Object.freeze({ el: 'Ρωμαϊκή περίοδος', en: 'Roman period' }),
    lateAntique: Object.freeze({ el: 'Ύστερη αρχαιότητα', en: 'Late Antiquity' }),
  }),
});

function normalizeLanguage(lang) {
  return LANGUAGES.includes(lang) ? lang : 'el';
}

function formatInteger(value, lang) {
  return new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: 0 }).format(Number(value));
}

function interpolate(template, values) {
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, key) => (
    Object.hasOwn(values, key) ? String(values[key]) : match
  ));
}

export function localeFor(lang) {
  return normalizeLanguage(lang) === 'en' ? 'en-GB' : 'el-GR';
}

export function localized(pair, lang = 'el') {
  if (typeof pair === 'string') return pair.trim();
  if (!pair || typeof pair !== 'object') return '';
  const active = normalizeLanguage(lang);
  const fallback = active === 'el' ? 'en' : 'el';
  return String(pair[active] ?? '').trim() || String(pair[fallback] ?? '').trim();
}

export function message(lang, key, values = {}) {
  const active = normalizeLanguage(lang);
  const entry = MESSAGES[active][key];
  if (entry === undefined) throw new RangeError(`Unknown message: ${key}`);
  return typeof entry === 'function' ? entry(values) : interpolate(entry, values);
}

export function vocabularyLabel(group, value, lang = 'el') {
  const entry = VOCABULARY[group]?.[value];
  if (entry) return localized(entry, lang);
  return String(value ?? '').replaceAll('_', ' ').trim();
}

export function formatYear(year, lang = 'el') {
  const value = Number(year);
  if (!Number.isInteger(value)) throw new TypeError('Year must be an integer.');
  if (value === 0) throw new RangeError('Historical chronology has no year zero.');
  const active = normalizeLanguage(lang);
  const era = value < 0
    ? (active === 'el' ? 'π.Χ.' : 'BCE')
    : (active === 'el' ? 'μ.Χ.' : 'CE');
  return `${formatInteger(Math.abs(value), active)} ${era}`;
}

export function formatDateRange(chronology, lang = 'el') {
  const reviewedLabel = localized(chronology?.label, lang);
  if (reviewedLabel) return reviewedLabel;
  const start = numberOrNull(chronology?.startYear);
  const end = numberOrNull(chronology?.endYear);
  if (start === null && end === null) return '';
  if (start !== null && end !== null && start === end) return formatYear(start, lang);
  if (start === null) return `${normalizeLanguage(lang) === 'el' ? 'έως' : 'until'} ${formatYear(end, lang)}`;
  if (end === null) return `${normalizeLanguage(lang) === 'el' ? 'από' : 'from'} ${formatYear(start, lang)}`;
  return `${formatYear(start, lang)}–${formatYear(end, lang)}`;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatCoordinates(latitude, longitude, lang = 'el') {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  const active = normalizeLanguage(lang);
  const formatter = new Intl.NumberFormat(localeFor(active), {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
  const directions = active === 'el'
    ? { north: 'Β', south: 'Ν', east: 'Α', west: 'Δ' }
    : { north: 'N', south: 'S', east: 'E', west: 'W' };
  return `${formatter.format(Math.abs(lat))}° ${lat >= 0 ? directions.north : directions.south} · ${formatter.format(Math.abs(lng))}° ${lng >= 0 ? directions.east : directions.west}`;
}

export { LANGUAGES, MESSAGES, VOCABULARY, normalizeLanguage };
