import jwt from 'jsonwebtoken';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createId } from '../../security.js';

const issuer = 'sigar-election-api';
const audience = 'sigar-media-service';

export function createMediaAuth({ secret = process.env.MEDIA_SERVICE_SHARED_SECRET || process.env.JWT_SECRET, store, canAccessGeography }) {
  if (!secret) throw new Error('MEDIA_SERVICE_SHARED_SECRET or JWT_SECRET is required for media authorization.');
  const issueMediaToken = ({ user, cameraId = '', mode = 'view', geography = {}, ttlSeconds = 120 }) => {
    if (!['publish', 'view'].includes(mode)) throw new Error('Invalid media token mode.');
    if (!user?.id || !cameraId) throw new Error('Authenticated user and camera ID are required.');
    if (!canAccessGeography(user, geography) && !['Admin', 'Super Admin'].includes(user.role)) throw new Error('User is not authorized for this camera geography.');
    return jwt.sign({ sub: user.id, jti: createId('media'), cameraId, mode, geography, scope: [`camera:${cameraId}:${mode}`] }, secret, { algorithm: 'HS256', issuer, audience, expiresIn: Math.min(300, Math.max(30, Number(ttlSeconds) || 120)) });
  };
  const verifyMediaToken = (token) => jwt.verify(token, secret, { algorithms: ['HS256'], issuer, audience });
  const signCallback = (payload) => {
    const body = JSON.stringify(payload);
    return { body, signature: createHmac('sha256', secret).update(body).digest('hex') };
  };
  const verifyCallback = (body, signature) => {
    const expected = createHmac('sha256', secret).update(body).digest();
    const actual = Buffer.from(String(signature || ''), 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  };
  return { issueMediaToken, verifyMediaToken, signCallback, verifyCallback, store };
}