export const FALLBACK_ICE_SERVERS = Object.freeze([
  Object.freeze({ urls: 'stun:stun.l.google.com:19302' }),
]);

const supportedRegions = new Set([
  'global', 'north_america', 'europe', 'eu', 'asia', 'oceania',
  'us_west', 'us_central', 'us_east', 'canada_central', 'canada_east',
  'europe_west', 'europe_central', 'asia_west', 'asia_east', 'middle_east',
  'canada', 'usa', 'uk', 'singapore', 'india', 'australia', 'france',
  'germany', 'italy', 'japan', 'sweden', 'spain', 'netherlands', 'qatar',
  'standard',
]);

export const normalizeMeteredDomain = value => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== 'https:' || url.port || url.pathname !== '/' || url.search || url.hash) return '';
    return /^[a-z0-9-]+\.metered\.live$/i.test(url.hostname)
      ? url.hostname.toLowerCase()
      : '';
  } catch {
    return '';
  }
};

export const normalizeMeteredRegion = value => {
  const region = String(value || 'standard').trim().toLowerCase();
  return supportedRegions.has(region) ? region : 'standard';
};

const validIceUrl = value =>
  typeof value === 'string' &&
  value.length <= 500 &&
  /^(stun|turn|turns):[^\s]+$/i.test(value);

export const sanitizeIceServers = value => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const urls = Array.isArray(item.urls)
      ? item.urls.filter(validIceUrl).slice(0, 8)
      : validIceUrl(item.urls) ? item.urls : null;
    if (!urls || (Array.isArray(urls) && !urls.length)) return [];
    const server = { urls };
    if (typeof item.username === 'string' && item.username.length <= 500) server.username = item.username;
    if (typeof item.credential === 'string' && item.credential.length <= 500) server.credential = item.credential;
    return [server];
  });
};
