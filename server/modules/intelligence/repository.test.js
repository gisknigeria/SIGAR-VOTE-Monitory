import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntelligenceRepository } from './repository.js';

function fixture() {
  const jsonDb = {};
  return createIntelligenceRepository({ jsonDb, saveJson() {} });
}

test('one source event projects into multiple views without double-counting', async () => {
  const repository = fixture();
  const first = await repository.createIntelligenceSignal({
    sourceEventId: 'field-event-1',
    views: ['pulse', 'situation'],
    title: 'Reporting activity detected',
    geography: { state: 'Oyo', lga: 'Ibadan North' },
    source: { type: 'field-report' },
  });
  const second = await repository.createIntelligenceSignal({
    sourceEventId: 'field-event-1',
    views: ['sentiment', 'pulse'],
    title: 'Same source event',
    geography: { state: 'Oyo', lga: 'Ibadan North' },
  });
  assert.equal(first.id, second.id);
  assert.deepEqual(second.views.sort(), ['pulse', 'sentiment', 'situation']);
  assert.equal((await repository.intelligenceSignals({ view: 'pulse' })).length, 1);
  assert.equal((await repository.intelligenceViewSummary({ view: 'situation' })).count, 1);
  assert.equal((await repository.intelligenceViewSummary({ view: 'sentiment' })).count, 1);
});

test('rumours and unverified signals remain explicitly labeled', async () => {
  const repository = fixture();
  const rumour = await repository.createIntelligenceSignal({
    sourceEventId: 'rumour-1',
    signalType: 'sentiment',
    title: 'Unconfirmed supply rumour',
    isRumour: true,
    verificationStatus: 'verified',
    geography: { state: 'Oyo', lga: 'Atiba' },
  });
  assert.equal(rumour.verificationStatus, 'unverified');
  assert.equal(rumour.label, 'UNVERIFIED');
  const summary = await repository.intelligenceViewSummary({ view: 'sentiment', geography: { lga: 'Atiba' } });
  assert.equal(summary.unverified, 1);
  assert.equal(summary.verified, 0);
});
