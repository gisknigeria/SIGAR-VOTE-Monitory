import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGeographyRollup, geographyDrillDownLevel, matchesGeography, paginate, resolveGeographyScope, resolveOptionalCoordinate } from './geography-query.js';

test('matchesGeography ignores unfiltered keys and normalizes casing/spacing', () => {
  const record = { lga: 'Ibadan North', ward: 'Ward   1' };
  assert.equal(matchesGeography(record, {}), true);
  assert.equal(matchesGeography(record, { lga: 'ibadan north' }), true);
  assert.equal(matchesGeography(record, { ward: 'ward 1' }), true);
  assert.equal(matchesGeography(record, { lga: 'Atiba' }), false);
});

test('resolveGeographyScope accepts a valid partial Oyo chain and rejects an invalid one', () => {
  const scope = resolveGeographyScope({ lga: 'IBADAN NORTH' });
  assert.equal(scope.lga, 'IBADAN NORTH');
  assert.throws(() => resolveGeographyScope({ lga: 'Not A Real LGA' }), /Unknown Oyo LGA/);
  assert.throws(() => resolveGeographyScope({ ward: 'Ward 1' }), /LGA is required/);
});

test('resolveGeographyScope resolves a naturally-cased LGA to the dataset\'s canonical key', () => {
  const scope = resolveGeographyScope({ lga: 'Ibadan North' });
  assert.equal(scope.lga, 'IBADAN NORTH');
});

test('buildGeographyRollup only labels the requested level unknown, not its ancestors', () => {
  const records = [{ lga: '', ward: '', pollingUnit: '' }];
  const byLga = buildGeographyRollup(records, 'lga');
  assert.deepEqual(byLga[0].geography, { state: 'Oyo', lga: 'unknown' });
  const byWard = buildGeographyRollup(records, 'ward');
  assert.deepEqual(byWard[0].geography, { state: 'Oyo', lga: '', ward: 'unknown' });
});

test('paginate bounds limit to MAX_PAGE_LIMIT and reports the true total', () => {
  const records = Array.from({ length: 500 }, (_, index) => index);
  const page = paginate(records, { limit: 10000, offset: 0 });
  assert.equal(page.items.length, 200);
  assert.equal(page.total, 500);
  assert.equal(page.limit, 200);
  const second = paginate(records, { limit: 50, offset: 480 });
  assert.equal(second.items.length, 20);
});

test('geographyDrillDownLevel advances one level at a time and stops at polling unit', () => {
  assert.equal(geographyDrillDownLevel({}), 'lga');
  assert.equal(geographyDrillDownLevel({ lga: 'Atiba' }), 'ward');
  assert.equal(geographyDrillDownLevel({ lga: 'Atiba', ward: 'Ward 1' }), 'pollingUnit');
  assert.equal(geographyDrillDownLevel({ lga: 'Atiba', ward: 'Ward 1', pollingUnit: 'PU 1' }), null);
});

test('resolveOptionalCoordinate preserves unknown instead of inventing a location', () => {
  assert.equal(resolveOptionalCoordinate(undefined, null), null);
  assert.equal(resolveOptionalCoordinate(undefined, 7.3775), 7.3775);
  assert.equal(resolveOptionalCoordinate('', 7.3775), null);
  assert.equal(resolveOptionalCoordinate(null, 7.3775), null);
  assert.equal(resolveOptionalCoordinate('6.5', null), 6.5);
  assert.equal(resolveOptionalCoordinate('not-a-number', 3.2), 3.2);
});
