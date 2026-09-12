import { randomUUID } from 'node:crypto';

const RESOLUTIONS = new Set(['state', 'lga', 'ward', 'polling-unit']);
const OBSERVATION_TYPES = new Set(['measured', 'estimated']);
const TECHNOLOGIES = new Set(['2G', '3G', '4G', '5G', 'LTE', 'fixed-wireless', 'fiber', 'satellite', 'unknown']);
const geographyOf = (value = {}) => ({ state: String(value.state || '').trim(), lga: String(value.lga || '').trim(), ward: String(value.ward || '').trim(), pollingUnit: String(value.pollingUnit || '').trim() });
const matches = (record, filter = {}) => Object.entries(geographyOf(filter)).every(([key, value]) => !value || String(record.geography?.[key] || '').toLowerCase() === String(value).toLowerCase());

export function createConnectivityRepository({ pool, jsonDb, saveJson }) {
  const read = async () => {
    if (!pool) { jsonDb.connectivityDatasets ||= {}; return Object.values(jsonDb.connectivityDatasets); }
    return (await pool.query("select value from app_settings where key like 'connectivity-dataset:%' order by key")).rows.map((row) => row.value);
  };
  const save = async (dataset) => {
    if (!pool) { jsonDb.connectivityDatasets ||= {}; jsonDb.connectivityDatasets[`connectivity-dataset:${dataset.id}`] = dataset; saveJson(); return dataset; }
    await pool.query('insert into app_settings (key,value) values ($1,$2) on conflict (key) do update set value=excluded.value', [`connectivity-dataset:${dataset.id}`, JSON.stringify(dataset)]);
    return dataset;
  };
  const validateRecord = (record, index, resolution) => {
    const geography = geographyOf(record.geography || record);
    if (!Object.values(geography).some(Boolean)) throw new Error(`A geographic key is required at row ${index + 1}.`);
    if (!RESOLUTIONS.has(resolution)) throw new Error(`Resolution must be one of: ${[...RESOLUTIONS].join(', ')}.`);
    const technologies = [...new Set((Array.isArray(record.technologies) ? record.technologies : []).map((item) => String(item).trim()).filter(Boolean))];
    if (technologies.some((technology) => !TECHNOLOGIES.has(technology))) throw new Error(`Unsupported connectivity technology at row ${index + 1}.`);
    const hasBaseStation = record.baseStation && typeof record.baseStation === 'object';
    const baseStation = hasBaseStation && record.baseStation.authorized === true ? { id: String(record.baseStation.id || '').trim(), latitude: record.baseStation.latitude ?? null, longitude: record.baseStation.longitude ?? null, authorized: true } : null;
    return { geography, technologies, observationType: OBSERVATION_TYPES.has(record.observationType) ? record.observationType : 'estimated', provider: String(record.provider || '').trim() || 'unknown', coverage: record.coverage ?? null, signal: record.signal ?? null, measuredAt: record.measuredAt || null, baseStation, redundancy: { providers: Array.isArray(record.redundancy?.providers) ? record.redundancy.providers.map((item) => String(item).trim()).filter(Boolean) : [], technologies: Array.isArray(record.redundancy?.technologies) ? record.redundancy.technologies.map((item) => String(item).trim()).filter(Boolean) : [] } };
  };
  return {
    async ingestConnectivityDataset({ sourceId, sourceName, sourceUrl = '', sourceVersion, publicationDate = null, methodology, resolution, records, providerApiContract = null, ingestedBy = '' }) {
      if (!String(sourceId || '').trim() || !String(sourceName || '').trim() || !String(sourceVersion || '').trim()) throw new Error('sourceId, sourceName, and sourceVersion are required.');
      if (!String(methodology || '').trim()) throw new Error('Methodology is required.');
      if (!RESOLUTIONS.has(resolution)) throw new Error(`Resolution must be one of: ${[...RESOLUTIONS].join(', ')}.`);
      if (!Array.isArray(records) || !records.length) throw new Error('Connectivity dataset records are required.');
      const dataset = { id: randomUUID(), sourceId: String(sourceId).trim(), sourceName: String(sourceName).trim(), sourceUrl: String(sourceUrl || '').trim(), sourceVersion: String(sourceVersion).trim(), publicationDate: publicationDate ? new Date(publicationDate).toISOString() : null, methodology: String(methodology).trim(), resolution, providerApiContract: providerApiContract || null, records: records.map((record, index) => validateRecord(record, index, resolution)), status: 'pending-approval', ingestedBy: String(ingestedBy || '').trim(), ingestedAt: new Date().toISOString() };
      return save(dataset);
    },
    async approveConnectivityDataset(id, { approvedBy = '' } = {}) {
      const dataset = (await read()).find((item) => item.id === id);
      if (!dataset) return null;
      if (!String(approvedBy || '').trim()) throw new Error('Authenticated approval attribution is required.');
      return save({ ...dataset, status: 'approved', approvedBy: String(approvedBy).trim(), approvedAt: new Date().toISOString() });
    },
    async connectivityDatasets({ provider, resolution, status = 'approved' } = {}) { return (await read()).filter((item) => (!resolution || item.resolution === resolution) && (!provider || item.records.some((record) => record.provider === provider)) && (!status || item.status === status)); },
    async connectivityAnalysis({ geography = {} } = {}) {
      const datasets = (await read()).filter((dataset) => dataset.status === 'approved');
      const records = datasets.flatMap((dataset) => dataset.records.filter((record) => matches(record, geography)).map((record) => ({ ...record, datasetId: dataset.id, sourceId: dataset.sourceId, sourceVersion: dataset.sourceVersion, publicationDate: dataset.publicationDate, methodology: dataset.methodology })));
      const providers = [...new Set(records.map((record) => record.provider).filter((provider) => provider !== 'unknown'))];
      const technologies = [...new Set(records.flatMap((record) => record.technologies))];
      const measured = records.filter((record) => record.observationType === 'measured');
      const estimated = records.filter((record) => record.observationType === 'estimated');
      const hasRedundancy = providers.length > 1 || records.some((record) => record.redundancy.providers.length > 1 || record.redundancy.technologies.length > 1);
      return { geography, providers, technologies, records, measuredCount: measured.length, estimatedCount: estimated.length, baseStations: records.filter((record) => record.baseStation?.authorized === true).map((record) => record.baseStation), redundancy: { available: hasRedundancy, providerCount: providers.length, limitation: hasRedundancy ? null : 'No sourced provider or technology redundancy was available for this geography.' }, planning: { liveCoverageStatus: measured.length ? 'measured-observations-available' : estimated.length ? 'estimated-only' : 'unknown', offlineRequirements: measured.length ? [] : ['Treat connectivity as uncertain.', 'Pre-cache forms and attachments.', 'Queue submissions for retry.', 'Do not infer MNO coverage from TURN availability.'] } };
    },
  };
}
