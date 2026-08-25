const SOURCES = {
  inec2019Governor: { name: 'INEC 2019 Oyo EC8E', url: 'https://www.inecnigeria.org/wp-content/uploads/2019/10/OYO.pdf' },
  inecArchive: { name: 'INEC election-results archive', url: 'https://www.inecnigeria.org/election-results/' },
  irev: { name: 'INEC IReV', url: 'https://inecelectionresults.ng/' },
  oyo2023Governor: { name: 'INEC declaration reported by Voice of Nigeria', url: 'https://von.gov.ng/inec-declares-makinde-winner-of-oyo-governorship-election/' },
};

export const HISTORICAL_ELECTION_DATASETS = [
  { id: '2019-president', year: 2019, election: 'Presidential', authority: 'INEC archive', level: 'State summary', status: 'partial', available: 'APC and PDP state totals', missing: 'Other-party and LGA vote breakdown', source: SOURCES.inecArchive },
  { id: '2019-governor', year: 2019, election: 'Governorship', authority: 'INEC', level: 'State declaration', status: 'available', available: 'Official leading-party totals and winner', missing: 'Complete party and LGA/ward/PU breakdown', source: SOURCES.inec2019Governor },
  { id: '2023-president', year: 2023, election: 'Presidential', authority: 'INEC/IReV', level: 'State summary', status: 'available', available: 'Declared state totals plus evidence transcriptions by LGA, ward, and polling unit', missing: 'Some polling-unit sheets or party scores may be unavailable', geography: { office: 'presidential', levels: ['lga', 'ward', 'polling-unit'] }, source: SOURCES.irev },
  { id: '2023-governor', year: 2023, election: 'Governorship', authority: 'INEC/IReV', level: 'State declaration', status: 'available', available: 'Declared state totals plus evidence transcriptions by LGA', missing: 'Ward and polling-unit geographic transcriptions', geography: { office: 'governor', levels: ['lga'] }, source: SOURCES.oyo2023Governor },
];

export const HISTORICAL_ELECTION_RESULTS = {
  '2019-president': { metric: 'votes', parties: [{ party: 'PDP', value: 366690 }, { party: 'APC', value: 365229 }], areas: [], note: 'The loaded archive contains the two leading state totals only; other parties are not represented in this record.' },
  '2019-governor': { metric: 'votes', totalVotes: 916860, parties: [{ party: 'PDP', value: 515621 }, { party: 'APC', value: 357982 }, { party: 'Other parties', value: 43257 }], areas: [], note: 'Official INEC state declaration. The remaining valid votes are grouped as Other parties until the complete party table is loaded.' },
  '2023-president': { metric: 'votes', parties: [{ party: 'APC', value: 449884 }, { party: 'PDP', value: 182977 }, { party: 'LP', value: 99110 }, { party: 'NNPP', value: 4095 }], areas: [], note: 'Declared leading-party state totals; detailed geographic transcriptions have not yet been loaded.' },
  '2023-governor': { metric: 'votes', parties: [{ party: 'PDP', value: 563756 }, { party: 'APC', value: 256685 }, { party: 'Accord', value: 38357 }], areas: [], note: 'Declared leading-party state totals. Other-party and polling-unit totals remain outside this loaded summary.' },
};

export function historicalDatasetSummary() {
  const available = HISTORICAL_ELECTION_DATASETS.filter((item) => item.status === 'available').length;
  return { total: HISTORICAL_ELECTION_DATASETS.length, available, partial: HISTORICAL_ELECTION_DATASETS.length - available };
}

export function getHistoricalDataset(year, election) {
  return HISTORICAL_ELECTION_DATASETS.find((item) => item.year === Number(year) && item.election === election) || null;
}
