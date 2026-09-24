import { classifyPhrase, normalizePhrase, themeLabel, themeTone } from './sentiment.js';

/**
 * Every figure the survey pages show, computed from the stored responses in one pass per
 * section. The campaign's Excel workbook computed the same things with pivot tables; this
 * reproduces them (the tests pin the workbook's own totals) and adds what a pivot cannot:
 * LGA weighting, second-choice transfers, collector concentration, and themes in the written
 * answers.
 *
 * Percentages always use "people who answered this question" as the base, and every section
 * carries that base, so a share is never quietly computed over blanks. (The workbook mixes the
 * two -- its Chart Data sheet excludes blanks while Key Analysis Summary includes them -- which
 * is why the same answer shows different percentages on different sheets.)
 */

export const FOCUS_PATTERN = /sharafadeen|\balli\b/i;
const MIN_LGA_NAMED_FOR_WEIGHTING = 30;
const SMALL_SAMPLE = 100;
const ONE_COLLECTOR_SHARE = 0.7;
const MIN_EXAMPLE_COUNT = 5; // a phrase must recur this often before it is shown as an example
const TEMPLATE_MIN_WORDS = 5;
const TEMPLATE_MIN_REPEATS = 20;

// Survey, polling-unit register and boundary file spell four LGAs differently.
const LGA_VARIANTS = { atigbo: 'atisbo', 'ogbomosho north': 'ogbomoso north', 'ogbomosho south': 'ogbomoso south', orelope: 'oorelope', oriire: 'ori ire' };
export const lgaKey = (value) => {
  const normalized = String(value ?? '').trim().replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, ' ').toLowerCase();
  return LGA_VARIANTS[normalized] || normalized;
};

const CATEGORY_FIELDS = [
  'respondent', 'topIssue', 'satisfaction', 'sector', 'fairAttention', 'lgaProblem', 'message', 'communicate',
  'hasPvc', 'votedLast', 'likelihood', 'barrier', 'platform', 'truthSource', 'candidateFactor', 'familiarity',
  'firstHeard', 'goodGovernor',
];
// Compared between the focus candidate's supporters and everyone who named someone else --
// the people the campaign still has to win.
const SEGMENT_FIELDS = ['platform', 'truthSource', 'firstHeard', 'message', 'communicate', 'topIssue', 'candidateFactor', 'satisfaction', 'barrier'];
const TEXT_FIELDS = ['impression', 'whyYes', 'whyNo'];
const CROSSTAB_FIELDS = ['respondent', 'topIssue', 'platform', 'candidateFactor', 'firstHeard'];

const share = (count, base) => (base ? Number((count / base).toFixed(4)) : 0);

export function createSurveyReader(dataset) {
  const index = Object.fromEntries(dataset.fields.map((field, i) => [field, i]));
  const agentColumn = dataset.fields.length;
  const value = (row, field) => (index[field] === undefined ? '' : dataset.values[field][row[index[field]]] || '');
  return { value, agent: (row) => row[agentColumn] || 0, has: (field) => index[field] !== undefined };
}

function tally(rows, pick) {
  const counts = new Map();
  let answered = 0;
  for (const row of rows) {
    const key = pick(row);
    if (!key) continue;
    answered += 1;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return {
    answered,
    rows: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count, share: share(count, answered) })),
  };
}

