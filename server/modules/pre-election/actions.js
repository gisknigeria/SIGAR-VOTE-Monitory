import { createHash } from 'node:crypto';
import { buildMap } from './map.js';
import { buildPulse } from './pulse.js';

/**
 * Next actions: the pre-election data turned into an Eisenhower matrix.
 *
 *   do_now   (urgent + important)     orange
 *   plan     (important, not urgent)  red
 *   delegate (urgent, less important) green
 *   reduce   (neither)                blue
 *
 * Every figure comes from `buildFacts` -- numbered facts computed from the Pulse and the map.
 * `ruleActions` fills the matrix from those facts on its own (and is the fallback whenever AI is
 * unavailable). `aiPrompt` asks a model to do the same job from the same facts, and
 * `checkAiPlan` rejects anything the model returns that the facts cannot back up.
 */

export const QUADRANTS = ['do_now', 'plan', 'delegate', 'reduce'];
export const HORIZONS = { week: 'This week', fortnight: 'Next 2 weeks', election: 'To election day' };
export const OWNERS = ['Field operations', 'Contact center', 'Communications', 'Research', 'LGA coordinators', 'Data team'];
export const STATUSES = ['todo', 'doing', 'done'];

const fmt = (value) => Number(value || 0).toLocaleString('en-US');
const pct = (value) => `${Math.round((value || 0) * 100)}%`;
const pts = (value) => `${value >= 0 ? '+' : '−'}${Math.abs(Math.round(value * 100))} pts`;
const list = (names, max = 4) => (names.length <= max ? names.join(', ') : `${names.slice(0, max).join(', ')} and ${names.length - max} more`);
const sum = (rows, pick) => rows.reduce((total, row) => total + (pick(row) || 0), 0);
export const actionKey = (quadrant, title) => createHash('sha1').update(`${quadrant}|${String(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`).digest('hex').slice(0, 12);

function dueFor(horizon, days, now) {
  if (horizon === 'election') return days <= 7 ? 'within 2 weeks' : 'before election day';
  const date = new Date(now.getTime() + days * 86400000);
  return `by ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).replace('Sept', 'Sep')}`;
}

/** Numbered facts for one scope; each carries the figures an action may quote. */
export function buildFacts({ datasets, survey, lga = '' }) {
  const pulse = buildPulse({ datasets, survey, lga });
  const map = buildMap({ datasets, survey, lga: pulse.filter.lga });
  const facts = [];
  const add = (id, text, data = {}) => { facts.push({ id, fact: text, ...data }); return id; };
  const place = pulse.filter.label;
  const cc = pulse.contactCenter;
  const s = pulse.survey;
  const m = pulse.members;

  if (s.available && s.candidates[0]) {
    const [first, second] = s.candidates;
    add('S1', `Survey (${fmt(s.responses)} responses in ${place}): ${first.short} ${pct(first.share)}${second ? `, ${second.short} ${pct(second.share)}` : ''} of people who named a candidate; ${pct(s.undecided / Math.max(s.responses, 1))} named nobody.`);
    if (!lga && s.weighted?.rows?.[0] && s.weighted.rows[0].name !== first.name) add('S2', `Weighted by each LGA's registered voters, ${s.weighted.rows[0].short} leads with ${pct(s.weighted.rows[0].share)}.`);
    if (s.topIssues[0]) add('S3', `Top voter issue in the survey: ${s.topIssues.slice(0, 3).map((row) => `${row.name} ${pct(row.share)}`).join(', ')}.`);
    if (s.platform[0]) add('S4', `Most influential platform: ${s.platform[0].name} (${pct(s.platform[0].share)}).`);
  }
  if (m.available) add('M1', `Members: ${fmt(m.total)} people; they cover ${fmt(m.unitsCovered)} of ${fmt(m.pollingUnits)} polling units (${pct(m.unitCoverage)}) in ${place}.`);
  if (cc.available) {
    if (cc.scope === 'state') {
      add('C1', `Contact center ${cc.period}: ${fmt(cc.calls)} calls to ${fmt(cc.unique)} people; ${fmt(cc.open)} still open (${pct(cc.openShare)}); ${fmt(cc.followUpRequested)} asked for a follow-up; ${fmt(cc.dropped)} dropped (${pct(cc.droppedShare)}).`);
      add('C2', `${pct(cc.supporters.share)} of people reached are confirmed supporters (${fmt(cc.supporters.count)}); ${fmt(cc.notEstablished)} are not yet established.`);
      if (cc.themes.length) add('C3', `Callers raise ${cc.themes.slice(0, 3).map((row) => `${row.label.toLowerCase()} (${fmt(row.calls)} calls)`).join(', ')} most.`);
      if (cc.topicNotRecorded || cc.locationUnconfirmedShare) add('C5', `Call records: topic missing on ${pct(cc.topicNotRecorded / Math.max(cc.calls, 1))} of calls; location unconfirmed on ${pct(cc.locationUnconfirmedShare)}.`);
    } else {
      add('C1', `Contact center ${cc.period}: ${fmt(cc.calls)} calls in ${place} (${pct(cc.shareOfState)} of all calls), reaching ${cc.wardsReached} of ${cc.wardsTotal} wards.`);
      if (cc.themes.length) add('C3', `Callers in ${place} raise ${cc.themes.slice(0, 3).map((row) => row.label.toLowerCase()).join(', ')} most.`);
    }
  }
  if (pulse.reference.pvcRate != null && !lga) add('R1', `${pct(pulse.reference.pvcRate)} of registered voters collected their PVC (${fmt(pulse.reference.registeredVoters.value - pulse.reference.pvcCollected.value)} uncollected, state level).`);

  const context = { pulse, map, place, scope: lga ? 'lga' : 'state', stateFocus: lga ? buildPulse({ datasets, survey }).survey.focus?.share ?? null : null };
  if (!lga) stateFacts(map.rows, pulse, add, context);
  else lgaFacts(map, pulse, add, context);
  return { facts, context };
}

