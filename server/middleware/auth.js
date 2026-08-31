import jwt from 'jsonwebtoken';
import { credentialFingerprint, createId } from '../security.js';

const tokenOptions = {
  algorithms: ['HS256'],
  issuer: 'election-monitor-api',
  audience: 'election-monitor-web',
};

export const isAdminRole = user => ['Admin', 'Super Admin'].includes(user?.role);
export const adminOnly = (req, res, next) => isAdminRole(req.user)
  ? next()
  : res.status(403).json({ message: 'Admin access required' });
export const superAdminOnly = (req, res, next) => req.user?.role === 'Super Admin'
  ? next()
  : res.status(403).json({ message: 'System administrator access required' });

export function createAuth({ secret, store, publicUser, asyncRoute }) {
  const sessionTtl = process.env.SESSION_TTL || '30d';
  const sessionCookieMaxAge = Math.max(3600, Number(process.env.SESSION_COOKIE_MAX_AGE) || 30 * 24 * 60 * 60);
  const issueToken = user => jwt.sign(
    { sub: user.id, fp: credentialFingerprint(user.password) },
    secret,
    {
      algorithm: 'HS256',
      issuer: tokenOptions.issuer,
      audience: tokenOptions.audience,
      expiresIn: sessionTtl,
      jwtid: createId('jwt'),
    },
  );
  const sessionCookie = token => `__Host-session=${encodeURIComponent(token)}; Path=/; Max-Age=${sessionCookieMaxAge}; HttpOnly; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  const clearSessionCookie = '__Host-session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict';
  const cookieValue = (req, name) => String(req.headers.cookie || '')
    .split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  const authenticateToken = async token => {
    const claims = jwt.verify(token, secret, tokenOptions);
    const user = (await store.users()).find(candidate => candidate.id === claims.sub);
    if (!user || !user.active || claims.fp !== credentialFingerprint(user.password)) throw new Error('Invalid session');
    return publicUser(user);
  };
  const auth = asyncRoute(async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : cookieValue(req, '__Host-session');
    if (!token) return res.status(401).json({ message: 'Authentication required.' });
    try {
      req.user = await authenticateToken(token);
      next();
    } catch {
      res.status(401).json({ message: 'Session expired. Please sign in again.' });
    }
  });

  return { issueToken, sessionCookie, clearSessionCookie, authenticateToken, auth };
}
