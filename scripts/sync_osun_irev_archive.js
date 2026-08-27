import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_ORIGIN = 'https://dolphin-app-sleqh.ondigitalocean.app';
const ELECTION_ID = '6a7f788adcbc755a763f082a';
const PORTAL_URL = `https://irev.inecnigeria.org/elections/${ELECTION_ID}`;
const IMAGE_HOSTS = new Set([
  'inc-s3-cache.incportals.com',
  'etransmission-result-docs.s3.eu-west-2.amazonaws.com',
]);

const fetchData = async (path) => {
  const response = await fetch(`${API_ORIGIN}/api/v1/${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Election-Monitor/1.0 IReV archive sync' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`IReV returned ${response.status} for ${path}`);
  const payload = await response.json();
  if (!payload?.success) throw new Error(`IReV returned an invalid response for ${path}`);
  return payload.data;
};

const trustedImageUrl = (value) => {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && IMAGE_HOSTS.has(url.hostname) ? url.href : '';
  } catch {
    return '';
  }
};

const [stats, units] = await Promise.all([
  fetchData(`elections/${ELECTION_ID}/result/stats`),
  fetchData(`elections/${ELECTION_ID}/pus`),
]);

const uploads = (Array.isArray(units) ? units : [])
  .map((item) => {
    const pollingUnit = item?.polling_unit || {};
    return {
      id: String(item?._id || '').trim(),
      puCode: String(item?.pu_code || pollingUnit.pu_code || '').trim(),
      pollingUnit: String(item?.name || pollingUnit.name || '').trim(),
      lga: String(pollingUnit?.lga?.name || '').trim(),
      ward: String(pollingUnit?.ward?.name || '').trim(),
      uploadedAt: item?.document?.updated_at || item?.updated_at || '',
      imageUrl: trustedImageUrl(item?.document?.url),
      sourceUrl: PORTAL_URL,
      verificationStatus: 'Archived IReV image',
    };
  })
  .filter((item) => item.id && item.puCode && item.imageUrl)
  .sort((a, b) => `${a.lga}|${a.ward}|${a.puCode}`.localeCompare(`${b.lga}|${b.ward}|${b.puCode}`));

if (!uploads.length) throw new Error('IReV returned no result-sheet images to archive.');

const archive = {
  pilot: true,
  configured: true,
  state: 'Osun',
  electionId: ELECTION_ID,
  electionName: String(units?.[0]?.election?.full_name || 'Osun governorship election'),
  portalUrl: PORTAL_URL,
  submitted: Math.max(uploads.length, Number(stats?.documents) || 0),
  expected: Math.max(0, Number(stats?.expected ?? stats?.pus) || 0),
  latestUploadAt: stats?.latest?.document?.updated_at || stats?.latest?.updated_at || uploads[0]?.uploadedAt || '',
  uploads,
  fetchedAt: new Date().toISOString(),
  archivedAt: new Date().toISOString(),
  offline: true,
  refreshIntervalMs: 300_000,
  notice: '',
};

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = join(scriptDirectory, '..', 'server', 'data', 'osunIrevArchive.json');
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(archive)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, uploads: uploads.length, submitted: archive.submitted, expected: archive.expected }));
