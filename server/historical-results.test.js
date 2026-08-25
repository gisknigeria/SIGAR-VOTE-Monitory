import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeHistoricalArea, normalizePartyScores, slugifyHistoricalArea } from './historical-results.js';

test('party scores are sorted and assigned percentages', () => {
  assert.deepEqual(normalizePartyScores({ PDP: 25, APC: 75 }), [
    { party: 'APC', votes: 75, percentage: 75 },
    { party: 'PDP', votes: 25, percentage: 25 },
  ]);
});

test('historical areas expose a winner and recorded total', () => {
  const area = normalizeHistoricalArea({ id: 1, name: 'Example', scores: { APC: 3, PDP: 7 } });
  assert.equal(area.winner, 'PDP');
  assert.equal(area.totalVotes, 10);
});

test('area names are converted to safe provider slugs', () => {
  assert.equal(slugifyHistoricalArea('Akinyele L.G.A.'), 'akinyele-l-g-a');
});
