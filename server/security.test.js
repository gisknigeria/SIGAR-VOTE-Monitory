import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeString, validatePassword, validateMediaPayload } from './security.js';
import { resolveSecurityPolicy } from './bootstrap/runtime.js';

test('sanitizeString removes control characters and trims input', () => {
  assert.equal(sanitizeString('  Hello\nWorld  '), 'Hello World');
  assert.equal(sanitizeString('  '), '');
});

test('validatePassword enforces a minimum strength', () => {
  assert.equal(validatePassword('weak'), false);
  assert.equal(validatePassword('StrongPass123!'), true);
});

test('validateMediaPayload rejects oversized or invalid media input', () => {
  assert.equal(validateMediaPayload([{ type: 'image', data: 'data:image/png;base64,abc' }]).valid, true);
  assert.equal(validateMediaPayload([{ type: 'image', data: 'not-a-data-url' }]).valid, false);
  assert.equal(validateMediaPayload([{ type: 'video', mimeType: 'video/webm;codecs=vp8,opus', data: 'data:video/webm;base64,YWJj' }]).valid, true);
  assert.equal(validateMediaPayload([{ type: 'video', mimeType: 'video/mp4', data: 'data:video/webm;base64,YWJj' }]).valid, false);
  const oversizedPayload = Buffer.from('a'.repeat(41 * 1024 * 1024)).toString('base64');
  assert.equal(validateMediaPayload([{ type: 'image', data: 'data:image/png;base64,' + oversizedPayload }]).valid, false);
});

test('resolveSecurityPolicy enforces least-privilege roles and production secrets', () => {
  const policy = resolveSecurityPolicy({
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(40),
    SUPER_ADMIN_PASSWORD: 'StrongPass123!',
    ADMIN_PASSWORD: 'StrongPass123!',
    ACCESS_REVIEW_DAYS: '90',
    EVIDENCE_RETENTION_DAYS: '365',
    AUDIT_RETENTION_DAYS: '2555',
  });

  assert.equal(policy.secretManagement.enforceProductionEnv, true);
  assert.equal(policy.accessReview.enabled, true);
  assert.equal(policy.accessReview.cadenceDays, 90);
  assert.equal(policy.retention.auditLogsDays, 2555);
  assert.ok(policy.roleScope['Super Admin'].geographies.includes('Oyo State'));
  assert.ok(policy.roleScope['Admin'].responsibilities.includes('command-center'));
  assert.ok(policy.roleScope['Supervisor'].responsibilities.includes('lga-ward-operations'));
});

test('resolveSecurityPolicy rejects incomplete production secret material', () => {
  assert.throws(() => resolveSecurityPolicy({
    NODE_ENV: 'production',
    JWT_SECRET: 'short',
    SUPER_ADMIN_PASSWORD: 'StrongPass123!',
    ADMIN_PASSWORD: 'StrongPass123!',
  }), /Missing required production configuration|JWT_SECRET must contain/);
});