function stateFacts(rows, pulse, add, context) {
  const byKey = new Map(pulse.byLga.map((row) => [row.lga, row]));
  const members = (row) => byKey.get(row.key)?.members || 0;
  const empty = rows.filter((row) => !members(row)).sort((a, b) => (b.values.registered || 0) - (a.values.registered || 0));
  if (empty.length) {
    context.empty = empty;
    add('G1', `No members in ${list(empty.map((row) => row.name), 6)}: ${fmt(sum(empty, (row) => row.pollingUnits))} polling units and ${fmt(sum(empty, (row) => row.values.registered))} registered voters.`);
    const liked = empty.filter((row) => row.values.support != null && row.values.support >= 0.4);
    if (liked.length) add('G2', `Strong support but no members: ${liked.map((row) => `${row.name} (Sen. Alli ${pct(row.values.support)})`).join(', ')}.`);
  }
  const silent = rows.filter((row) => members(row) > 0 && row.values.calls === 0).sort((a, b) => members(b) - members(a));
  if (silent.length) { context.silent = silent; add('G3', `Members but no contact-center calls in ${list(silent.map((row) => `${row.name} (${fmt(members(row))} members)`))}.`); }
  const blind = rows.filter((row) => row.values.support == null && !row.values.calls).sort((a, b) => (b.values.registered || 0) - (a.values.registered || 0));
  if (blind.length) { context.blind = blind; add('G4', `No readable survey and no calls in ${list(blind.map((row) => row.name))} (${fmt(sum(blind, (row) => row.values.registered))} registered voters).`); }
  const drops = rows.filter((row) => row.values.changeGov != null && row.values.changeGov <= -0.1).sort((a, b) => a.values.changeGov - b.values.changeGov);
  if (drops.length) { context.drops = drops; add('H1', `Sen. Alli polls below APC's 2023 governorship share in ${list(drops.map((row) => `${row.name} (${pts(row.values.changeGov)})`), 5)}; ${fmt(sum(drops, members))} members and ${fmt(sum(drops, (row) => row.values.calls))} calls there.`); }
  const gains = rows.filter((row) => row.values.changeGov != null && row.values.changeGov >= 0.25).sort((a, b) => b.values.changeGov - a.values.changeGov);
  if (gains.length) { context.gains = gains; add('H2', `Strongest gains since the 2023 governorship: ${list(gains.map((row) => `${row.name} (${pts(row.values.changeGov)})`), 5)}.`); }
  const apcWon = rows.filter((row) => row.detail.gov2023?.winner === 'APC').map((row) => row.name);
  if (apcWon.length) add('H3', `APC won only ${apcWon.join(' and ')} in the 2023 governorship (indicative, transcribed results).`);
  const focusShare = pulse.survey.focus?.share || 0;
  const crowded = rows.filter((row) => row.values.membersPerPu >= 5 && row.values.support != null && row.values.support < focusShare).sort((a, b) => b.values.membersPerPu - a.values.membersPerPu);
  if (crowded.length) { context.crowded = crowded; add('G5', `Many members but low support: ${list(crowded.map((row) => `${row.name} (${fmt(members(row))} members, ${row.values.membersPerPu.toFixed(1)} per polling unit, Sen. Alli ${pct(row.values.support)})`), 3)}.`); }
  const party = pulse.contactCenter.available ? (pulse.contactCenter.themes || []).find((row) => row.id === 'party') : null;
  if (party && party.calls >= 10) { context.party = party; add('C4', `${fmt(party.calls)} calls reported party unity or leadership disputes.`); }
  if (pulse.contacts.truncated) add('D1', 'The contact list stops at 1,048,574 rows (Excel\'s limit), so it is probably incomplete.');
  if (pulse.reference.lgaLevelLoaded < 33) add('D2', `PVC collection and population by LGA are loaded for ${pulse.reference.lgaLevelLoaded} of 33 LGAs.`);
}

