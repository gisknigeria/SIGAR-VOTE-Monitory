import { baselineSurvey } from '../pre-election/baseline.js';

const KEY = 'voter-survey:current';

/**
 * One current survey dataset, stored the same way as the other reference datasets
 * (app_settings in Postgres, the JSON file locally). A new import replaces the old one; the
 * audit log records who imported what and when.
 *
 * The dataset is read on every analysis request, so the parsed copy is kept in memory and only
 * re-read when a newer import has been saved. Until the first import, the survey that ships with
 * the app (see pre-election/baseline.js) is used, and an import is added to it.
 */
export function createVoterSurveyRepository({ pool, jsonDb, saveJson }) {
  let cached = null;
  return {
    async saveVoterSurvey(dataset) {
      if (!pool) {
        jsonDb.voterSurvey = dataset;
        saveJson();
      } else {
        await pool.query('insert into app_settings (key,value) values ($1,$2) on conflict (key) do update set value=excluded.value', [KEY, JSON.stringify(dataset)]);
      }
      cached = dataset;
      return dataset;
    },
    async voterSurvey() {
      if (!pool) return jsonDb.voterSurvey || baselineSurvey();
      if (cached) {
        // A cheap freshness check so a second server instance picks up a new import.
        const probe = await pool.query("select value->>'id' as id from app_settings where key=$1", [KEY]);
        if (probe.rows[0]?.id === cached.id) return cached;
      }
      const result = await pool.query('select value from app_settings where key=$1', [KEY]);
      cached = result.rows[0]?.value || null;
      return cached || baselineSurvey();
    },
  };
}
