import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportingRepository, operationalReportRollupsToCsv, resolvePhaseWindow, resolveTimeWindow } from './repository.js';

function fixture() {
  return createReportingRepository({
    pool: null,
    jsonDb: {
      incidents: [
        {
          id: 'i-1',
          reportType: 'Network Connectivity',
          status: 'acknowledged',
          lga: 'Ibadan North',
          ward: 'Ward 1',
          pollingUnit: 'PU 1',
          createdAt: '2026-09-10T08:00:00.000Z',
          updatedAt: '2026-09-10T08:20:00.000Z',
          lifecycle: { transitionHistory: [{ to: 'reported', at: '2026-09-10T08:00:00.000Z' }, { to: 'acknowledged', at: '2026-09-10T08:20:00.000Z' }] },
        },
        {
          id: 'r-1',
          reportType: 'Polling Unit Result',
          status: 'Submitted',
          lga: 'Ibadan North',
          ward: 'Ward 1',
          pollingUnit: 'PU 1',
          createdAt: '2026-09-10T08:30:00.000Z',
        },
      ],
      intelligenceSignals: { signal: { id: 's-1', geography: { state: 'Oyo', lga: 'Ibadan North' }, updatedAt: '2026-09-10T08:35:00.000Z' } },
      intelligenceDecisions: { decision: { id: 'd-1', stage: 'proposed', geography: { state: 'Oyo', lga: 'Ibadan North' }, updatedAt: '2026-09-10T08:36:00.000Z' } },
      resourceIntelligence: { resource: { id: 'req-1', kind: 'requirement', quantity: 4, resourceType: 'Radio', geography: { state: 'Oyo', lga: 'Ibadan North' }, updatedAt: '2026-09-10T08:10:00.000Z' } },
    },
  });
}

test('operational report derives metrics and metadata from known sources', async () => {
  const report = await fixture().operationalReport({ state: 'Oyo', lga: 'Ibadan North' });
  assert.equal(report.metrics.coverage.submitted, 1);
  assert.equal(report.metrics.backlog.openIncidents, 1);
  assert.equal(report.metrics.responseTime.averageMillisecondsToAcknowledge, 20 * 60 * 1000);
  assert.equal(report.metrics.quality.completenessPercent, 100);
  assert.equal(report.metrics.resources.missing, 4);
  assert.equal(report.rollups.byLga[0].geography.lga, 'Ibadan North');
  assert.ok(report.metadata.freshness);
  assert.equal(report.metadata.completeness.knownSourceRecords, 5);
  assert.ok(report.metadata.limitations.length > 0);
});

test('coverage counts distinct polling units, not duplicate submissions', async () => {
  const report = await createReportingRepository({
    pool: null,
    jsonDb: {
      incidents: [
        { id: 'dup-1', reportType: 'Polling Unit Result', state: 'Oyo', lga: 'Ibadan North', ward: 'Ward 1', pollingUnit: 'PU 1', createdAt: '2026-09-10T08:00:00.000Z' },
        { id: 'dup-2', reportType: 'Polling Unit Result', state: 'Oyo', lga: 'Ibadan North', ward: 'Ward 1', pollingUnit: 'PU 1', createdAt: '2026-09-10T08:05:00.000Z' },
        { id: 'dup-3', reportType: 'Polling Unit Result', state: 'Oyo', lga: 'Ibadan North', ward: 'Ward 1', pollingUnit: 'PU 2', createdAt: '2026-09-10T08:10:00.000Z' },
      ],
      resourceIntelligence: {},
      intelligenceSignals: {},
      intelligenceDecisions: {},
    },
  }).operationalReport({ state: 'Oyo', lga: 'Ibadan North' });

  assert.equal(report.metrics.coverage.submitted, 2);
  assert.ok(report.metrics.coverage.submitted <= report.metrics.coverage.denominator);
});

