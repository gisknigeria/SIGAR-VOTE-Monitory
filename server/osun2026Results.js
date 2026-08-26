import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const prepared = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'data', 'osun2026PollingUnitResults.json'), 'utf8'));

export const OSUN_2026_PUBLISHED_RESULTS = Object.freeze({
  election: '2026 Osun State Governorship Election',
  status: 'Final · INEC declared',
  sourceName: prepared.sourceName,
  sourceUrl: prepared.sourceUrl,
  sourceNote: prepared.sourceNote,
  importedAt: prepared.importedAt,
  count: prepared.rows.length,
  totals: [
    { party: 'A', name: 'Accord', votes: 511067 },
    { party: 'APC', name: 'All Progressives Congress', votes: 444815 },
    { party: 'ADC', name: 'African Democratic Congress', votes: 17180 },
    { party: 'ADP', name: 'Action Democratic Party', votes: 2946 },
    { party: 'ZLP', name: 'Zenith Labour Party', votes: 2482 },
  ],
  pollingUnits: prepared.rows.map(row => ({
    ...row,
    winner: [...row.results].sort((a, b) => b.votes - a.votes)[0]?.party || '',
  })),
});
