import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';
import { HISTORICAL_ELECTION_DATASETS, HISTORICAL_ELECTION_RESULTS } from '../shared/historicalElectionData.js';

const workDir = path.resolve('..');
const dataDir = path.join(workDir, '.tmp-election-workbook');
const outputDir = path.join(workDir, 'outputs', 'previous-election-dataset');
const outputPath = path.join(outputDir, 'Oyo_Previous_Election_Dataset.xlsx');
const previewDir = path.join(dataDir, 'previews');
const COLORS = { burgundy: '#5A172B', burgundyDark: '#260A13', gold: '#D9AA4B', cream: '#FFF8E8', pale: '#F8F1E2', ink: '#26171D', rose: '#F2DCE4', green: '#DDF3E5', amber: '#FFF0C7', red: '#FBE0E5', gray: '#6B5B61' };

const colName = number => {
  let value = number;
  let name = '';
  while (value > 0) { value -= 1; name = String.fromCharCode(65 + (value % 26)) + name; value = Math.floor(value / 26); }
  return name;
};

const csvValues = async filename => {
  const csv = await fs.readFile(path.join(dataDir, filename), 'utf8');
  const imported = await Workbook.fromCSV(csv, { sheetName: 'Imported' });
  return imported.worksheets.getItem('Imported').getUsedRange().values;
};

const numericColumns = new Set([5, 6, 8, 14, 15, 16, 17]);
const normalizeCsvRows = values => values.slice(1).map(row => row.map((value, index) => {
  if (!numericColumns.has(index)) return value == null ? '' : String(value);
  if (value == null || String(value).trim() === '') return null;
  const parsed = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(parsed) ? parsed : null;
}));

const workbook = Workbook.create();
const overview = workbook.worksheets.add('Overview');
const stateSheet = workbook.worksheets.add('State Declared');
const lgaSheet = workbook.worksheets.add('LGA 2023');
const wardSheet = workbook.worksheets.add('Ward Summary');
const verifiedSheet = workbook.worksheets.add('PU Verified');
const reviewSheet = workbook.worksheets.add('PU Review');
const missingSheet = workbook.worksheets.add('PU Missing');
const sourcesSheet = workbook.worksheets.add('Sources & Notes');

const applyTitle = (sheet, title, subtitle, lastColumn) => {
  sheet.showGridLines = false;
  sheet.getRange(`A1:${lastColumn}1`).merge();
  sheet.getRange('A1').values = [[title]];
  sheet.getRange(`A2:${lastColumn}2`).merge();
  sheet.getRange('A2').values = [[subtitle]];
  sheet.getRange(`A1:${lastColumn}1`).format = { fill: COLORS.burgundyDark, font: { bold: true, color: COLORS.cream, size: 18 }, rowHeight: 30, verticalAlignment: 'center' };
  sheet.getRange(`A2:${lastColumn}2`).format = { fill: COLORS.burgundy, font: { color: '#F5DC9A', size: 10 }, rowHeight: 25, wrapText: true, verticalAlignment: 'center' };
};

const styleHeader = range => {
  range.format = { fill: COLORS.burgundy, font: { bold: true, color: COLORS.cream }, rowHeight: 24, verticalAlignment: 'center', wrapText: true, borders: { bottom: { style: 'medium', color: COLORS.gold } } };
};

const styleBody = range => {
  range.format = { font: { color: COLORS.ink, size: 9 }, verticalAlignment: 'top', borders: { insideHorizontal: { style: 'thin', color: '#E8D9DE' } } };
};

const setWidths = (sheet, widths, lastRow) => widths.forEach((width, index) => {
  sheet.getRange(`${colName(index + 1)}1:${colName(index + 1)}${lastRow}`).format.columnWidthPx = width;
});

const addTable = (sheet, startRow, headers, rows, name) => {
  const lastCol = colName(headers.length);
  const lastRow = startRow + rows.length;
  sheet.getRange(`A${startRow}:${lastCol}${lastRow}`).values = [headers, ...rows];
  styleHeader(sheet.getRange(`A${startRow}:${lastCol}${startRow}`));
  if (rows.length) styleBody(sheet.getRange(`A${startRow + 1}:${lastCol}${lastRow}`));
  const table = sheet.tables.add(`A${startRow}:${lastCol}${lastRow}`, true, name);
  table.style = 'TableStyleMedium2';
  table.showFilterButton = true;
  return { lastCol, lastRow };
};