function lgaFacts(map, pulse, add, context) {
  const wards = map.rows;
  const lgaRow = map.context;
  if (lgaRow?.values.changeGov != null) add('H1', `In ${context.place}, Sen. Alli polls ${pct(lgaRow.values.support)} against APC's ${pct(lgaRow.values.gov2023)} in the 2023 governorship (${pts(lgaRow.values.changeGov)}).`);
  const emptyWards = wards.filter((row) => !row.values.members).sort((a, b) => (b.values.registered || 0) - (a.values.registered || 0));
  if (emptyWards.length) { context.emptyWards = emptyWards; add('G1', `${emptyWards.length} of ${wards.length} wards in ${context.place} have no members: ${list(emptyWards.map((row) => row.name))} (${fmt(sum(emptyWards, (row) => row.pollingUnits))} polling units, ${fmt(sum(emptyWards, (row) => row.values.registered))} voters).`); }
  const quiet = wards.filter((row) => row.values.members >= 20 && row.values.calls != null && row.values.calls <= 2).sort((a, b) => b.values.members - a.values.members);
  if (quiet.length) { context.quietWards = quiet; add('G3', `Members but almost no calls in ${list(quiet.map((row) => `${row.name} (${row.values.members} members, ${row.values.calls} calls)`))}.`); }
  const lost = wards.filter((row) => row.detail.pres2023 && row.detail.pres2023.winner !== 'APC');
  if (lost.length) { context.lostWards = lost; add('H2', `APC lost ${list(lost.map((row) => `${row.name} (${row.detail.pres2023.winner} won)`))} in the 2023 presidential.`); }
  if (pulse.members.available && pulse.members.unitCoverage < 0.6) { context.coverageGap = pulse.members.pollingUnits - pulse.members.unitsCovered; add('M2', `${fmt(context.coverageGap)} of ${fmt(pulse.members.pollingUnits)} polling units in ${context.place} have no member.`); }
  const focusShare = context.stateFocus ?? null;
  if (lgaRow && lgaRow.values.membersPerPu >= 5 && lgaRow.values.support != null && (focusShare == null || lgaRow.values.support < focusShare)) { context.crowded = true; add('G5', `${context.place} has ${lgaRow.values.membersPerPu.toFixed(1)} members per polling unit but Sen. Alli polls ${pct(lgaRow.values.support)}.`); }
  context.lgaRow = lgaRow;
  const needs = lgaRow?.detail.needs || [];
  if (needs.length) add('S5', `Needs in ${context.place} (survey + callers): ${needs.slice(0, 3).map((need) => need.label.toLowerCase()).join(', ')}.`);
}

