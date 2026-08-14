import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";


const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const outputDir = path.join(root, "outputs", "agw-data-foundation");
const outputPath = path.join(outputDir, "Ancient_Greek_World_Data_Review.xlsx");

const palette = {
  ink: "#26322D",
  green: "#355C4A",
  olive: "#6B7355",
  terracotta: "#A65F3F",
  gold: "#C5A96B",
  parchment: "#F7F1E5",
  paper: "#FFFDF8",
  sage: "#E5ECE5",
  rose: "#F5E2DC",
  sand: "#E8DDC6",
  muted: "#66736C",
  white: "#FFFFFF",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
    rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map((value) => value.replace(/^\uFEFF/, ""));
  return rows.slice(1).flatMap((values, index) => {
    if (!values.some((value) => value !== "")) return [];
    if (values.length !== headers.length) {
      throw new Error(
        `CSV row ${index + 2} has ${values.length} fields; expected ${headers.length}`,
      );
    }
    return [Object.fromEntries(headers.map((header, column) => [header, values[column]]))];
  });
}

async function readCsv(relativePath) {
  return parseCsv(await fs.readFile(path.join(root, relativePath), "utf8"));
}

function columnLetter(index) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function titleCase(value) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const integerFields = new Set([
  "start_year",
  "end_year",
  "http_status",
  "sort_order",
]);
const numberFields = new Set(["latitude", "longitude", "distance_m"]);
const booleanFields = new Set(["is_preferred", "display_cutoff", "is_primary"]);
const dateFields = new Set(["accessed_on", "last_reviewed", "reviewed_on", "retrieved_on"]);