const [verifiedValues, reviewValues, missingValues, lgaPayload] = await Promise.all([
  csvValues('OYO_crosschecked.csv'),
  csvValues('OYO_unsure.csv'),
  csvValues('OYO_notfound.csv'),
  fs.readFile(path.join(dataDir, 'oyo-2023-lga.json'), 'utf8').then(JSON.parse),
]);
const rawHeaders = verifiedValues[0].map(value => String(value));
const friendlyHeaders = rawHeaders.map(value => value.replaceAll('_', ' ').replace('PU-Code', 'PU Code').replace('PU-Name', 'PU Name'));
const verifiedRows = normalizeCsvRows(verifiedValues);
const reviewRows = normalizeCsvRows(reviewValues);
const missingRows = normalizeCsvRows(missingValues);

applyTitle(verifiedSheet, 'Oyo 2023 Presidential — Crosschecked Polling Units', 'Captured result sheets validated against INEC IReV by the Nigeria 2.0 crosscheck project. Blank figures remain blank; they are not converted to zero.', 'S');
const verifiedTable = addTable(verifiedSheet, 4, friendlyHeaders, verifiedRows, 'VerifiedPollingUnits');
verifiedSheet.freezePanes.freezeRows(4); verifiedSheet.freezePanes.freezeColumns(5);
setWidths(verifiedSheet, [65, 125, 155, 95, 245, 95, 95, 85, 90, 85, 85, 85, 85, 85, 70, 70, 70, 70, 280], verifiedTable.lastRow);
verifiedSheet.getRange(`F5:I${verifiedTable.lastRow}`).format.numberFormat = '#,##0';
verifiedSheet.getRange(`O5:R${verifiedTable.lastRow}`).format.numberFormat = '#,##0';
verifiedSheet.getRange(`S5:S${verifiedTable.lastRow}`).format.font = { color: '#1155CC', underline: true, size: 8 };

applyTitle(reviewSheet, 'Oyo 2023 Presidential — Manual Review Required', 'Captured polling-unit records flagged as unsure by the source. Use these separately from crosschecked results.', 'S');
const reviewTable = addTable(reviewSheet, 4, friendlyHeaders, reviewRows, 'ReviewPollingUnits');
reviewSheet.freezePanes.freezeRows(4); reviewSheet.freezePanes.freezeColumns(5);
setWidths(reviewSheet, [65, 125, 155, 95, 245, 95, 95, 85, 90, 85, 85, 85, 85, 85, 70, 70, 70, 70, 280], reviewTable.lastRow);
reviewSheet.getRange(`F5:I${reviewTable.lastRow}`).format.numberFormat = '#,##0';
reviewSheet.getRange(`O5:R${reviewTable.lastRow}`).format.numberFormat = '#,##0';
reviewSheet.getRange(`S5:S${reviewTable.lastRow}`).format.font = { color: '#1155CC', underline: true, size: 8 };

applyTitle(missingSheet, 'Oyo 2023 Presidential — Result Sheet Not Found', 'Polling units for which the source did not find a result sheet. Missing values are intentionally preserved as unavailable.', 'S');
const missingTable = addTable(missingSheet, 4, friendlyHeaders, missingRows, 'MissingPollingUnits');
missingSheet.freezePanes.freezeRows(4); missingSheet.freezePanes.freezeColumns(5);
setWidths(missingSheet, [65, 125, 155, 95, 245, 95, 95, 85, 90, 85, 85, 85, 85, 85, 70, 70, 70, 70, 280], missingTable.lastRow);
missingSheet.getRange(`F5:I${missingTable.lastRow}`).format.numberFormat = '#,##0';

