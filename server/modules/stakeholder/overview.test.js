import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStakeholderOverview } from './overview.js';

const scope = { state: 'Oyo', lgas: 2, wards: 4, pollingUnits: 10, lgaNames: ['AFIJIO', 'ATIBA'] };

const result = (lga, ward, unit, entries, createdAt = '2026-09-14T09:00:00.000Z') => ({
  reportType: 'Polling Unit Result',
  lga, ward, pollingUnit: unit,
  resultCount: JSON.stringify(entries),
  createdAt,
  createdBy: 'agent-1',
  media: [{ id: 'evidence-1', type: 'image' }],
});

test('tallies parties, coverage and turnout from submitted results', () => {
  const view = buildStakeholderOverview({
    incidents: [
      result('AFIJIO', 'W1', 'PU 1', [{ party: 'APC', votes: 120 }, { party: 'PDP', votes: 80 }]),
      result('AFIJIO', 'W1', 'PU 2', [{ party: 'APC', votes: 30 }, { party: 'PDP', votes: 70 }]),
      result('ATIBA', 'W2', 'PU 3', [{ party: 'PDP', votes: 50 }]),
    ],
    registeredVoters: 1000,
    registeredVotersBasis: 'INEC 2023 state total (state level)',
    scope,
  });

  assert.equal(view.coverage.reportingUnits, 3);
  assert.equal(view.coverage.totalUnits, 10);
  assert.equal(view.coverage.percent, 30);
  assert.equal(view.turnout.votesCounted, 350);
  assert.equal(view.turnout.percent, 35);
  assert.deepEqual(view.parties.map((p) => [p.party, p.votes]), [['PDP', 200], ['APC', 150]]);
  assert.equal(view.leading.party, 'PDP');
  assert.equal(view.leading.margin, 50);
  assert.match(view.summary.coverageState, /monitor|early|healthy/i);
  assert.ok(view.watchlist.length >= 1);
  assert.ok(view.summary.decisionConfidence >= 0);
  assert.equal(view.preElection.hasTrainingData, false, 'nothing recorded must not read as 0% trained');
  assert.equal(view.preElection.hasLogisticsData, false);
});

test('a lead on partial returns is never reported as decisive', () => {
  const partial = buildStakeholderOverview({
    incidents: [result('AFIJIO', 'W1', 'PU 1', [{ party: 'APC', votes: 10 }])],
    scope,
  });
  assert.equal(partial.leading.decisive, false, '1 of 10 units is not a result');
  assert.ok(partial.notes.some((note) => /partial returns/i.test(note)));

  const mostly = buildStakeholderOverview({
    incidents: Array.from({ length: 6 }, (_, i) =>
      result('AFIJIO', 'W1', `PU ${i}`, [{ party: 'APC', votes: 10 }, { party: 'PDP', votes: 1 }])),
    scope,
  });
  assert.equal(mostly.leading.decisive, true);
});

test('the same polling unit reported twice counts once towards coverage', () => {
  const view = buildStakeholderOverview({
    incidents: [
      result('AFIJIO', 'W1', 'PU 1', [{ party: 'APC', votes: 10 }]),
      result('afijio', 'w1', 'pu 1', [{ party: 'APC', votes: 10 }]),
    ],
    scope,
  });
  assert.equal(view.coverage.reportingUnits, 1, 'coverage must count distinct units');
  assert.equal(view.coverage.submissions, 2, 'but both submissions are still visible');
});

test('incidents are reduced to counts, never detail', () => {
  const view = buildStakeholderOverview({
    incidents: [
      { reportType: 'Vote Buying', severity: 'High', lga: 'AFIJIO', ward: 'W1', pollingUnit: 'PU 9', description: 'names and details', createdBy: 'agent-7', media: [{ id: 'evidence-9' }] },
      { reportType: 'Vote Buying', severity: 'Critical', lga: 'ATIBA' },
      { reportType: 'BVAS Failure', severity: 'High', lga: 'ATIBA' },
    ],
    scope,
  });

  assert.equal(view.incidents.total, 3);
  assert.deepEqual(view.incidents.byType, [{ name: 'Vote Buying', count: 2 }, { name: 'BVAS Failure', count: 1 }]);

  // The whole payload must not carry identities, evidence references or sub-LGA locations.
  const serialized = JSON.stringify(view);
  for (const leak of ['agent-7', 'evidence-9', 'names and details', 'PU 9', 'W1']) {
    assert.equal(serialized.includes(leak), false, `stakeholder payload must not contain "${leak}"`);
  }
});

test('pre-election readiness includes staffing, training and equipment signals the stakeholder can act on', () => {
  const view = buildStakeholderOverview({
    incidents: [],
    phase: 'pre-election',
    users: [
      { id: 'a1', role: 'Agent', active: true, lga: 'AFIJIO', ward: 'W1', pollingUnit: 'PU 1' },
      { id: 'a2', role: 'Agent', active: true, lga: 'AFIJIO', ward: 'W1', pollingUnit: 'PU 2' },
      { id: 's1', role: 'Supervisor', active: true, lga: 'AFIJIO' },
      { id: 'a3', role: 'Agent', active: false, lga: 'ATIBA' },
    ],
    tasks: [
      { title: 'Agent training', status: 'completed', description: 'BVAS onboarding' },
      { title: 'Supervisor briefing', status: 'open', description: 'Field procedures' },
    ],
    resourceReadiness: [
      { resourceType: 'BVAS', required: 10, available: 8, arrived: 8 },
      { resourceType: 'Materials', required: 8, available: 5, arrived: 5 },
    ],
    scope,
  });

  assert.equal(view.preElection.agentCount, 2);
  assert.equal(view.preElection.supervisorCount, 1);
  assert.equal(view.preElection.staffingCoverage, 20);
  assert.equal(view.preElection.trainingCompletion, 50);
  assert.equal(view.preElection.equipmentReadiness, 80);
  assert.ok(view.preElection.logisticsReadiness >= 0);
  assert.equal(view.preElection.hasTrainingData, true);
  assert.equal(view.preElection.hasEquipmentData, true);
  assert.equal(view.preElection.hasLogisticsData, true);
  assert.ok(view.summary.coverageState === 'Low reporting' || view.summary.coverageState === 'Early reporting');
});

test('turnout is reported as unavailable rather than invented when no register is loaded', () => {
  const view = buildStakeholderOverview({
    incidents: [result('AFIJIO', 'W1', 'PU 1', [{ party: 'APC', votes: 10 }])],
    registeredVoters: null,
    scope,
  });
  assert.equal(view.turnout.percent, null);
  assert.equal(view.turnout.registeredVoters, null);
  assert.ok(view.notes.some((note) => /turnout cannot be calculated/i.test(note)));
});

test('malformed or negative vote entries are ignored rather than corrupting the tally', () => {
  const view = buildStakeholderOverview({
    incidents: [
      result('AFIJIO', 'W1', 'PU 1', [{ party: 'APC', votes: 10 }, { party: '', votes: 5 }, { party: 'PDP', votes: -3 }, { party: 'LP', votes: 'abc' }]),
      { reportType: 'Polling Unit Result', lga: 'AFIJIO', ward: 'W1', pollingUnit: 'PU 2', resultCount: 'not json', createdAt: '2026-09-14T09:00:00.000Z' },
    ],
    scope,
  });
  assert.deepEqual(view.parties, [{ party: 'APC', votes: 10, share: 100 }]);
  assert.equal(view.turnout.votesCounted, 10);
});
