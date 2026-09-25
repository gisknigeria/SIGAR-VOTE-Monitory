import test from 'node:test';
import assert from 'node:assert/strict';
import { openCsvWorkbook, openWorkbook } from '../voter-survey/xlsx.js';
import { buildSurveyDataset } from '../voter-survey/import.js';
import { ALLI, HAMZAT, buildXlsx, SURVEY_HEADER, surveyRow } from '../voter-survey/test-fixtures.js';
import { buildDataset, describeDataset, normalizePhone } from './datasets.js';
import { matchLga, oyoLgas } from './lga.js';
import { buildPulse, STATE_BASELINE } from './pulse.js';
import { createPreElectionRepository } from './repository.js';

test('matchLga maps campaign spellings onto the 33 register LGAs', () => {
  assert.equal(oyoLgas().length, 33);
  const cases = {
    'OYO EAST LG': 'OYO EAST',
    'OGBOMOSHO NORTH': 'OGBOMOSO NORTH',
    'IB SOUTHWEST LG': 'IBADAN SOUTH WEST',
    'IBADAN SOUTH- EAST': 'IBADAN SOUTH-EAST',
    'Ibadan South-East': 'IBADAN SOUTH-EAST',
    'Oriire': 'ORI IRE',
    'Orelope': 'OORELOPE',
    'Ona-Ara': 'ONA-ARA',
    'OGO-OLUWA LG': 'OGO-OLUWA',
    'SUURULERE LG': 'SURULERE',
    'Surulere': 'SURULERE',
    'Local Government': '',
    'Lagos Island': '',
  };
  for (const [input, expected] of Object.entries(cases)) assert.equal(matchLga(input), expected, input);
});

test('normalizePhone restores the leading zero and rejects malformed numbers', () => {
  assert.equal(normalizePhone('7010000584'), '07010000584');
  assert.equal(normalizePhone(8060811060), '08060811060');
  assert.equal(normalizePhone('+234 806 081 1060'), '08060811060');
  assert.equal(normalizePhone('08060811060, 07034767826'), '08060811060');
  assert.equal(normalizePhone('0806081106'), '');
  assert.equal(normalizePhone(''), '');
});

test('member lists keep no names or phones and count a person in two lists once', () => {
  const agents = buildDataset('members', openWorkbook(buildXlsx({
    Master: [
      ['Record ID', 'State', 'LGA', 'Ward / source label', 'PU code', 'Polling unit / location', 'Agent name', 'Phone number', 'Name supplied'],
      ['OY-1', 'Oyo', 'Atiba', 'WARD 1', '001', 'School', 'ADE OLU', '08060811060', 1],
      ['OY-2', 'Oyo', 'Atiba', 'WARD 1', '002', 'Market', 'BOLA ADE', '8034767826', 1],
      ['OY-3', 'Oyo', 'Atiba', 'WARD 1', '002', 'Market', 'BOLA ADE', '08034767826', 1],
    ],
    'Atiba': [['Record ID', 'Agent name', 'Phone number'], ['OY-1', 'ADE OLU', '08060811060']],
  })), { label: 'Polling-unit agents' });
  assert.equal(agents.summary.rowsRead, 3, 'reads only the Master sheet');
  assert.equal(agents.summary.uniquePeople, 2);
  assert.ok(!JSON.stringify(agents).includes('08060811060'));
  assert.ok(!JSON.stringify(agents).includes('ADE OLU'));

  // One sheet per LGA, no LGA column, a title-less header on row 1.
  const volunteers = buildDataset('members', openWorkbook(buildXlsx({
    'OYO WEST LG': [['S/N', 'NAME', 'PHONE NO', 'WARD', 'UNIT'], [1, 'ADE OLU', '08060811060', 'WARD 2', 4], [2, 'KEMI', '07011112222', 'WARD 2', 5]],
    'Summary': [['LGA', 'Count'], ['Oyo West', 2]],
  })), { label: 'Volunteers' });
  assert.equal(volunteers.summary.rowsRead, 2);
  assert.deepEqual(volunteers.summary.sheets, ['OYO WEST LG']);
  assert.equal(describeDataset(volunteers).records, undefined);

  const pulse = buildPulse({ datasets: [agents, volunteers] });
  assert.equal(pulse.members.total, 3, 'the shared phone number is one person');
  assert.equal(pulse.members.inMoreThanOneList, 1);
  assert.deepEqual(pulse.members.groups.map((group) => group.people), [2, 2]);
  assert.equal(pulse.byLga.find((row) => row.lga === 'ATIBA').members, 2);
  assert.equal(pulse.byLga.find((row) => row.lga === 'OYO WEST').members, 2, 'listed in both LGAs, counted in each');
  const atiba = buildPulse({ datasets: [agents, volunteers], lga: 'atiba' });
  assert.equal(atiba.filter.lga, 'ATIBA');
  assert.equal(atiba.members.total, 2);
  assert.equal(atiba.members.unitsCovered, 2);
});

