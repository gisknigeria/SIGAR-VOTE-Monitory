export const areaKey = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^oorelope$/, 'orelope');

export const PARTY_COLORS = { APC: '#007A33', PDP: '#CC163F', LP: '#783BD1', NNPP: '#125DDD', APM: '#B85B00', ACCORD: '#A17A00', ADC: '#007F85', SDP: '#B83280' };
export function partyColor(party) {
  if (!party) return '#596273';
  const key = String(party).toUpperCase();
  if (PARTY_COLORS[key]) return PARTY_COLORS[key];
  const hue = [...key].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 360, 0);
  return `hsl(${hue} 75% 35%)`;
}

export function resultSummary(area) {
  const parties = (area?.parties || []).filter(p => p.votes != null && p.votes !== '' && Number.isFinite(Number(p.votes)) && Number(p.votes) >= 0)
    .map(p => ({ ...p, votes: Number(p.votes) })).sort((a, b) => b.votes - a.votes || a.party.localeCompare(b.party));
  const total = parties.reduce((sum, p) => sum + p.votes, 0);
  const tie = total > 0 && parties.length > 1 && parties[0].votes === parties[1].votes;
  const winner = total > 0 && !tie ? parties[0].party : '';
  return { total, winner, tie, color: tie ? '#766140' : partyColor(winner), top: parties.slice(0, 3).map(p => ({ ...p, percentage: total ? p.votes / total * 100 : null })) };
}

// Match only unique normalized names/codes. Never guess a boundary by list order.
export function matchArea(areas, values) {
  const keys = new Set(values.filter(Boolean).map(areaKey));
  const matches = areas.filter(area => [area.name, area.code, ...(area.aliases || [])].some(value => value && keys.has(areaKey(value))));
  return matches.length === 1 ? matches[0] : null;
}

export function aggregateAgents(users) {
  const seen = new Set();
  const assignments = new Map();
  let total = 0;
  let unassigned = 0;
  for (const user of users) {
    if (user.role !== 'Agent' || user.active === false || !user.id || seen.has(user.id)) continue;
    seen.add(user.id);
    if (!['oyo', '30'].includes(areaKey(user.state))) continue;
    total++;
    if (!user.lga) { unassigned++; continue; }
    const key = [user.lga, user.ward, user.pollingUnit].map(areaKey).join('|');
    const entry = assignments.get(key) || { lga: user.lga, ward: user.ward || '', pollingUnit: user.pollingUnit || '', count: 0 };
    entry.count++;
    assignments.set(key, entry);
  }
  return { total, unassigned, assignments: [...assignments.values()] };
}

export function agentsInArea(assignments, lga, ward, pollingUnit) {
  return assignments.filter(item => areaKey(item.lga) === areaKey(lga)
    && (!ward || areaKey(item.ward) === areaKey(ward))
    && (!pollingUnit || areaKey(item.pollingUnit) === areaKey(pollingUnit)))
    .reduce((sum, item) => sum + item.count, 0);
}