const stateRows = [];
for (const dataset of HISTORICAL_ELECTION_DATASETS) {
  const result = HISTORICAL_ELECTION_RESULTS[dataset.id];
  for (const party of result.parties) {
    stateRows.push([dataset.year, dataset.election, party.party, party.value, null, null, dataset.status, result.note, dataset.source.name, dataset.source.url]);
  }
}
applyTitle(stateSheet, 'Oyo Previous Elections — Declared State Summaries', 'Declared or reported state-level summaries already loaded in the application. “Share of loaded votes” uses only parties present in each loaded record.', 'J');
const stateTable = addTable(stateSheet, 4, ['Year', 'Election', 'Party', 'Votes', 'Loaded Total', 'Share of Loaded', 'Dataset Status', 'Coverage Note', 'Source', 'Source URL'], stateRows, 'StateDeclaredResults');
stateSheet.getRange(`E5:F${stateTable.lastRow}`).formulas = stateRows.map((_, index) => {
  const row = index + 5;
  return [`=SUMIFS($D$5:$D$${stateTable.lastRow},$A$5:$A$${stateTable.lastRow},A${row},$B$5:$B$${stateTable.lastRow},B${row})`, `=IF(E${row}=0,"",D${row}/E${row})`];
});
stateSheet.freezePanes.freezeRows(4);
setWidths(stateSheet, [65, 110, 100, 90, 95, 95, 90, 430, 190, 320], stateTable.lastRow);
stateSheet.getRange(`D5:E${stateTable.lastRow}`).format.numberFormat = '#,##0';
stateSheet.getRange(`F5:F${stateTable.lastRow}`).format.numberFormat = '0.00%';
stateSheet.getRange(`H5:H${stateTable.lastRow}`).format.wrapText = true;
stateSheet.getRange(`J5:J${stateTable.lastRow}`).format.font = { color: '#1155CC', underline: true, size: 8 };

const lgaRows = [];
for (const [officeKey, officeLabel] of [['presidential', 'Presidential'], ['governor', 'Governorship']]) {
  for (const lga of lgaPayload?.[officeKey]?.lgas || []) {
    for (const [party, votes] of Object.entries(lga.parties || {}).sort((a, b) => Number(b[1]) - Number(a[1]))) {
      lgaRows.push([2023, officeLabel, lga.lga_id, lga.lga, party, Number(votes) || 0, Number(lga.total) || 0, null, 'Evidence transcription', 'https://api.nigeria2.com/api/v1/results/2023/nga_31']);
    }
  }
}
applyTitle(lgaSheet, 'Oyo 2023 — LGA Party Distribution', 'Long-format LGA evidence transcriptions for Presidential and Governorship contests. These may not reconcile with INEC declared state totals.', 'J');
const lgaTable = addTable(lgaSheet, 4, ['Year', 'Election', 'LGA ID', 'LGA', 'Party', 'Votes', 'Recorded LGA Total', 'Party Share', 'Record Type', 'Source URL'], lgaRows, 'LgaPartyDistribution');
lgaSheet.getRange(`H5:H${lgaTable.lastRow}`).formulas = lgaRows.map((_, index) => {
  const row = index + 5;
  return [`=IF(G${row}=0,"",F${row}/G${row})`];
});
lgaSheet.freezePanes.freezeRows(4); lgaSheet.freezePanes.freezeColumns(4);
setWidths(lgaSheet, [60, 110, 65, 135, 75, 85, 110, 85, 130, 330], lgaTable.lastRow);
lgaSheet.getRange(`F5:G${lgaTable.lastRow}`).format.numberFormat = '#,##0';
lgaSheet.getRange(`H5:H${lgaTable.lastRow}`).format.numberFormat = '0.00%';
lgaSheet.getRange(`J5:J${lgaTable.lastRow}`).format.font = { color: '#1155CC', underline: true, size: 8 };

