import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntelligenceRepository } from './repository.js';

function fixture() { return createIntelligenceRepository({ jsonDb: {}, saveJson() {} }); }

test('signals preserve taxonomy, confidence, freshness, and duplicate observations', async () => {
  const repository = fixture();
  const first = await repository.createIntelligenceSignal({ sourceEventId: 'event-1', signalType: 'situation', views: ['situation'], category: 'connectivity', title: 'Observed outage', confidence: 'medium', observedAt: '2026-09-11T08:00:00.000Z', freshnessExpiresAt: '2099-09-11T09:00:00.000Z', source: { provider: 'field-observation', samplingLimitations: 'One agent report' } });
  const duplicate = await repository.createIntelligenceSignal({ sourceEventId: 'event-2', signalType: 'situation', views: ['situation'], category: 'connectivity', title: 'Repeated outage observation', duplicateOf: first.id, source: { provider: 'field-observation', samplingLimitations: 'Same location, later observation' } });
  assert.equal(first.category, 'connectivity');
  assert.equal(first.confidence, 'medium');
  assert.equal(first.isFresh, true);
  assert.equal(duplicate.duplicateOf, first.id);
  assert.equal((await repository.intelligenceSignals({})).length, 2);
});

test('rumours remain unverified and authorized reviewers control verification', async () => {
  const repository = fixture();
  const rumour = await repository.createIntelligenceSignal({ sourceEventId: 'rumour-1', signalType: 'situation', views: ['situation'], category: 'rumour', title: 'Unconfirmed report', isRumour: true, source: { samplingLimitations: 'Unverified field claim' } });
  assert.equal(rumour.verificationStatus, 'unverified');
  assert.equal(rumour.category, 'rumour');
  await assert.rejects(repository.verifyIntelligenceSignal(rumour.id, { reviewerId: 'agent-1', reviewerRole: 'Agent' }), /authorized reviewer/);
  const verified = await repository.verifyIntelligenceSignal(rumour.id, { reviewerId: 'supervisor-1', reviewerRole: 'Supervisor', verificationStatus: 'provisional', confidence: 'low', reviewNote: 'Reviewed against local report.' });
  assert.equal(verified.verificationStatus, 'provisional');
  assert.equal(verified.review.reviewerId, 'supervisor-1');
});

test('sentiment remains aggregate and retains sampling limitations', async () => {
  const repository = fixture();
  const signal = await repository.createIntelligenceSignal({ sourceEventId: 'sentiment-1', signalType: 'sentiment', views: ['sentiment'], category: 'readiness', title: 'Aggregate sentiment sample', source: { aggregate: true, sampleSize: 42, samplingLimitations: 'Convenience sample; not representative of all voters.' } });
  assert.equal(signal.source.aggregate, true);
  assert.equal(signal.source.sampleSize, 42);
  assert.match(signal.source.samplingLimitations, /not representative/);
});
