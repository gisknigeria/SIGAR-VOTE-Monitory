import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { aggregateAgents } from '../../shared/areaAnalysis.js';
import { getRegistrationLocationOptions } from '../../shared/electionData.js';
import { recordAudit } from '../modules/foundation/audit-helper.js';

export const OPERATION_TYPES = ['Observer coverage', 'Training', 'Logistics', 'Accessibility', 'Campaign'];
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
  router.get('/resources/dashboard', asyncRoute(async (req, res) => res.json(await store.resourceDashboard(req.query))));
  router.get('/resources/adequacy', asyncRoute(async (req, res) => res.json(await store.resourceAdequacy(req.query))));
  router.get('/resources/records', asyncRoute(async (req, res) => res.json(await store.resourceRecords(req.query))));
  router.post('/resources/requirements', asyncRoute(async (req, res) => {
    try {
      const value = await store.createResourceRequirement({ ...req.body, createdBy: req.user.id });
      await recordAudit(store, req, { action: 'resource.requirement_created', entityType: 'resource', entityId: value.id, geography: value.geography, details: { resourceType: value.resourceType, quantity: value.quantity } });
      return res.status(201).json(value);
    } catch (error) { return res.status(400).json({ message: error.message }); }
  }));
  router.post('/resources/availability', asyncRoute(async (req, res) => {
    try {
      const value = await store.recordResourceAvailability({ ...req.body, createdBy: req.user.id });
      await recordAudit(store, req, { action: 'resource.availability_recorded', entityType: 'resource', entityId: value.id, geography: value.geography, details: { resourceType: value.resourceType, quantity: value.quantity } });
      return res.status(201).json(value);
    } catch (error) { return res.status(400).json({ message: error.message }); }
  }));
  router.post('/resources/dispatch', asyncRoute(async (req, res) => {
    try {
      const value = await store.dispatchResource({ ...req.body, approvedBy: req.body.approvedBy || req.user.id, createdBy: req.user.id });
      await recordAudit(store, req, { action: 'resource.dispatched', entityType: 'resource', entityId: value.id, geography: value.geography, details: { resourceType: value.resourceType, quantity: value.quantity, approvedBy: value.approvedBy } });
      return res.status(201).json(value);
    } catch (error) { return res.status(400).json({ message: error.message }); }
  }));
  router.post('/resources/reservations', asyncRoute(async (req, res) => {
    try {
      const value = await store.reserveResource({ ...req.body, approvedBy: req.body.approvedBy || req.user.id, createdBy: req.user.id });
      await recordAudit(store, req, { action: 'resource.reserved', entityType: 'resource', entityId: value.id, geography: value.geography, details: { resourceType: value.resourceType, quantity: value.quantity, approvedBy: value.approvedBy } });
      return res.status(201).json(value);
    } catch (error) { return res.status(400).json({ message: error.message }); }
  }));
  router.post('/resources/:id/arrival', asyncRoute(async (req, res) => {
    const value = await store.confirmResourceArrival(req.params.id, { ...req.body, confirmedBy: req.user.id });
    if (!value) return res.status(404).json({ message: 'Resource deployment not found.' });
    await recordAudit(store, req, { action: 'resource.arrival_confirmed', entityType: 'resource', entityId: value.id, geography: value.geography, details: { arrivalStatus: value.arrivalStatus, arrivedQuantity: value.arrivedQuantity } });
    res.json(value);
  }));
  router.post('/resources/:id/reallocate', asyncRoute(async (req, res) => {
    let value;
    try { value = await store.reallocateResource(req.params.id, { ...req.body, updatedBy: req.user.id }); }
    catch (error) { return res.status(400).json({ message: error.message }); }
    if (!value) return res.status(404).json({ message: 'Resource deployment not found.' });
    await recordAudit(store, req, { action: 'resource.reallocated', entityType: 'resource', entityId: value.id, geography: value.geography, details: { reason: req.body.reason } });
    res.json(value);
  }));
  router.post('/resources/:id/return', asyncRoute(async (req, res) => {
    try {
      const value = await store.returnResource(req.params.id, { ...req.body, returnedBy: req.user.id });
      if (!value) return res.status(404).json({ message: 'Resource deployment not found.' });
      await recordAudit(store, req, { action: 'resource.returned', entityType: 'resource', entityId: value.id, geography: value.geography, details: { reason: req.body.reason } });
      return res.json(value);
    } catch (error) { return res.status(400).json({ message: error.message }); }
  }));
  router.post('/resources/:id/utilization', asyncRoute(async (req, res) => {
    try {
      const value = await store.reviewResourceUtilization(req.params.id, { ...req.body, reviewedBy: req.user.id });
      if (!value) return res.status(404).json({ message: 'Resource deployment not found.' });
      await recordAudit(store, req, { action: 'resource.utilization_reviewed', entityType: 'resource', entityId: value.id, geography: value.geography, details: { utilizationStatus: value.utilizationStatus } });
      return res.json(value);
    } catch (error) { return res.status(400).json({ message: error.message }); }
  }));
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
