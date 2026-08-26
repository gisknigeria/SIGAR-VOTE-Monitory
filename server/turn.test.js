import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FALLBACK_ICE_SERVERS,
  normalizeMeteredDomain,
  normalizeMeteredRegion,
  normalizeCloudflareTurnKeyId,
  normalizeCloudflareTurnTtl,
  sanitizeCloudflareIceServers,
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

test('validates Cloudflare TURN settings and removes browser-blocked port 53 URLs', () => {
  assert.equal(normalizeCloudflareTurnKeyId('A'.repeat(32)), 'a'.repeat(32));
  assert.equal(normalizeCloudflareTurnKeyId('wrong'), '');
  assert.equal(normalizeCloudflareTurnTtl('7200'), 7200);
  assert.equal(normalizeCloudflareTurnTtl('999999'), 86400);
  assert.deepEqual(sanitizeCloudflareIceServers([{
    urls: [
      'stun:stun.cloudflare.com:3478',
      'stun:stun.cloudflare.com:53',
      'turn:turn.cloudflare.com:3478?transport=udp',
      'turn:turn.cloudflare.com:53?transport=udp',
      'turns:turn.cloudflare.com:443?transport=tcp',
    ],
    username: 'user',
    credential: 'pass',
  }]), [{
    urls: [
      'stun:stun.cloudflare.com:3478',
      'turn:turn.cloudflare.com:3478?transport=udp',
      'turns:turn.cloudflare.com:443?transport=tcp',
    ],
    username: 'user',
    credential: 'pass',
  }]);
});
