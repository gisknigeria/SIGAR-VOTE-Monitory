import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityRepository } from './repository.js';

const user = (overrides) => ({ id: 'u-1', name: 'Test Admin', email: 'admin@test.local', role: 'Admin', active: true, ...overrides });

test('an admin-capable account with no recorded review is reported overdue', async () => {
  const jsonDb = { users: [user()] };
  const repository = createIdentityRepository({ pool: null, jsonDb, saveJson() {}, mappers: {} });
  const status = await repository.accessReviewStatus({ cadenceDays: 90 });
  assert.equal(status.length, 1);
  assert.equal(status[0].overdue, true);
  assert.equal(status[0].lastReviewedAt, null);
});

test('recordAccessReview clears the overdue flag until the cadence elapses again', async () => {
  const jsonDb = { users: [user()] };
  const repository = createIdentityRepository({ pool: null, jsonDb, saveJson() {}, mappers: {} });

  const review = await repository.recordAccessReview('u-1', { reviewedBy: 'super-1', notes: 'quarterly check' });
  assert.equal(review.reviewedBy, 'super-1');

  const status = await repository.accessReviewStatus({ cadenceDays: 90 });
  assert.equal(status[0].overdue, false);
  assert.equal(status[0].lastReviewedBy, 'super-1');
});

test('a review older than the cadence is overdue again', async () => {
  const jsonDb = { users: [user()], accessReviews: { 'access-review:u-1': { userId: 'u-1', reviewedBy: 'super-1', reviewedAt: new Date(Date.now() - 200 * 86400000).toISOString(), notes: '' } } };
  const repository = createIdentityRepository({ pool: null, jsonDb, saveJson() {}, mappers: {} });
  const status = await repository.accessReviewStatus({ cadenceDays: 90 });
  assert.equal(status[0].overdue, true);
});

test('recordAccessReview requires an authenticated reviewer', async () => {
  const jsonDb = { users: [user()] };
  const repository = createIdentityRepository({ pool: null, jsonDb, saveJson() {}, mappers: {} });
  await assert.rejects(repository.recordAccessReview('u-1', {}), /authenticated reviewer/);
});

test('accessReviewStatus only reports admin-capable, active roles', async () => {
  const jsonDb = { users: [user({ id: 'a', role: 'Agent' }), user({ id: 'b', role: 'Admin', active: false }), user({ id: 'c', role: 'Supervisor' })] };
  const repository = createIdentityRepository({ pool: null, jsonDb, saveJson() {}, mappers: {} });
  const status = await repository.accessReviewStatus({});
  assert.deepEqual(status.map((entry) => entry.userId), ['c']);
});
