import test from 'node:test';
import assert from 'node:assert/strict';
import { openCsvWorkbook, openWorkbook } from './xlsx.js';
import { appendSurveyDataset, buildSurveyDataset } from './import.js';
import { analyzeSurvey, lgaKey } from './analysis.js';
import { classifyPhrase } from './sentiment.js';
import { buildXlsx, SURVEY_HEADER, surveyRow, ALLI, HAMZAT } from './test-fixtures.js';

const workbookWith = (rows, extraSheets = {}) =>
  openWorkbook(buildXlsx({ 'Cleaned Table': [SURVEY_HEADER, ...rows.map((row, i) => surveyRow({ id: i + 1, ...row }))], ...extraSheets }));

test('the reader returns cell values by position, including gaps and numbers', () => {
  const workbook = openWorkbook(buildXlsx({ First: [['a', '', 'c'], [1, 'two & three']], Second: [['x']] }));
  assert.deepEqual(workbook.sheetNames, ['First', 'Second']);
  assert.deepEqual(workbook.rows('First'), [['a', '', 'c'], ['1', 'two & three']]);
  assert.equal(workbook.rows('Missing'), null);
  assert.throws(() => openWorkbook(Buffer.from('this is not a zip file at all, just text')), /not a valid \.xlsx/);
});

test('CSV imports preserve quoted commas and newlines', () => {
  const csv = Buffer.from('Likely Vote Candidate,Voting LGA,Respondent\n"Sen. Alli","Atiba","Youth, urban\\nvoices"\n');
  const rows = openCsvWorkbook(csv).rows('CSV upload');
  assert.equal(rows[1][0], 'Sen. Alli');
  assert.equal(rows[1][2], 'Youth, urban\\nvoices');
});

test('import keeps answers but drops agent names and submission IDs', () => {
  const dataset = buildSurveyDataset(workbookWith([
    { vote: ALLI, agent: 'Adeola Bankole' },
    { vote: HAMZAT, agent: 'Chiamaka Obi' },
    { vote: '', agent: 'Adeola Bankole' },
  ]), { sourceFile: 'survey.xlsx' });

  const stored = JSON.stringify(dataset);
  for (const leak of ['Adeola', 'Bankole', 'Chiamaka', 'Obi']) assert.equal(stored.includes(leak), false, `stored survey must not contain "${leak}"`);
  assert.equal(dataset.fields.includes('agent'), false);
  assert.equal(dataset.responseCount, 3);
  assert.equal(dataset.agentCount, 2, 'agents are still counted, as opaque numbers');
  assert.equal(dataset.sourceSheet, 'Cleaned Table');
});

test('new survey imports append to the existing dataset', () => {
  const first = buildSurveyDataset(workbookWith([{ vote: ALLI, lga: 'Atiba' }]));
  const second = buildSurveyDataset(workbookWith([{ vote: HAMZAT, lga: 'Ibadan North' }]));
  const combined = appendSurveyDataset(first, second, { sourceFile: 'second.xlsx' });
  assert.equal(combined.responseCount, 2);
  assert.equal(analyzeSurvey(combined).vote.named, 2);
  assert.equal(analyzeSurvey(combined).vote.firstChoice.find((row) => row.name === ALLI).count, 1);
});

test('import refuses a workbook without the survey columns', () => {
  const workbook = openWorkbook(buildXlsx({ Sheet1: [['Name', 'Phone'], ['x', 'y']] }));
  assert.throws(() => buildSurveyDataset(workbook), /Likely Vote Candidate/);
});

test("the workbook's own headline totals are read so an import can be checked against Excel", () => {
  const dataset = buildSurveyDataset(workbookWith([{ vote: ALLI }], {
    'Key Analysis Summary': [['Oyo Polls Summary'], ['Total Responses', 1, '', 'Named Candidate Votes', 1], ['Sen Ali Votes', 1]],
  }));
  assert.deepEqual(dataset.workbookTotals, { responses: 1, namedVotes: 1, focusVotes: 1 });
});

const sample = () => buildSurveyDataset(workbookWith([
  ...Array.from({ length: 6 }, () => ({ vote: ALLI, second: HAMZAT, lga: 'Atiba', agent: 'A One' })),
  ...Array.from({ length: 4 }, () => ({ vote: HAMZAT, second: ALLI, lga: 'Atiba', agent: 'B Two' })),
  ...Array.from({ length: 1 }, () => ({ vote: ALLI, lga: 'Ibadan North-East', agent: 'C Three' })),
  ...Array.from({ length: 3 }, () => ({ vote: HAMZAT, lga: 'Ibadan North-East', agent: 'C Three' })),
  { vote: '', lga: 'Atiba', agent: 'A One' },
  { vote: ALLI, second: ALLI, lga: 'Atiba', agent: 'A One' },
]));

test('vote shares use people who named a candidate as the base, not every response', () => {
  const view = analyzeSurvey(sample());
  assert.equal(view.vote.named, 15);
  assert.equal(view.focus.name, ALLI);
  assert.equal(view.focus.votes, 8);
  assert.equal(view.focus.share, Number((8 / 15).toFixed(4)));
  assert.equal(view.focus.rank, 1);
  assert.equal(view.quality.noVoteAnswer, 1);
});