function typedValue(field, value) {
  if (value === "") return null;
  if (integerFields.has(field)) return Number.parseInt(value, 10);
  if (numberFields.has(field)) return Number.parseFloat(value);
  if (booleanFields.has(field)) return value === "1";
  if (dateFields.has(field) && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00Z`);
  }
  return value;
}

function styleTitle(sheet, endColumn, title, subtitle) {
  sheet.showGridLines = false;
  sheet.mergeCells(`A1:${endColumn}1`);
  sheet.getRange("A1").values = [[title]];
  sheet.getRange(`A1:${endColumn}1`).format = {
    fill: palette.ink,
    font: { name: "Palatino Linotype", size: 18, bold: true, color: palette.white },
    verticalAlignment: "center",
  };
  sheet.getRange(`A1:${endColumn}1`).format.rowHeight = 34;
  sheet.mergeCells(`A2:${endColumn}2`);
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange(`A2:${endColumn}2`).format = {
    fill: palette.parchment,
    font: { name: "Aptos", size: 9, italic: true, color: palette.muted },
    verticalAlignment: "center",
    wrapText: true,
    borders: { bottom: { style: "thin", color: palette.gold } },
  };
  sheet.getRange(`A2:${endColumn}2`).format.rowHeight = 28;
}

function setWidths(sheet, columns, lastRow, customWidths = {}) {
  columns.forEach((field, index) => {
    let width = customWidths[field];
    if (!width) {
      if (field.endsWith("_id") || field === "entity_id" || field === "url_status") width = 24;
      else if (field.includes("description") || field.includes("note") || field.includes("reason")) width = 38;
      else if (field === "url" || field.includes("citation")) width = 45;
      else if (field.includes("name") || field.includes("label") || field.includes("title")) width = 28;
      else if (field.includes("year") || field === "latitude" || field === "longitude") width = 13;
      else width = 18;
    }
    const letter = columnLetter(index);
    sheet.getRange(`${letter}1:${letter}${lastRow}`).format.columnWidth = width;
  });
}

function applySemanticFormats(sheet, columns, firstDataRow, lastDataRow) {
  columns.forEach((field, index) => {
    const letter = columnLetter(index);
    const range = sheet.getRange(`${letter}${firstDataRow}:${letter}${lastDataRow}`);
    if (integerFields.has(field)) range.format.numberFormat = "#,##0";
    if (numberFields.has(field)) range.format.numberFormat = field === "distance_m" ? "#,##0.00" : "0.000000";
    if (dateFields.has(field)) range.format.numberFormat = "yyyy-mm-dd";
    if (booleanFields.has(field)) range.format.horizontalAlignment = "center";
    if (
      field.includes("description") ||
      field.includes("note") ||
      field.includes("reason") ||
      field.includes("label") ||
      field.includes("migration_evidence") ||
      field.includes("citation") ||
      field === "publisher" ||
      field === "url" ||
      field === "geometry_geojson" ||
      field === "geometry_wkt"
    ) {
      range.format.wrapText = true;
      range.format.verticalAlignment = "top";
    }
  });
}

function buildDataSheet(sheet, title, subtitle, rows, options = {}) {
  if (!rows.length) throw new Error(`No rows supplied for ${title}`);
  const columns = options.columns ?? Object.keys(rows[0]);
  const endColumn = columnLetter(columns.length - 1);
  const firstDataRow = 5;
  const lastDataRow = firstDataRow + rows.length - 1;
  styleTitle(sheet, endColumn, title, subtitle);
  sheet.getRange(`A4:${endColumn}4`).values = [columns];
  const matrix = rows.map((row) => columns.map((field) => typedValue(field, row[field] ?? "")));
  sheet.getRange(`A${firstDataRow}:${endColumn}${lastDataRow}`).values = matrix;
  const table = sheet.tables.add(`A4:${endColumn}${lastDataRow}`, true, options.tableName);
  table.style = "TableStyleMedium2";
  table.showFilterButton = true;
  sheet.getRange(`A4:${endColumn}4`).format = {
    fill: palette.green,
    font: { name: "Aptos", size: 9, bold: true, color: palette.white },
    wrapText: true,
    verticalAlignment: "center",
    borders: { bottom: { style: "medium", color: palette.gold } },
  };
  sheet.getRange(`A4:${endColumn}4`).format.rowHeight = 30;
  sheet.getRange(`A${firstDataRow}:${endColumn}${lastDataRow}`).format.font = {
    name: "Aptos",
    size: 9,
    color: palette.ink,
  };
  sheet.getRange(`A${firstDataRow}:${endColumn}${lastDataRow}`).format.rowHeight = options.rowHeight ?? 32;
  applySemanticFormats(sheet, columns, firstDataRow, lastDataRow);
  setWidths(sheet, columns, lastDataRow, options.widths ?? {});
  sheet.freezePanes.freezeRows(4);
  sheet.freezePanes.freezeColumns(options.freezeColumns ?? 2);
  return { columns, endColumn, firstDataRow, lastDataRow };
}

function styleCard(sheet, labelRange, valueRange, fill) {
  sheet.getRange(labelRange).merge();
  sheet.getRange(labelRange).format = {
    fill,
    font: { name: "Aptos", size: 8, bold: true, color: palette.white },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
  };
  sheet.getRange(valueRange).merge();
  sheet.getRange(valueRange).format = {
    fill: palette.paper,
    font: { name: "Palatino Linotype", size: 18, bold: true, color: palette.ink },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    borders: { preset: "outside", style: "thin", color: fill },
  };
}

const [
  entities,
  names,
  places,
  chronologies,
  authorities,
  relationships,
  sources,
  sourceSupport,
  externalIds,
  reviewQueue,
  candidates,
] = await Promise.all([
  readCsv("data/canonical/entities.csv"),
  readCsv("data/canonical/names.csv"),
  readCsv("data/canonical/places.csv"),
  readCsv("data/canonical/chronologies.csv"),
  readCsv("data/canonical/authorities.csv"),
  readCsv("data/canonical/relationships.csv"),
  readCsv("data/canonical/sources.csv"),
  readCsv("data/canonical/entity_sources.csv"),
  readCsv("data/canonical/external_ids.csv"),
  readCsv("reports/review-queue.csv"),
  readCsv("data/research/candidates.csv"),
]);
const quality = JSON.parse(await fs.readFile(path.join(root, "reports", "quality-report.json"), "utf8"));

const vocabularyDir = path.join(root, "data", "vocabularies");
const vocabularyFiles = (await fs.readdir(vocabularyDir)).filter((name) => name.endsWith(".csv")).sort();
const vocabularies = [];
for (const file of vocabularyFiles) {
  const rows = parseCsv(await fs.readFile(path.join(vocabularyDir, file), "utf8"));
  for (const row of rows) vocabularies.push({ vocabulary: file.replace(/\.csv$/, ""), ...row });
}

const workbook = Workbook.create();
const sheetNames = [
  "Read Me",
  "Quality Summary",
  "Entities",
  "Names",
  "Places",
  "Chronologies",
  "Authorities",
  "Relationships",
  "Sources",
  "Source Support",
  "External IDs",
  "Review Queue",
  "Candidate Audit",
  "Vocabularies",
];
const sheets = Object.fromEntries(sheetNames.map((name) => [name, workbook.worksheets.add(name)]));

const dataLayouts = {};
dataLayouts.Entities = buildDataSheet(
  sheets.Entities,
  "Entities / Οντότητες",
  "Canonical identity records. Greek is the authoritative editorial language; use IDs when reporting corrections.",
  entities,
  {
    tableName: "EntitiesTable",
    rowHeight: 44,
    widths: { entity_id: 36, description_el: 46, description_en: 46, reviewer: 32 },
  },
);
dataLayouts.Names = buildDataSheet(
  sheets.Names,
  "Names / Ονομασίες",
  "Preferred, ancient and alternative linguistic forms linked to canonical entities.",
  names,
  { tableName: "NamesTable", rowHeight: 26, widths: { name_id: 42, entity_id: 36, name: 32 } },
);
dataLayouts.Places = buildDataSheet(
  sheets.Places,
  "Places / Χωρικοί ισχυρισμοί",
  "WGS 84 points. Proxy and representative-centre roles are explicit and must not be read as monument footprints or territories.",
  places,
  {
    tableName: "PlacesTable",
    rowHeight: 40,
    widths: { place_id: 42, entity_id: 36, geometry_geojson: 34, spatial_note_el: 45, spatial_note_en: 45 },
  },
);
dataLayouts.Chronologies = buildDataSheet(
  sheets.Chronologies,
  "Chronologies / Χρονολογίες",
  "BCE years are negative, CE years positive, and year zero is prohibited. Display cutoffs are not destruction dates.",
  chronologies,
  {
    tableName: "ChronologiesTable",
    rowHeight: 38,
    widths: { chronology_id: 44, entity_id: 36, label_el: 26, label_en: 28, note_el: 44, note_en: 44 },
  },
);
dataLayouts.Authorities = buildDataSheet(
  sheets.Authorities,
  "Authorities / Καθιερωμένες οντότητες",
  "Controlled external targets for regions, cults, dynasties, settlements and polities not represented as canonical atlas entities.",
  authorities,
  { tableName: "AuthoritiesTable", rowHeight: 30, widths: { authority_id: 46, preferred_label_el: 30, preferred_label_en: 30 } },
);
dataLayouts.Relationships = buildDataSheet(
  sheets.Relationships,
  "Relationships / Σχέσεις",
  "Each typed relationship has exactly one internal entity or controlled-authority target and a source.",
  relationships,
  {
    tableName: "RelationshipsTable",
    rowHeight: 52,
    widths: {
      relationship_id: 28,
      subject_entity_id: 38,
      object_entity_id: 38,
      object_authority_id: 44,
      object_label_el: 36,
      object_label_en: 36,
      migration_evidence_el: 48,
    },
  },
);
dataLayouts.Sources = buildDataSheet(
  sheets.Sources,
  "Sources / Πηγές",
  "URL access status is operational evidence only; it is deliberately separate from scholarly relevance and authority.",
  sources,
  {
    tableName: "SourcesTable",
    rowHeight: 44,
    widths: { source_id: 36, url: 55, title: 48, citation: 58, notes: 48 },
  },
);
dataLayouts["Source Support"] = buildDataSheet(
  sheets["Source Support"],
  "Source Support / Υποστήριξη ισχυρισμών",
  "Junction table assigning primary and secondary sources to seven controlled claim scopes for every entity.",
  sourceSupport,
  { tableName: "SourceSupportTable", rowHeight: 24, widths: { entity_source_id: 58, entity_id: 38, source_id: 38 } },
);
dataLayouts["External IDs"] = buildDataSheet(
  sheets["External IDs"],
  "External IDs / Εξωτερικά αναγνωριστικά",
  "Canonical external alignments. Polity identifiers attach to representative-centre place assertions rather than territorial entities.",
  externalIds,
  { tableName: "ExternalIdsTable", rowHeight: 28, widths: { external_id: 42, entity_id: 36, place_id: 44, uri: 48 } },
);
dataLayouts["Review Queue"] = buildDataSheet(
  sheets["Review Queue"],
  "Review Queue / Ουρά ελέγχου",
  "Zero-error release warnings: retained uncertainty, proxy points, URL access conditions and measured coordinate offsets.",
  reviewQueue,
  {
    tableName: "ReviewQueueTable",
    rowHeight: 44,
    widths: { code: 32, table: 18, record_id: 44, message: 60, recommendation: 62 },
  },
);
dataLayouts["Candidate Audit"] = buildDataSheet(
  sheets["Candidate Audit"],
  "Candidate Audit / Έλεγχος επεκτάσεων",
  "Material omissions are recorded here. Deferred candidates are not silently inserted with incomplete chronology, geometry or bilingual evidence.",
  candidates,
  {
    tableName: "CandidateAuditTable",
    rowHeight: 68,
    widths: { candidate_id: 32, authoritative_source: 52, reason_el: 58, reason_en: 58 },
  },
);
dataLayouts.Vocabularies = buildDataSheet(
  sheets.Vocabularies,
  "Controlled Vocabularies / Ελεγχόμενα λεξιλόγια",
  "Machine-readable codes with bilingual labels and definitions. Changes require a deliberate schema/version update.",
  vocabularies,
  {
    tableName: "VocabulariesTable",
    rowHeight: 42,
    widths: { vocabulary: 28, code: 32, label_el: 30, label_en: 30, definition_el: 52, definition_en: 52 },
  },
);

const queueSeverity = sheets["Review Queue"].getRange(`A5:A${dataLayouts["Review Queue"].lastDataRow}`);
queueSeverity.conditionalFormats.add("containsText", {
  text: "error",
  format: { fill: palette.rose, font: { bold: true, color: "#8A2D23" } },
});
queueSeverity.conditionalFormats.add("containsText", {
  text: "warning",
  format: { fill: "#FFF2CC", font: { bold: true, color: "#7A5A00" } },
});
const sourceStatus = sheets.Sources.getRange(`J5:J${dataLayouts.Sources.lastDataRow}`);
sourceStatus.conditionalFormats.add("containsText", {
  text: "unavailable",
  format: { fill: palette.rose, font: { color: "#8A2D23" } },
});
sourceStatus.conditionalFormats.add("containsText", {
  text: "ok",
  format: { fill: palette.sage, font: { color: palette.green } },
});

const readme = sheets["Read Me"];
styleTitle(
  readme,
  "H",
  "Ancient Greek World Atlas — Data Review",
  "Άτλας του Αρχαίου Ελληνικού Κόσμου — Επιμελητικός έλεγχος δεδομένων",
);
readme.mergeCells("A4:H4");
readme.getRange("A4").values = [["Purpose / Σκοπός"]];
readme.getRange("A4:H4").format = {
  fill: palette.green,
  font: { name: "Palatino Linotype", size: 13, bold: true, color: palette.white },
};
readme.mergeCells("A5:H7");
readme.getRange("A5").values = [[
  "A human-review companion to the canonical CSV release. It contains the complete normalized tables, quality warnings, controlled vocabularies and expansion ledger. Greek is the authoritative editorial language. The CSV files remain the source of truth.\n\nΣυνοδευτικό αρχείο ανθρώπινου ελέγχου για την κανονική έκδοση CSV. Περιλαμβάνει τους πλήρεις πίνακες, τις προειδοποιήσεις ποιότητας, τα ελεγχόμενα λεξιλόγια και το μητρώο επεκτάσεων. Η ελληνική είναι η κύρια επιμελητική γλώσσα.",
]];
readme.getRange("A5:H7").format = {
  fill: palette.paper,
  font: { name: "Aptos", size: 10, color: palette.ink },
  wrapText: true,
  verticalAlignment: "top",
  borders: { preset: "outside", style: "thin", color: palette.sand },
};
readme.getRange("A9:D9").values = [["Release fact", "Value", "Meaning / Σημασία", "Source"]];
readme.getRange("A10:D16").values = [
  ["Dataset version", quality.dataset_version, "Semantic version of the canonical release", "reports/quality-report.json"],
  ["Validation status", quality.summary.status.toUpperCase(), "Zero hard validation errors required", "reports/quality-report.json"],
  ["Canonical entities", quality.metrics.table_counts.entities, "Submitted core preserved after normalization", "data/canonical/entities.csv"],
  ["Pleiades matches", `${quality.metrics.coverage.pleiades_reconciled_matched}/${quality.metrics.coverage.pleiades_identifiers}`, "Canonical ID and URI reconciliations", "data/research/pleiades-reconciliation.csv"],
  ["Bilingual completeness", `${quality.metrics.coverage.bilingual_entities_percent}%`, "Greek and English names and descriptions", "reports/quality-report.json"],
  ["Source-scope completeness", `${quality.metrics.coverage.entities_with_all_source_scopes_percent}%`, "Seven required support scopes per entity", "data/canonical/entity_sources.csv"],
  ["Warnings", quality.summary.warnings, "Documented uncertainty/access conditions; not validation errors", "reports/review-queue.csv"],
];
const readmeTable = readme.tables.add("A9:D16", true, "ReadMeFactsTable");
readmeTable.style = "TableStyleMedium2";
readme.getRange("A9:D9").format = {
  fill: palette.green,
  font: { bold: true, color: palette.white },
};
readme.mergeCells("A18:H18");
readme.getRange("A18").values = [["How to review / Τρόπος ελέγχου"]];
readme.getRange("A18:H18").format = {
  fill: palette.terracotta,
  font: { name: "Palatino Linotype", size: 12, bold: true, color: palette.white },
};
readme.getRange("A19:H23").merge();
readme.getRange("A19").values = [[
  "1. Start with Quality Summary.  2. Filter Review Queue by code.  3. Use record_id to locate the row in Entities, Places, Chronologies, Relationships or Sources.  4. Consult the source URL and the bilingual notes.  5. Record proposed additions in the research CSVs, not by editing generated exports.\n\n1. Ξεκινήστε από τη Σύνοψη Ποιότητας.  2. Φιλτράρετε την Ουρά Ελέγχου.  3. Χρησιμοποιήστε το record_id για να βρείτε την εγγραφή.  4. Ελέγξτε την πηγή και τις δίγλωσσες σημειώσεις.  5. Οι αλλαγές γίνονται στα ερευνητικά CSV και όχι στα παραγόμενα αρχεία.",
]];
readme.getRange("A19:H23").format = {
  fill: palette.parchment,
  font: { name: "Aptos", size: 10, color: palette.ink },
  wrapText: true,
  verticalAlignment: "top",
  borders: { preset: "outside", style: "thin", color: palette.gold },
};
readme.getRange("A1:A23").format.columnWidth = 24;
readme.getRange("B1:B23").format.columnWidth = 18;
readme.getRange("C1:C23").format.columnWidth = 48;
readme.getRange("D1:D23").format.columnWidth = 38;
for (const letter of ["E", "F", "G", "H"]) readme.getRange(`${letter}1:${letter}23`).format.columnWidth = 16;
readme.freezePanes.freezeRows(2);

const summary = sheets["Quality Summary"];
styleTitle(
  summary,
  "L",
  "Quality Summary / Σύνοψη Ποιότητας",
  "Formula-driven release counts with the machine-validation result and the remaining transparent review warnings.",
);
const cards = [
  ["A4:B4", "A5:B6", "TOTAL ENTITIES / ΟΝΤΟΤΗΤΕΣ", "=COUNTA('Entities'!$A$5:$A$230)", palette.green],
  ["C4:D4", "C5:D6", "BILINGUAL COMPLETE / ΔΙΓΛΩΣΣΑ", "=COUNTIFS('Entities'!$G$5:$G$230,\"<>\",'Entities'!$H$5:$H$230,\"<>\",'Entities'!$J$5:$J$230,\"<>\",'Entities'!$K$5:$K$230,\"<>\")", palette.olive],
  ["E4:F4", "E5:F6", "RELATIONSHIPS / ΣΧΕΣΕΙΣ", "=COUNTA('Relationships'!$A$5:$A$330)", palette.terracotta],
  ["G4:H4", "G5:H6", "SOURCES / ΠΗΓΕΣ", "=COUNTA('Sources'!$A$5:$A$217)", palette.green],
  ["I4:J4", "I5:J6", "PLEIADES MATCHES", "=COUNTA('External IDs'!$A$5:$A$188)", palette.olive],
  ["K4:L4", "K5:L6", "VALIDATION ERRORS / ΣΦΑΛΜΑΤΑ", "=COUNTIF('Review Queue'!$A$5:$A$47,\"error\")", palette.terracotta],
  ["A8:B8", "A9:B10", "SETTLEMENTS / ΟΙΚΙΣΜΟΙ", "=COUNTIF('Entities'!$C$5:$C$230,\"settlement\")", palette.green],
  ["C8:D8", "C9:D10", "SANCTUARIES / ΙΕΡΑ", "=COUNTIF('Entities'!$C$5:$C$230,\"sanctuary\")", palette.olive],
  ["E8:F8", "E9:F10", "POLITIES / ΠΟΛΙΤΕΙΕΣ", "=COUNTIF('Entities'!$C$5:$C$230,\"polity\")", palette.terracotta],
  ["G8:H8", "G9:H10", "PROXY POINTS", "=COUNTIF('Places'!$G$5:$G$230,\"proxy\")", palette.green],
  ["I8:J8", "I9:J10", "URL UNAVAILABLE", "=COUNTIF('Sources'!$J$5:$J$217,\"unavailable\")", palette.olive],
  ["K8:L8", "K9:L10", "WARNINGS / ΠΡΟΕΙΔΟΠΟΙΗΣΕΙΣ", "=COUNTIF('Review Queue'!$A$5:$A$47,\"warning\")", palette.terracotta],
];
for (const [labelRange, valueRange, label, formula, fill] of cards) {
  styleCard(summary, labelRange, valueRange, fill);
  summary.getRange(labelRange.split(":")[0]).values = [[label]];
  summary.getRange(valueRange.split(":")[0]).formulas = [[formula]];
  summary.getRange(valueRange).format.numberFormat = "#,##0";
}
summary.getRange("A13:B13").values = [["Entity class", "Count"]];
summary.getRange("A14:A16").values = [["Settlements"], ["Sanctuaries"], ["Polities"]];
summary.getRange("B14:B16").formulas = [
  ["=COUNTIF('Entities'!$C$5:$C$230,\"settlement\")"],
  ["=COUNTIF('Entities'!$C$5:$C$230,\"sanctuary\")"],
  ["=COUNTIF('Entities'!$C$5:$C$230,\"polity\")"],
];
summary.getRange("A13:B16").format = {
  fill: palette.parchment,
  font: { name: "Aptos", size: 9, color: palette.ink },
  borders: { preset: "outside", style: "thin", color: palette.gold },
};
summary.getRange("A13:B13").format = { fill: palette.green, font: { bold: true, color: palette.white } };
summary.getRange("A19:B19").values = [["Warning code", "Count"]];
summary.getRange("A20:A23").values = [
  ["RETAINED_UNCERTAINTY"],
  ["PROXY_GEOMETRY"],
  ["SOURCE_URL_ACCESS"],
  ["PLEIADES_COORDINATE_OFFSET"],
];
summary.getRange("B20:B23").formulas = [
  ["=COUNTIF('Review Queue'!$B$5:$B$47,A20)"],
  ["=COUNTIF('Review Queue'!$B$5:$B$47,A21)"],
  ["=COUNTIF('Review Queue'!$B$5:$B$47,A22)"],
  ["=COUNTIF('Review Queue'!$B$5:$B$47,A23)"],
];
summary.getRange("A19:B23").format = {
  fill: palette.parchment,
  font: { name: "Aptos", size: 9, color: palette.ink },
  borders: { preset: "outside", style: "thin", color: palette.gold },
};
summary.getRange("A19:B19").format = { fill: palette.terracotta, font: { bold: true, color: palette.white } };
const classChart = summary.charts.add("bar", summary.getRange("A13:B16"));
classChart.title = "Canonical entities by class";
classChart.hasLegend = false;
classChart.setPosition("D13", "L24");
summary.mergeCells("A26:L29");
summary.getRange("A26").values = [[
  "PASS — zero hard errors. The 43 warnings are deliberate transparency: 19 reviewed records retain medium confidence, 8 points are explicit proxies, 15 source URLs were unavailable or unchecked during the dated access test, and one Pleiades coordinate difference exceeds 500 m.\n\nΕΠΙΤΥΧΙΑ — μηδενικά υποχρεωτικά σφάλματα. Οι 43 προειδοποιήσεις διατηρούν ορατές τις ιστορικές αβεβαιότητες και τις συνθήκες πρόσβασης.",
]];
summary.getRange("A26:L29").format = {
  fill: palette.sage,
  font: { name: "Aptos", size: 10, bold: true, color: palette.green },
  wrapText: true,
  verticalAlignment: "center",
  borders: { preset: "outside", style: "medium", color: palette.green },
};
for (let index = 0; index < 12; index += 1) {
  const letter = columnLetter(index);
  summary.getRange(`${letter}1:${letter}29`).format.columnWidth = index < 2 ? 24 : 14;
}
summary.freezePanes.freezeRows(2);
summary.showGridLines = false;

await fs.mkdir(outputDir, { recursive: true });
const summaryInspect = await workbook.inspect({
  kind: "table",
  range: "'Quality Summary'!A1:L29",
  include: "values,formulas",
  tableMaxRows: 29,
  tableMaxCols: 12,
  maxChars: 12000,
});
console.log(`SUMMARY_INSPECT\n${summaryInspect.ndjson}`);
const formulaErrorCodes = ["#REF!", "#DIV/0!", "#VALUE!", "#NAME?", "#N/A"];
const formulaErrors = formulaErrorCodes.filter((code) => summaryInspect.ndjson.includes(code));
if (formulaErrors.length) {
  throw new Error(`Formula errors found in Quality Summary: ${formulaErrors.join(", ")}`);
}
console.log(`FORMULA_ERROR_SCAN\n${JSON.stringify({ kind: "summary_scan", errors: 0 })}`);

const renderRanges = {
  "Read Me": "A1:H23",
  "Quality Summary": "A1:L29",
  Entities: "A1:K18",
  Names: "A1:K18",
  Places: "A1:J18",
  Chronologies: "A1:J18",
  Authorities: "A1:G18",
  Relationships: "A1:L18",
  Sources: "A1:L18",
  "Source Support": "A1:E18",
  "External IDs": "A1:H18",
  "Review Queue": "A1:F20",
  "Candidate Audit": "A1:K19",
  Vocabularies: "A1:G20",
};
if (process.argv.includes("--render-previews")) {
  for (const [sheetName, range] of Object.entries(renderRanges)) {
    const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
    const slug = sheetName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await fs.writeFile(
      path.join(outputDir, `preview-${slug}.png`),
      new Uint8Array(await preview.arrayBuffer()),
    );
  }
}

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(`OUTPUT ${outputPath}`);
console.log(`SHEETS ${sheetNames.length}`);
await fs.rm(`${outputPath}.inspect.ndjson`, { force: true });
process.exitCode = 0;
