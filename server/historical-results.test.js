import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeHistoricalArea, normalizePartyScores, normalizeWardHistory, slugifyHistoricalArea } from './historical-results.js';

test('blank and invalid scores remain unavailable and ties have no winner', () => {
  assert.deepEqual(normalizePartyScores({ A: null, B: '', C: 'invalid', D: 0 }), [{ party: 'D', votes: 0, percentage: 0 }]);
  assert.equal(normalizeHistoricalArea({ scores: { A: 5, B: 5 } }).winner, '');
});
test('polling units preserve source coordinates without inventing missing positions', () => {
  const { areas } = normalizeWardHistory({ polling_units: [{ pu_code: 'one', latitude: 8, longitude: 3 }, { pu_code: 'two' }, { pu_code: 'three', lat: 999, lng: 3 }] });
  assert.deepEqual(areas[0].coordinates, [3, 8]);
  assert.equal(areas[1].coordinates, null);
  assert.equal(areas[2].coordinates, null);
});

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
