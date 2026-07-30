import test from 'node:test';
import assert from 'node:assert/strict';
import { NIGERIA_STATES, getRegistrationLocationOptions } from './electionData.js';

test('registration location data includes Nigeria states and real polling-unit options', () => {
  assert.ok(NIGERIA_STATES.includes('Oyo'));
  assert.ok(NIGERIA_STATES.includes('Abia'));
  const oyoOptions = getRegistrationLocationOptions('Oyo');
  assert.ok(oyoOptions.lgas.includes('AFIJIO'));
  const afijioOptions = getRegistrationLocationOptions('Oyo', 'AFIJIO');
  assert.ok(afijioOptions.wards.includes('AKINMORIN/JOBELE'));
  const oyoPollingUnits = getRegistrationLocationOptions('Oyo', 'AFIJIO', 'AKINMORIN/JOBELE');
  assert.ok(oyoPollingUnits.pollingUnits.includes('BAALE JOBELE OPEN SPACE'));

  const abiaOptions = getRegistrationLocationOptions('Abia', 'ABA NORTH', 'EZIAMA');
  assert.ok(abiaOptions.lgas.includes('ABA NORTH'));
  assert.ok(abiaOptions.wards.includes('EZIAMA'));
  assert.ok(abiaOptions.pollingUnits.some((unit) => unit.includes('RAILWAY QUARTERS')));
  assert.equal(abiaOptions.lgas.every((lga) => lga !== 'Afijio'), true);
  assert.equal(abiaOptions.wards.every((ward) => ward !== 'Ward 01'), true);
});
