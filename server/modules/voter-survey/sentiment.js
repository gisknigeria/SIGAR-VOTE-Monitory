/**
 * Theme and tone for the survey's short written answers ("overall impression", "why yes",
 * "why no"). The answers are 3-5 words on average and mostly praise for the respondent's own
 * candidate, so the useful output is not "positive vs negative" alone but *why* people back a
 * candidate -- and which doubts come up.
 *
 * Rules, not a model: every label can be traced to the phrase that produced it, the result is
 * identical on every run, and no respondent text ever leaves the server. The rules were written
 * against the phrases that actually occur in the Oyo survey (typos included: "competence well
 * experienced", "grass root"), and each is covered by a test.
 */

export const THEMES = [
  { id: 'competence', label: 'Competence & experience', tone: 'positive', pattern: /competen|experienc|capab|\bable\b|tested|intelligen|educated|diligent|\bactive\b|skill|capacity|brilliant|qualified|knowledg|confiden|organi[sz]ed|action man|hard ?working|add working|dedicat|prudent/ },
  { id: 'integrity', label: 'Integrity & trust', tone: 'positive', pattern: /integrity|honest|trust|reliab|accountab|transparen|sincer|credib|faithful|loyal/ },
  { id: 'character', label: 'Good character', tone: 'positive', pattern: /good (person|man|character|behaviou?r|heart)|nice|humble|kind|toleran|role model|gentle|respect|caring|perfect|good impression|dignity|\bfair\b|community supporter/ },
  { id: 'record', label: 'Track record & achievements', tone: 'positive', pattern: /record|achiev|development|perform|track|project|he do it|done it|work(ed)? for/ },
  { id: 'grassroots', label: 'Understands ordinary people', tone: 'positive', pattern: /grass ?root|problems fac|understand|masses|people'?s? (man|person)|for the people|down to earth/ },
  { id: 'policies', label: 'Policies & plans', tone: 'positive', pattern: /polic|reform|infrastructure|econom|youth friendly|elder|plan|job|employ|empower|welfare/ },
  { id: 'leadership', label: 'Leadership', tone: 'positive', pattern: /leader/ },
  { id: 'hope', label: 'Hope for better', tone: 'positive', pattern: /do better|likely to do|better future|change|he can do it|can deliver|will deliver/ },
  { id: 'faith', label: 'Faith', tone: 'neutral', pattern: /\bgod\b|pray|allah|grace|destiny/ },
  { id: 'party', label: 'Party loyalty', tone: 'neutral', pattern: /party|\bapc\b|\bpdp\b|\blp\b/ },
  { id: 'unfamiliar', label: 'Does not know the candidate', tone: 'neutral', pattern: /not familiar|don'?t know|do not know|no idea|never heard|not aware|not known/ },
  { id: 'noView', label: 'No clear view', tone: 'neutral', pattern: /^(no comment|nothing|none|nil|no|yes|ok|okay|average|voting|not interested|i don'?t want to talk|next)\.?$|no comment|uninterested|don'?t want to talk/ },
  { id: 'notThisTime', label: '"Not this time"', tone: 'negative', pattern: /next time|not now|another time|later/ },
  { id: 'prefersOther', label: 'Prefers another candidate', tone: 'negative', pattern: /hamzat|oriyomi|adelabu|makinde|ajadi|someone else|another person|another candidate/ },
  { id: 'doubts', label: 'Doubts & concerns', tone: 'negative', pattern: /lack of|rigg|unpredictab|not (good|capable|trust|competent|reliable)|\bbad\b|fail|corrupt|disappoint|\bpoor\b|\bweak\b|\blie[sd]?\b|\bliar|deceiv|selfish|arrogan|no (experience|record)/ },
  // Assigned, never matched: a positive answer that names no specific reason ("good", "satisfied").
  { id: 'praise', label: 'General praise', tone: 'positive', pattern: /(?!)/ },
];

const GENERIC_POSITIVE = /\b(good|great|impressive|satisf\w*|excellent|fine|wonderful|amazing|best|contentment|interest(ed|ing)?|like him|love him|opinion in him)\b/;
const THEME_BY_ID = Object.fromEntries(THEMES.map((theme) => [theme.id, theme]));

export const normalizePhrase = (text) => String(text ?? '').toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

const cache = new Map();

/** Classifies one answer. Returns its tone and the themes it mentions (possibly none). */
export function classifyPhrase(text) {
  const phrase = normalizePhrase(text);
  if (!phrase) return { tone: null, themes: [] };
  if (cache.has(phrase)) return cache.get(phrase);

  // "no bad record" and "not bad" are praise; strip the negated negatives before matching.
  // "not interested" / "I don't have interest in him" are the opposite of interest.
  const scrubbed = phrase
    .replace(/\bno bad record\b|\bnot bad\b|\bno bad\b/g, 'good record')
    .replace(/\b(?:not|no|don'?t have|do not have|never had|lack)(?: any)? interest(?:ed)?\b/g, 'uninterested');
  const themes = THEMES.filter((theme) => theme.pattern.test(scrubbed)).map((theme) => theme.id);
  if (!themes.length && GENERIC_POSITIVE.test(scrubbed)) themes.push('praise');
  const hasNegative = themes.some((id) => THEME_BY_ID[id].tone === 'negative');
  const hasPositive = themes.some((id) => THEME_BY_ID[id].tone === 'positive') || GENERIC_POSITIVE.test(scrubbed);

  let tone = 'neutral';
  if (hasNegative && !hasPositive) tone = 'negative';
  else if (hasPositive && !hasNegative) tone = 'positive';
  else if (hasPositive && hasNegative) tone = 'mixed';

  const result = { tone, themes };
  if (cache.size < 20_000) cache.set(phrase, result);
  return result;
}

export const themeLabel = (id) => THEME_BY_ID[id]?.label || id;
export const themeTone = (id) => THEME_BY_ID[id]?.tone || 'neutral';