const allRows = [...verifiedRows, ...reviewRows, ...missingRows];
const wardKeys = [...new Set(allRows.map(row => `${row[1]}\u0000${row[2]}`))].sort((a, b) => a.localeCompare(b));
const wardRows = wardKeys.map(key => {
  const [lga, ward] = key.split('\u0000');
  return [lga, ward, null, null, null, null, null, null, null, null, null, null];
});
applyTitle(wardSheet, 'Oyo 2023 Presidential — Ward Evidence Summary', 'Formula-driven aggregation. Party votes include crosschecked polling units only; review and missing counts remain visible as separate coverage indicators.', 'L');
const wardTable = addTable(wardSheet, 4, ['LGA', 'Ward', 'Verified PUs', 'Review PUs', 'Missing PUs', 'APC', 'LP', 'PDP', 'NNPP', 'Recorded Votes', 'Recorded Winner', 'Verified Coverage'], wardRows, 'WardEvidenceSummary');
wardSheet.getRange(`C5:L${wardTable.lastRow}`).formulas = wardRows.map((_, index) => {
  const row = index + 5;
  const countFormula = sheet => `=COUNTIFS('${sheet}'!$B$5:$B$${sheet === 'PU Verified' ? verifiedTable.lastRow : sheet === 'PU Review' ? reviewTable.lastRow : missingTable.lastRow},A${row},'${sheet}'!$C$5:$C$${sheet === 'PU Verified' ? verifiedTable.lastRow : sheet === 'PU Review' ? reviewTable.lastRow : missingTable.lastRow},B${row})`;
  const voteFormula = sourceColumn => `=SUMIFS('PU Verified'!$${sourceColumn}$5:$${sourceColumn}$${verifiedTable.lastRow},'PU Verified'!$B$5:$B$${verifiedTable.lastRow},A${row},'PU Verified'!$C$5:$C$${verifiedTable.lastRow},B${row})`;
  return [
    countFormula('PU Verified'), countFormula('PU Review'), countFormula('PU Missing'),
    voteFormula('O'), voteFormula('P'), voteFormula('Q'), voteFormula('R'),
    `=SUM(F${row}:I${row})`,
    `=IF(MAX(F${row}:I${row})=0,"No recorded result",INDEX(F$4:I$4,1,MATCH(MAX(F${row}:I${row}),F${row}:I${row},0)))`,
    `=IF(SUM(C${row}:E${row})=0,"",C${row}/SUM(C${row}:E${row}))`,
  ];
});
wardSheet.freezePanes.freezeRows(4); wardSheet.freezePanes.freezeColumns(2);
setWidths(wardSheet, [135, 190, 85, 80, 80, 80, 80, 80, 80, 100, 110, 100], wardTable.lastRow);
wardSheet.getRange(`C5:J${wardTable.lastRow}`).format.numberFormat = '#,##0';
wardSheet.getRange(`L5:L${wardTable.lastRow}`).format.numberFormat = '0.0%';
wardSheet.getRange(`L5:L${wardTable.lastRow}`).conditionalFormats.add('colorScale', { colors: ['#F8D7DA', '#FFF0C7', '#DDF3E5'], thresholds: ['min', '50%', 'max'] });

