
import { randomUUID } from 'node:crypto';

export function createFieldOperationsRepository({ pool, jsonDb, saveJson, mappers }) {
  const { toCamera } = mappers;
  const resourceKey = (id) => `resource-intelligence:${id}`;
  const readResourceValues = async () => {
    if (!pool) {
      jsonDb.resourceIntelligence ||= {};
      return Object.values(jsonDb.resourceIntelligence);
    }
    return (await pool.query("select value from app_settings where key like 'resource-intelligence:%'")).rows.map((row) => row.value);
  };
  const saveResourceValue = async (value) => {
    if (!pool) {
      jsonDb.resourceIntelligence ||= {};
      jsonDb.resourceIntelligence[resourceKey(value.id)] = value;
      saveJson();
      return value;
    }
    await pool.query('insert into app_settings (key,value) values ($1,$2) on conflict (key) do update set value=excluded.value', [resourceKey(value.id), JSON.stringify(value)]);
    return value;
  };
  const geographyOf = (value = {}) => ({
    state: String(value.state || 'Oyo').trim(),
    lga: String(value.lga || '').trim(),
    ward: String(value.ward || '').trim(),
    pollingUnit: String(value.pollingUnit || '').trim(),
  });
  const matchesGeography = (value, filter = {}) => {
    const geography = geographyOf(value.geography || value);
    return Object.entries(geographyOf(filter)).every(([key, expected]) => !expected || geography[key] === expected);
  };
  const resourceSnapshot = (values, filter = {}) => {
    const selected = values.filter((value) => matchesGeography(value, filter));
    const requirements = selected.filter((value) => value.kind === 'requirement');
    const availability = selected.filter((value) => value.kind === 'availability');
    const deployments = selected.filter((value) => value.kind === 'deployment');
    const byType = new Map();
    for (const value of [...requirements, ...availability, ...deployments]) {
      const itemKey = `${value.resourceType}::${value.unit || 'units'}`;
      const item = byType.get(itemKey) || { resourceType: value.resourceType, unit: value.unit || 'units', required: 0, available: 0, deployed: 0, arrived: 0, missing: 0, underutilized: 0 };
      if (value.kind === 'requirement') item.required += Number(value.quantity || 0);
      if (value.kind === 'availability') item.available += Number(value.quantity || 0) - Number(value.reservedQuantity || 0);
      if (value.kind === 'deployment') {
        item.deployed += Number(value.originalQuantity ?? value.quantity ?? 0);
        if (value.arrivalStatus === 'partial' || value.arrivalStatus === 'arrived') item.arrived += Number(value.arrivedQuantity || 0);
        if (value.utilizationStatus === 'underutilized') item.underutilized += Number(value.originalQuantity ?? value.quantity ?? 0);
      }
      byType.set(itemKey, item);
    }
    return [...byType.values()].map((item) => ({ ...item, missing: Math.max(0, item.required - item.arrived) }));
  };
  const inventoryBalance = (values, resourceType, geography) => {
    const selected = values.filter((value) => value.resourceType === resourceType && matchesGeography(value, geography));
    const available = selected.filter((value) => value.kind === 'availability').reduce((sum, value) => sum + Number(value.quantity || 0), 0);
    const reserved = selected.filter((value) => value.kind === 'availability').reduce((sum, value) => sum + Number(value.reservedQuantity || 0), 0);
    const dispatched = selected.filter((value) => value.kind === 'deployment' && value.sourceGeography && matchesGeography({ geography: value.sourceGeography }, geography)).reduce((sum, value) => sum + Number(value.originalQuantity ?? value.quantity ?? 0), 0);
    const returned = selected.filter((value) => value.kind === 'return').reduce((sum, value) => sum + Number(value.quantity || 0), 0);
    return { available, reserved, dispatched, returned, balance: available + returned - dispatched - reserved };
  };
  return {
    async operationPlans() {
      const values = !pool
        ? Object.entries(jsonDb.settings || {}).filter(([key]) => key.startsWith('area-operation:')).map(([, value]) => value)
        : (await pool.query("select value from app_settings where key like 'area-operation:%'")).rows.map(row => row.value);
      return values.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async deleteOperationPlan(id) {
      const key = `area-operation:${id}`;
      if (!pool) { delete (jsonDb.settings || {})[key]; saveJson(); return; }
      await pool.query('delete from app_settings where key=$1', [key]);
    },
    async resourceRequirements(filter = {}) {
      return (await readResourceValues()).filter((value) => value.kind === 'requirement' && matchesGeography(value, filter));
    },
    async createResourceRequirement({ resourceType, quantity, unit = 'units', geography, forecastDate, basis = '', planningEvidence = [], priority = 'normal', createdBy = '' }) {
      const value = { id: randomUUID(), kind: 'requirement', resourceType: String(resourceType || '').trim(), unit: String(unit || 'units').trim() || 'units', quantity: Math.max(0, Number(quantity) || 0), geography: geographyOf(geography), forecastDate: forecastDate || null, basis: String(basis || '').trim(), planningEvidence: Array.isArray(planningEvidence) ? planningEvidence : [], priority, status: 'forecast', createdBy, createdAt: new Date().toISOString() };
      if (!value.resourceType || !value.quantity) throw new Error('Resource type and positive quantity are required.');
      return saveResourceValue(value);
    },
    async recordResourceAvailability({ resourceType, quantity, unit = 'units', geography, source = 'inventory', inventoryId = '', createdBy = '' }) {
      const value = { id: randomUUID(), kind: 'availability', resourceType: String(resourceType || '').trim(), unit: String(unit || 'units').trim() || 'units', quantity: Math.max(0, Number(quantity) || 0), reservedQuantity: 0, geography: geographyOf(geography), source, inventoryId: String(inventoryId || '').trim(), createdBy, createdAt: new Date().toISOString(), movementHistory: [{ type: 'received', quantity: Math.max(0, Number(quantity) || 0), actorId: createdBy, at: new Date().toISOString() }] };
      if (!value.resourceType || !value.quantity) throw new Error('Resource type and positive quantity are required.');
      return saveResourceValue(value);
    },
    async dispatchResource({ resourceType, quantity, unit = 'units', geography, sourceGeography, ownerId = '', deadlineAt = null, reservationId = '', approvedBy = '', createdBy = '' }) {
      const originalQuantity = Math.max(0, Number(quantity) || 0);
      const values = await readResourceValues();
      const balance = inventoryBalance(values, String(resourceType || '').trim(), sourceGeography || geography);
      const reservation = reservationId ? values.find((item) => item.kind === 'reservation' && item.id === reservationId && item.status === 'reserved') : null;
      const reservedAllowance = reservation && reservation.resourceType === String(resourceType || '').trim() ? Number(reservation.quantity || 0) : 0;
      if (!originalQuantity || originalQuantity > balance.balance + reservedAllowance) throw new Error(`Insufficient ${resourceType || 'resource'} stock. Available balance: ${balance.balance}.`);
      const now = new Date().toISOString();
      const value = { id: randomUUID(), kind: 'deployment', resourceType: String(resourceType || '').trim(), unit: String(unit || 'units').trim() || 'units', quantity: originalQuantity, originalQuantity, arrivedQuantity: 0, geography: geographyOf(geography), sourceGeography: geographyOf(sourceGeography), ownerId, deadlineAt, reservationId: String(reservationId || '').trim(), approvedBy: String(approvedBy || '').trim(), approvalStatus: approvedBy ? 'approved' : 'pending', arrivalStatus: 'dispatched', utilizationStatus: 'unreviewed', createdBy, createdAt: now, updatedAt: now, movementHistory: [{ type: 'dispatched', quantity: originalQuantity, actorId: createdBy, at: now }] };
      if (!approvedBy) throw new Error('An authorized approval is required before dispatch.');
      if (reservation && reservedAllowance >= originalQuantity) {
        const reservedAvailability = values.find((item) => item.kind === 'availability' && item.resourceType === reservation.resourceType && matchesGeography(item, reservation.geography));
        if (reservedAvailability) await saveResourceValue({ ...reservedAvailability, reservedQuantity: Math.max(0, Number(reservedAvailability.reservedQuantity || 0) - originalQuantity), movementHistory: [...(reservedAvailability.movementHistory || []), { type: 'reservation-consumed', quantity: originalQuantity, actorId: createdBy, at: now }] });
        await saveResourceValue({ ...reservation, quantity: originalQuantity, status: 'consumed', consumedAt: now, movementHistory: [...(reservation.movementHistory || []), { type: 'consumed', quantity: originalQuantity, actorId: createdBy, at: now }] });
      }
      if (!value.resourceType || !value.quantity) throw new Error('Resource type and positive quantity are required.');
      return saveResourceValue(value);
    },
    async confirmResourceArrival(id, { quantity, arrivedAt = new Date().toISOString(), confirmedBy = '' } = {}) {
      const value = (await readResourceValues()).find((item) => item.id === id && item.kind === 'deployment');
      if (!value) return null;
      const added = Math.max(0, Number(quantity) || 0);
      const arrivedQuantity = Number(value.arrivedQuantity || 0) + added;
      if (arrivedQuantity > Number(value.originalQuantity || value.quantity || 0)) throw new Error('Arrival quantity cannot exceed the original dispatched quantity.');
      return saveResourceValue({ ...value, quantity: value.originalQuantity || value.quantity, arrivedQuantity, arrivalStatus: arrivedQuantity === Number(value.originalQuantity || value.quantity) ? 'arrived' : 'partial', arrivedAt, confirmedBy, updatedAt: new Date().toISOString(), movementHistory: [...(value.movementHistory || []), { type: 'arrival', quantity: added, actorId: confirmedBy, at: arrivedAt }] });
    },
    async reallocateResource(id, { geography, quantity, ownerId, reason = '', updatedBy = '' } = {}) {
      const value = (await readResourceValues()).find((item) => item.id === id && item.kind === 'deployment');
      if (!value) return null;
      return saveResourceValue({ ...value, geography: geographyOf(geography || value.geography), quantity: value.originalQuantity || value.quantity, ownerId: ownerId ?? value.ownerId, reallocation: { reason, updatedBy, at: new Date().toISOString() }, movementHistory: [...(value.movementHistory || []), { type: 'reallocated', quantity: value.originalQuantity || value.quantity, actorId: updatedBy, at: new Date().toISOString(), from: value.geography, to: geographyOf(geography || value.geography), reason }], updatedAt: new Date().toISOString() });
    },
    async reviewResourceUtilization(id, { utilizationStatus, usedQuantity = 0, reviewedBy = '', notes = '' } = {}) {
      const value = (await readResourceValues()).find((item) => item.id === id && item.kind === 'deployment');
      if (!value) return null;
      if (!['adequate', 'underutilized', 'overstretched'].includes(utilizationStatus)) throw new Error('Invalid utilization status.');
      return saveResourceValue({ ...value, utilizationStatus, usedQuantity: Math.max(0, Number(usedQuantity) || 0), utilizationReview: { reviewedBy, notes, at: new Date().toISOString() }, updatedAt: new Date().toISOString() });
    },
    async resourceAdequacy(filter = {}) {
      return resourceSnapshot(await readResourceValues(), filter);
    },
    async reserveResource({ resourceType, quantity, geography, reservedFor = '', approvedBy = '', createdBy = '' }) {
      if (!approvedBy) throw new Error('An authorized approval is required before reservation.');
      const values = await readResourceValues();
      const balance = inventoryBalance(values, resourceType, geography);
      const requested = Math.max(0, Number(quantity) || 0);
      if (!requested || requested > balance.balance) throw new Error(`Insufficient ${resourceType || 'resource'} stock for reservation.`);
      const reservation = { id: randomUUID(), kind: 'reservation', resourceType: String(resourceType || '').trim(), quantity: requested, geography: geographyOf(geography), reservedFor: String(reservedFor || '').trim(), approvedBy, createdBy, status: 'reserved', createdAt: new Date().toISOString(), movementHistory: [{ type: 'reserved', quantity: requested, actorId: createdBy, at: new Date().toISOString() }] };
      const availability = values.find((item) => item.kind === 'availability' && item.resourceType === reservation.resourceType && matchesGeography(item, geography));
      if (availability) await saveResourceValue({ ...availability, reservedQuantity: Number(availability.reservedQuantity || 0) + requested, movementHistory: [...(availability.movementHistory || []), ...reservation.movementHistory] });
      return saveResourceValue(reservation);
    },
    async returnResource(id, { quantity, reason = '', returnedBy = '' } = {}) {
      const value = (await readResourceValues()).find((item) => item.id === id && item.kind === 'deployment');
      if (!value) return null;
      const returned = Math.max(0, Number(quantity) || 0);
      const previous = Number(value.returnedQuantity || 0);
      if (returned + previous > Number(value.originalQuantity || value.quantity || 0)) throw new Error('Returned quantity cannot exceed the original dispatched quantity.');
      const now = new Date().toISOString();
      await saveResourceValue({ id: randomUUID(), kind: 'return', resourceType: value.resourceType, unit: value.unit || 'units', quantity: returned, geography: value.sourceGeography || value.geography, deploymentId: value.id, reason, returnedBy, createdAt: now });
      return saveResourceValue({ ...value, returnedQuantity: previous + returned, movementHistory: [...(value.movementHistory || []), { type: 'returned', quantity: returned, reason, actorId: returnedBy, at: now }], updatedAt: now });
    },
    async resourceDashboard(filter = {}) {
      const geography = geographyOf(filter);
      return { geography, asOf: new Date().toISOString(), resources: await this.resourceAdequacy(filter), requirements: await this.resourceRequirements(filter) };
    },
    /**
     * Raw, per-kind records with their IDs -- resourceAdequacy/resourceDashboard
     * only expose an aggregated by-type snapshot, which is enough to show
     * shortages but not enough for a caller (a UI, a script) to act on a specific
     * dispatch (confirm arrival, reallocate, return, review utilization).
     */
    async resourceRecords(filter = {}) {
      const values = (await readResourceValues()).filter((value) => matchesGeography(value, filter));
      const byKind = { requirement: [], availability: [], deployment: [], reservation: [], return: [] };
      for (const value of values) (byKind[value.kind] || (byKind[value.kind] = [])).push(value);
      for (const list of Object.values(byKind)) list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      return byKind;
    },
    async cameras() {
      if (!pool) return jsonDb.cameras;
      const { rows } = await pool.query('select * from cameras order by created_at desc');
      return rows.map(toCamera);
    },
    async createCamera(camera) {
      if (!pool) { jsonDb.cameras.push(camera); saveJson(); return camera; }
      const { rows } = await pool.query('insert into cameras (id,name,type,url,lat,lng,state,lga,ward,polling_unit,status,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *', [camera.id, camera.name, camera.type, camera.url, camera.lat ?? null, camera.lng ?? null, camera.state || '', camera.lga || '', camera.ward || '', camera.pollingUnit || '', camera.status, camera.createdAt]);
      return toCamera(rows[0]);
    },
    async deleteCamera(id) {
      if (!pool) { jsonDb.cameras = jsonDb.cameras.filter(camera => camera.id !== id); saveJson(); return; }
      await pool.query('delete from cameras where id=$1', [id]);
    },
  };
}
