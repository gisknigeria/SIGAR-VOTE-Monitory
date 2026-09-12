import { randomUUID } from 'node:crypto';
import { getRegistrationLocationOptions } from '../../../shared/electionData.js';
import { buildGeographyRollup, GEOGRAPHY_KEYS, geographyOf, matchesGeography, normalizeGeography } from '../foundation/geography-query.js';
import { deployment } from '../../config/deployment.js';

const LIFECYCLE_PHASES = ['pre-election', 'election-day', 'post-election'];
const ONE_DAY_MS = 86_400_000;
const TASK_OPEN_STATUSES = ['open', 'acknowledged', 'in-progress', 'overdue'];

/**
 * Resolves a lifecycle phase to a concrete [since, until) window using the
 * configured election date (SIGAR_ELECTION_DATE). Never guesses a date: if the
 * phase can't be resolved, the caller must supply since/until explicitly.
 */
export function resolvePhaseWindow(phase, electionDateIso) {
  if (!LIFECYCLE_PHASES.includes(phase)) throw new Error(`Invalid lifecycle phase. Use one of: ${LIFECYCLE_PHASES.join(', ')}.`);
  if (!electionDateIso) throw new Error(`Set SIGAR_ELECTION_DATE, or supply since/until explicitly, to scope the '${phase}' lifecycle phase.`);
  const electionDate = new Date(electionDateIso);
  if (!Number.isFinite(electionDate.getTime())) throw new Error('The configured election date is invalid.');
  const dayStart = new Date(Date.UTC(electionDate.getUTCFullYear(), electionDate.getUTCMonth(), electionDate.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + ONE_DAY_MS);
  if (phase === 'pre-election') return { since: null, until: dayStart.toISOString() };
  if (phase === 'election-day') return { since: dayStart.toISOString(), until: dayEnd.toISOString() };
  return { since: dayEnd.toISOString(), until: null };
}

export function resolveTimeWindow({ since, until, phase } = {}, electionDateIso = deployment.electionDate) {
  const hasExplicitBounds = Boolean(String(since || '').trim() || String(until || '').trim());
  if (phase && !hasExplicitBounds) return { ...resolvePhaseWindow(phase, electionDateIso), phase };
  const sinceTime = since ? Date.parse(since) : null;
  const untilTime = until ? Date.parse(until) : null;
  if (since && !Number.isFinite(sinceTime)) throw new Error('Invalid since date.');
  if (until && !Number.isFinite(untilTime)) throw new Error('Invalid until date.');
  return { since: since ? new Date(sinceTime).toISOString() : null, until: until ? new Date(untilTime).toISOString() : null, phase: phase || null };
}

const normalizeComparableText = (value) => String(value ?? '').trim().replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, ' ').toLowerCase();
const normalizeKey = (value) => normalizeComparableText(value);
const hasMatch = (filterValue, recordValue) => !filterValue || normalizeKey(recordValue) === normalizeKey(filterValue);
const matches = (item, filter = {}) => {
  const contestFilter = filter.electionId || filter.election_id || filter.contestId || filter.contest || '';
  const itemContest = item.electionId || item.election_id || item.contestId || item.contest || item.scopeId || '';
  if (contestFilter && itemContest && !hasMatch(contestFilter, itemContest)) return false;
  return matchesGeography(item, filter);
};
const safeDate = (value) => {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : null;
};
const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
/**
 * An item with no usable timestamp is excluded once a window is active rather
 * than assumed to be current -- a missing capture time must not silently count
 * as "within range".
 */
