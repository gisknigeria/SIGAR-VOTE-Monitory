import { randomUUID } from 'node:crypto';

/**
 * Turns the campaign's survey workbook into a stored, anonymous dataset.
 *
 * What is kept: every answer a respondent gave, their respondent group and voting LGA.
 * What is dropped at the door: submission IDs, agent names (first, last and full), and the raw
 * "likely vote" free text (which is where people type other names). Agents survive only as an
 * opaque number, shuffled, so the analysis can still say "one collector gathered 90% of this
 * LGA" without anyone being able to read back who.
 *
 * Storage is dictionary-encoded -- each column keeps its distinct values once and every row
 * holds small integer codes -- which keeps 28k responses around 2-3MB instead of ~15MB.
 */

// Canonical field -> the header(s) it may appear under. Matching ignores case and punctuation,
// so "Likely Vote Candidate" and "likely_vote_candidate" both land here.
export const SURVEY_FIELDS = {
  respondent: ['Respondent'],
  topIssue: ['Top Priority Issue'],
  satisfaction: ['Satisfaction With Current Government', 'Satisfaction Current Govt'],
  sector: ['Sector Needing Improvement', 'Sectors Need Improvement'],
  fairAttention: ['LGA Fair Attention'],
  lgaProblem: ['Biggest Problem In LGA', 'Biggest Problem LGA'],
  message: ['Message More Likely To Support', 'Message More Support'],
  communicate: ['What Should Be Communicated More Clearly', 'What Communicate Clearly'],
  hasPvc: ['Has PVC'],
  votedLast: ['Voted Last Election'],
  likelihood: ['Likelihood To Vote', 'Likely To Vote'],
  barrier: ['What Could Prevent Voting', 'What Prevent Voting'],
  platform: ['Most Influential Platform', 'Platform Influences Decision'],
  truthSource: ['Who Speaks The Truth'],
  firstChoice: ['Likely Vote Candidate'],
  firstChoiceType: ['Likely Vote Response Type'],
  candidateFactor: ['Most Important Candidate Factor', 'Factor Matters Most'],
  familiarity: ['Familiarity With Candidate'],
  impression: ['Overall Impression Of Candidate', 'Impression Of Candidate'],
  firstHeard: ['Where Candidate Was First Heard', 'Where Heard Candidate'],
  goodGovernor: ['Will Candidate Make A Good Governor', 'Will Make Good Governor'],
  whyYes: ['If Yes Why'],
  whyNo: ['If No Why'],
  secondChoice: ['Preferred Alternative Candidate'],
  secondChoiceResponse: ['Preferred Alternative Response', 'If Not Running Preferred'],
  secondChoiceType: ['Preferred Alternative Response Type'],
  lga: ['Voting LGA', 'Voting LGA 1'],
  voteQuality: ['Vote Response Quality'],
};
const REQUIRED = ['firstChoice', 'lga', 'respondent'];
const PREFERRED_SHEETS = ['Cleaned Table', 'Oyo Cleaned Polls Tables'];

const headerKey = (value) => String(value ?? '').trim().replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/** Finds the sheet holding the cleaned responses: named ones first, then any sheet with the right header. */
function findResponseSheet(workbook) {
  const looksRight = (rows) => rows?.[0]?.some((cell) => headerKey(cell) === 'likely vote candidate');
  for (const name of PREFERRED_SHEETS) {
    if (workbook.sheetNames.includes(name)) {
      const rows = workbook.rows(name);
      if (looksRight(rows)) return { name, rows };
    }
  }
  for (const name of workbook.sheetNames) {
    const rows = workbook.rows(name);
    if (looksRight(rows)) return { name, rows };
  }
  return null;
}

/** Question wording from the "Questionaire Answers" sheet, keyed by canonical field. */
function readQuestions(workbook) {
  const name = workbook.sheetNames.find((sheet) => /question/i.test(sheet));
  const rows = name ? workbook.rows(name) || [] : [];
  // The questionnaire lists questions in survey order; map by keyword rather than position so a
  // reordered sheet cannot silently attach the wrong question to a chart.
  const matchers = [
    ['topIssue', /top priority/i], ['satisfaction', /satisfied/i], ['sector', /sector/i], ['fairAttention', /fair|attention/i],
    ['lgaProblem', /biggest problem/i], ['message', /message/i], ['communicate', /communicated/i], ['hasPvc', /pvc/i],
    ['votedLast', /vote in the last/i], ['likelihood', /how likely/i], ['barrier', /prevent/i], ['platform', /platform/i],
    ['truthSource', /truth/i], ['firstChoice', /held today/i], ['familiarity', /familiar/i], ['impression', /impression/i],
    ['firstHeard', /first hear/i], ['goodGovernor', /good governor/i], ['secondChoice', /not running/i], ['lga', /local govt|local government are you/i],
  ];
  const questions = {};
  for (const row of rows.slice(1)) {
    const text = clean(row[1]);
    if (!text) continue;
    const hit = matchers.find(([key, pattern]) => !questions[key] && pattern.test(text));
    if (hit) questions[hit[0]] = text;
  }
  return questions;
}