test('wards with the same name stay separated by their parent geography', async () => {
  const report = await createReportingRepository({
    pool: null,
    jsonDb: {
      incidents: [
        { id: 'ward-a', reportType: 'Polling Unit Result', state: 'Oyo', lga: 'Ibadan North', ward: 'Ward 1', pollingUnit: 'PU 9', createdAt: '2026-09-10T08:00:00.000Z' },
        { id: 'ward-b', reportType: 'Polling Unit Result', state: 'Oyo', lga: 'Atiba', ward: 'Ward 1', pollingUnit: 'PU 1', createdAt: '2026-09-10T08:01:00.000Z' },
      ],
      resourceIntelligence: {},
      intelligenceSignals: {},
      intelligenceDecisions: {},
    },
  }).operationalReport({ state: 'Oyo' });

  assert.equal(report.rollups.byWard.length, 2);
  assert.deepEqual(report.rollups.byWard.map((group) => ({ lga: group.geography.lga, ward: group.geography.ward })).sort((a, b) => a.lga.localeCompare(b.lga)), [
    { lga: 'Atiba', ward: 'Ward 1' },
    { lga: 'Ibadan North', ward: 'Ward 1' },
  ]);
});

test('filtered reports apply matching geography to freshness and timeliness', async () => {
  // Timestamps are relative to the moment the test runs (not hardcoded absolute
  // dates) so "last 24h" stays deterministic regardless of wall-clock drift.
  const now = Date.now();
  const isoMinutesAgo = (minutes) => new Date(now - minutes * 60_000).toISOString();
  const latest = isoMinutesAgo(30);
  const report = await createReportingRepository({
    pool: null,
    jsonDb: {
      incidents: [
        { id: 'g-1', reportType: 'Network Connectivity', state: 'Oyo', lga: 'Atiba', ward: 'Ward 1', pollingUnit: 'PU 1', createdAt: isoMinutesAgo(180), updatedAt: isoMinutesAgo(150) },
        { id: 'g-2', reportType: 'Network Connectivity', state: 'Oyo', lga: 'Atiba', ward: 'Ward 2', pollingUnit: 'PU 7', createdAt: isoMinutesAgo(60), updatedAt: isoMinutesAgo(45) },
      ],
      resourceIntelligence: {
        req: { id: 'r-1', kind: 'requirement', resourceType: 'Radio', unit: 'sets', quantity: 2, geography: { state: 'Oyo', lga: 'Atiba', ward: 'Ward 1' }, updatedAt: latest },
      },
      intelligenceSignals: {},
      intelligenceDecisions: {},
    },
  }).operationalReport({ state: 'Oyo', lga: 'Atiba' });

  assert.equal(report.metrics.resources.byType[0].resourceType, 'Radio');
  assert.equal(report.metadata.freshness, latest);
  assert.equal(report.metrics.timeliness.latestRecordAt, latest);
  assert.equal(report.metrics.timeliness.recordsLast24h, 3);
  assert.equal(report.rollups.byLga.length, 1);
  assert.equal(report.rollups.byLga[0].geography.lga, 'Atiba');
});

test('empty report is explicit about missing known data', async () => {
  const report = await createReportingRepository({ pool: null, jsonDb: {}, }).operationalReport({ state: 'Oyo', lga: 'Atiba' });
  assert.equal(report.metadata.completeness.metricCoverage, 'no-known-records');
  assert.equal(report.metrics.coverage.submitted, 0);
  assert.equal(report.metadata.freshness, null);
});

test('resolvePhaseWindow splits pre-election/election-day/post-election around the configured date and never guesses one', () => {
  const electionDate = '2026-11-03';
  const pre = resolvePhaseWindow('pre-election', electionDate);
  assert.equal(pre.since, null);
  assert.equal(pre.until, '2026-11-03T00:00:00.000Z');
  const day = resolvePhaseWindow('election-day', electionDate);
  assert.equal(day.since, '2026-11-03T00:00:00.000Z');
  assert.equal(day.until, '2026-11-04T00:00:00.000Z');
  const post = resolvePhaseWindow('post-election', electionDate);
  assert.equal(post.since, '2026-11-04T00:00:00.000Z');
  assert.equal(post.until, null);
  assert.throws(() => resolvePhaseWindow('election-day', ''), /Set SIGAR_ELECTION_DATE/);
  assert.throws(() => resolvePhaseWindow('not-a-phase', electionDate), /Invalid lifecycle phase/);
});

