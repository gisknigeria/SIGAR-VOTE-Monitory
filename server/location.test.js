import test from 'node:test';
import assert from 'node:assert/strict';
import { formatReverseLocation } from './location.js';

test('reverse location prefers a named place and preserves street context', () => {
  const location = formatReverseLocation({
    name: 'Bodija Community Primary School',
    display_name: 'Bodija Community Primary School, Awolowo Avenue, Ibadan, Oyo, Nigeria',
    address: { house_number: '2', road: 'Awolowo Avenue', city: 'Ibadan' },
  }, 7.435, 3.914);
  assert.equal(location.label, 'Bodija Community Primary School');
  assert.equal(location.street, '2 Awolowo Avenue');
  assert.equal(location.locality, 'Ibadan');
});

test('reverse location falls back to coordinates when no address exists', () => {
  const location = formatReverseLocation({}, 7.3775, 3.947);
  assert.equal(location.label, '7.37750, 3.94700');
});
