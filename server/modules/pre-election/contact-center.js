import { matchLga } from './lga.js';

/**
 * Reads the contact center's weekly report workbook (Overview, Calls Per Day, Calls Per LGA,
 * Calls Per Category, Issues in the Area, Contact Categories, Location Insights, ...).
 *
 * The report is already aggregated, so everything is kept except agent names: agents become a
 * count and a spread of calls. The free-text "Issues in the Area" answers are grouped into themes
 * (roads, electricity, water, money...) so they can be compared with the survey and by LGA.
 */

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const key = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const number = (value) => {
  const n = Number(String(value ?? '').replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// One call can raise several themes ("bad road, no borehole, need money"), so themes overlap.
export const ISSUE_THEMES = [
  ['roads', 'Roads & bridges', /road|bridge|gutter|erosion|drain|culvert|transport/],
  ['electricity', 'Electricity & street lights', /electric|light|solar|transformer|power|nepa/],
  ['water', 'Water & boreholes', /water|borehole|brehole|bore hole|well\b|toilet/],
  ['money', 'Money & financial support', /money|financ|fund|cash|stipend|palliative|food|stomach infrastructure/],
  ['campaign', 'Campaign materials & mobilisation', /campaign|material|mobili[sz]|canvas|awareness|sensiti[sz]|posters?|vest/],
  ['jobs', 'Jobs & empowerment', /job|employ|empower|youth|skill|trade|loan|grant/],
  ['health', 'Health care', /health|hospital|clinic|medic|drug/],
  ['education', 'Schools & education', /school|college|educat|institution|teacher|scholarship/],
  ['party', 'Party unity & leadership', /exco|executive|\bparty\b|division|crisis|chairman|faction|defect|divert|\bapm\b|\bpdp\b|unity|settle|conflict|mismanag|leaders? (are|is)|caucus/],
  ['security', 'Security', /secur|thief|thieves|thug|kidnap|herder|robber/],
  ['agriculture', 'Agriculture & farming', /farm|agric|fertili[sz]|tractor|crop|cassava/],
  ['sanitation', 'Waste & sanitation', /waste|refuse|sanitation|dump/],
  ['appreciation', 'Appreciation & commitment', /appreciat|thank|ready to vote|supporter|happy|grateful|loyal/],
];
const NO_ISSUE = /^(non|none|nil|nothing|no issue|no concern|no problem|n a|na|no complain)/;
const GENERIC = /assist|support|help|follow ?up/;

export function themesOf(text) {
  const value = key(text);
  if (!value || NO_ISSUE.test(value)) return [];
  const hits = ISSUE_THEMES.filter(([, , pattern]) => pattern.test(value)).map(([id]) => id);
  if (hits.length) return hits;
  return GENERIC.test(value) ? ['assistance'] : ['other'];
}
export const themeLabel = (id) => ISSUE_THEMES.find(([theme]) => theme === id)?.[1] || (id === 'assistance' ? 'General assistance request' : 'Other');

/** Rows under the header row whose first cells match `header`, up to the next blank row. */
function table(rows, header) {
  const wanted = header.map(key);
  const start = rows.findIndex((row) => wanted.every((name, i) => key(row[i]) === name));
  if (start < 0) return [];
  const out = [];
  for (const row of rows.slice(start + 1)) {
    if (!row.some((cell) => clean(cell))) break;
    if (row.slice(1).every((cell) => !clean(cell)) && out.length) break; // next section title
    out.push(row);
  }
  return out;
}

const sheetRows = (workbook, pattern) => {
  const name = workbook.sheetNames.find((sheet) => pattern.test(sheet));
  return name ? workbook.rows(name) || [] : [];
};

export function isContactCenterReport(workbook) {
  return workbook.sheetNames.some((name) => /^overview$/i.test(name.trim())) && workbook.sheetNames.some((name) => /calls per lga/i.test(name));
}

export function buildContactCenter(workbook) {
  if (!isContactCenterReport(workbook)) throw new Error('This does not look like a contact center report: it needs an "Overview" sheet and a "Calls Per LGA" sheet.');

  const overviewRows = sheetRows(workbook, /^overview$/i);
  const metrics = Object.fromEntries(table(overviewRows, ['Metric', 'Value']).map((row) => [key(row[0]), row[1]]));
  const period = clean(metrics['reporting period']) || clean(overviewRows[1]?.[0]).replace(/^overview\s*\|\s*/i, '');
  const overview = {
    calls: number(metrics['total calls']),
    uniqueContacts: number(metrics['unique contacts']),
    inbound: number(metrics.inbound),
    outbound: number(metrics.outbound),
    open: number(metrics.open),
    closed: number(metrics.closed),
  };
  if (!overview.calls) throw new Error('The Overview sheet has no "Total Calls" figure.');

  const perDay = table(sheetRows(workbook, /calls per day/i), ['Date', 'Calls']).map((row) => ({ date: clean(row[0]).slice(0, 10), calls: number(row[1]), unique: number(row[2]), inbound: number(row[3]), outbound: number(row[4]) }));

  const byLga = {};
  const unmatched = [];
  for (const row of table(sheetRows(workbook, /calls per lga/i), ['LGA', 'Calls'])) {
    const lga = matchLga(row[0]);
    const entry = { calls: number(row[1]), unique: number(row[2]), wards: number(row[3]) };
    if (!lga) { unmatched.push({ name: clean(row[0]) || '(blank)', count: entry.calls }); continue; }
    const current = byLga[lga] || { calls: 0, unique: 0, wards: 0 };
    byLga[lga] = { calls: current.calls + entry.calls, unique: current.unique + entry.unique, wards: Math.max(current.wards, entry.wards) };
  }

  const pairs = (pattern, header) => table(sheetRows(workbook, pattern), header).map((row) => ({ name: clean(row[0]), calls: number(row[1]), unique: number(row[2]) })).filter((row) => row.name);
  const categories = pairs(/calls per category/i, ['Project Category', 'Calls']);
  const contactTypes = pairs(/contact categor/i, ['Scenario', 'Calls']);
  const informationRequests = pairs(/information request/i, ['Information Requested', 'Calls']);
  const locationRows = sheetRows(workbook, /location insight/i);
  const location = table(locationRows, ['Location Result', 'Calls']).map((row) => ({ name: clean(row[0]), calls: number(row[1]) }));
  // Calls by ward, as typed by agents ("WARD3", "AGUODO/MASIFA WARD 03", "4"); matched to INEC wards later.
  const byWard = table(locationRows, ['LGA', 'Ward', 'Calls'])
    .map((row) => ({ lga: matchLga(row[0]), ward: clean(row[1]).toUpperCase().slice(0, 80), calls: number(row[2]), unique: number(row[3]) }))
    .filter((row) => row.lga && row.calls);

  // Issues: themed totals for the state and theme mentions per LGA.
  const themes = new Map();
  const lgaThemes = {};
  let issueCalls = 0;
  let issuesRecorded = 0;
  for (const row of table(sheetRows(workbook, /issues in the area/i), ['Issue Raised', 'Calls'])) {
    const calls = number(row[1]) || 1;
    issueCalls += calls;
    const found = themesOf(row[0]);
    if (!found.length) continue;
    issuesRecorded += calls;
    for (const theme of found) themes.set(theme, (themes.get(theme) || 0) + calls);
    for (const name of String(row[3] ?? '').split(',')) {
      const lga = matchLga(name);
      if (!lga) continue;
      lgaThemes[lga] ||= {};
      for (const theme of found) lgaThemes[lga][theme] = (lgaThemes[lga][theme] || 0) + 1;
    }
  }

  // "Assistance Requests" sits under the issues on the same sheet: what callers asked for.
  const requests = { followUp: 0, noneNeeded: 0, themes: new Map() };
  for (const row of table(sheetRows(workbook, /issues in the area/i), ['Request', 'Calls'])) {
    const calls = number(row[1]) || 1;
    const text = key(row[0]);
    if (/^no\b|^none|^nil/.test(text)) { requests.noneNeeded += calls; continue; }
    if (/follow ?up|call ?back/.test(text)) { requests.followUp += calls; continue; }
    for (const theme of themesOf(row[0])) requests.themes.set(theme, (requests.themes.get(theme) || 0) + calls);
  }

  const outcomes = table(sheetRows(workbook, /agent performance/i), ['Outcome', 'Calls']).map((row) => ({ name: clean(row[0]), calls: number(row[1]) })).filter((row) => row.name);
  const agentRows = table(sheetRows(workbook, /agent performance/i), ['Agent', 'Username', 'Calls']);
  const agentCalls = agentRows.map((row) => number(row[2])).filter((calls) => calls > 0).sort((a, b) => b - a);

  return {
    period,
    overview,
    perDay,
    byLga,
    byWard,
    categories,
    contactTypes,
    informationRequests,
    location,
    issues: {
      callsWithIssue: issueCalls,
      callsWithRealIssue: issuesRecorded,
      themes: [...themes.entries()].map(([id, calls]) => ({ id, label: themeLabel(id), calls })).sort((a, b) => b.calls - a.calls),
      byLga: lgaThemes,
    },
    requests: { followUp: requests.followUp, noneNeeded: requests.noneNeeded, themes: [...requests.themes.entries()].map(([id, calls]) => ({ id, label: themeLabel(id), calls })).sort((a, b) => b.calls - a.calls) },
    outcomes,
    agents: { count: agentCalls.length, busiest: agentCalls[0] || 0, median: agentCalls[Math.floor(agentCalls.length / 2)] || 0 },
    summary: { period, calls: overview.calls, lgas: Object.keys(byLga).length, unmatched, issuesThemed: issuesRecorded },
  };
}