applyTitle(overview, 'Oyo Previous Election Dataset', 'Excel export prepared for historical analysis. Data quality categories are kept separate; evidence transcriptions are not presented as replacements for official INEC declarations.', 'J');
overview.getRange('A4:J4').merge(); overview.getRange('A4').values = [['DATA QUALITY OVERVIEW — OYO 2023 PRESIDENTIAL POLLING UNITS']];
overview.getRange('A4:J4').format = { fill: COLORS.gold, font: { bold: true, color: COLORS.burgundyDark }, rowHeight: 23 };
overview.getRange('A6:B6').merge(); overview.getRange('D6:E6').merge(); overview.getRange('G6:H6').merge(); overview.getRange('I6:J6').merge();
overview.getRange('A6').values = [['Crosschecked']]; overview.getRange('D6').values = [['Manual review']]; overview.getRange('G6').values = [['Sheet not found']]; overview.getRange('I6').values = [['Total polling units']];
overview.getRange('A7:B8').merge(); overview.getRange('D7:E8').merge(); overview.getRange('G7:H8').merge(); overview.getRange('I7:J8').merge();
overview.getRange('A7').formulas = [[`=COUNTA('PU Verified'!$D$5:$D$${verifiedTable.lastRow})`]];
overview.getRange('D7').formulas = [[`=COUNTA('PU Review'!$D$5:$D$${reviewTable.lastRow})`]];
overview.getRange('G7').formulas = [[`=COUNTA('PU Missing'!$D$5:$D$${missingTable.lastRow})`]];
overview.getRange('I7').formulas = [['=A7+D7+G7']];
for (const range of ['A6:B8', 'D6:E8', 'G6:H8', 'I6:J8']) overview.getRange(range).format = { fill: COLORS.pale, font: { color: COLORS.ink }, borders: { preset: 'outside', style: 'medium', color: COLORS.gold }, horizontalAlignment: 'center', verticalAlignment: 'center' };
for (const cell of ['A7', 'D7', 'G7', 'I7']) overview.getRange(cell).format = { font: { bold: true, color: COLORS.burgundy, size: 22 }, horizontalAlignment: 'center', verticalAlignment: 'center', numberFormat: '#,##0' };
overview.getRange('A11:B15').values = [['Quality category', 'Polling units'], ['Crosschecked', null], ['Manual review', null], ['Sheet not found', null], ['Total', null]];
overview.getRange('B12').formulas = [['=A7']]; overview.getRange('B13').formulas = [['=D7']]; overview.getRange('B14').formulas = [['=G7']]; overview.getRange('B15').formulas = [['=I7']];
styleHeader(overview.getRange('A11:B11')); styleBody(overview.getRange('A12:B15')); overview.getRange('B12:B15').format.numberFormat = '#,##0';
overview.getRange('A18:J18').merge(); overview.getRange('A18').values = [['WORKBOOK CONTENTS']]; overview.getRange('A18:J18').format = { fill: COLORS.burgundy, font: { bold: true, color: COLORS.cream } };
overview.getRange('A20:J27').values = [
  ['Sheet', 'Purpose', '', '', '', '', '', '', '', ''],
  ['State Declared', '2019 and 2023 state-level party totals loaded in the application.', '', '', '', '', '', '', '', ''],
  ['LGA 2023', 'Long-format Presidential and Governorship evidence transcriptions for all 33 LGAs.', '', '', '', '', '', '', '', ''],
  ['Ward Summary', 'Formula-driven ward totals and coverage, using crosschecked presidential polling units.', '', '', '', '', '', '', '', ''],
  ['PU Verified', '3,899 polling units crosschecked against IReV.', '', '', '', '', '', '', '', ''],
  ['PU Review', '2,252 polling units flagged for manual review.', '', '', '', '', '', '', '', ''],
  ['PU Missing', '239 polling units where the source did not find a result sheet.', '', '', '', '', '', '', '', ''],
  ['Sources & Notes', 'Source URLs, definitions, limitations, and audit notes.', '', '', '', '', '', '', '', ''],
];
overview.getRange('A20:A27').format = { font: { bold: true, color: COLORS.burgundy }, fill: COLORS.rose };
overview.getRange('B20:J27').merge(true); overview.getRange('B20:J27').format = { wrapText: true, font: { color: COLORS.ink }, borders: { insideHorizontal: { style: 'thin', color: '#E8D9DE' } } };
setWidths(overview, [130, 95, 25, 95, 25, 25, 95, 25, 95, 95], 27);
const qualityChart = overview.charts.add('doughnut', overview.getRange('A11:B14'));
qualityChart.title = 'Oyo polling-unit evidence coverage'; qualityChart.hasLegend = true; qualityChart.setPosition('D11', 'J17');