/** The matrix from the facts alone. Stable keys so status survives a refresh. */
export function ruleActions({ facts, context }, { horizon = 'week', now = new Date() } = {}) {
  const has = (id) => facts.some((fact) => fact.id === id);
  const q = { do_now: [], plan: [], delegate: [], reduce: [] };
  const put = (quadrant, key, action) => q[quadrant].push({ key: `rule:${key}`, source: 'rules', status: 'todo', ...action });
  const { pulse, place } = context;
  const cc = pulse.contactCenter;

  if (context.scope === 'state') {
    if (context.empty?.length) put('do_now', 'ground-empty', { title: `Build ground teams in ${list(context.empty.map((row) => row.name), 3)}`, why: `No members there: ${fmt(sum(context.empty, (row) => row.pollingUnits))} polling units and ${fmt(sum(context.empty, (row) => row.values.registered))} registered voters.`, where: context.empty.map((row) => row.name), owner: 'Field operations', due: dueFor(horizon, 7, now), target: `${fmt(sum(context.empty, (row) => row.pollingUnits))} agents, one per polling unit`, evidence: ['G1', ...(has('G2') ? ['G2'] : [])] });
    if (cc.available && cc.openShare >= 0.2) put('do_now', 'cc-backlog', { title: `Clear ${fmt(cc.open)} open calls and call back ${fmt(cc.followUpRequested)} who asked`, why: `${pct(cc.openShare)} of ${fmt(cc.calls)} calls are still open.`, where: [], owner: 'Contact center', due: dueFor(horizon, 2, now), target: 'Open calls under 10%', evidence: ['C1'] });
    if (context.party) put('do_now', 'party-unity', { title: 'Settle the party disputes callers are reporting', why: `${fmt(context.party.calls)} calls reported unity or leadership disputes.`, where: [], owner: 'LGA coordinators', due: dueFor(horizon, 5, now), target: 'Each reported dispute assigned to a coordinator', evidence: ['C4'] });
    if (context.silent?.length) put('do_now', 'cc-silent', { title: `Call the members in ${list(context.silent.map((row) => row.name), 3)}`, why: 'Members are listed there but the contact center has made no calls.', where: context.silent.map((row) => row.name), owner: 'Contact center', due: dueFor(horizon, 5, now), target: 'Every listed LGA called this week', evidence: ['G3'] });
    if (context.drops?.length) put('plan', 'win-back', { title: `Plan a win-back in ${list(context.drops.map((row) => row.name), 3)}`, why: 'Sen. Alli polls well below APC\'s 2023 governorship share there despite members and calls.', where: context.drops.map((row) => row.name), owner: 'Communications', due: dueFor(horizon, 14, now), target: 'Listening session and message plan per LGA', evidence: ['H1'] });
    if (has('S3') || has('C3')) put('plan', 'messaging', { title: 'Lead messaging with the needs voters and callers name', why: [facts.find((f) => f.id === 'S3')?.fact, facts.find((f) => f.id === 'C3')?.fact].filter(Boolean).join(' '), where: [], owner: 'Communications', due: dueFor(horizon, 10, now), target: 'Message per LGA on its top two needs', evidence: ['S3', 'C3', 'S4'].filter(has) });
    if (context.gains?.length) put('plan', 'strongholds', { title: `Lock in turnout in ${list(context.gains.map((row) => row.name), 4)}`, why: 'The biggest gains on APC\'s 2023 share: protect them with PVC collection and turnout plans.', where: context.gains.map((row) => row.name), owner: 'Field operations', due: dueFor(horizon, 14, now), target: 'PVC and turnout plan per stronghold', evidence: ['H2', ...(has('R1') ? ['R1'] : [])] });
    if (context.blind?.length) put('plan', 'blind-spots', { title: `Survey the blind spots: ${list(context.blind.map((row) => row.name), 3)}`, why: 'No readable survey and no calls there, so support is unknown.', where: context.blind.map((row) => row.name), owner: 'Research', due: dueFor(horizon, 10, now), target: '100+ responses in each', evidence: ['G4'] });
    if (cc.available && cc.droppedShare >= 0.15) put('delegate', 'cc-dropped', { title: `Retry the ${fmt(cc.dropped)} dropped calls once`, why: `${pct(cc.droppedShare)} of calls dropped.`, where: [], owner: 'Contact center', due: dueFor(horizon, 3, now), target: 'One retry per dropped call', evidence: ['C1'] });
    if (has('C5')) put('delegate', 'cc-records', { title: 'Complete call records: topic and location', why: facts.find((f) => f.id === 'C5').fact, where: [], owner: 'Data team', due: dueFor(horizon, 5, now), target: 'Topic and location on 90% of calls', evidence: ['C5'] });
    if (has('D1') || has('D2')) put('delegate', 'data-files', { title: 'Load the missing data files', why: [facts.find((f) => f.id === 'D1')?.fact, facts.find((f) => f.id === 'D2')?.fact].filter(Boolean).join(' '), where: [], owner: 'Data team', due: dueFor(horizon, 7, now), target: 'Full contact list and LGA PVC table uploaded', evidence: ['D1', 'D2'].filter(has) });
    if (context.crowded?.length) put('reduce', 'crowded', { title: `Pause new recruitment in ${list(context.crowded.map((row) => row.name), 2)}`, why: 'Plenty of members per polling unit but support is still low: move recruiting effort to empty LGAs.', where: context.crowded.map((row) => row.name), owner: 'Field operations', due: dueFor(horizon, 7, now), target: 'Recruiters reassigned to empty LGAs', evidence: ['G5', ...(has('G1') ? ['G1'] : [])] });
    if (cc.available && cc.supporters.share >= 0.6 && cc.notEstablished > 0) put('reduce', 'supporter-calls', { title: 'Call confirmed supporters less; reach the undecided', why: `${pct(cc.supporters.share)} of calls reach people already confirmed as supporters; ${fmt(cc.notEstablished)} are not yet established.`, where: [], owner: 'Contact center', due: dueFor(horizon, 7, now), target: 'Half of next week\'s calls to people not yet established', evidence: ['C2'] });
  } else {
    const change = context.lgaRow?.values.changeGov;
    if (change != null && change <= -0.2) put('do_now', 'lga-drop', { title: `Find out why support fell in ${place}`, why: facts.find((f) => f.id === 'H1').fact, where: [place], owner: 'Research', due: dueFor(horizon, 5, now), target: 'Listening sessions in every ward', evidence: ['H1'] });
    const allWardsEmpty = context.emptyWards?.length && context.emptyWards.length === context.map.rows.length;
    if (context.coverageGap && !allWardsEmpty) put('do_now', 'lga-coverage', { title: `Put a member on the ${fmt(context.coverageGap)} empty polling units`, why: facts.find((f) => f.id === 'M2').fact, where: [place], owner: 'Field operations', due: dueFor(horizon, 7, now), target: `${fmt(context.coverageGap)} agents`, evidence: ['M2'] });
    if (context.crowded) put('reduce', 'lga-crowded', { title: `Pause new recruitment in ${place}`, why: facts.find((f) => f.id === 'G5').fact, where: [place], owner: 'Field operations', due: dueFor(horizon, 7, now), target: 'Recruiters moved to persuasion work', evidence: ['G5'] });
    if (context.emptyWards?.length) put('do_now', 'wards-empty', { title: allWardsEmpty ? `Build a ground team across all ${context.emptyWards.length} wards of ${place}` : `Recruit members in ${list(context.emptyWards.map((row) => row.name), 3)}`, why: `No members in ${context.emptyWards.length} ward${context.emptyWards.length === 1 ? '' : 's'} of ${place}.`, where: context.emptyWards.map((row) => row.name), owner: 'Field operations', due: dueFor(horizon, 7, now), target: `${fmt(sum(context.emptyWards, (row) => row.pollingUnits))} agents, one per polling unit`, evidence: ['G1'] });
    if (context.quietWards?.length) put('do_now', 'wards-quiet', { title: `Call the members in ${list(context.quietWards.map((row) => row.name), 3)}`, why: 'Members are listed there but almost no calls were made.', where: context.quietWards.map((row) => row.name), owner: 'Contact center', due: dueFor(horizon, 5, now), target: 'Every listed ward called', evidence: ['G3'] });
    if (has('H1')) put('plan', 'lga-winback', { title: `Set ${place}'s message on its top needs`, why: facts.find((f) => f.id === 'H1').fact, where: [place], owner: 'Communications', due: dueFor(horizon, 10, now), target: 'Message plan for the LGA', evidence: ['H1', ...(has('S5') ? ['S5'] : [])] });
    if (context.lostWards?.length) put('plan', 'wards-lost', { title: `Plan outreach in wards APC lost in 2023`, why: facts.find((f) => f.id === 'H2').fact, where: context.lostWards.map((row) => row.name), owner: 'Field operations', due: dueFor(horizon, 14, now), target: 'Ward plan for each', evidence: ['H2'] });
    if (cc.available && !cc.calls) put('do_now', 'lga-no-calls', { title: `Start contact-center calls in ${place}`, why: facts.find((f) => f.id === 'C1')?.fact || `No calls recorded in ${place}.`, where: [place], owner: 'Contact center', due: dueFor(horizon, 3, now), target: 'First calls in every ward', evidence: ['C1'].filter(has) });
    if (!q.delegate.length && cc.available && cc.calls) put('delegate', 'lga-records', { title: `Confirm ward and topic on every ${place} call`, why: 'Call records drive the ward map; incomplete records hide where work is needed.', where: [place], owner: 'Data team', due: dueFor(horizon, 5, now), target: 'Ward and topic on every call', evidence: ['C1'] });
  }
  return q;
}

