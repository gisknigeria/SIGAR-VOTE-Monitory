import test from 'node:test';
import assert from 'node:assert/strict';
import { annotateGeneration, describeGeneration, GENERATION_TYPES } from './generation-provenance.js';

test('describeGeneration requires a valid generationType and rejects an unlabeled default', () => {
  assert.throws(() => describeGeneration({}), /generationType must be one of/);
  assert.throws(() => describeGeneration({ generationType: 'ai' }), /generationType must be one of/);
  for (const type of GENERATION_TYPES) {
    assert.equal(describeGeneration({ generationType: type, provider: 'groq' }).generationType, type);
  }
});

test('describeGeneration rejects an invalid review status and defaults to unreviewed', () => {
  assert.equal(describeGeneration({ generationType: 'generative-ai' }).reviewStatus, 'unreviewed');
  assert.throws(() => describeGeneration({ generationType: 'generative-ai', reviewStatus: 'trusted' }), /reviewStatus must be one of/);
});

test('annotateGeneration merges the governance envelope with the response payload', () => {
  const response = annotateGeneration({ summary: 'text' }, { generationType: 'generative-ai', provider: 'groq', model: 'llama-3.1-8b-instant' });
  assert.equal(response.summary, 'text');
  assert.equal(response.generationType, 'generative-ai');
  assert.equal(response.provider, 'groq');
  assert.ok(response.generatedAt);
  assert.equal(response.reviewStatus, 'unreviewed');
});

test('a deterministic rule is never labeled generative-ai', () => {
  const response = annotateGeneration({ summary: 'Local summary: ...' }, { generationType: 'deterministic-rule', provider: 'local', model: 'summarizeNewsLocally' });
  assert.equal(response.generationType, 'deterministic-rule');
  assert.notEqual(response.generationType, 'generative-ai');
});
