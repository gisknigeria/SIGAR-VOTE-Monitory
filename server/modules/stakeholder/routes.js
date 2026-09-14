import { buildStakeholderOverview, countScope, STAKEHOLDER_PHASES } from './overview.js';

export const STAKEHOLDER_ROLE = 'Stakeholder';
const CAN_VIEW = [STAKEHOLDER_ROLE, 'Admin', 'Super Admin'];

/**
 * The one endpoint a stakeholder account can reach. Everything else in the platform already
 * refuses an unknown role by default -- incidents, chat rooms and the user list all return
 * nothing for a Stakeholder -- so this is deliberately the whole of their surface rather than a
 * relaxed version of the operational reporting endpoints, which carry detail observers should
 * not have.
 */
export function registerStakeholderRoutes({ app, auth, rateLimit, asyncRoute, store }) {
  const scope = countScope();

  app.get(
    '/api/stakeholder/overview',
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      if (!CAN_VIEW.includes(req.user?.role))
        return res.status(403).json({ message: 'This view is available to stakeholders and administrators.' });

      const phase = STAKEHOLDER_PHASES.includes(req.query.phase) ? req.query.phase : 'election-day';

      let registeredVoters = null;
      let registeredVotersBasis = '';
      try {
        const datasets = await store.demographicDatasets({ metric: 'registered-voters', status: 'approved' });
        const latest = [...datasets].sort((a, b) => String(b.publicationDate || '').localeCompare(String(a.publicationDate || '')))[0];
        const total = (latest?.records || []).reduce((sum, record) => sum + (Number(record.value) || 0), 0);
        if (total > 0) {
          registeredVoters = total;
          registeredVotersBasis = `${latest.sourceName} (${latest.resolution} level)`;
        }
      } catch {
        // A missing or unreadable dataset must not take the stakeholder view down; it simply
        // means turnout is reported as unavailable, which the payload already handles.
      }

      res.set('Cache-Control', 'private, max-age=15');
      const [incidents, users, resourceReadiness, tasks] = await Promise.all([
        store.incidents(),
        store.users(),
        store.resourceAdequacy ? store.resourceAdequacy() : [],
        store.tasks ? store.tasks() : [],
      ]);

      res.json(
        buildStakeholderOverview({
          incidents,
          users,
          resourceReadiness,
          tasks,
          registeredVoters,
          registeredVotersBasis,
          phase,
          scope,
        }),
      );
    }),
  );
}
