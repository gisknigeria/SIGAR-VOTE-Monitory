import test from 'node:test';
import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { caCertificates, databaseConnection } from './runtime.js';

// A throwaway self-signed test certificate (no private key is kept anywhere).
const PEM = [
  '-----BEGIN CERTIFICATE-----',
  'MIIBfTCCASOgAwIBAgIUKI6sUj/YR5S2T2P6nMsj8Kl6/B4wCgYIKoZIzj0EAwIw',
  'FDESMBAGA1UEAwwJdGVzdC1yb290MB4XDTI2MDkyNTA2MDkwMloXDTM2MDkyMjA2',
  'MDkwMlowFDESMBAGA1UEAwwJdGVzdC1yb290MFkwEwYHKoZIzj0CAQYIKoZIzj0D',
  'AQcDQgAEmdzRvvMWVpmVA48x8sr6yG7yKfxGW9+MjV51WEGFM52yblNr+2uZAdOl',
  'kOsLOLywWJBQtUuQ3SbIcdspCcuDs6NTMFEwHQYDVR0OBBYEFBSQxSdpw67o9QdP',
  'hv0Dkepi/ku2MB8GA1UdIwQYMBaAFBSQxSdpw67o9QdPhv0Dkepi/ku2MA8GA1Ud',
  'EwEB/wQFMAMBAf8wCgYIKoZIzj0EAwIDSAAwRQIgZS5JSZiJm01f+OBnw8TaERXS',
  '+WZjvjL/Uuwf0XmFvLMCIQDWFXzz6sT7R3J6aefHyKMkkMUNcnsD/WBzCiLiUW2/',
  '4A==',
  '-----END CERTIFICATE-----',
].join('\n');

test('database connections verify certificates and accept a provider CA', () => {
  const url = 'postgresql://app:p%40ss@db.example.com:25060/defaultdb?sslmode=require&application_name=monitor';
  const plain = databaseConnection(url, {});
  assert.equal(plain.connectionString, 'postgresql://app:p%40ss@db.example.com:25060/defaultdb?application_name=monitor');
  assert.deepEqual(plain.ssl, { rejectUnauthorized: true });

  const withCa = databaseConnection(url, { DATABASE_CA_CERT: PEM });
  assert.equal(withCa.ssl.rejectUnauthorized, true);
  assert.equal(withCa.ssl.ca.length, 1);

  assert.equal(databaseConnection(url, { DATABASE_SSL: 'disable' }).ssl, false);
  assert.equal(databaseConnection('postgres://localhost/app?sslmode=disable', {}).ssl, false);
});

test('a CA pasted with its line breaks flattened is rebuilt into a readable PEM', () => {
  const expected = new X509Certificate(PEM).fingerprint256;
  const pastes = [PEM, PEM.replace(/\n/g, ' '), PEM.replace(/\n/g, '\\n'), `"${PEM.replace(/\n/g, '\r\n')}"`];
  for (const pasted of pastes) {
    const certs = caCertificates(pasted);
    assert.equal(certs.length, 1);
    assert.equal(new X509Certificate(certs[0]).fingerprint256, expected);
  }
  assert.equal(caCertificates(`${PEM}\n${PEM}`).length, 2);
  assert.deepEqual(caCertificates(''), []);
  assert.deepEqual(caCertificates('not a certificate'), []);
  assert.deepEqual(caCertificates('-----BEGIN CERTIFICATE----- -----END CERTIFICATE-----'), []);
});
