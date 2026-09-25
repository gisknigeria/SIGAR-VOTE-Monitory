// analyzeSurvey keys LGAs with its own normaliser, so register names go through it too.
import { analyzeSurvey, lgaKey as analyzeLgaKey } from '../voter-survey/analysis.js';
import { lgaLabel, matchLga, oyoLgas } from './lga.js';

/**
 * The Pre-Election Pulse: one screen joining every pre-election source -- the voter survey, the
 * member lists, the contact list and the population / voter-register reference -- for the whole
 * state or one LGA, plus plain-English findings written from those figures.
 *
 * Every section says whether its data is loaded, so a missing upload shows as "not loaded yet"
 * rather than as a zero.
 */

// Published state totals, used until an LGA-level reference table is uploaded.
export const STATE_BASELINE = {
  registeredVoters: { value: 3_276_675, source: 'INEC final register, 2023 general election' },
  pvcCollected: { value: 2_761_421, source: 'INEC PVC collection figures, February 2023' },
  population: { value: 7_976_100, source: 'NPC/NBS 2022 projection (2006 census: 5,580,894)' },
  wards: 351,
};

const MIN_NAMED_FOR_LGA_READ = 30;
const ratio = (part, whole) => (whole > 0 && part != null ? Number((part / whole).toFixed(4)) : null);
const pct = (value, digits = 0) => `${(value * 100).toFixed(digits)}%`;
const fmt = (value) => Number(value || 0).toLocaleString('en-US');
const latest = (items) => [...items].sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)))[0] || null;

const SHORT = { 'Sen Sharafadeen Abiodun Alli': 'Sen. Alli', 'Olufemi Ajadi Oguntoyinbo': 'Ajadi' };
export const shortName = (name) => SHORT[name] || String(name || '').split(' ').slice(-1)[0] || '—';

function referenceView(reference, lga) {
  const values = reference?.values || {};
  const fields = ['population', 'registeredVoters', 'pvcCollected'];
  const out = {};
  for (const field of fields) {
    if (lga) {
      const value = values[lga]?.[field];
      out[field] = value == null ? null : { value, source: reference.source || reference.label };
      continue;
    }
    // A state figure from the upload only when it covers every LGA; otherwise the published total.
    const covered = oyoLgas().filter((item) => values[item.name]?.[field] != null);
    out[field] = covered.length === oyoLgas().length
      ? { value: covered.reduce((sum, item) => sum + values[item.name][field], 0), source: reference.source || reference.label }
      : STATE_BASELINE[field];
  }
  out.pvcRate = ratio(out.pvcCollected?.value, out.registeredVoters?.value);
  out.lgaLevelLoaded = Object.keys(values).length;
  return out;
}

function membersView(memberSets, lga) {
  if (!memberSets.length) return { available: false };
  const register = oyoLgas();
  // id -> { lgas, groups }. Someone listed in two LGAs counts in each LGA's figure, once in the state's.
  const people = new Map();
  const units = new Map(); // lga -> Set of ward|unit
  const wards = new Map(); // lga -> Set of ward
  const groups = memberSets.map((set) => ({ label: set.label, ids: new Set() }));
  memberSets.forEach((set, index) => {
    for (const [recordLga, ward, unit, id] of set.records) {
      if (!people.has(id)) people.set(id, { lgas: new Set(), groups: new Set() });
      people.get(id).groups.add(index);
      people.get(id).lgas.add(recordLga);
      if (lga && recordLga !== lga) continue;
      groups[index].ids.add(id);
      if (unit) {
        if (!units.has(recordLga)) units.set(recordLga, new Set());
        units.get(recordLga).add(`${ward}|${unit}`);
      }
      if (ward) {
        if (!wards.has(recordLga)) wards.set(recordLga, new Set());
        wards.get(recordLga).add(ward);
      }
    }
  });
  const byLga = new Map();
  for (const person of people.values()) for (const name of person.lgas) byLga.set(name, (byLga.get(name) || 0) + 1);
  const inScope = [...people.values()].filter((person) => !lga || person.lgas.has(lga));
  const scopeLgas = lga ? register.filter((item) => item.name === lga) : register;
  // A unit can be counted at most once per register polling unit, so coverage never tops 100%.
  const unitsCovered = scopeLgas.reduce((sum, item) => sum + Math.min(units.get(item.name)?.size || 0, item.pollingUnits), 0);
  const pollingUnits = scopeLgas.reduce((sum, item) => sum + item.pollingUnits, 0);
  const wardsCovered = scopeLgas.reduce((sum, item) => sum + Math.min(wards.get(item.name)?.size || 0, item.wards), 0);
  const wardsTotal = scopeLgas.reduce((sum, item) => sum + item.wards, 0);
  return {
    available: true,
    total: inScope.length,
    inMoreThanOneList: inScope.filter((person) => person.groups.size > 1).length,
    groups: groups.map((group) => ({ label: group.label, people: group.ids.size })),
    lgasWithMembers: register.filter((item) => byLga.get(item.name)).length,
    unitsCovered,
    pollingUnits,
    unitCoverage: ratio(unitsCovered, pollingUnits),
    wardsCovered,
    wardsTotal,
    byLga,
    unitsByLga: new Map([...units.entries()].map(([key, set]) => [key, set.size])),
    updatedAt: latest(memberSets)?.uploadedAt || null,
  };
}