/** The workbook's own headline totals, used to prove the import read the same data Excel did. */
function readWorkbookTotals(workbook) {
  const name = workbook.sheetNames.find((sheet) => /key analysis summary/i.test(sheet));
  const rows = name ? workbook.rows(name) || [] : [];
  const totals = {};
  for (const row of rows) {
    for (let i = 0; i < row.length - 1; i += 1) {
      const label = headerKey(row[i]);
      const value = Number(String(row[i + 1]).replace(/,/g, ''));
      if (!Number.isFinite(value) || row[i + 1] === '') continue;
      if (label === 'total responses') totals.responses = value;
      if (label === 'named candidate votes') totals.namedVotes = value;
      if (label === 'sen ali votes') totals.focusVotes = value;
    }
  }
  return totals;
}

const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export function buildSurveyDataset(workbook, { sourceFile = '', importedBy = '', now = new Date() } = {}) {
  const sheet = findResponseSheet(workbook);
  if (!sheet) throw new Error('No sheet with a "Likely Vote Candidate" column was found. Upload the cleaned survey workbook.');

  const [header, ...body] = sheet.rows;
  const byHeader = new Map(header.map((cell, index) => [headerKey(cell), index]));
  const columns = {};
  for (const [field, names] of Object.entries(SURVEY_FIELDS)) {
    const index = names.map((name) => byHeader.get(headerKey(name))).find((value) => value !== undefined);
    if (index !== undefined) columns[field] = index;
  }
  const missing = REQUIRED.filter((field) => columns[field] === undefined);
  if (missing.length) throw new Error(`The survey sheet "${sheet.name}" is missing required columns: ${missing.map((field) => SURVEY_FIELDS[field][0]).join(', ')}.`);

  const agentFull = byHeader.get('agent name');
  const agentFirst = byHeader.get('agent first name') ?? byHeader.get('agent firstname');
  const agentLast = byHeader.get('agent last name') ?? byHeader.get('agent lastname');
  const agentOf = (row) => {
    const full = agentFull !== undefined ? clean(row[agentFull]) : '';
    const joined = full || [agentFirst, agentLast].filter((index) => index !== undefined).map((index) => clean(row[index])).join(' ').trim();
    return joined.toLowerCase();
  };

  const fields = Object.keys(columns);
  const dictionaries = Object.fromEntries(fields.map((field) => [field, new Map([['', 0]])]));
  const encode = (field, value) => {
    const dictionary = dictionaries[field];
    if (!dictionary.has(value)) dictionary.set(value, dictionary.size);
    return dictionary.get(value);
  };

  const rows = body.filter((row) => row.some((cell) => clean(cell)));
  // Agents become shuffled integers: stable within this import, meaningless outside it.
  const agentNames = [...new Set(rows.map(agentOf).filter(Boolean))];
  const agentCode = new Map(shuffle(agentNames).map((name, index) => [name, index + 1]));

  const encoded = rows.map((row) => [
    ...fields.map((field) => encode(field, clean(row[columns[field]]))),
    agentCode.get(agentOf(row)) || 0,
  ]);

  return {
    id: randomUUID(),
    importedAt: now.toISOString(),
    importedBy: String(importedBy || ''),
    sourceFile: String(sourceFile || '').slice(0, 200),
    sourceSheet: sheet.name,
    responseCount: encoded.length,
    agentCount: agentNames.length,
    fields,
    values: Object.fromEntries(fields.map((field) => [field, [...dictionaries[field].keys()]])),
    rows: encoded,
    questions: readQuestions(workbook),
    workbookTotals: readWorkbookTotals(workbook),
  };
}

/** Appends a newly imported dataset while keeping one compatible encoded dataset in storage. */
export function appendSurveyDataset(existing, incoming, { sourceFile = '', importedBy = '', now = new Date() } = {}) {
  if (!existing) return { ...incoming, sourceFile: String(sourceFile || incoming.sourceFile || '').slice(0, 200), importedBy: String(importedBy || '') };
  const fields = [...new Set([...existing.fields, ...incoming.fields])];
  const read = (dataset, row, field) => {
    const index = dataset.fields.indexOf(field);
    return index < 0 ? '' : dataset.values[field][row[index]] || '';
  };
  const values = Object.fromEntries(fields.map((field) => [field, ['']]));
  const indexes = new Map(fields.map((field) => [field, new Map([['', 0]])]));
  const encode = (field, value) => {
    const dictionary = indexes.get(field);
    if (!dictionary.has(value)) dictionary.set(value, dictionary.size);
    return dictionary.get(value);
  };
  const agentOffset = Math.max(0, ...existing.rows.map((row) => Number(row[existing.fields.length]) || 0));
  const encodeRows = (dataset, offset = 0) => dataset.rows.map((row) => [
    ...fields.map((field) => encode(field, read(dataset, row, field))),
    (Number(row[dataset.fields.length]) || 0) + offset,
  ]);
  const rows = [...encodeRows(existing), ...encodeRows(incoming, agentOffset)];
  for (const field of fields) values[field] = [...indexes.get(field).keys()];
  return {
    id: randomUUID(),
    importedAt: now.toISOString(),
    importedBy: String(importedBy || ''),
    sourceFile: [existing.sourceFile, sourceFile || incoming.sourceFile].filter(Boolean).join(', ').slice(0, 200),
    sourceSheet: `${existing.sourceSheet}, ${incoming.sourceSheet}`.slice(0, 200),
    responseCount: rows.length,
    agentCount: new Set(rows.map((row) => row[fields.length]).filter(Boolean)).size,
    fields,
    values,
    rows,
    questions: { ...(existing.questions || {}), ...(incoming.questions || {}) },
    workbookTotals: {},
  };
}
