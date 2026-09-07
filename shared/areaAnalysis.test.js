import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateAgents, agentsInArea, matchArea, resultSummary } from './areaAnalysis.js';

test('top three use every recorded party in the denominator', () => {
  const result = resultSummary({ parties: [{ party: 'APC', votes: 40 }, { party: 'PDP', votes: 30 }, { party: 'LP', votes: 20 }, { party: 'NNPP', votes: 10 }, { party: 'APM', votes: null }] });
  assert.equal(result.top.length, 3);
  assert.equal(result.top[0].percentage, 40);
  assert.equal(result.total, 100);
  assert.equal(result.winner, 'APC');
});
test('ties and all-zero or missing results have no winning party', () => {
  assert.equal(resultSummary({ parties: [{ party: 'A', votes: 4 }, { party: 'B', votes: 4 }] }).tie, true);
  assert.equal(resultSummary({ parties: [{ party: 'A', votes: 0 }] }).winner, '');
  assert.deepEqual(resultSummary({ parties: [{ party: 'A', votes: null }] }).top, []);
});
test('boundary matching handles punctuation but rejects ambiguous and absent matches', () => {
  const areas = [{ id: 'a', name: 'Ibadan North-East' }];
  assert.equal(matchArea(areas, ['IBADAN NORTH EAST']).id, 'a');
  assert.equal(matchArea([...areas, { id: 'b', name: 'Ibadan North East' }], ['Ibadan North-East']), null);
  assert.equal(matchArea(areas, ['Unknown']), null);
});
test('agent totals deduplicate IDs and respect state, active status, role and parent geography', () => {
  const agent = { id: '1', role: 'Agent', active: true, state: 'Oyo', lga: 'IBADAN NORTH', ward: 'WARD 1', pollingUnit: 'School' };
  const result = aggregateAgents([agent, agent, { ...agent, id: '2', ward: 'WARD 2' }, { ...agent, id: '3', active: false }, { ...agent, id: '4', role: 'Supervisor' }, { ...agent, id: '5', state: 'Lagos' }, { ...agent, id: '6', lga: '' }]);
  assert.equal(result.total, 3);
  assert.equal(result.unassigned, 1);
  assert.equal(agentsInArea(result.assignments, 'Ibadan North'), 2);
  assert.equal(agentsInArea(result.assignments, 'Ibadan North', 'Ward 1', 'School'), 1);
  assert.equal(agentsInArea(result.assignments, 'Ibadan South', 'Ward 1'), 0);
});
