import { buildGeographyRollup, DEFAULT_PAGE_LIMIT, geographyDrillDownLevel, matchesGeography, paginate, resolveGeographyScope } from '../foundation/geography-query.js';

export class GeographyAccessDeniedError extends Error {
  constructor() {
    super('You are not authorized for this geographic scope.');
    this.code = 'GEOGRAPHY_ACCESS_DENIED';
  }
}

const publicPersonnel = ({ password, ...user }) => user;
const collectEvidenceIds = (records, field) => records.flatMap((record) => (Array.isArray(record[field]) ? record[field] : []).map((item) => item?.id).filter(Boolean));

/**
 * Joins personnel, readiness, incidents, resources, connectivity, CRM signals,
 * results, evidence, tasks and outcomes for one validated Oyo geography scope, at
 * the drill-down/roll-up level implied by how much of the scope was supplied
 * (state -> LGA -> ward -> polling unit). Every list read is bounded by `limit`
 * (capped) and reports its true total rather than returning unbounded arrays.
 *
 * This is a read composition over the existing per-domain repositories (via
 * `store`) rather than a new persistence layer, so it stays consistent with
 * whatever those repositories already enforce (source classification, evidence
 * access rules, sync/versioning) instead of re-implementing it.
 */
export async function buildGeographicOperationalView({ store, actor, canAccessGeography, scope = {}, limit = DEFAULT_PAGE_LIMIT, offset = 0 } = {}) {
  const resolvedScope = resolveGeographyScope(scope);
  if (!canAccessGeography(actor, resolvedScope)) throw new GeographyAccessDeniedError();

  const pageArgs = { lga: resolvedScope.lga, ward: resolvedScope.ward, pollingUnit: resolvedScope.pollingUnit, limit, offset };
  const [personnelAll, incidents, results, tasksAll, signals, decisions, resourceAdequacy, resourceRequirements, connectivity] = await Promise.all([
    store.users(),
    store.incidentsPage(pageArgs),
    store.resultRecordsPage(pageArgs),
    store.tasks({}),
    store.intelligenceSignals({ geography: resolvedScope }),
    store.decisions({ geography: resolvedScope }),
    store.resourceAdequacy(resolvedScope),
    store.resourceRequirements(resolvedScope),
    store.connectivityAnalysis({ geography: resolvedScope }),
  ]);

  const personnel = paginate(personnelAll.filter((user) => matchesGeography(user, resolvedScope)).map(publicPersonnel), { limit, offset });
  const tasksScoped = tasksAll.filter((task) => matchesGeography(task.geography || {}, resolvedScope));
  const tasks = paginate(tasksScoped, { limit, offset });

  const readinessSignals = signals.filter((signal) => signal.category === 'readiness');
  const crmSignals = signals.filter((signal) => signal.category === 'crm-issue');
  const otherSignals = signals.filter((signal) => signal.category !== 'readiness' && signal.category !== 'crm-issue');

  const evidenceIds = [...collectEvidenceIds(incidents.items, 'media'), ...collectEvidenceIds(results.items, 'evidence')];
  const evidence = store.evidenceSummaries ? await store.evidenceSummaries(evidenceIds) : [];

  const verifiedIncidents = incidents.items.filter((incident) => incident.lifecycle?.verifiedAt);
  const completedTasks = tasksScoped.filter((task) => task.status === 'completed');
  const decidedOutcomes = decisions.filter((decision) => decision.outcome);

  const level = geographyDrillDownLevel(resolvedScope);
  const rollups = level ? {
    incidents: buildGeographyRollup(incidents.items, level),
    results: buildGeographyRollup(results.items, level),
    tasks: buildGeographyRollup(tasksScoped, level),
  } : null;

  return {
    scope: resolvedScope,
    drillDownLevel: level,
    generatedAt: new Date().toISOString(),
    personnel,
    readiness: { total: readinessSignals.length, verified: readinessSignals.filter((s) => s.verificationStatus === 'verified').length, signals: readinessSignals.slice(0, limit) },
    incidents,
    resources: { adequacy: resourceAdequacy, requirements: resourceRequirements },
    connectivity,
    crmSignals: { total: crmSignals.length, items: crmSignals.slice(0, limit) },
    results,
    evidence: { items: evidence },
    tasks,
    outcomes: {
      verifiedIncidents: { total: verifiedIncidents.length, items: verifiedIncidents.slice(0, limit).map((incident) => ({ id: incident.id, verifiedAt: incident.lifecycle.verifiedAt, verifiedBy: incident.lifecycle.verifiedBy })) },
      completedTasks: { total: completedTasks.length, items: completedTasks.slice(0, limit).map((task) => ({ id: task.id, title: task.title, responseEvidence: task.responseEvidence })) },
      decisionOutcomes: { total: decidedOutcomes.length, items: decidedOutcomes.slice(0, limit).map((decision) => ({ id: decision.id, outcome: decision.outcome, verification: decision.verification })) },
    },
    rollups,
    metadata: {
      otherSignalCount: otherSignals.length,
      limitations: [
        'Coordinates and evidence are shown only where a source explicitly supplied them; an unknown location is returned as null, never a default point.',
        'Camera feeds are not yet tagged with a governed geography unit, so they are not included in this join.',
        'Signal, decision, resource, connectivity, and task records are geography-filtered in application code rather than by an indexed SQL predicate; only incidents and results use a bounded SQL query.',
        'Result reconciliation outcomes are available separately via the results reconciliation endpoints and are not yet joined into this view.',
      ],
    },
  };
}