export function analyzeSurvey(dataset, { lga = '', respondent = '' } = {}, { lgaWeights = null, weightBasis = '' } = {}) {
  const read = createSurveyReader(dataset);
  const all = dataset.rows;
  const wantLga = lgaKey(lga);
  const rows = all.filter((row) => (!wantLga || lgaKey(read.value(row, 'lga')) === wantLga) && (!respondent || read.value(row, 'respondent') === respondent));

  const first = (row) => read.value(row, 'firstChoice');
  const focusName = dataset.values.firstChoice?.find((name) => FOCUS_PATTERN.test(name)) || '';
  const isFocus = (row) => focusName && first(row) === focusName;
  const named = rows.filter(first);

  // ---- Vote intention ------------------------------------------------------------------------
  const firstChoice = tally(named, first);
  const leader = firstChoice.rows[0] || null;
  const focusRow = firstChoice.rows.find((row) => row.name === focusName) || null;
  const focusRank = focusRow ? firstChoice.rows.indexOf(focusRow) + 1 : null;
  const bestRival = firstChoice.rows.find((row) => row.name !== focusName) || null;
  // "Who would you vote for if your candidate were not running" -- a valid candidate only.
  const secondChoice = tally(rows, (row) => {
    const name = read.value(row, 'secondChoice');
    return name && name !== first(row) ? name : '';
  });
  const quality = tally(rows, (row) => {
    const label = read.value(row, 'voteQuality');
    if (label) return label === 'Blank' ? 'No answer' : label;
    return first(row) ? 'Named candidate' : 'No answer';
  });
  quality.answered = rows.length;
  quality.rows = quality.rows.map((item) => ({ ...item, share: share(item.count, rows.length) }));

  const mainCandidates = firstChoice.rows.filter((row) => row.count >= Math.max(5, named.length * 0.01)).map((row) => row.name);
  const transfers = mainCandidates.slice(0, 5).map((candidate) => {
    const voters = named.filter((row) => first(row) === candidate);
    const next = tally(voters, (row) => {
      const name = read.value(row, 'secondChoice');
      return name && name !== candidate ? name : '';
    });
    return { candidate, voters: voters.length, answered: next.answered, to: next.rows.slice(0, 4) };
  });

  // ---- By LGA --------------------------------------------------------------------------------
  const lgaBuckets = new Map();
  for (const row of rows) {
    const name = read.value(row, 'lga');
    const key = name ? lgaKey(name) : '';
    if (!lgaBuckets.has(key)) lgaBuckets.set(key, { lga: name || 'LGA not given', key, rows: [] });
    lgaBuckets.get(key).rows.push(row);
  }
  const byLga = [...lgaBuckets.values()].map((bucket) => {
    const agents = tally(bucket.rows, (row) => String(read.agent(row) || ''));
    const namedHere = bucket.rows.filter(first);
    const votes = tally(namedHere, first);
    const topAgentShare = agents.answered ? agents.rows[0].count / agents.answered : 0;
    const flags = [];
    if (bucket.rows.length < SMALL_SAMPLE) flags.push('small-sample');
    if (agents.rows.length && topAgentShare >= ONE_COLLECTOR_SHARE) flags.push('one-collector');
    const focusVotes = votes.rows.find((row) => row.name === focusName)?.count || 0;
    return {
      lga: bucket.lga,
      key: bucket.key,
      responses: bucket.rows.length,
      named: namedHere.length,
      collectors: agents.rows.length,
      topCollectorShare: Number(topAgentShare.toFixed(4)),
      leader: votes.rows[0]?.name || null,
      leaderShare: votes.rows[0]?.share || 0,
      focusVotes,
      focusShare: share(focusVotes, namedHere.length),
      candidates: votes.rows.slice(0, 5),
      flags,
    };
  }).sort((a, b) => b.responses - a.responses);

  // ---- LGA-weighted estimate ----------------------------------------------------------------
  // Raw shares over-count LGAs where many people were surveyed (Atiba is 13% of responses). The
  // weighted figure gives each LGA its share of the state instead, using only LGAs with enough
  // answers to be meaningful, and reports how much of the state those LGAs represent.
  let weighted = null;
  if (!wantLga && lgaWeights?.size) {
    const totalWeight = [...lgaWeights.values()].reduce((sum, weight) => sum + weight, 0);
    const included = byLga.filter((row) => row.key && row.named >= MIN_LGA_NAMED_FOR_WEIGHTING && lgaWeights.get(row.key));
    const includedWeight = included.reduce((sum, row) => sum + lgaWeights.get(row.key), 0);
    if (included.length && includedWeight > 0) {
      const estimate = new Map();
      for (const row of included) {
        const bucketRows = lgaBuckets.get(row.key).rows.filter(first);
        const votes = tally(bucketRows, first);
        for (const candidate of votes.rows) estimate.set(candidate.name, (estimate.get(candidate.name) || 0) + candidate.share * lgaWeights.get(row.key));
      }
      weighted = {
        basis: weightBasis,
        coverage: share(includedWeight, totalWeight),
        lgasIncluded: included.length,
        lgasExcluded: [...lgaWeights.keys()].filter((key) => !included.some((row) => row.key === key)).length,
        minimumAnswersPerLga: MIN_LGA_NAMED_FOR_WEIGHTING,
        rows: [...estimate.entries()].map(([name, total]) => ({ name, share: Number((total / includedWeight).toFixed(4)) })).sort((a, b) => b.share - a.share),
      };
    }
  }

  // ---- Every multiple-choice question ------------------------------------------------------
  const questions = {};
  for (const field of CATEGORY_FIELDS) if (read.has(field)) questions[field] = tally(rows, (row) => read.value(row, field));

  // ---- Candidate cross-tabs (the workbook's "Candidates Analysis") -------------------------
  const crosstabCandidates = mainCandidates.slice(0, 4);
  const crosstabs = {};
  for (const field of CROSSTAB_FIELDS) {
    if (!read.has(field)) continue;
    const groups = new Map();
    for (const row of named) {
      const category = read.value(row, field);
      if (!category) continue;
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(row);
    }
    crosstabs[field] = {
      candidates: crosstabCandidates,
      rows: [...groups.entries()].map(([category, groupRows]) => {
        const votes = tally(groupRows, first);
        const counts = Object.fromEntries(crosstabCandidates.map((name) => [name, votes.rows.find((row) => row.name === name)?.count || 0]));
        const listed = Object.values(counts).reduce((sum, count) => sum + count, 0);
        return { name: category, named: groupRows.length, counts, others: groupRows.length - listed, leader: votes.rows[0]?.name || null };
      }).sort((a, b) => b.named - a.named),
    };
  }

  // ---- Focus supporters vs voters for other candidates -------------------------------------
  const focusRows = named.filter(isFocus);
  const rivalRows = named.filter((row) => !isFocus(row));
  const segments = {};
  if (focusName) {
    for (const field of SEGMENT_FIELDS) {
      if (!read.has(field)) continue;
      const mine = tally(focusRows, (row) => read.value(row, field));
      const theirs = tally(rivalRows, (row) => read.value(row, field));
      const names = [...new Set([...mine.rows, ...theirs.rows].map((row) => row.name))];
      segments[field] = {
        focusAnswered: mine.answered,
        othersAnswered: theirs.answered,
        rows: names.map((name) => ({
          name,
          focus: mine.rows.find((row) => row.name === name)?.share || 0,
          others: theirs.rows.find((row) => row.name === name)?.share || 0,
        })).sort((a, b) => b.others + b.focus - (a.others + a.focus)),
      };
    }
  }

  // ---- Written answers: themes and tone -----------------------------------------------------
  const phraseCounts = new Map();
  const toneTotals = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
  const themeTotals = new Map();
  const byCandidate = new Map();
  let textAnswers = 0;
  for (const row of rows) {
    const candidate = first(row) || '';
    for (const field of TEXT_FIELDS) {
      const text = read.value(row, field);
      if (!text) continue;
      const { tone, themes } = classifyPhrase(text);
      if (!tone) continue;
      textAnswers += 1;
      toneTotals[tone] += 1;
      const phrase = normalizePhrase(text);
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
      if (!byCandidate.has(candidate)) byCandidate.set(candidate, { answers: 0, tone: { positive: 0, negative: 0, neutral: 0, mixed: 0 }, themes: new Map() });
      const bucket = byCandidate.get(candidate);
      bucket.answers += 1;
      bucket.tone[tone] += 1;
      for (const theme of themes) {
        bucket.themes.set(theme, (bucket.themes.get(theme) || 0) + 1);
        if (!themeTotals.has(theme)) themeTotals.set(theme, { count: 0, phrases: new Map() });
        const total = themeTotals.get(theme);
        total.count += 1;
        total.phrases.set(phrase, (total.phrases.get(phrase) || 0) + 1);
      }
    }
  }
  const sentiment = {
    answers: textAnswers,
    tone: Object.fromEntries(Object.entries(toneTotals).map(([key, count]) => [key, { count, share: share(count, textAnswers) }])),
    themes: [...themeTotals.entries()].map(([id, total]) => ({
      id,
      label: themeLabel(id),
      tone: themeTone(id),
      count: total.count,
      share: share(total.count, textAnswers),
      examples: [...total.phrases.entries()].filter(([, count]) => count >= MIN_EXAMPLE_COUNT).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([phrase, count]) => ({ phrase, count })),
    })).sort((a, b) => b.count - a.count),
    byCandidate: [...byCandidate.entries()]
      .filter(([candidate, bucket]) => candidate && bucket.answers >= 50)
      .sort((a, b) => b[1].answers - a[1].answers)
      .slice(0, 5)
      .map(([candidate, bucket]) => ({
        candidate,
        answers: bucket.answers,
        positive: share(bucket.tone.positive, bucket.answers),
        negative: share(bucket.tone.negative + bucket.tone.mixed, bucket.answers),
        neutral: share(bucket.tone.neutral, bucket.answers),
        themes: [...bucket.themes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => ({ id, label: themeLabel(id), tone: themeTone(id), count, share: share(count, bucket.answers) })),
      })),
  };

  // ---- Data quality --------------------------------------------------------------------------
  const signatures = new Map();
  for (const row of rows) {
    const signature = row.slice(0, dataset.fields.length).join(',');
    signatures.set(signature, (signatures.get(signature) || 0) + 1);
  }
  const duplicates = [...signatures.values()].reduce((sum, count) => sum + (count > 1 ? count - 1 : 0), 0);
  const templated = [...phraseCounts.entries()]
    .filter(([phrase, count]) => count >= TEMPLATE_MIN_REPEATS && phrase.split(' ').length >= TEMPLATE_MIN_WORDS)
    .sort((a, b) => b[1] - a[1]);
  const qualityReport = {
    duplicates,
    duplicateShare: share(duplicates, rows.length),
    noVoteAnswer: rows.length - named.length,
    focusSecondChoiceIsFocus: focusName ? focusRows.filter((row) => read.value(row, 'secondChoice') === focusName).length : 0,
    goodGovernorYesWithReasonAgainst: rows.filter((row) => read.value(row, 'goodGovernor') === 'Yes' && read.value(row, 'whyNo')).length,
    lgaNotGiven: lgaBuckets.get('')?.rows.length || 0,
    templatedAnswers: templated.reduce((sum, [, count]) => sum + count, 0),
    templatedShare: share(templated.reduce((sum, [, count]) => sum + count, 0), textAnswers),
    templatedExamples: templated.slice(0, 5).map(([phrase, count]) => ({ phrase, count })),
    oneCollectorLgas: byLga.filter((row) => row.flags.includes('one-collector')).map((row) => ({ lga: row.lga, responses: row.responses, share: row.topCollectorShare })),
    smallSampleLgas: byLga.filter((row) => row.key && row.flags.includes('small-sample')).map((row) => ({ lga: row.lga, responses: row.responses })),
  };

  return {
    source: {
      file: dataset.sourceFile,
      sheet: dataset.sourceSheet,
      importedAt: dataset.importedAt,
      responses: dataset.responseCount,
      collectors: dataset.agentCount,
      lgas: new Set(all.map((row) => lgaKey(read.value(row, 'lga'))).filter(Boolean)).size,
      questions: dataset.questions || {},
      workbookTotals: dataset.workbookTotals || {},
    },
    filter: { lga: wantLga ? (byLga[0]?.lga || lga) : '', respondent, responses: rows.length, smallSample: rows.length < SMALL_SAMPLE },
    options: {
      lgas: [...new Map(all.map((row) => read.value(row, 'lga')).filter(Boolean).map((name) => [lgaKey(name), name])).values()].sort(),
      respondents: [...new Set(all.map((row) => read.value(row, 'respondent')).filter(Boolean))].sort(),
    },
    focus: focusName ? { name: focusName, votes: focusRow?.count || 0, share: focusRow?.share || 0, rank: focusRank, rival: bestRival ? { name: bestRival.name, votes: bestRival.count, share: bestRival.share } : null } : null,
    vote: { named: named.length, leader, firstChoice: firstChoice.rows, secondChoice, quality: quality.rows, transfers, weighted },
    byLga,
    questions,
    crosstabs,
    segments,
    sentiment,
    quality: qualityReport,
  };
}
