import express from 'express';
import { getRegistrationLocationOptions } from '../../../shared/electionData.js';
import { recordAudit } from '../foundation/audit-helper.js';
import { openWorkbook } from './xlsx.js';
import { buildSurveyDataset } from './import.js';
import { analyzeSurvey, lgaKey } from './analysis.js';

const CAN_VIEW = ['Stakeholder', 'Admin', 'Super Admin'];
const CAN_IMPORT = ['Admin', 'Super Admin'];
const MAX_WORKBOOK_BYTES = 40 * 1024 * 1024;

/** Polling units per LGA, from the bundled INEC register -- the fallback weighting. */
function pollingUnitWeights() {
  const weights = new Map();
  for (const lga of getRegistrationLocationOptions('Oyo').lgas) {
    let units = 0;
    for (const ward of getRegistrationLocationOptions('Oyo', lga).wards) units += getRegistrationLocationOptions('Oyo', lga, ward).pollingUnits.length;
    if (units) weights.set(lgaKey(lga), units);
  }
  return weights;
}

/**
 * GET  /api/voter-survey          the analysis (optional ?lga= and ?respondent= filters)
 * POST /api/voter-survey/import   replace the survey with a new workbook (admins only)
 *
 * Only aggregates leave the server. The stored dataset itself -- even anonymised -- is never
 * returned, and written-answer examples are shown only once a phrase recurs, so a single
 * respondent's words cannot be picked out.
 */
export function registerVoterSurveyRoutes({ app, auth, rateLimit, asyncRoute, store }) {
  const fallbackWeights = pollingUnitWeights();
  const cache = new Map();

  const weightsFor = async () => {
    try {
      const datasets = await store.demographicDatasets({ metric: 'registered-voters', resolution: 'lga', status: 'approved' });
      const latest = [...datasets].sort((a, b) => String(b.publicationDate || '').localeCompare(String(a.publicationDate || '')))[0];
      if (latest?.records?.length) {
        const weights = new Map(latest.records.map((record) => [lgaKey(record.geography?.lga), Number(record.value) || 0]).filter(([key, value]) => key && value > 0));
        if (weights.size >= 20) return { weights, basis: `registered voters per LGA (${latest.sourceName})` };
      }
    } catch {
      // Fall through to the polling-unit proxy.
    }
    return { weights: fallbackWeights, basis: 'number of polling units per LGA (a stand-in for voter numbers until an approved registered-voter dataset is loaded)' };
  };

  app.get('/api/voter-survey', auth, rateLimit, asyncRoute(async (req, res) => {
    if (!CAN_VIEW.includes(req.user?.role)) return res.status(403).json({ message: 'The voter survey is available to stakeholders and administrators.' });
    const dataset = await store.voterSurvey();
    if (!dataset) return res.json({ status: 'empty', canImport: CAN_IMPORT.includes(req.user.role) });

    const filter = { lga: String(req.query.lga || '').slice(0, 80), respondent: String(req.query.respondent || '').slice(0, 80) };
    const key = `${dataset.id}|${filter.lga}|${filter.respondent}`;
    if (!cache.has(key)) {
      if (cache.size > 200) cache.clear();
      const { weights, basis } = await weightsFor();
      cache.set(key, analyzeSurvey(dataset, filter, { lgaWeights: weights, weightBasis: basis }));
    }
    res.set('Cache-Control', 'private, max-age=60');
    res.json({ status: 'ok', canImport: CAN_IMPORT.includes(req.user.role), ...cache.get(key) });
  }));

  app.post(
    '/api/voter-survey/import',
    auth,
    rateLimit,
    express.raw({ type: () => true, limit: MAX_WORKBOOK_BYTES }),
    asyncRoute(async (req, res) => {
      if (!CAN_IMPORT.includes(req.user?.role)) return res.status(403).json({ message: 'Only administrators can import the voter survey.' });
      const fileName = String(req.query.fileName || 'survey.xlsx').slice(0, 200);
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'No file was received. Choose the survey .xlsx workbook and try again.' });

      let dataset;
      try {
        dataset = buildSurveyDataset(openWorkbook(req.body), { sourceFile: fileName, importedBy: req.user.id });
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
      if (!dataset.responseCount) return res.status(400).json({ message: 'The survey sheet has no responses.' });

      await store.saveVoterSurvey(dataset);
      cache.clear();
      await recordAudit(store, req, {
        action: 'voter_survey.imported',
        entityType: 'dataset',
        entityId: dataset.id,
        details: { sourceFile: dataset.sourceFile, sheet: dataset.sourceSheet, responses: dataset.responseCount, collectors: dataset.agentCount },
        source: 'upload',
      });

      // Prove the import read what Excel read: compare with the workbook's own headline totals.
      const analysis = analyzeSurvey(dataset);
      const totals = dataset.workbookTotals || {};
      const checks = [
        ['Total responses', totals.responses, dataset.responseCount],
        ['Named-candidate answers', totals.namedVotes, analysis.vote.named],
        ['Sen. Alli first-choice votes', totals.focusVotes, analysis.focus?.votes],
      ].filter(([, expected]) => Number.isFinite(expected)).map(([label, expected, actual]) => ({ label, workbook: expected, imported: actual, matches: expected === actual }));

      res.status(201).json({ id: dataset.id, sourceFile: dataset.sourceFile, sheet: dataset.sourceSheet, responses: dataset.responseCount, collectors: dataset.agentCount, fields: dataset.fields.length, checks });
    }),
  );
}
