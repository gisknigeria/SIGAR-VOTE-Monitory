import express from 'express';
import { recordAudit } from '../foundation/audit-helper.js';
import { openCsvWorkbook, openWorkbook } from '../voter-survey/xlsx.js';
import { buildDataset, DATASET_KINDS, describeDataset } from './datasets.js';
import { lgaLabel, oyoLgas } from './lga.js';
import { withBaseline } from './baseline.js';
import { buildMap } from './map.js';
import { buildPulse } from './pulse.js';

const CAN_VIEW = ['Stakeholder', 'Admin', 'Super Admin'];
const CAN_UPLOAD = ['Admin', 'Super Admin'];
const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;

const TEMPLATES = {
  members: () => 'LGA,Ward,Polling unit,Name,Phone number\nIbadan North,Ward 1,001,,\n',
  contacts: () => 'LGA,Phone number\nIbadan North,\n',
  reference: () => `LGA,Population,Registered voters,PVCs collected\n${oyoLgas().map((lga) => `${lgaLabel(lga.name)},,,`).join('\n')}\n`,
};

/**
 * GET    /api/pre-election/pulse?lga=        the Pulse for Oyo or one LGA (aggregates only)
 * GET    /api/pre-election/map?lga=&ward=    the sentiment map: 33 LGAs, one LGA's wards, or one ward's units
 * GET    /api/pre-election/datasets          uploaded datasets, without their rows (admins)
 * POST   /api/pre-election/datasets?kind=    upload a member list, contact list or reference table (admins)
 * DELETE /api/pre-election/datasets/:id      remove an upload (admins)
 * GET    /api/pre-election/templates/:kind   a blank CSV in the expected shape
 */
export function registerPreElectionRoutes({ app, auth, rateLimit, asyncRoute, store }) {
  const cache = new Map();
  const canView = (req, res) => {
    if (CAN_VIEW.includes(req.user?.role)) return true;
    res.status(403).json({ message: 'The pre-election pulse is available to stakeholders and administrators.' });
    return false;
  };
  const canUpload = (req, res) => {
    if (CAN_UPLOAD.includes(req.user?.role)) return true;
    res.status(403).json({ message: 'Only administrators can manage pre-election data.' });
    return false;
  };

  app.get('/api/pre-election/pulse', auth, rateLimit, asyncRoute(async (req, res) => {
    if (!canView(req, res)) return;
    const [uploaded, survey] = await Promise.all([store.preElectionDatasets(), store.voterSurvey()]);
    const datasets = withBaseline(uploaded);
    const lga = String(req.query.lga || '').slice(0, 80);
    const key = `${datasets.map((item) => item.id).sort().join(',')}|${survey?.id || ''}|${lga}`;
    if (!cache.has(key)) {
      if (cache.size > 100) cache.clear();
      cache.set(key, buildPulse({ datasets, survey, lga }));
    }
    res.set('Cache-Control', 'private, max-age=30');
    res.json({ ...cache.get(key), canUpload: CAN_UPLOAD.includes(req.user.role) });
  }));

  app.get('/api/pre-election/map', auth, rateLimit, asyncRoute(async (req, res) => {
    if (!canView(req, res)) return;
    const [uploaded, survey] = await Promise.all([store.preElectionDatasets(), store.voterSurvey()]);
    const datasets = withBaseline(uploaded);
    const lga = String(req.query.lga || '').slice(0, 80);
    const ward = /^\d{1,2}$/.test(String(req.query.ward || '')) ? String(Number(req.query.ward)) : '';
    const key = `map|${datasets.map((item) => item.id).sort().join(',')}|${survey?.id || ''}|${lga}|${ward}`;
    if (!cache.has(key)) {
      if (cache.size > 100) cache.clear();
      cache.set(key, buildMap({ datasets, survey, lga, ward }));
    }
    res.set('Cache-Control', 'private, max-age=30');
    res.json(cache.get(key));
  }));

  app.get('/api/pre-election/datasets', auth, rateLimit, asyncRoute(async (req, res) => {
    if (!canUpload(req, res)) return;
    const [uploaded, survey] = await Promise.all([store.preElectionDatasets(), store.voterSurvey()]);
    const datasets = withBaseline(uploaded);
    res.json({
      datasets: datasets.map(describeDataset).sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt))),
      survey: survey ? { id: survey.id, sourceFile: survey.sourceFile, importedAt: survey.importedAt, responses: survey.responseCount, builtIn: Boolean(survey.builtIn) } : null,
    });
  }));

  app.post(
    '/api/pre-election/datasets',
    auth,
    rateLimit,
    express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }),
    asyncRoute(async (req, res) => {
      if (!canUpload(req, res)) return;
      const kind = String(req.query.kind || '');
      if (!DATASET_KINDS.includes(kind)) return res.status(400).json({ message: `Choose a dataset type: ${DATASET_KINDS.join(', ')}.` });
      const fileName = String(req.query.fileName || 'upload.xlsx').slice(0, 200);
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'No file was received. Choose an Excel or CSV file and try again.' });
      let dataset;
      try {
        const isCsv = /\.csv$/i.test(fileName) || String(req.headers['content-type'] || '').includes('text/csv');
        dataset = buildDataset(kind, isCsv ? openCsvWorkbook(req.body) : openWorkbook(req.body), {
          label: req.query.label, source: req.query.source, year: req.query.year, sourceFile: fileName, uploadedBy: req.user.id,
        });
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
      const { replaced } = await store.savePreElectionDataset(dataset);
      cache.clear();
      await recordAudit(store, req, {
        action: 'pre_election.dataset_uploaded',
        entityType: 'dataset',
        entityId: dataset.id,
        details: { kind, label: dataset.label, sourceFile: fileName, replaced, ...dataset.summary, sheets: undefined, unmatched: dataset.summary.unmatched?.length },
        source: 'upload',
      });
      res.status(201).json({ ...describeDataset(dataset), replaced: replaced.length });
    }),
  );

  app.delete('/api/pre-election/datasets/:id', auth, rateLimit, asyncRoute(async (req, res) => {
    if (!canUpload(req, res)) return;
    const removed = await store.deletePreElectionDataset(String(req.params.id));
    if (!removed) return res.status(404).json({ message: 'That upload no longer exists.' });
    cache.clear();
    await recordAudit(store, req, { action: 'pre_election.dataset_deleted', entityType: 'dataset', entityId: removed.id, details: { kind: removed.kind, label: removed.label, sourceFile: removed.sourceFile } });
    res.status(204).end();
  }));

  app.get('/api/pre-election/templates/:kind', auth, rateLimit, (req, res) => {
    const template = TEMPLATES[req.params.kind];
    if (!template) return res.status(404).json({ message: 'Unknown template.' });
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="pre-election-${req.params.kind}-template.csv"`);
    res.send(template());
  });
}
