import { randomUUID } from 'node:crypto';

const RESOLUTIONS = new Set(['country', 'state', 'lga', 'ward', 'polling-unit']);
const PERSONAL_FIELDS = new Set(['name', 'fullName', 'firstName', 'lastName', 'email', 'phone', 'address', 'dateOfBirth', 'dob', 'nationalId', 'voterId', 'nin']);
const numberOrNull = (value) => value === null || value === undefined || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const geographyOf = (value = {}) => ({ state: String(value.state || '').trim(), lga: String(value.lga || '').trim(), ward: String(value.ward || '').trim(), pollingUnit: String(value.pollingUnit || '').trim() });
const keyOf = (dataset, record) => `${dataset.sourceId}:${dataset.sourceVersion}:${dataset.metric}:${dataset.resolution}:${JSON.stringify(geographyOf(record.geography || record))}`;

export function createDemographicsRepository({ pool, jsonDb, saveJson }) {
  const read = async () => {
    if (!pool) { jsonDb.demographicDatasets ||= {}; return Object.values(jsonDb.demographicDatasets); }
    return (await pool.query("select value from app_settings where key like 'demographic-dataset:%' order by key")).rows.map((row) => row.value);
  };
  const save = async (dataset) => {
    if (!pool) { jsonDb.demographicDatasets ||= {}; jsonDb.demographicDatasets[`demographic-dataset:${dataset.id}`] = dataset; saveJson(); return dataset; }
    await pool.query('insert into app_settings (key,value) values ($1,$2) on conflict (key) do update set value=excluded.value', [`demographic-dataset:${dataset.id}`, JSON.stringify(dataset)]);
    return dataset;
  };
  const validateRecord = (record, index) => {
    const personal = Object.keys(record || {}).find((key) => PERSONAL_FIELDS.has(key));
    if (personal) throw new Error(`Aggregate demographic datasets cannot contain personal field '${personal}' at row ${index + 1}.`);
    const geography = geographyOf(record.geography || record);
    if (!Object.values(geography).some(Boolean)) throw new Error(`A geographic key is required at row ${index + 1}.`);
    const value = numberOrNull(record.value ?? record.count ?? record.population ?? record.registeredVoters);
    if (value === null || value < 0) throw new Error(`A non-negative aggregate value is required at row ${index + 1}.`);
    return { geography, value, uncertainty: record.uncertainty ?? null, unit: String(record.unit || 'persons').trim() || 'persons' };
  };
  return {
    async ingestDemographicDataset({ sourceId, sourceName, sourceUrl = '', sourceVersion, metric, resolution, publicationDate, methodology, uncertainty = null, records, ingestedBy = '' }) {
      if (!String(sourceId || '').trim() || !String(sourceName || '').trim() || !String(sourceVersion || '').trim()) throw new Error('sourceId, sourceName, and sourceVersion are required.');
      if (!['population', 'registered-voters', 'demographic'].includes(String(metric || '').trim())) throw new Error('Metric must be population, registered-voters, or demographic.');
      if (!RESOLUTIONS.has(resolution)) throw new Error(`Resolution must be one of: ${[...RESOLUTIONS].join(', ')}.`);
      if (!publicationDate || !Number.isFinite(Date.parse(publicationDate))) throw new Error('A valid publication date is required.');
      if (!String(methodology || '').trim()) throw new Error('Methodology is required.');
      if (!Array.isArray(records) || !records.length) throw new Error('Aggregate dataset records are required.');
      const dataset = { id: randomUUID(), sourceId: String(sourceId).trim(), sourceName: String(sourceName).trim(), sourceUrl: String(sourceUrl || '').trim(), sourceVersion: String(sourceVersion).trim(), metric, resolution, publicationDate: new Date(publicationDate).toISOString(), methodology: String(methodology).trim(), uncertainty, records: records.map(validateRecord), status: 'pending-approval', ingestedBy: String(ingestedBy || '').trim(), ingestedAt: new Date().toISOString() };
      return save(dataset);
    },
    async approveDemographicDataset(id, { approvedBy = '' } = {}) {
      const dataset = (await read()).find((item) => item.id === id);
      if (!dataset) return null;
      if (!String(approvedBy || '').trim()) throw new Error('Authenticated approval attribution is required.');
      return save({ ...dataset, status: 'approved', approvedBy: String(approvedBy).trim(), approvedAt: new Date().toISOString() });
    },
    async demographicDatasets({ metric, resolution, status = 'approved' } = {}) { return (await read()).filter((item) => (!metric || item.metric === metric) && (!resolution || item.resolution === resolution) && (!status || item.status === status)); },
    async demographicAnalysis({ geography = {}, populationDatasetId = '', registeredVotersDatasetId = '' } = {}) {
      const datasets = await read();
      const find = (id, metric) => datasets.find((item) => item.id === id && item.status === 'approved' && item.metric === metric);
      const population = find(populationDatasetId, 'population');
      const voters = find(registeredVotersDatasetId, 'registered-voters');
      const select = (dataset) => dataset?.records.find((record) => Object.entries(geography).every(([key, value]) => !value || record.geography[key].toLowerCase() === String(value).toLowerCase())) || null;
      const populationRecord = select(population);
      const voterRecord = select(voters);
      const ratio = populationRecord?.value !== null && populationRecord?.value !== undefined && voterRecord?.value !== null && populationRecord.value > 0 ? Number((voterRecord.value / populationRecord.value).toFixed(4)) : null;
      return { geography, population: populationRecord ? { value: populationRecord.value, uncertainty: populationRecord.uncertainty, datasetId: population.id, publicationDate: population.publicationDate, sourceVersion: population.sourceVersion, methodology: population.methodology } : null, registeredVoters: voterRecord ? { value: voterRecord.value, uncertainty: voterRecord.uncertainty, datasetId: voters.id, publicationDate: voters.publicationDate, sourceVersion: voters.sourceVersion, methodology: voters.methodology } : null, registeredVoterToPopulationRatio: ratio, estimateStatus: ratio === null ? 'unknown' : 'observed-comparison-only' };
    },
  };
}
