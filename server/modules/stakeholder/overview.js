import { getRegistrationLocationOptions } from '../../../shared/electionData.js';
import { deployment } from '../../config/deployment.js';

export const STAKEHOLDER_PHASES = ['pre-election', 'election-day', 'post-election'];

const POLLING_RESULT_TYPE = 'Polling Unit Result';
const normalizeKey = (value) => String(value ?? '').trim().replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, ' ').toLowerCase();

const parseEntries = (record) => {
  try {
    const parsed = JSON.parse(record.resultCount || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const safeTime = (value) => {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : null;
};

/** Counts the state's polling units once, so coverage has a real denominator rather than a guess. */
export function countScope(state = deployment.state || 'Oyo') {
  const lgas = getRegistrationLocationOptions(state).lgas;
  let wards = 0;
  let pollingUnits = 0;
  for (const lga of lgas) {
    const lgaWards = getRegistrationLocationOptions(state, lga).wards;
    wards += lgaWards.length;
    for (const ward of lgaWards) pollingUnits += getRegistrationLocationOptions(state, lga, ward).pollingUnits.length;
  }
  return { state, lgas: lgas.length, wards, pollingUnits, lgaNames: lgas };
}

/**
 * Builds the read-only picture a stakeholder sees. Deliberately aggregate: incidents are reduced
 * to counts by type and severity, and nothing below LGA level, no reporter identity and no
 * evidence reference ever enters the payload. Stakeholders observe the election; they do not
 * conduct it, and a leaked agent identity or polling-unit-level incident trail is a real risk to
 * the people in the field.
 */
export function buildStakeholderOverview({
  incidents = [],
  registeredVoters = null,
  registeredVotersBasis = '',
  phase = 'election-day',
  scope = countScope(),
  now = Date.now(),
  users = [],
  resourceReadiness = [],
  tasks = [],
} = {}) {
  const results = incidents.filter((item) => item.reportType === POLLING_RESULT_TYPE);
  const operational = incidents.filter((item) => item.reportType !== POLLING_RESULT_TYPE);

  // One polling unit may be reported more than once; coverage counts distinct units, not rows.
  const reportedUnits = new Set(
    results.map((item) => [item.lga, item.ward, item.pollingUnit].map(normalizeKey).join('|')).filter((key) => key !== '||'),
  );

  const partyTotals = new Map();
  let votesCounted = 0;
  for (const record of results) {
    for (const entry of parseEntries(record)) {
      const party = String(entry?.party || '').trim();
      const votes = Number(entry?.votes);
      if (!party || !Number.isFinite(votes) || votes < 0) continue;
      partyTotals.set(party, (partyTotals.get(party) || 0) + votes);
      votesCounted += votes;
    }
  }
  const parties = [...partyTotals.entries()]
    .map(([party, votes]) => ({ party, votes, share: votesCounted ? Number(((votes / votesCounted) * 100).toFixed(2)) : 0 }))
    .sort((left, right) => right.votes - left.votes);

  const leading = parties.length
    ? {
        party: parties[0].party,
        votes: parties[0].votes,
        margin: parties[0].votes - (parties[1]?.votes || 0),
        marginPercent: votesCounted ? Number((((parties[0].votes - (parties[1]?.votes || 0)) / votesCounted) * 100).toFixed(2)) : 0,
        // With most units still outstanding, a lead is not a result. Say so in the data.
        decisive: reportedUnits.size >= scope.pollingUnits * 0.5 && parties[0].votes > (parties[1]?.votes || 0),
      }
    : null;

  const byLgaMap = new Map();
  for (const lga of scope.lgaNames || []) byLgaMap.set(normalizeKey(lga), { lga, reporting: 0, votes: 0, partyVotes: new Map() });
  for (const record of results) {
    const key = normalizeKey(record.lga);
    if (!byLgaMap.has(key)) byLgaMap.set(key, { lga: record.lga || 'Unassigned', reporting: 0, votes: 0, partyVotes: new Map() });
    const bucket = byLgaMap.get(key);
    bucket.reporting += 1;
    for (const entry of parseEntries(record)) {
      const party = String(entry?.party || '').trim();
      const votes = Number(entry?.votes);
      if (!party || !Number.isFinite(votes) || votes < 0) continue;
      bucket.votes += votes;
      bucket.partyVotes.set(party, (bucket.partyVotes.get(party) || 0) + votes);
    }
  }
  const byLga = [...byLgaMap.values()]
    .map((bucket) => {
      const top = [...bucket.partyVotes.entries()].sort((a, b) => b[1] - a[1])[0];
      return { lga: bucket.lga, reporting: bucket.reporting, votes: bucket.votes, leadingParty: top ? top[0] : null };
    })
    .sort((left, right) => right.votes - left.votes || left.lga.localeCompare(right.lga));

  // Hourly submission rate — the shape stakeholders actually ask about: "is it still coming in?"
  const hourly = new Map();
  for (const record of results) {
    const time = safeTime(record.createdAt);
    if (time === null) continue;
    const hour = new Date(time);
    hour.setMinutes(0, 0, 0);
    const key = hour.toISOString();
    hourly.set(key, (hourly.get(key) || 0) + 1);
  }
  let running = 0;
  const timeline = [...hourly.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([hour, submissions]) => {
      running += submissions;
      return { hour, submissions, cumulative: running };
    });

  const countBy = (records, pick) => {
    const counts = new Map();
    for (const record of records) {
      const key = String(pick(record) || '').trim() || 'Unspecified';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  };

  const turnoutPercent = registeredVoters && votesCounted
    ? Number(((votesCounted / registeredVoters) * 100).toFixed(2))
    : null;

  const pendingUnits = Math.max(scope.pollingUnits - reportedUnits.size, 0);
  const criticalIncidentCount = operational.filter((item) => item.severity === 'Critical').length;
  const highRiskIncidentCount = operational.filter((item) => item.severity === 'High').length;
  const topLga = [...byLga].sort((left, right) => right.reporting - left.reporting || left.lga.localeCompare(right.lga))[0] || null;

  const coverageState =
    scope.pollingUnits && reportedUnits.size / scope.pollingUnits >= 0.8 ? 'Healthy'
      : scope.pollingUnits && reportedUnits.size / scope.pollingUnits >= 0.5 ? 'Monitoring'
        : scope.pollingUnits && reportedUnits.size / scope.pollingUnits >= 0.2 ? 'Early reporting'
          : 'Low reporting';

  const leadMessage = leading
    ? `${leading.party} is ahead by ${Number(leading.margin || 0).toLocaleString()} votes${leading.decisive ? ' and the gap is now decisive' : ' on partial return data'}`
    : 'No party lead is established yet.';

  const decisionConfidence = Math.max(
    15,
    Math.min(
      95,
      Math.round(
        (scope.pollingUnits ? (reportedUnits.size / scope.pollingUnits) * 65 : 15)
        + (leading?.decisive ? 20 : 0)
        + (criticalIncidentCount === 0 ? 12 : -Math.min(18, criticalIncidentCount * 9))
        + (highRiskIncidentCount === 0 ? 8 : -Math.min(10, highRiskIncidentCount * 4)),
      ),
    ),
  );

  const summary = {
    coverageState,
    coverageNarrative: coverageState === 'Healthy'
      ? `Reporting is strong enough for a reliable state-level read.`
      : coverageState === 'Monitoring'
        ? `Coverage is moderate and should be closely watched for late units.`
        : coverageState === 'Early reporting'
          ? `Return flow is still early, so the picture may change materially.`
          : `Coverage remains thin; state-level conclusions should be treated as provisional.`,
    keyMessage: `${leadMessage} ${pendingUnits > 0 ? `${pendingUnits.toLocaleString()} polling units remain outstanding.` : 'All polling units in scope have reported.'}`,
    decisionConfidence,
    outstandingUnits: pendingUnits,
    leadingLga: topLga ? { lga: topLga.lga, reporting: topLga.reporting } : null,
    riskSummary: {
      critical: criticalIncidentCount,
      high: highRiskIncidentCount,
    },
  };

  const watchlist = [
    {
      label: 'Outstanding units',
      value: pendingUnits > 0 ? `${pendingUnits.toLocaleString()} still pending` : 'Complete',
      tone: pendingUnits > 0 ? 'watch' : 'ok',
      detail: pendingUnits > 0 ? 'Late reporting may shift the state picture.' : 'There are no missing units in the current scope.',
    },
    {
      label: 'Priority incidents',
      value: `${criticalIncidentCount + highRiskIncidentCount} high-risk`,
      tone: criticalIncidentCount > 0 || highRiskIncidentCount > 0 ? 'alert' : 'ok',
      detail: criticalIncidentCount > 0 ? `${criticalIncidentCount} critical incidents need immediate follow-up.` : 'No critical incidents are currently open.',
    },
    {
      label: 'Current leader',
      value: leading ? `${leading.party}` : 'No lead yet',
      tone: leading && leading.decisive ? 'ok' : 'watch',
      detail: leading ? `${leading.margin.toLocaleString()} vote lead` : 'Lead is still too early to call.',
    },
    {
      label: 'Fastest LGA',
      value: topLga ? topLga.lga : '—',
      tone: 'neutral',
      detail: topLga ? `${topLga.reporting} units reported` : 'No LGA-level reporting yet.',
    },
  ];

  const activeUsers = Array.isArray(users) ? users.filter((user) => user?.active !== false) : [];
  const agentCount = activeUsers.filter((user) => user.role === 'Agent').length;
  const supervisorCount = activeUsers.filter((user) => user.role === 'Supervisor').length;
  const staffingCoverage = scope.pollingUnits ? Number(((agentCount / Math.max(1, scope.pollingUnits)) * 100).toFixed(2)) : 0;
  const trainingTasks = Array.isArray(tasks)
    ? tasks.filter((task) => /training|orientation|briefing|capacity/i.test(`${task?.title || ''} ${task?.description || ''}`))
    : [];
  const completedTrainingTasks = trainingTasks.filter((task) => task?.status === 'completed').length;
  const trainingCompletion = trainingTasks.length ? Number(((completedTrainingTasks / trainingTasks.length) * 100).toFixed(2)) : 0;
  const equipmentReadinessSource = Array.isArray(resourceReadiness)
    ? resourceReadiness.filter((item) => /bvas|device|tablet|kit|scanner|equipment/i.test(String(item?.resourceType || '')))
    : [];
  const equipmentReadiness = equipmentReadinessSource.length
    ? Number(
        ((equipmentReadinessSource.reduce((sum, item) => sum + (Number(item.available || item.arrived || 0) / Math.max(1, Number(item.required || 1))), 0)
          / Math.max(1, equipmentReadinessSource.length)) * 100).toFixed(2),
      )
    : 0;
  const logisticsReadiness = Array.isArray(resourceReadiness) && resourceReadiness.length
    ? Number(
        ((resourceReadiness.reduce((sum, item) => sum + (Number(item.available || item.arrived || 0) / Math.max(1, Number(item.required || 1))), 0)
          / Math.max(1, resourceReadiness.length)) * 100).toFixed(2),
      )
    : 0;

  const preElection = {
    agentCount,
    supervisorCount,
    staffingCoverage,
    logisticsReadiness,
    trainingCompletion,
    equipmentReadiness,
    totalRequiredResources: resourceReadiness.reduce((sum, item) => sum + (Number(item.required) || 0), 0),
    totalAvailableResources: resourceReadiness.reduce((sum, item) => sum + (Number(item.available || item.arrived || 0) || 0), 0),
  };

  const notes = [];
  if (!registeredVoters) notes.push('No registered-voter figure is loaded, so turnout cannot be calculated.');
  else notes.push(`Turnout is measured against ${registeredVotersBasis || 'the loaded registered-voter figure'}.`);
  if (reportedUnits.size < scope.pollingUnits)
    notes.push(`${(scope.pollingUnits - reportedUnits.size).toLocaleString()} of ${scope.pollingUnits.toLocaleString()} polling units have not reported. Totals are partial and will change.`);
  if (leading && !leading.decisive)
    notes.push('The current lead is based on partial returns and should not be read as a result.');
  if (phase === 'pre-election')
    notes.push(`Pre-election readiness shows ${agentCount.toLocaleString()} active agents and ${supervisorCount.toLocaleString()} supervisors in the field. Logistics readiness is ${logisticsReadiness}% across planned resources.`);
  notes.push('Incident figures are counts only. Locations below LGA, reporter identities and evidence are deliberately excluded from this view.');

  return {
    phase: STAKEHOLDER_PHASES.includes(phase) ? phase : 'election-day',
    generatedAt: new Date(now).toISOString(),
    scope: { state: scope.state, lgas: scope.lgas, wards: scope.wards, pollingUnits: scope.pollingUnits },
    coverage: {
      reportingUnits: reportedUnits.size,
      totalUnits: scope.pollingUnits,
      percent: scope.pollingUnits ? Number(((reportedUnits.size / scope.pollingUnits) * 100).toFixed(2)) : 0,
      submissions: results.length,
    },
    turnout: { votesCounted, registeredVoters, percent: turnoutPercent, basis: registeredVotersBasis || null },
    parties,
    leading,
    byLga,
    timeline,
    incidents: {
      total: operational.length,
      byType: countBy(operational, (item) => item.reportType),
      bySeverity: countBy(operational, (item) => item.severity),
    },
    preElection,
    summary,
    watchlist,
    notes,
  };
}