applyTitle(sourcesSheet, 'Sources, Definitions and Limitations', 'Use this sheet to audit the workbook. URLs are stored as plain text and can be copied into a browser.', 'F');
const sourceRows = [
  ['Nigeria 2.0 Oyo 2023 API', '2023 Presidential and Governorship LGA evidence transcriptions', 'https://api.nigeria2.com/api/v1/results/2023/nga_31', 'Evidence transcription', 'May not reconcile with declared state totals.', new Date('2026-08-25')],
  ['Nigeria 2.0 public data repository', 'Oyo 2023 presidential polling-unit crosscheck, unsure and not-found files', 'https://github.com/nigeria2/data-ng-election-2023', 'Independent crosscheck', 'Crosschecked records were validated against IReV by the source project; review and missing categories remain separate.', new Date('2026-08-25')],
  ['INEC election results', 'Official election-results archive', 'https://inecnigeria.org/election-results/', 'Official archive', 'Use INEC declarations as the authoritative final result.', new Date('2026-08-25')],
  ['INEC IReV', 'Polling-unit result-sheet portal', 'https://inecelectionresults.ng/', 'Official evidence portal', 'IReV sheets support verification but are not themselves a substituted statewide declaration.', new Date('2026-08-25')],
  ['INEC 2019 Oyo EC8E', '2019 Oyo governorship declaration source used by the application', 'https://www.inecnigeria.org/wp-content/uploads/2019/10/OYO.pdf', 'Official declaration', 'State summary only in this workbook.', new Date('2026-08-25')],
  ['Voice of Nigeria report of INEC declaration', '2023 Oyo governorship declared leading totals used by the application', 'https://von.gov.ng/inec-declares-makinde-winner-of-oyo-governorship-election/', 'Reported INEC declaration', 'State leading totals only; consult INEC for the final certified record.', new Date('2026-08-25')],
];
const sourcesTable = addTable(sourcesSheet, 4, ['Source', 'Workbook Use', 'URL', 'Record Type', 'Limitation / Audit Note', 'Accessed'], sourceRows, 'WorkbookSources');
sourcesSheet.freezePanes.freezeRows(4);
setWidths(sourcesSheet, [220, 330, 420, 140, 430, 100], sourcesTable.lastRow);
sourcesSheet.getRange(`C5:C${sourcesTable.lastRow}`).format.font = { color: '#1155CC', underline: true, size: 8 };
sourcesSheet.getRange(`F5:F${sourcesTable.lastRow}`).format.numberFormat = 'yyyy-mm-dd';
sourcesSheet.getRange(`A5:F${sourcesTable.lastRow}`).format.wrapText = true;
sourcesSheet.getRange('A13:F13').merge(); sourcesSheet.getRange('A13').values = [['KEY DEFINITIONS']]; sourcesSheet.getRange('A13:F13').format = { fill: COLORS.gold, font: { bold: true, color: COLORS.burgundyDark } };
sourcesSheet.getRange('A14:F18').values = [
  ['Crosschecked', 'Result captured and validated against IReV by the source project.', '', '', '', ''],
  ['Manual review', 'Result captured but flagged as unsure; do not combine with crosschecked totals without review.', '', '', '', ''],
  ['Sheet not found', 'No result sheet was found by the source; missing figures are not zero.', '', '', '', ''],
  ['Recorded winner', 'Party with the highest sum among APC, LP, PDP and NNPP in crosschecked polling units only.', '', '', '', ''],
  ['Other parties', 'Polling-unit CSVs expose APC, LP, PDP and NNPP tallies. Other-party polling-unit votes are not included in those files.', '', '', '', ''],
];
sourcesSheet.getRange('A14:A18').format = { fill: COLORS.rose, font: { bold: true, color: COLORS.burgundy } };
sourcesSheet.getRange('B14:F18').merge(true); sourcesSheet.getRange('B14:F18').format = { wrapText: true, font: { color: COLORS.ink }, borders: { insideHorizontal: { style: 'thin', color: '#E8D9DE' } } };

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const overviewInspect = await workbook.inspect({ kind: 'table', range: 'Overview!A1:J27', include: 'values,formulas', tableMaxRows: 30, tableMaxCols: 12, maxChars: 7000 });
const wardInspect = await workbook.inspect({ kind: 'table', range: 'Ward Summary!A1:L12', include: 'values,formulas', tableMaxRows: 12, tableMaxCols: 12, maxChars: 7000 });
const formulaErrors = await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A', options: { useRegex: true, maxResults: 300 }, summary: 'final formula error scan', maxChars: 4000 });
console.log('OVERVIEW_INSPECT\n' + overviewInspect.ndjson);
console.log('WARD_INSPECT\n' + wardInspect.ndjson);
console.log('FORMULA_ERRORS\n' + formulaErrors.ndjson);

const previewRanges = {
  Overview: 'A1:J27', 'State Declared': 'A1:J18', 'LGA 2023': 'A1:J24', 'Ward Summary': 'A1:L22',
  'PU Verified': 'A1:S18', 'PU Review': 'A1:S18', 'PU Missing': 'A1:S18', 'Sources & Notes': 'A1:F18',
};
for (const [sheetName, range] of Object.entries(previewRanges)) {
  const preview = await workbook.render({ sheetName, range, scale: 0.85, format: 'png' });
  await fs.writeFile(path.join(previewDir, `${sheetName.replaceAll(' ', '_')}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(outputPath);
console.log(JSON.stringify({ outputPath, sheets: Object.keys(previewRanges), rows: { verified: verifiedRows.length, review: reviewRows.length, missing: missingRows.length, wards: wardRows.length, lgaPartyRows: lgaRows.length } }, null, 2));