function surveyView(dataset, lga, weights) {
  if (!dataset) return { available: false };
  const analysis = analyzeSurvey(dataset, { lga: lga ? lgaLabel(lga) : '' }, weights);
  const answered = (field) => analysis.questions[field] || { answered: 0, rows: [] };
  const shareOf = (field, pattern) => {
    const question = answered(field);
    const hits = question.rows.filter((row) => pattern.test(row.name)).reduce((sum, row) => sum + row.count, 0);
    return question.answered ? { share: ratio(hits, question.answered), count: hits, answered: question.answered } : null;
  };
  const responses = analysis.filter.responses;
  return {
    available: true,
    analysis,
    responses,
    named: analysis.vote.named,
    undecided: responses - analysis.vote.named,
    candidates: analysis.vote.firstChoice.slice(0, 6).map((row) => ({ name: row.name, short: shortName(row.name), count: row.count, share: row.share })),
    weighted: analysis.vote.weighted ? { basis: analysis.vote.weighted.basis, coverage: analysis.vote.weighted.coverage, rows: analysis.vote.weighted.rows.slice(0, 6).map((row) => ({ ...row, short: shortName(row.name) })) } : null,
    focus: analysis.focus ? { name: analysis.focus.name, short: shortName(analysis.focus.name), share: analysis.focus.share, votes: analysis.focus.votes, rank: analysis.focus.rank } : null,
    topIssues: answered('topIssue').rows.slice(0, 6),
    topIssuesAnswered: answered('topIssue').answered,
    satisfaction: answered('satisfaction').rows,
    satisfactionAnswered: answered('satisfaction').answered,
    platform: answered('platform').rows.slice(0, 5),
    platformAnswered: answered('platform').answered,
    hasPvc: shareOf('hasPvc', /^yes/i),
    // Of everyone surveyed, not of those who answered: the question was mostly left blank by
    // people who were not going to vote, so "of those who answered" reads as ~100%.
    likely: (() => { const hit = shareOf('likelihood', /likely/i); return hit ? { ...hit, share: ratio(hit.count, responses) } : null; })(),
    smallSample: analysis.filter.smallSample,
    updatedAt: dataset.importedAt || null,
  };
}

