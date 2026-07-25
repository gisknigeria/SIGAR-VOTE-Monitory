import test from 'node:test';
import assert from 'node:assert/strict';
import { NIGERIA_STATES, getRegistrationLocationOptions } from './electionData.js';

test('registration location data includes Nigeria states and Oyo options', () => {
  assert.ok(NIGERIA_STATES.includes('Oyo'));
  const options = getRegistrationLocationOptions('Oyo');
  assert.ok(options.lgas.length > 0);
  assert.ok(options.wards.length > 0);
  assert.ok(options.pollingUnits.length > 0);
});
