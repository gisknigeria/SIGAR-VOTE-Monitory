import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { aggregateAgents } from '../../shared/areaAnalysis.js';
import { getRegistrationLocationOptions } from '../../shared/electionData.js';

export const OPERATION_TYPES = ['Observer coverage', 'Training', 'Logistics', 'Accessibility'];
export function validateOperation(body) {
  const text = (key, length) => typeof body?.[key] === 'string' ? body[key].trim().slice(0, length) : '';
  const plan = { title: text('title', 120), category: text('category', 40), lga: text('lga', 100), ward: text('ward', 150), date: text('date', 10), notes: text('notes', 2000) };
  if (!plan.title || !OPERATION_TYPES.includes(plan.category)) throw new Error('Enter a title and valid operation type.');
  const options = getRegistrationLocationOptions('Oyo', plan.lga);
  if (!options.lgas.includes(plan.lga) || (plan.ward && !options.wards.includes(plan.ward))) throw new Error('Select a valid Oyo LGA and ward.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.date) || !Number.isFinite(Date.parse(plan.date)) || new Date(plan.date).toISOString().slice(0, 10) !== plan.date) throw new Error('Select a valid operation date.');
  return plan;
}

export function createAreaOperationsRouter({ auth, adminOnly, rateLimit, asyncRoute, store }) {
  const router = Router();
  router.use(auth, adminOnly, rateLimit);
  router.get('/agents', asyncRoute(async (_req, res) => res.json(aggregateAgents(await store.users()))));
  router.get('/plans', asyncRoute(async (_req, res) => res.json(await store.operationPlans())));
  router.post('/plans', asyncRoute(async (req, res) => {
    let value;
    try { value = validateOperation(req.body); } catch (error) { return res.status(400).json({ message: error.message }); }
    const plan = { ...value, id: randomUUID(), createdAt: new Date().toISOString(), createdBy: req.user.id };
    await store.setSetting(`area-operation:${plan.id}`, plan);
    return res.status(201).json(plan);
  }));
  router.delete('/plans/:id', asyncRoute(async (req, res) => {
    if (!/^[0-9a-f-]{36}$/.test(req.params.id)) return res.status(400).json({ message: 'Invalid plan identifier.' });
    await store.deleteOperationPlan(req.params.id);
    res.sendStatus(204);
  }));
  return router;
}