test('resolveTimeWindow prefers explicit since/until over phase and validates dates', () => {
  const explicit = resolveTimeWindow({ since: '2026-01-01', until: '2026-02-01', phase: 'election-day' }, '2026-11-03');
  assert.equal(explicit.since, new Date('2026-01-01').toISOString());
  assert.equal(explicit.phase, 'election-day');
  assert.throws(() => resolveTimeWindow({ since: 'not-a-date' }), /Invalid since date/);
  assert.deepEqual(resolveTimeWindow({}), { since: null, until: null, phase: null });
});

test('operationalReport rejects an unresolvable lifecycle phase instead of guessing a window', async () => {
  await assert.rejects(
    createReportingRepository({ pool: null, jsonDb: {} }).operationalReport({ phase: 'election-day' }),
    /Set SIGAR_ELECTION_DATE/,
  );
});

test('operationalReport applies an explicit time window and excludes records with no usable timestamp', async () => {
  const jsonDb = {
    incidents: [
      { id: 'in-window', state: 'Oyo', lga: 'Atiba', createdAt: '2026-06-15T10:00:00.000Z' },
      { id: 'out-of-window', state: 'Oyo', lga: 'Atiba', createdAt: '2026-01-01T10:00:00.000Z' },
      { id: 'no-timestamp', state: 'Oyo', lga: 'Atiba' },
    ],
  };
  const report = await createReportingRepository({ pool: null, jsonDb }).operationalReport({ lga: 'Atiba', since: '2026-06-01', until: '2026-07-01' });
  assert.deepEqual(report.sources, { incidents: 1, results: 0, dedicatedResultRecords: 0, signals: 0, decisions: 0, resources: 0, tasks: 0, reconciliations: 0 });
  assert.equal(report.window.since, new Date('2026-06-01').toISOString());
  assert.ok(report.metadata.limitations.some((line) => line.includes('excluded rather than assumed current')));
});

test('operationalReport joins tasks, reconciliations and resource utilization without treating provisional data as final', async () => {
  const jsonDb = {
    incidents: [],
    resourceIntelligence: {
      dep1: { id: 'dep1', kind: 'deployment', resourceType: 'Radio', quantity: 5, utilizationStatus: 'underutilized', geography: { state: 'Oyo', lga: 'Atiba' } },
      dep2: { id: 'dep2', kind: 'deployment', resourceType: 'Radio', quantity: 3, geography: { state: 'Oyo', lga: 'Atiba' } },
    },
    tasks: {
      't1': { id: 't1', status: 'completed', geography: { state: 'Oyo', lga: 'Atiba' }, createdAt: '2026-06-01T08:00:00.000Z', acknowledgedAt: '2026-06-01T08:10:00.000Z' },
      't2': { id: 't2', status: 'open', geography: { state: 'Oyo', lga: 'Atiba' }, createdAt: '2026-06-01T09:00:00.000Z' },
    },
    resultReconciliations: {
      r1: { id: 'r1', electionId: 'ng-oyo-election', pollingUnit: 'PU 1', status: 'pending-review', discrepancies: [{ party: 'A' }], createdAt: '2026-06-01T08:00:00.000Z' },
      r2: { id: 'r2', electionId: 'ng-oyo-election', pollingUnit: 'PU 2', status: 'reviewed', correctionId: 'c1', discrepancies: [], createdAt: '2026-06-01T08:00:00.000Z' },
    },
  };
  const report = await createReportingRepository({ pool: null, jsonDb }).operationalReport({ lga: 'Atiba' });

  assert.equal(report.metrics.resources.utilization.underutilized, 1);
  assert.equal(report.metrics.resources.utilization.unreviewed, 1);
  assert.equal(report.metrics.resources.utilization.totalDeployments, 2);
  assert.equal(report.metrics.outcomes.tasksCompleted, 1);
  assert.equal(report.metrics.outcomes.tasksOpenOrOverdue, 1);
  assert.ok(report.metrics.responseTime.averageMillisecondsToAcknowledgeTask > 0);
  assert.equal(report.metrics.reconciliation.pending, 1);
  assert.equal(report.metrics.reconciliation.reviewed, 1);
  assert.equal(report.metrics.reconciliation.corrected, 1);
  assert.equal(report.metrics.reconciliation.totalDiscrepancies, 1);
});

