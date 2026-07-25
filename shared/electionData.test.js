import test from 'node:test';
import assert from 'node:assert/strict';
import { NIGERIA_STATES, getRegistrationLocationOptions } from './electionData.js';

test('registration location data includes Nigeria states and real polling-unit options', () => {
  assert.ok(NIGERIA_STATES.includes('Oyo'));
  assert.ok(NIGERIA_STATES.includes('Abia'));
  const oyoOptions = getRegistrationLocationOptions('Oyo');
  assert.ok(oyoOptions.lgas.length > 0);
  assert.ok(oyoOptions.wards.length > 0);
  assert.ok(oyoOptions.pollingUnits.length > 0);

  const abiaOptions = getRegistrationLocationOptions('Abia');
  assert.ok(abiaOptions.lgas.includes('ABA NORTH'));
  assert.ok(abiaOptions.wards.includes('ABA RIVER'));
  assert.ok(abiaOptions.pollingUnits.some((unit) => unit.includes('PRIMARY SCHOOL')));
  assert.equal(abiaOptions.lgas.every((lga) => lga !== 'Afijio'), true);
  assert.equal(abiaOptions.wards.every((ward) => ward !== 'Ward 01'), true);
});
