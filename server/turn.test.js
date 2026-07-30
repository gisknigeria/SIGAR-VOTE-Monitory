import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FALLBACK_ICE_SERVERS,
  normalizeMeteredDomain,
  normalizeMeteredRegion,
  sanitizeIceServers,
} from './turn.js';

test('normalizes only valid Metered application domains', () => {
  assert.equal(normalizeMeteredDomain(' Example-App.metered.live '), 'example-app.metered.live');
  assert.equal(normalizeMeteredDomain('https://example-app.metered.live'), 'example-app.metered.live');
  assert.equal(normalizeMeteredDomain('https://example.com'), '');
  assert.equal(normalizeMeteredDomain('example-app.metered.live/path'), '');
});

test('normalizes supported Metered regions', () => {
  assert.equal(normalizeMeteredRegion('EUROPE_WEST'), 'europe_west');
  assert.equal(normalizeMeteredRegion('standard'), 'standard');
  assert.equal(normalizeMeteredRegion('invalid-region'), 'standard');
});

test('sanitizes ICE server responses without dropping TURN credentials', () => {
  assert.deepEqual(sanitizeIceServers([
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'turn:global.relay.metered.ca:443?transport=tcp', username: 'user', credential: 'pass', ignored: true },
    { urls: 'https://malicious.example' },
  ]), [
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'turn:global.relay.metered.ca:443?transport=tcp', username: 'user', credential: 'pass' },
  ]);
  assert.equal(FALLBACK_ICE_SERVERS[0].urls, 'stun:stun.l.google.com:19302');
});
