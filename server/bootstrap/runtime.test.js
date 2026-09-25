import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseConnection } from './runtime.js';

test('database connections verify certificates and accept a provider CA', () => {
  const url = 'postgresql://app:p%40ss@db.example.com:25060/defaultdb?sslmode=require&application_name=monitor';
  const plain = databaseConnection(url, {});
  assert.equal(plain.connectionString, 'postgresql://app:p%40ss@db.example.com:25060/defaultdb?application_name=monitor');
  assert.deepEqual(plain.ssl, { rejectUnauthorized: true });

  const pem = '-----BEGIN CERTIFICATE-----\\nMIIB\\n-----END CERTIFICATE-----';
  const withCa = databaseConnection(url, { DATABASE_CA_CERT: pem });
  assert.equal(withCa.ssl.rejectUnauthorized, true);
  assert.equal(withCa.ssl.ca, '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----');

  assert.equal(databaseConnection(url, { DATABASE_SSL: 'disable' }).ssl, false);
  assert.equal(databaseConnection('postgres://localhost/app?sslmode=disable', {}).ssl, false);
});