test('contact lists keep only counts per LGA and flag Excel-truncated files', () => {
  const csv = Buffer.from('Lga ,Phone Number\nAFIJIO,7010000584\nAFIJIO,7010000584\nIBADAN SOUTH- EAST,8031234567\nIBADAN SOUTH-EAST,8031234568\nNOWHERE,8031234569\nAFIJIO,123\n');
  const contacts = buildDataset('contacts', openCsvWorkbook(csv));
  assert.deepEqual(contacts.counts, { AFIJIO: 1, 'IBADAN SOUTH-EAST': 2 });
  assert.equal(contacts.summary.duplicatesInFile, 1);
  assert.equal(contacts.summary.invalid, 1);
  assert.deepEqual(contacts.summary.unmatched, [{ name: 'NOWHERE', count: 1 }]);
  assert.equal(contacts.summary.truncated, false);
  assert.equal(buildPulse({ datasets: [contacts] }).contacts.total, 3);
});

test('reference figures use the upload per LGA and published totals until every LGA is loaded', () => {
  const reference = buildDataset('reference', openCsvWorkbook(Buffer.from('LGA,Population,Registered voters,PVCs collected\nAtiba,"250,000",120000,100000\nOyo West,200000,90000,95000\nTotal,1,1,1\n')));
  assert.equal(reference.summary.stored, 2);
  assert.equal(reference.summary.warnings.length, 1, 'PVCs above registered voters is flagged');
  const state = buildPulse({ datasets: [reference] });
  assert.equal(state.reference.registeredVoters.value, STATE_BASELINE.registeredVoters.value);
  assert.equal(state.reference.lgaLevelLoaded, 2);
  const atiba = buildPulse({ datasets: [reference], lga: 'Atiba' });
  assert.equal(atiba.reference.population.value, 250000);
  assert.equal(atiba.reference.pvcRate, 0.8333);
  const iseyin = buildPulse({ datasets: [reference], lga: 'Iseyin' });
  assert.equal(iseyin.reference.population, null, 'an LGA with no upload shows as not loaded, never zero');
});

test('the pulse joins the survey and writes findings; empty sources say they are not loaded', () => {
  const survey = buildSurveyDataset(openWorkbook(buildXlsx({
    'Cleaned Table': [
      SURVEY_HEADER,
      ...Array.from({ length: 40 }, (_, i) => surveyRow({ id: i, vote: i < 22 ? ALLI : HAMZAT, lga: 'Atiba' })),
      ...Array.from({ length: 40 }, (_, i) => surveyRow({ id: 100 + i, vote: i < 30 ? HAMZAT : i < 35 ? ALLI : '', lga: 'Ibadan North-East', issue: 'Security' })),
    ],
  })));
  const pulse = buildPulse({ survey });
  assert.equal(pulse.survey.responses, 80);
  assert.equal(pulse.survey.candidates[0].short, 'Hamzat');
  assert.equal(pulse.members.available, false);
  assert.equal(pulse.contacts.available, false);
  assert.ok(pulse.insights.some((item) => /No member list loaded/.test(item.text)));
  assert.ok(pulse.insights.some((item) => item.tone === 'risk' && /Sen\. Alli is #2/.test(item.text)));
  assert.equal(pulse.byLga.find((row) => row.lga === 'IBADAN NORTH EAST').responses, 40);

  const atiba = buildPulse({ survey, lga: 'ATIBA' });
  assert.equal(atiba.survey.responses, 40);
  assert.equal(atiba.survey.candidates[0].short, 'Sen. Alli');
  assert.ok(atiba.insights.some((item) => /Only 40 survey responses/.test(item.text)));
});

test('repository replaces uploads of the same kind and label only', async () => {
  const jsonDb = {};
  const repo = createPreElectionRepository({ jsonDb, saveJson: () => {} });
  const make = (kind, label, id) => ({ id, kind, label, uploadedAt: new Date().toISOString() });
  await repo.savePreElectionDataset(make('members', 'Agents', 'a'));
  await repo.savePreElectionDataset(make('members', 'Volunteers', 'b'));
  const { replaced } = await repo.savePreElectionDataset(make('members', 'agents', 'c'));
  assert.deepEqual(replaced, ['a']);
  await repo.savePreElectionDataset(make('contacts', 'List 1', 'd'));
  await repo.savePreElectionDataset(make('contacts', 'List 2', 'e'));
  assert.deepEqual((await repo.preElectionDatasets()).map((item) => item.id).sort(), ['b', 'c', 'e']);
  assert.equal((await repo.deletePreElectionDataset('b')).id, 'b');
  assert.equal(await repo.deletePreElectionDataset('b'), null);
});