/** The instruction text sent to the model (Gemini first). */
export function aiPrompt(facts, { place, horizon, now = new Date() }) {
  return `You are the planning analyst for an Oyo State governorship campaign (candidate: Sen. Sharafadeen Alli).
Turn the FACTS below into a prioritised action plan laid out as an Eisenhower time-management matrix.

SCOPE: ${place}
HORIZON: ${HORIZONS[horizon] || HORIZONS.week}
TODAY: ${now.toDateString()}

THE FOUR QUADRANTS
1 DO NOW   (urgent + important)      Problems that cost votes or coverage if not fixed within the horizon: areas with no members or no calls, call backlogs and follow-ups people asked for, party unity disputes, anything with a deadline.
2 PLAN     (important, not urgent)   Strategy that decides the election but can be scheduled: win-back plans where support fell since 2023, messaging by issue, protecting strongholds, PVC collection and turnout planning, research to fill blind spots.
3 DELEGATE (urgent, less important)  Time-bound routine tasks a team member can handle without leadership: retrying dropped calls, cleaning call records, re-exporting data files.
4 REDUCE   (neither)                 Effort that is not paying off and should be cut or moved: over-staffed areas, repeat calls to already confirmed supporters, activity where support is not moving.

HOW TO JUDGE
- Important = large effect on votes: many registered voters, big gap between support now and APC's 2023 share, many polling units without a member, or a large group still undecided.
- Urgent = gets worse or closes soon: open calls, follow-ups requested, empty polling units, disputes, data needed for this horizon.
- Prefer actions that move effort from quadrant 4 into quadrants 1 and 2.

RULES (must follow)
- Use ONLY the numbers and names in FACTS. Never invent a figure, place, person or date.
- Every action must cite the fact ids it relies on in "evidence".
- Areas only: name LGAs or wards, never individuals, phone numbers or voters.
- Lawful, ethical campaigning only. Never suggest paying or giving gifts for votes, buying PVCs, intimidation, misinformation or discouraging anyone from voting. Callers asking for money are a need to address through programmes and messaging, not a reason to pay voters.
- The 2023 results are incomplete transcriptions; call them indicative, not official totals.
- If data is missing, say so in "data_gaps" instead of guessing.
- Plain English, short sentences. Action titles start with a verb and are at most 12 words.

OUTPUT: return ONLY valid JSON matching this schema, with no text before or after it.
{"brief":{"where_we_stand":"2-3 sentences","focus":"1-2 sentences on what to do first"},
 "quadrants":{"do_now":[ACTION],"plan":[ACTION],"delegate":[ACTION],"reduce":[ACTION]},
 "data_gaps":["short sentence"]}
do_now and plan: 2-4 actions each; delegate and reduce: 1-3 actions each.
ACTION = {"title":"Verb-first instruction, max 12 words","why":"One sentence with the key numbers","where":["LGA or ward names from FACTS"],"owner":"${OWNERS.join(' | ')}","due":"within the HORIZON, e.g. 'by 2 Oct' or 'this week'","target":"measurable result","evidence":["fact ids"]}

FACTS:
${JSON.stringify(facts.map(({ id, fact }) => ({ id, fact })), null, 1)}`;
}