function insightsFor({ lga, survey, members, contacts, reference, rows }) {
  const out = [];
  const add = (tone, text) => out.push({ tone, text });
  const place = lga ? lgaLabel(lga) : 'Oyo';

  if (survey.available && survey.candidates.length) {
    const [first, second] = survey.candidates;
    const gap = second ? (first.share - second.share) * 100 : null;
    if (second && gap < 5) add('watch', `${first.short} (${pct(first.share)}) and ${second.short} (${pct(second.share)}) are within ${gap.toFixed(1)} points in ${place}: a two-way race.`);
    else add('info', `${first.short} leads first choice in ${place} with ${pct(first.share)} of people who named a candidate${second ? `, ${gap.toFixed(0)} points ahead of ${second.short}` : ''}.`);
    const weighted = survey.weighted?.rows?.[0];
    if (weighted && weighted.name !== first.name) add('risk', `Weighted by each LGA's size (${survey.weighted.basis}), ${weighted.short} leads with ${pct(weighted.share)}: the raw lead comes from heavily surveyed LGAs.`);
    if (survey.focus && survey.focus.rank !== 1) {
      add('risk', `${survey.focus.short} is ${survey.focus.rank ? `#${survey.focus.rank}` : 'not named'} in ${place} (${pct(survey.focus.share || 0)}), behind ${first.short}.`);
    }
    const undecided = ratio(survey.undecided, survey.responses);
    if (undecided >= 0.3) add('watch', `${pct(undecided)} of respondents in ${place} named no candidate: a large pool still to win.`);
    if (survey.smallSample) add('watch', `Only ${fmt(survey.responses)} survey responses in ${place}: treat the shares as indicative.`);
  }
  if (survey.available && survey.topIssues[0]) {
    const issue = survey.topIssues[0];
    add('info', `${issue.name} is the top issue in ${place} (${pct(issue.share)}${survey.topIssues[1] ? `; next ${survey.topIssues[1].name.toLowerCase()} ${pct(survey.topIssues[1].share)}` : ''}). Lead messaging with it.`);
  }
  if (survey.available && survey.platform[0]) add('info', `${survey.platform[0].name} is the most influential platform (${pct(survey.platform[0].share)} of answers).`);

  if (!lga && survey.available) {
    const readable = rows.filter((row) => row.named >= MIN_NAMED_FOR_LGA_READ && row.focusShare != null);
    if (readable.length >= 3 && survey.focus) {
      const sorted = [...readable].sort((a, b) => b.focusShare - a.focusShare);
      const top = sorted.slice(0, 3).map((row) => `${row.label} ${pct(row.focusShare)}`).join(', ');
      const bottom = sorted.slice(-3).reverse().map((row) => `${row.label} ${pct(row.focusShare)}`).join(', ');
      add('good', `${survey.focus.short} is strongest in ${top}.`);
      add('risk', `${survey.focus.short} is weakest in ${bottom}.`);
      if (members.available) {
        const exposed = readable
          .filter((row) => row.focusShare >= (survey.focus.share || 0) && row.pollingUnits && (row.unitsCovered || 0) / row.pollingUnits < 0.25)
          .sort((a, b) => (b.registeredVoters || b.pollingUnits) - (a.registeredVoters || a.pollingUnits))
          .slice(0, 3);
        if (exposed.length) add('risk', `Support is above the state average but under 25% of polling units have a member in ${exposed.map((row) => row.label).join(', ')}. Recruit agents there first.`);
      }
    }
    const unsurveyed = rows.filter((row) => !row.responses).map((row) => row.label);
    if (unsurveyed.length) add('watch', `${unsurveyed.length} LGA${unsurveyed.length === 1 ? ' has' : 's have'} no survey responses: ${unsurveyed.slice(0, 5).join(', ')}${unsurveyed.length > 5 ? '…' : ''}.`);
  }

  if (members.available) {
    add(members.unitCoverage >= 0.6 ? 'good' : 'risk', `Members cover ${fmt(members.unitsCovered)} of ${fmt(members.pollingUnits)} polling units in ${place} (${pct(members.unitCoverage || 0)}).`);
    if (!lga) {
      const empty = rows.filter((row) => !row.members).sort((a, b) => (b.registeredVoters || b.pollingUnits) - (a.registeredVoters || a.pollingUnits));
      if (empty.length) add('risk', `${empty.length} LGA${empty.length === 1 ? ' has' : 's have'} no confirmed members yet: ${empty.slice(0, 5).map((row) => row.label).join(', ')}${empty.length > 5 ? '…' : ''}.`);
    }
    if (members.inMoreThanOneList) add('info', `${fmt(members.inMoreThanOneList)} people appear in more than one member list and are counted once.`);
  } else add('watch', 'No member list loaded yet. Upload agent and volunteer lists in Data to see ground strength.');

  if (reference.pvcRate != null) {
    const uncollected = reference.registeredVoters.value - reference.pvcCollected.value;
    add(reference.pvcRate >= 0.85 ? 'info' : 'watch', `${pct(reference.pvcRate, 1)} of registered voters in ${place} have collected their PVC; ${fmt(uncollected)} cards were uncollected.`);
  }
  if (contacts.available) {
    const reach = ratio(contacts.total, reference.registeredVoters?.value);
    if (reach != null) add('info', `The contact list reaches ${fmt(contacts.total)} phones in ${place}, about ${pct(reach)} of registered voters.`);
    if (contacts.truncated && !lga) add('watch', 'The contact list stops at 1,048,574 rows (Excel\'s limit), so it was probably cut off. Re-export it straight to CSV.');
  }
  if (!lga && reference.lgaLevelLoaded < oyoLgas().length) add('watch', `LGA population and PVC figures are loaded for ${reference.lgaLevelLoaded} of ${oyoLgas().length} LGAs. State totals use published INEC/NPC figures.`);

  const order = { risk: 0, watch: 1, good: 2, info: 3 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}

export function buildPulse({ datasets = [], survey = null, lga = '' }) {
  const wanted = lga ? matchLga(lga) : '';
  const memberSets = datasets.filter((item) => item.kind === 'members');
  const contactSet = latest(datasets.filter((item) => item.kind === 'contacts'));
  const reference = latest(datasets.filter((item) => item.kind === 'reference'));
  const register = oyoLgas();

  // Weight the survey by registered voters per LGA when the reference has them.
  const voterWeights = new Map(register.map((item) => [item.name, reference?.values?.[item.name]?.registeredVoters]).filter(([, value]) => value > 0));
  const weights = voterWeights.size >= 20
    ? { lgaWeights: new Map([...voterWeights.entries()].map(([name, value]) => [analyzeLgaKey(name), value])), weightBasis: 'registered voters per LGA' }
    : { lgaWeights: new Map(register.map((item) => [analyzeLgaKey(item.name), item.pollingUnits])), weightBasis: 'polling units per LGA (until registered voters per LGA are uploaded)' };

  const surveyScoped = surveyView(survey, wanted, weights);
  const surveyState = wanted ? surveyView(survey, '', weights) : surveyScoped;
  const members = membersView(memberSets, wanted);
  const ref = referenceView(reference, wanted);
  const contactsTotal = contactSet ? (wanted ? contactSet.counts[wanted] || 0 : Object.values(contactSet.counts).reduce((sum, value) => sum + value, 0)) : 0;
  const contacts = contactSet ? { available: true, total: contactsTotal, truncated: Boolean(contactSet.summary?.truncated), updatedAt: contactSet.uploadedAt } : { available: false };

  const surveyByLga = new Map((surveyState.analysis?.byLga || []).map((row) => [matchLga(row.lga), row]).filter(([key]) => key));
  const rows = register.map((item) => {
    const surveyRow = surveyByLga.get(item.name);
    const values = reference?.values?.[item.name] || {};
    return {
      lga: item.name,
      label: lgaLabel(item.name),
      pollingUnits: item.pollingUnits,
      wards: item.wards,
      population: values.population ?? null,
      registeredVoters: values.registeredVoters ?? null,
      pvcCollected: values.pvcCollected ?? null,
      members: members.available ? members.byLga.get(item.name) || 0 : null,
      unitsCovered: members.available ? Math.min(members.unitsByLga.get(item.name) || 0, item.pollingUnits) : null,
      contacts: contactSet ? contactSet.counts[item.name] || 0 : null,
      responses: surveyRow?.responses || 0,
      named: surveyRow?.named || 0,
      leader: surveyRow?.leader ? shortName(surveyRow.leader) : null,
      leaderShare: surveyRow?.leaderShare ?? null,
      focusShare: surveyRow && surveyRow.named ? surveyRow.focusShare : null,
    };
  });

  const scopedSurvey = { ...surveyScoped };
  delete scopedSurvey.analysis;
  const { byLga, unitsByLga, ...membersOut } = members;
  return {
    filter: { lga: wanted, label: wanted ? lgaLabel(wanted) : 'All of Oyo', options: register.map((item) => ({ value: item.name, label: lgaLabel(item.name) })) },
    register: { lgas: register.length, wards: wanted ? register.find((item) => item.name === wanted)?.wards : STATE_BASELINE.wards, pollingUnits: wanted ? register.find((item) => item.name === wanted)?.pollingUnits : register.reduce((sum, item) => sum + item.pollingUnits, 0) },
    reference: ref,
    members: membersOut,
    contacts,
    survey: scopedSurvey,
    byLga: rows,
    insights: insightsFor({ lga: wanted, survey: surveyScoped, members, contacts, reference: ref, rows }),
  };
}
