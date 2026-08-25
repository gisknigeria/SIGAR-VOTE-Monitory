const numberOrZero = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export const normalizePartyScores = (scores = {}) => {
  const parties = Object.entries(scores || {})
    .map(([party, votes]) => ({ party: String(party || '').trim(), votes: numberOrZero(votes) }))
    .filter(item => item.party && item.votes >= 0)
    .sort((a, b) => b.votes - a.votes || a.party.localeCompare(b.party));
  const totalVotes = parties.reduce((sum, item) => sum + item.votes, 0);
  return parties.map(item => ({
    ...item,
    percentage: totalVotes ? Number(((item.votes / totalVotes) * 100).toFixed(2)) : 0,
  }));
};

export const normalizeHistoricalArea = ({ id, name, code = '', scores = {}, totalVotes, registeredVoters, accreditedVoters, confidence, confidenceBand }) => {
  const parties = normalizePartyScores(scores);
  const recordedTotal = numberOrZero(totalVotes) || parties.reduce((sum, item) => sum + item.votes, 0);
  return {
    id: String(id ?? code ?? name ?? ''),
    name: String(name || '').trim(),
    code: String(code || '').trim(),
    winner: parties[0]?.party || '',
    totalVotes: recordedTotal,
    registeredVoters: registeredVoters == null ? null : numberOrZero(registeredVoters),
    accreditedVoters: accreditedVoters == null ? null : numberOrZero(accreditedVoters),
    confidence: confidence == null ? null : numberOrZero(confidence),
    confidenceBand: String(confidenceBand || ''),
    parties,
  };
};

export const slugifyHistoricalArea = value => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

export const normalizeStateHistory = (payload, office) => {
  const result = payload?.[office];
  if (!result || !Array.isArray(result.lgas)) return null;
  return {
    year: Number(payload.year) || 2023,
    state: String(payload.state || 'Oyo'),
    office,
    level: 'lga',
    areas: result.lgas.map(item => normalizeHistoricalArea({
      id: item.lga_id,
      name: item.lga,
      scores: item.parties,
      totalVotes: item.total,
    })),
  };
};

export const normalizeLgaHistory = payload => ({
  level: 'ward',
  parent: { id: String(payload?.id || ''), name: String(payload?.name || '') },
  areas: (payload?.wards || []).map(item => normalizeHistoricalArea({
    id: item.ward_code,
    code: item.ward_code,
    name: item.ward,
    scores: item.scores,
    totalVotes: item.total_votes,
    registeredVoters: item.registered_voters,
  })),
});

export const normalizeWardHistory = payload => ({
  level: 'polling-unit',
  parent: { code: String(payload?.ward_code || ''), name: String(payload?.ward || '') },
  areas: (payload?.polling_units || []).map(item => normalizeHistoricalArea({
    id: item.pu_code,
    code: item.pu_code,
    name: item.pu_name,
    scores: item.scores,
    totalVotes: item.known_votes,
    registeredVoters: item.registered_voters,
    accreditedVoters: item.accredited_voters,
    confidence: item.confidence,
    confidenceBand: item.confidence_band,
  })),
});
