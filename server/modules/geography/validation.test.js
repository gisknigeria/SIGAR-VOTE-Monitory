import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOyoAssignment } from './validation.js';

test('validateOyoAssignment resolves a human-typed LGA to the dataset\'s canonical casing', () => {
  const result = validateOyoAssignment({ state: 'Oyo', lga: 'Ibadan North' });
  assert.equal(result.lga, 'IBADAN NORTH');
});

test('validateOyoAssignment resolves a hyphenated LGA name regardless of the dataset\'s own inconsistent hyphenation', () => {
  const result = validateOyoAssignment({ state: 'Oyo', lga: 'Ibadan North-East' });
  assert.equal(result.lga, 'IBADAN NORTH EAST');
});

test('validateOyoAssignment rejects an LGA that genuinely does not exist', () => {
  assert.throws(() => validateOyoAssignment({ state: 'Oyo', lga: 'Not A Real LGA' }), /Select a valid Oyo LGA/);
});

test('validateOyoAssignment resolves ward and polling unit casing once the LGA is resolved', () => {
  const result = validateOyoAssignment({ state: 'Oyo', lga: 'ibadan north', ward: 'ward i n2' });
  assert.equal(result.lga, 'IBADAN NORTH');
  assert.equal(result.ward, 'WARD I N2');
});

test('validateOyoAssignment requires an LGA before a ward or polling unit', () => {
  assert.throws(() => validateOyoAssignment({ state: 'Oyo', ward: 'Ward 1' }), /LGA is required/);
});

test('validateOyoAssignment with no geography supplied returns empty fields, not an error', () => {
  const result = validateOyoAssignment({ state: 'Oyo' });
  assert.deepEqual(result, { state: 'Oyo', lga: '', ward: '', pollingUnit: '' });
});