const withinWindow = (item, window, field = 'observedAt') => {
  if (!window.since && !window.until) return true;
  const time = safeDate(item[field] || item.createdAt || item.created_at);
  if (time === null) return false;
  if (window.since && time < Date.parse(window.since)) return false;
  if (window.until && time >= Date.parse(window.until)) return false;
  return true;
};
const utilizationBreakdown = (resources) => {
  const deployments = resources.filter((item) => item.kind === 'deployment');
  const counts = { adequate: 0, underutilized: 0, overstretched: 0, unreviewed: 0 };
  for (const item of deployments) {
    const status = ['adequate', 'underutilized', 'overstretched'].includes(item.utilizationStatus) ? item.utilizationStatus : 'unreviewed';
    counts[status] += 1;
  }
  return { ...counts, totalDeployments: deployments.length };
};
const reconciliationSummary = (reconciliations) => ({
  pending: reconciliations.filter((item) => item.status === 'pending-review').length,
  reviewed: reconciliations.filter((item) => item.status === 'reviewed').length,
  corrected: reconciliations.filter((item) => Boolean(item.correctionId)).length,
  totalDiscrepancies: reconciliations.reduce((sum, item) => sum + (item.discrepancies?.length || 0), 0),
});
const resolveReferenceName = (value, options = []) => {
  const fallback = String(value || '').trim();
  if (!fallback) return '';
  const normalized = normalizeKey(fallback);
  const match = options.find((option) => normalizeKey(option) === normalized);
  return match || fallback;
};
const getSelectedDenominator = (filter = {}) => {
  const state = String(filter.state || 'Oyo').trim() || 'Oyo';
  const rawLga = String(filter.lga || '').trim();
  const rawWard = String(filter.ward || '').trim();
  const pollingUnit = String(filter.pollingUnit || '').trim();
  const allLgas = getRegistrationLocationOptions(state).lgas;
  const lga = resolveReferenceName(rawLga, allLgas);
  const wardOptions = lga ? getRegistrationLocationOptions(state, lga).wards : [];
  const ward = resolveReferenceName(rawWard, wardOptions);

  if (pollingUnit) {
    const units = getRegistrationLocationOptions(state, lga || '', ward || '').pollingUnits;
    return units.some((unit) => normalizeKey(unit) === normalizeKey(pollingUnit)) ? 1 : 0;
  }
  if (ward) {
    return getRegistrationLocationOptions(state, lga || '', ward).pollingUnits.length;
  }
  if (lga) {
    return getRegistrationLocationOptions(state, lga).wards.reduce((total, currentWard) => total + getRegistrationLocationOptions(state, lga, currentWard).pollingUnits.length, 0);
  }

  return allLgas.reduce((total, currentLga) => total + getRegistrationLocationOptions(state, currentLga).wards.reduce((wardTotal, currentWard) => wardTotal + getRegistrationLocationOptions(state, currentLga, currentWard).pollingUnits.length, 0), 0);
};
const summarizeResourceTotals = (resources = []) => {
  const byType = new Map();
  for (const resource of resources) {
    const resourceType = String(resource.resourceType || resource.type || '').trim() || 'Unspecified';
    const unit = String(resource.unit || resource.resourceUnit || resource.unitType || 'units').trim() || 'units';
    const key = `${resourceType}::${unit}`;
    const item = byType.get(key) || { resourceType, unit, required: 0, available: 0, deployed: 0, arrived: 0, missing: 0, underutilized: 0 };
    if (resource.kind === 'requirement') item.required += Number(resource.quantity || 0);
    if (resource.kind === 'availability') item.available += Number(resource.quantity || 0);
    if (resource.kind === 'deployment') {
      item.deployed += Number(resource.quantity || 0);
      if (resource.arrivalStatus === 'arrived') item.arrived += Number(resource.quantity || 0);
      if (resource.utilizationStatus === 'underutilized') item.underutilized += Number(resource.quantity || 0);
    }
    byType.set(key, item);
  }
  const normalized = [...byType.values()].map((item) => ({ ...item, missing: Math.max(0, item.required - item.arrived) }));
  const totals = normalized.reduce((sum, item) => ({
    required: sum.required + item.required,
    available: sum.available + item.available,
    deployed: sum.deployed + item.deployed,
    arrived: sum.arrived + item.arrived,
    missing: sum.missing + item.missing,
    underutilized: sum.underutilized + item.underutilized,
  }), { required: 0, available: 0, deployed: 0, arrived: 0, missing: 0, underutilized: 0 });
  return { byType: normalized, totals };
};
export function createReportingRepository({ pool, jsonDb, saveJson, mappers }) {
  const toResultRecord = mappers?.toResultRecord || ((record) => record);
  const readSources = async () => {
    if (!pool) {
      jsonDb.incidents ||= [];
      jsonDb.intelligenceSignals ||= {};
      jsonDb.intelligenceDecisions ||= {};
      jsonDb.resourceIntelligence ||= {};
      jsonDb.tasks ||= {};
      jsonDb.resultRecords ||= [];
      jsonDb.resultReconciliations ||= {};
      return {
        incidents: jsonDb.incidents,
        signals: Object.values(jsonDb.intelligenceSignals),
        decisions: Object.values(jsonDb.intelligenceDecisions),
        resources: Object.values(jsonDb.resourceIntelligence),
        tasks: Object.values(jsonDb.tasks),
        dedicatedResults: jsonDb.resultRecords,
        reconciliations: Object.values(jsonDb.resultReconciliations),
      };
    }
    const [incidents, dedicatedResults, settings] = await Promise.all([
      pool.query('select * from incidents'),
      pool.query('select * from result_records'),
      pool.query("select key, value from app_settings where key like 'intelligence-signal:%' or key like 'intelligence-decision:%' or key like 'resource-intelligence:%' or key like 'task:%' or key like 'resultReconciliations:%'"),
    ]);
    const grouped = { signals: [], decisions: [], resources: [], tasks: [], reconciliations: [] };
    for (const row of settings.rows) {
      if (row.key.startsWith('intelligence-signal:')) grouped.signals.push(row.value);
      if (row.key.startsWith('intelligence-decision:')) grouped.decisions.push(row.value);
      if (row.key.startsWith('resource-intelligence:')) grouped.resources.push(row.value);
      if (row.key.startsWith('task:')) grouped.tasks.push(row.value);
      if (row.key.startsWith('resultReconciliations:')) grouped.reconciliations.push(row.value);
    }
    return { incidents: incidents.rows, dedicatedResults: dedicatedResults.rows.map(toResultRecord), ...grouped };
  };
  const toIncident = (item) => ({
    ...item,
    status: item.status || 'reported',
    geography: geographyOf(item),
    createdAt: item.createdAt || item.created_at,
    updatedAt: item.updatedAt || item.updated_at,
  });
  const toTask = (item) => ({
    ...item,
    geography: item.geography || {},
    createdAt: item.createdAt || item.created_at,
    acknowledgedAt: item.acknowledgedAt || item.acknowledged_at,
  });
  const snapshotKey = (id) => `report-snapshot:${id}`;
  const readSnapshots = async () => {
    if (!pool) { jsonDb.reportSnapshots ||= {}; return Object.values(jsonDb.reportSnapshots); }
    return (await pool.query("select value from app_settings where key like 'report-snapshot:%' order by key desc")).rows.map((row) => row.value);
  };
  const saveSnapshot = async (snapshot) => {
    if (!pool) { jsonDb.reportSnapshots ||= {}; jsonDb.reportSnapshots[snapshotKey(snapshot.id)] = snapshot; saveJson?.(); return snapshot; }
    await pool.query('insert into app_settings (key,value) values ($1,$2) on conflict (key) do nothing', [snapshotKey(snapshot.id), JSON.stringify(snapshot)]);
    return snapshot;
  };
  return {
    async operationalReport(filter = {}) {
      const geography = normalizeGeography(filter);
      const window = resolveTimeWindow(filter);
      const sources = await readSources();
      const incidents = sources.incidents.map(toIncident).filter((item) => matches(item, geography) && withinWindow(item, window));
      const resultRecords = incidents.filter((item) => item.reportType === 'Polling Unit Result' || item.report_type === 'Polling Unit Result');
      const uniqueResultCount = new Set(resultRecords.map((item) => {
        const resultGeography = geographyOf(item);
        return GEOGRAPHY_KEYS.map((key) => normalizeKey(resultGeography[key])).join('|');
      }).filter((key) => key !== '|||')).size;
      const operationalIncidents = incidents.filter((item) => item.reportType !== 'Polling Unit Result' && item.report_type !== 'Polling Unit Result');
      const resources = sources.resources.filter((item) => matches(item, geography) && withinWindow(item, window));
      const decisions = sources.decisions.filter((item) => matches(item, geography) && withinWindow(item, window));
      const signals = sources.signals.filter((item) => matches(item, geography) && withinWindow(item, window));
      const tasks = sources.tasks.map(toTask).filter((item) => matches(item.geography, geography) && withinWindow(item, window));
      const dedicatedResults = sources.dedicatedResults.filter((item) => matches(item, geography) && withinWindow(item, window));
      // Reconciliation records only carry a flat pollingUnit + electionId (no lga/ward), so
      // they cannot use matchesGeography's lga/ward check without excluding everything; an
      // LGA/ward-only filter therefore returns every matched-election reconciliation (see
      // the limitation note below) rather than silently reporting zero.
      const reconciliations = sources.reconciliations.filter((item) => {
        const contestFilter = filter.electionId || filter.contestId || '';
        if (contestFilter && item.electionId && normalizeKey(item.electionId) !== normalizeKey(contestFilter)) return false;
        if (geography.pollingUnit && normalizeKey(item.pollingUnit) !== normalizeKey(geography.pollingUnit)) return false;
        return withinWindow(item, window);
      });
      const now = Date.now();
      const responseTimes = incidents.flatMap((item) => {
        const history = item.lifecycle?.transitionHistory || [];
        const reported = safeDate(history.find((entry) => entry.to === 'reported')?.at || item.createdAt);
        const acknowledged = safeDate(history.find((entry) => entry.to === 'acknowledged')?.at);
        return reported !== null && acknowledged !== null ? [acknowledged - reported] : [];
      });
      const resolutionTimes = incidents.flatMap((item) => {
        const history = item.lifecycle?.transitionHistory || [];
        const reported = safeDate(history.find((entry) => entry.to === 'reported')?.at || item.createdAt);
        const resolved = safeDate(history.find((entry) => ['closed', 'resolved'].includes(entry.to))?.at);
        return reported !== null && resolved !== null ? [resolved - reported] : [];
      });
      const taskAcknowledgeTimes = tasks.flatMap((task) => {
        const created = safeDate(task.createdAt);
        const acknowledged = safeDate(task.acknowledgedAt);
        return created !== null && acknowledged !== null ? [acknowledged - created] : [];
      });
      const freshDates = [...incidents, ...signals, ...decisions, ...resources, ...tasks, ...dedicatedResults].map((item) => safeDate(item.updatedAt || item.createdAt || item.created_at)).filter(Boolean);
      const completeIncidentCount = operationalIncidents.filter((item) => item.geography?.state && item.geography?.lga && item.geography?.ward).length;
      const resourceSummary = summarizeResourceTotals(resources);
      const backlog = incidents.filter((item) =>
        item.reportType !== 'Polling Unit Result' &&
        item.report_type !== 'Polling Unit Result' &&
        !['closed', 'resolved'].includes(String(item.status).toLowerCase()),
      ).length;
      const dedicatedCoverageCount = new Set(dedicatedResults.map((item) => {
        const resultGeography = geographyOf(item);
        return GEOGRAPHY_KEYS.map((key) => normalizeKey(resultGeography[key])).join('|');
      }).filter((key) => key !== '|||')).size;
      const sourceVersionCounts = new Map();
      for (const record of dedicatedResults) {
        const version = record.sourceReleaseId || record.provenance?.sourceVersion || 'unspecified';
        sourceVersionCounts.set(version, (sourceVersionCounts.get(version) || 0) + 1);
      }
      const sourceCounts = { incidents: operationalIncidents.length, results: resultRecords.length, dedicatedResultRecords: dedicatedResults.length, signals: signals.length, decisions: decisions.length, resources: resources.length, tasks: tasks.length, reconciliations: reconciliations.length };
      const allSourceRecords = Object.values(sourceCounts).reduce((sum, value) => sum + value, 0);
      const denominator = getSelectedDenominator(geography);
      const coverageRatio = denominator ? Number((uniqueResultCount / denominator * 100).toFixed(2)) : 0;
      const dedicatedCoverageRatio = denominator ? Number((dedicatedCoverageCount / denominator * 100).toFixed(2)) : 0;
      const latestRecordAt = freshDates.length ? new Date(Math.max(...freshDates)).toISOString() : null;
      const timeliness = { latestRecordAt, recordsLast24h: freshDates.filter((time) => now - time <= 86400000).length };
      const limitations = [
        'Coverage denominator uses the selected geography and reference polling-unit data.',
        'Metrics exclude records outside the requested geography and contest.',
        'A missing timestamp or geography reduces completeness rather than being inferred.',
        'Reconciliation records are only geography-scoped by polling unit; an LGA/ward-only filter without a polling unit returns every matched-election reconciliation, not just this geography\'s.',
        'Reconciliation and decision outcomes marked pending/unreviewed are provisional and must never be read as final results.',
      ];
      if (window.since || window.until) limitations.push(`Results are scoped to ${window.since || 'the start of records'} through ${window.until || 'now'}${window.phase ? ` (${window.phase})` : ''}; a record with no usable timestamp is excluded rather than assumed current.`);
      return {
        scope: geography,
        window,
        generatedAt: new Date(now).toISOString(),
        metrics: {
          coverage: {
            submitted: uniqueResultCount, denominator, percent: coverageRatio,
            dedicatedResultRecords: { submitted: dedicatedCoverageCount, denominator, percent: dedicatedCoverageRatio, note: 'Counted from the dedicated result_records store; may diverge from the legacy incident-tagged count above during migration.' },
          },
          timeliness,
          backlog: { openIncidents: backlog, pendingDecisions: decisions.filter((item) => item.stage === 'proposed' || item.stage === 'approved').length, openOrOverdueTasks: tasks.filter((item) => TASK_OPEN_STATUSES.includes(item.status)).length },
          responseTime: { averageMillisecondsToAcknowledge: average(responseTimes), averageMillisecondsToResolve: average(resolutionTimes), averageMillisecondsToAcknowledgeTask: average(taskAcknowledgeTimes) },
          quality: { completeGeographyRecords: completeIncidentCount, totalIncidentRecords: operationalIncidents.length, completenessPercent: operationalIncidents.length ? Number((completeIncidentCount / operationalIncidents.length * 100).toFixed(2)) : 100 },
          resources: { ...resourceSummary.totals, byType: resourceSummary.byType, utilization: utilizationBreakdown(resources) },
          reconciliation: reconciliationSummary(reconciliations),
          outcomes: {
            decisionsCompleted: decisions.filter((item) => item.stage === 'completed').length,
            decisionsPendingVerification: decisions.filter((item) => ['actioned', 'verifying'].includes(item.stage)).length,
            decisionsRejected: decisions.filter((item) => item.stage === 'rejected').length,
            tasksCompleted: tasks.filter((item) => item.status === 'completed').length,
            tasksOpenOrOverdue: tasks.filter((item) => TASK_OPEN_STATUSES.includes(item.status)).length,
          },
        },
        rollups: { byLga: buildGeographyRollup(incidents, 'lga'), byWard: buildGeographyRollup(incidents, 'ward'), byPollingUnit: buildGeographyRollup(incidents, 'pollingUnit') },
        sources: sourceCounts,
        metadata: {
          freshness: latestRecordAt,
          completeness: { knownSourceRecords: allSourceRecords, metricCoverage: allSourceRecords > 0 ? 'partial-or-complete-by-source' : 'no-known-records' },
          sourceTypes: Object.keys(sourceCounts),
          sourceVersions: { results: [...sourceVersionCounts].map(([sourceReleaseId, count]) => ({ sourceReleaseId, count })) },
          limitations,
        },
      };
    },

    /** Persists an immutable copy of a freshly generated report for later, reproducible reference (e.g. audit or dispute review). */
    async createReportSnapshot({ filter = {}, requestedBy = '', label = '' } = {}) {
      const report = await this.operationalReport(filter);
      const snapshot = { id: randomUUID(), filter: normalizeGeography(filter), electionId: filter.electionId || filter.contestId || '', phase: report.window.phase, requestedBy: String(requestedBy || '').trim(), label: String(label || '').trim(), createdAt: new Date().toISOString(), report };
      return saveSnapshot(snapshot);
    },
    async reportSnapshot(id) {
      return (await readSnapshots()).find((snapshot) => snapshot.id === id) || null;
    },
    async reportSnapshots({ requestedBy, phase, electionId } = {}) {
      return (await readSnapshots())
        .filter((snapshot) => (!requestedBy || snapshot.requestedBy === requestedBy) && (!phase || snapshot.phase === phase) && (!electionId || snapshot.electionId === electionId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  };
}

/** Serializes a report's geography rollups to CSV for an authorized export. */
export function operationalReportRollupsToCsv(report) {
  const rows = [['level', 'state', 'lga', 'ward', 'pollingUnit', 'records']];
  for (const [level, key] of [['lga', 'byLga'], ['ward', 'byWard'], ['pollingUnit', 'byPollingUnit']]) {
    for (const group of report.rollups?.[key] || []) {
      rows.push([level, group.geography.state || '', group.geography.lga || '', group.geography.ward || '', group.geography.pollingUnit || '', String(group.records)]);
    }
  }
  const escape = (value) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return rows.map((row) => row.map(escape).join(',')).join('\n');
}
