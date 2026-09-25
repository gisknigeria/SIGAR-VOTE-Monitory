import test from 'node:test';
import assert from 'node:assert/strict';
import { createWardMatcher, wardByName, wardNumber } from '../../../shared/wardMatch.js';
import { baselineSurvey, withBaseline } from './baseline.js';
import { oyoGeo, wardResolver } from './geo.js';
import { buildMap } from './map.js';

test('ward labels: names, spelling slips, Roman numerals and bare numbers', () => {
  const wards = ['AAJE/OGUNBADO', 'ABOGUNDE', 'AGUODO/ MASIFA', 'ISALE ALAASA', 'SABO/TARA', 'TEDE I', 'TEDE II'];
  assert.equal(wardByName('AGUODO/MASIFA . WARD 3', wards), 'AGUODO/ MASIFA');
  assert.equal(wardByName('MASIFA AGUODO', wards), 'AGUODO/ MASIFA');
  assert.equal(wardByName('ALASA WARD 05', wards), 'ISALE ALAASA');
  assert.equal(wardByName('SABO /TAARA. WARD 10', wards), 'SABO/TARA');
  assert.equal(wardByName('TEDE II', wards), 'TEDE II');
  assert.equal(wardByName('TEDE I', wards), 'TEDE I');
  assert.equal(wardByName('WARD 3', wards), '', 'a bare number is not a name');
  assert.equal(wardNumber('WARD3'), 3);
  assert.equal(wardNumber('ALASA. WARD O5'), 5);
  assert.equal(wardNumber('ABOGUNDE WARD ONE'), 1);
  assert.equal(wardNumber('11: GBONJE / OLELE'), 11);
  assert.equal(wardNumber('10 OKEOLA'), 10);
  assert.equal(wardNumber('IJERU WARD II'), 2);
  const numbered = new Map([[1, 'ABOGUNDE'], [3, 'AGUODO/ MASIFA']]);
  const match = createWardMatcher(wards, [], numbered);
  assert.equal(match('WARD 3'), 'AGUODO/ MASIFA');
  assert.equal(match('03'), 'AGUODO/ MASIFA');
  assert.equal(match('WARD 9'), '', 'an unknown number stays unmatched');
});

test('the bundled register covers all 6,390 Oyo polling units in 351 numbered wards', () => {
  const lgas = [...oyoGeo().lgas.values()];
  assert.equal(lgas.length, 33);
  assert.equal(lgas.reduce((sum, lga) => sum + lga.wardList.length, 0), 351);
  assert.equal(lgas.reduce((sum, lga) => sum + lga.pollingUnits, 0), 6390);
  const resolve = wardResolver('OGBOMOSO NORTH');
  assert.equal(resolve('WARD 3').name, 'AGUODO/ MASIFA');
  assert.equal(resolve('SABO /TAARA. WARD 10').number, 10);
});

test('map: LGA layers join ground work, survey, needs and 2023 history', () => {
  const map = buildMap({ datasets: withBaseline([]), survey: baselineSurvey() });
  assert.equal(map.level, 'lga');
  assert.equal(map.rows.length, 33);
  const oyoWest = map.rows.find((row) => row.key === 'OYO WEST');
  assert.equal(oyoWest.detail.gov2023.winner, 'PDP');
  assert.ok(oyoWest.values.changeGov > 0.4, 'Oyo West moved strongly toward Sen. Alli');
  assert.ok(oyoWest.values.population > 0 && oyoWest.detail.populationEstimated);
  assert.ok(oyoWest.detail.needs.length > 0 && oyoWest.detail.needs[0].survey != null);
  const population = map.rows.reduce((sum, row) => sum + row.values.population, 0);
  assert.ok(Math.abs(population - 7_976_100) < 50, 'estimates add up to the state projection');
  assert.equal(map.layers.pvc.loaded, false, 'PVCs by LGA need an upload');
  assert.ok(map.insights.some((item) => /blind spots/.test(item.text)));
  assert.ok(map.ranking.length > 0 && map.ranking[0].reasons.length > 0);
});

test('map: drilling into wards and polling units keeps members and calls placed', () => {
  const datasets = withBaseline([]);
  const wards = buildMap({ datasets, survey: baselineSurvey(), lga: 'Ogbomoso North' });
  assert.equal(wards.level, 'ward');
  assert.equal(wards.rows.length, 10);
  const masifa = wards.rows.find((row) => row.number === 3);
  assert.ok(masifa.values.members > 100 && masifa.values.calls > 20);
  assert.ok(masifa.values.pres2023 > 0 && masifa.values.registered > 10000);
  assert.equal(wards.context.key, 'OGBOMOSO NORTH');

  const units = buildMap({ datasets, survey: baselineSurvey(), lga: 'Ogbomoso North', ward: '3' });
  assert.equal(units.level, 'pu');
  assert.equal(units.ward.name, 'AGUODO/ MASIFA');
  assert.equal(units.rows.length, 40);
  assert.ok(units.rows.filter((row) => row.values.members > 0).length >= 30);
  assert.ok(units.insights.length > 0);
});
