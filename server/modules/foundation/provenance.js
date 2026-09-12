export const SOURCE_CLASSIFICATIONS = Object.freeze([
  'authoritative-master',
  'external-reference',
  'field-observed',
  'estimated-derived',
  'model-generated',
]);

const CLASSIFICATION_ALIASES = Object.freeze({
  'master-data': 'authoritative-master',
  'official-electoral': 'authoritative-master',
  'operational-boundary': 'field-observed',
  'operating-observation': 'field-observed',
  estimate: 'estimated-derived',
  'derived-analytics': 'model-generated',
});

export function normalizeSourceClassification(value, fallback = 'field-observed') {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
  const canonical = CLASSIFICATION_ALIASES[normalized] || normalized;
  return SOURCE_CLASSIFICATIONS.includes(canonical) ? canonical : fallback;
}