const numbersIn = (text) => (String(text || '').match(/\d[\d,]*(?:\.\d+)?/g) || []).map((value) => value.replace(/,/g, '')).filter((value) => value.length > 0);

/**
 * Validates a model's JSON against the facts. Unknown evidence ids are dropped; any number in an
 * action that appears in none of its cited facts (nor any fact) is listed in `unverified`, and
 * the screen marks it. Returns null when the output is unusable, so the rules take over.
 */
export function checkAiPlan(raw, facts) {
  let plan = raw;
  if (typeof raw === 'string') {
    const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try { plan = JSON.parse(text); } catch { return null; }
  }
  if (!plan || typeof plan !== 'object' || !plan.quadrants) return null;
  const ids = new Set(facts.map((fact) => fact.id));
  const allNumbers = new Set(facts.flatMap((fact) => numbersIn(fact.fact)));
  const allowedDates = /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
  const clean = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const out = { do_now: [], plan: [], delegate: [], reduce: [] };
  let count = 0;
  for (const quadrant of QUADRANTS) {
    for (const item of (Array.isArray(plan.quadrants[quadrant]) ? plan.quadrants[quadrant] : []).slice(0, 5)) {
      const title = clean(item?.title, 120);
      if (!title) continue;
      const evidence = (Array.isArray(item.evidence) ? item.evidence : []).map(String).filter((id) => ids.has(id));
      const text = [item.title, item.why, item.target].join(' ').replace(allowedDates, '');
      const unverified = [...new Set(numbersIn(text).filter((value) => !allNumbers.has(value) && !['1', '2', '3', '10', '12', '90', '100'].includes(value)))];
      out[quadrant].push({
        key: `ai:${actionKey(quadrant, title)}`,
        source: 'ai',
        status: 'todo',
        title,
        why: clean(item.why, 400),
        where: (Array.isArray(item.where) ? item.where : []).map((name) => clean(name, 60)).filter(Boolean).slice(0, 8),
        owner: OWNERS.includes(item.owner) ? item.owner : clean(item.owner, 40) || 'Field operations',
        due: clean(item.due, 40),
        target: clean(item.target, 160),
        evidence,
        unverified,
      });
      count += 1;
    }
  }
  if (count < 3) return null;
  return {
    brief: { where_we_stand: clean(plan.brief?.where_we_stand, 700), focus: clean(plan.brief?.focus, 400) },
    quadrants: out,
    data_gaps: (Array.isArray(plan.data_gaps) ? plan.data_gaps : []).map((gap) => clean(gap, 200)).filter(Boolean).slice(0, 6),
  };
}

/** A brief written from the facts, for when no AI plan exists. */
export function ruleBrief({ facts, context }) {
  const get = (id) => facts.find((fact) => fact.id === id)?.fact;
  const stand = [get('S1'), get('S2'), get('M1')].filter(Boolean).join(' ');
  const quadrant = ruleActions({ facts, context }).do_now;
  return {
    where_we_stand: stand || `Not enough data loaded for ${context.place} yet.`,
    focus: quadrant.length ? `Start with: ${quadrant.slice(0, 3).map((action) => action.title.charAt(0).toLowerCase() + action.title.slice(1)).join('; ')}.` : 'No urgent gaps stand out in the loaded data.',
  };
}