test('second choice never counts a voter picking their own first choice again', () => {
  const view = analyzeSurvey(sample());
  assert.equal(view.vote.secondChoice.rows.find((row) => row.name === ALLI).count, 4, 'only Hamzat voters naming Alli count');
  assert.equal(view.quality.focusSecondChoiceIsFocus, 1, 'the contradiction is reported, not hidden');
  const alliTransfer = view.vote.transfers.find((row) => row.candidate === ALLI);
  assert.equal(alliTransfer.to[0].name, HAMZAT);
});

test('LGA weighting can reverse a raw lead built on an over-sampled LGA', () => {
  // Atiba (Alli-heavy) is over-sampled; Ibadan North-East (Hamzat-heavy) is the bigger LGA.
  const weights = new Map([[lgaKey('Atiba'), 100], [lgaKey('IBADAN NORTH EAST'), 900]]);
  const dataset = sample();
  const view = analyzeSurvey(dataset, {}, { lgaWeights: weights, weightBasis: 'test' });
  // Ibadan North-East has only 4 named answers, under the 30 minimum, so it is excluded.
  assert.equal(view.vote.weighted, null, 'no LGA has enough answers yet, so no weighted figure is claimed');

  const many = buildSurveyDataset(workbookWith([
    ...Array.from({ length: 40 }, () => ({ vote: ALLI, lga: 'Atiba' })),
    ...Array.from({ length: 10 }, () => ({ vote: HAMZAT, lga: 'Atiba' })),
    ...Array.from({ length: 10 }, () => ({ vote: ALLI, lga: 'Ibadan North-East' })),
    ...Array.from({ length: 30 }, () => ({ vote: HAMZAT, lga: 'Ibadan North-East' })),
  ]));
  const raw = analyzeSurvey(many);
  assert.equal(raw.vote.firstChoice[0].name, ALLI, 'raw: Alli leads 50 to 40');
  const fair = analyzeSurvey(many, {}, { lgaWeights: weights, weightBasis: 'test' });
  assert.equal(fair.vote.weighted.rows[0].name, HAMZAT, 'weighted: the larger LGA decides');
  assert.equal(fair.vote.weighted.coverage, 1);
});

test('an LGA collected mostly by one person is flagged', () => {
  const view = analyzeSurvey(sample());
  const ibne = view.byLga.find((row) => row.key === lgaKey('Ibadan North-East'));
  assert.ok(ibne.flags.includes('one-collector'));
  assert.ok(ibne.flags.includes('small-sample'));
  const atiba = view.byLga.find((row) => row.key === lgaKey('Atiba'));
  assert.equal(atiba.flags.includes('one-collector'), false, 'Atiba is split 8/4, under the 70% line');
});

test('filters narrow every figure, and LGA names match across spellings', () => {
  const view = analyzeSurvey(sample(), { lga: 'IBADAN NORTH EAST' });
  assert.equal(view.filter.responses, 4);
  assert.equal(view.vote.firstChoice[0].name, HAMZAT);
  assert.equal(view.vote.weighted, null, 'weighting is state-level only');
});

test('identical responses are counted as a data-quality warning', () => {
  const view = analyzeSurvey(sample());
  assert.ok(view.quality.duplicates >= 10);
});

test('written-answer examples appear only once a phrase recurs, so one person cannot be quoted', () => {
  const dataset = buildSurveyDataset(workbookWith([
    ...Array.from({ length: 6 }, () => ({ vote: ALLI, impression: 'Integrity' })),
    { vote: ALLI, impression: 'My neighbour Tunde says he is honest' },
  ]));
  const view = analyzeSurvey(dataset);
  const integrity = view.sentiment.themes.find((theme) => theme.id === 'integrity');
  assert.equal(integrity.count, 7);
  assert.deepEqual(integrity.examples.map((item) => item.phrase), ['integrity']);
  assert.equal(JSON.stringify(view).includes('Tunde'), false);
});

test('themes and tone for phrases that actually occur in the Oyo survey', () => {
  const cases = [
    ['competence well experienced and youth friendly being', 'positive', 'competence'],
    ['because he understands some problems facing the grass roots', 'positive', 'grassroots'],
    ['Integrity', 'positive', 'integrity'],
    ['he is a good person', 'positive', 'character'],
    ['he has good development record', 'positive', 'record'],
    ['good', 'positive', 'praise'],
    ['satisfied', 'positive', 'praise'],
    ['no comment', 'neutral', 'noView'],
    ['not familiar', 'neutral', 'unfamiliar'],
    ['next time', 'negative', 'notThisTime'],
    ['lack of experience', 'mixed', 'doubts'],
    ['rigging', 'negative', 'doubts'],
    ['I just don\'t have interest in him', 'neutral', 'noView'],
    ['no bad record', 'positive', 'record'],
    ['i believe in him', 'neutral', null],
  ];
  for (const [phrase, tone, theme] of cases) {
    const result = classifyPhrase(phrase);
    assert.equal(result.tone, tone, `tone of "${phrase}"`);
    if (theme) assert.ok(result.themes.includes(theme), `"${phrase}" should carry ${theme}, got ${result.themes}`);
    else assert.deepEqual(result.themes.filter((id) => id === 'doubts'), [], `"${phrase}" must not read as a doubt`);
  }
});