test('operationalReport groups dedicated result records by source version without conflating them with the legacy incident count', async () => {
  const jsonDb = {
    incidents: [{ id: 'legacy-1', reportType: 'Polling Unit Result', state: 'Oyo', lga: 'Atiba', ward: 'Ward 1', pollingUnit: 'PU 1', createdAt: '2026-06-01T08:00:00.000Z' }],
    resultRecords: [
      { id: 'rr-1', state: 'Oyo', lga: 'Atiba', ward: 'Ward 1', pollingUnit: 'PU 1', sourceReleaseId: 'release-a', createdAt: '2026-06-01T08:00:00.000Z' },
      { id: 'rr-2', state: 'Oyo', lga: 'Atiba', ward: 'Ward 2', pollingUnit: 'PU 9', sourceReleaseId: 'release-a', createdAt: '2026-06-01T08:00:00.000Z' },
    ],
  };
  const report = await createReportingRepository({ pool: null, jsonDb }).operationalReport({ lga: 'Atiba' });

  assert.equal(report.metrics.coverage.submitted, 1);
  assert.equal(report.metrics.coverage.dedicatedResultRecords.submitted, 2);
  assert.deepEqual(report.metadata.sourceVersions.results, [{ sourceReleaseId: 'release-a', count: 2 }]);
});

test('report snapshots are immutable and retrievable by id', async () => {
  const jsonDb = { incidents: [{ id: 'i-1', state: 'Oyo', lga: 'Atiba', createdAt: '2026-06-01T08:00:00.000Z' }] };
  const repository = createReportingRepository({ pool: null, jsonDb, saveJson() {} });

  const snapshot = await repository.createReportSnapshot({ filter: { lga: 'Atiba' }, requestedBy: 'admin-1', label: 'weekly check-in' });
  assert.ok(snapshot.id);
  assert.equal(snapshot.requestedBy, 'admin-1');
  assert.equal(snapshot.report.scope.lga, 'Atiba');

  const fetched = await repository.reportSnapshot(snapshot.id);
  assert.deepEqual(fetched, snapshot);

  jsonDb.incidents.push({ id: 'i-2', state: 'Oyo', lga: 'Atiba', createdAt: '2026-06-02T08:00:00.000Z' });
  const fetchedAgain = await repository.reportSnapshot(snapshot.id);
  assert.equal(fetchedAgain.report.sources.incidents, 1, 'a stored snapshot must not reflect data recorded after it was taken');

  const listed = await repository.reportSnapshots({ requestedBy: 'admin-1' });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, snapshot.id);
});

test('operationalReportRollupsToCsv exports rollups with header, escaping and level column', () => {
  const csv = operationalReportRollupsToCsv({
    rollups: {
      byLga: [{ geography: { state: 'Oyo', lga: 'Atiba, North' }, records: 4 }],
      byWard: [],
      byPollingUnit: [],
    },
  });
  const lines = csv.split('\n');
  assert.equal(lines[0], 'level,state,lga,ward,pollingUnit,records');
  assert.equal(lines[1], 'lga,Oyo,"Atiba, North",,,4');
});
