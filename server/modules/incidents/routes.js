import { createId, normalizeText, validateMediaPayload, validateCoordinates } from "../../security.js";
import { emitChatRoom } from "../../chat-realtime.js";
import { requireOyoState, deployment } from '../../config/deployment.js';
import { validateOyoAssignment } from '../geography/validation.js';
import { INCIDENT_STATUSES, normalizeIncidentStatus } from './lifecycle.js';
import { normalizeSyncEnvelope, syncConflictResponse } from '../foundation/sync-contract.js';
import { recordAudit } from '../foundation/audit-helper.js';
export function registerIncidentRoutes({ app, auth, adminOnly, rateLimit, asyncRoute, store, io, isAdminRole, canAccessIncident, canSupervisorAssign, emitIncidentToViewers, emitNotification, logIp, getClientIp, isSosIncident, sosVisibleTo, emitEmergencyAlert, emitAuthorized }) {
  app.get(
    "/api/incidents",
    auth,
    rateLimit,
    asyncRoute(async (req, res) =>
      res.json(
        (await store.incidents()).filter((incident) =>
          canAccessIncident(req.user, incident),
        ),
      ),
    ),
  );
  app.get(
    "/api/incidents/:id",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      const incident = (await store.incidents()).find(
        (item) => item.id === req.params.id,
      );
      if (!incident || !canAccessIncident(req.user, incident))
        return res.status(404).json({ message: "Incident not found" });
      res.json(incident);
    }),
  );
  app.post(
    "/api/incidents",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      try { requireOyoState(req.body.state || deployment.state); }
      catch (error) { return res.status(400).json({ message: error.message }); }
      const media = Array.isArray(req.body.media)
        ? req.body.media.slice(0, 6)
        : [];
      const mediaValidation = validateMediaPayload(media);
      if (!mediaValidation.valid)
        return res
          .status(400)
          .json({
            message: mediaValidation.errors[0] || "Invalid media payload",
          });
      const mediaBytes = media.reduce(
        (total, item) =>
          total + Buffer.byteLength(String(item?.data || ""), "utf8"),
        0,
      );
      if (mediaBytes > 10 * 1024 * 1024)
        return res
          .status(413)
          .json({
            message:
              "Incident attachments are too large. Keep the total under 10MB.",
          });
      const allowedTypes = new Set([
        "SOS-Emergency",
        "Vote Buying",
        "Thuggery and Violence",
        "Voter Intimidation",
        "Collusion",
        "Compromised Privacy",
        "Over-voting",
        "Late Opening",
        "Material Shortages",
        "Missing Registers",
        "Lack of Crowd Control",
        "BVAS Failure",
        "Network Connectivity",
        "Battery Depletion",
      ]);
      if (
        ["Agent", "Supervisor"].includes(req.user.role) &&
        !allowedTypes.has(req.body.reportType)
      )
        return res
          .status(403)
          .json({ message: "This role cannot create that report type" });
      const lga = String(req.user.lga || req.body.lga || "").trim();
      const ward = String(req.user.ward || req.body.ward || "").trim();
      const pollingUnit = String(
        (req.user.role === "Agent"
          ? req.user.pollingUnit
          : req.body.pollingUnit) || "",
      ).trim();
      const visibleTo = [
        ...new Set(
          [
            ...(Array.isArray(req.body.visibleTo) ? req.body.visibleTo : []),
            ...(isSosIncident(req.body)
              ? sosVisibleTo({ ...req.user, userId: req.user.id, ...req.body })
              : []),
            req.body.assignedTo,
          ].filter(Boolean),
        ),
      ];
      let protectedEvidence;
      if (store.protectMediaPayload) {
        try {
          protectedEvidence = await store.protectMediaPayload(media, {
            actorId: req.user.id,
            allowedUserIds: visibleTo,
            source: 'incident-submission',
            custodyEvent: 'captured-and-submitted',
          });
        } catch (error) {
          return res.status(400).json({ message: error.message });
        }
      }
      try { validateOyoAssignment({ state: deployment.state, lga, ward, pollingUnit }, { multipleWards: req.user.role === 'Supervisor' }); }
      catch (error) { return res.status(400).json({ message: error.message }); }
      let syncEnvelope;
      try { syncEnvelope = normalizeSyncEnvelope({ ...req.body, submissionId: req.body.submissionId || req.body.id || createId('incident-sync'), captureTime: req.body.captureTime || new Date().toISOString() }, 'incident'); }
      catch (error) { return res.status(400).json({ code: 'SYNC_INVALID', message: error.message }); }
      const incident = {
        title: normalizeText(req.body.title || "Incident"),
        description: normalizeText(req.body.description || ""),
        reportType: normalizeText(req.body.reportType || "IP"),
        severity: ["Low", "Medium", "High", "Critical"].includes(
          req.body.severity,
        )
          ? req.body.severity
          : "High",
        status: "reported",
        lat: Number(req.body.lat),
        lng: Number(req.body.lng),
        assignedTo: visibleTo.includes(req.body.assignedTo)
          ? req.body.assignedTo
          : "",
        lga,
        ward,
        pollingUnit,
        visibleTo,
        media: protectedEvidence || media,
        id: createId("i"),
        createdAt: new Date().toISOString(),
        createdBy: req.user.id,
        deadlineAt: req.body.deadlineAt || null,
        ownerId: req.body.assignedTo || "",
        escalationLevel: 0,
        verificationEvidence: [],
        submissionId: syncEnvelope.submissionId,
        captureTime: syncEnvelope.captureTime,
        serverReceiptTime: syncEnvelope.serverReceiptTime,
        payloadHash: syncEnvelope.payloadHash,
        recordVersion: syncEnvelope.recordVersion,
      };
      if (!incident.payloadHash && store.hashPayload) incident.payloadHash = store.hashPayload({ title: incident.title, description: incident.description, reportType: incident.reportType, severity: incident.severity, state: deployment.state, lga, ward, pollingUnit, captureTime: syncEnvelope.captureTime, attachments: syncEnvelope.attachmentIds });
      if (!validateCoordinates(incident.lat, incident.lng))
        return res
          .status(400)
          .json({ message: "Valid incident coordinates are required" });
      let created;
      try { created = await store.createIncident(incident); }
      catch (error) { if (error.code === 'SYNC_CONFLICT') return res.status(409).json(syncConflictResponse(error)); throw error; }
      logIp("incident", req.user, created.id, getClientIp(req));
      await recordAudit(store, req, { action: "incident.created", entityType: "incident", entityId: created.id, geography: { lga: created.lga, ward: created.ward, pollingUnit: created.pollingUnit }, details: { reportType: created.reportType, severity: created.severity } });
      emitIncidentToViewers("incident:created", created);
      res.status(201).json(created);
    }),
  );
  app.put(
    "/api/incidents/:id",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      const current = (await store.incidents()).find(
        (item) => item.id === req.params.id,
      );
      if (!current || !canAccessIncident(req.user, current))
        return res.status(404).json({ message: "Incident not found" });
      const mayManage =
        isAdminRole(req.user) ||
        current.createdBy === req.user.id ||
        current.assignedTo === req.user.id;
      if (!mayManage)
        return res
          .status(403)
          .json({ message: "You may view this incident but cannot modify it" });
      const allowedKeys = isAdminRole(req.user)
        ? [
            "title",
            "description",
            "severity",
            "status",
            "assignedTo",
            "visibleTo",
            "geometry",
            "style",
            "deadlineAt",
            "ownerId",
            "escalationLevel",
            "verificationEvidence",
            "transitionReason",
          ]
        : ["description", "status"];
      const patch = {};
      for (const key of allowedKeys) {
        if (req.body[key] !== undefined) patch[key] = req.body[key];
      }
      if (patch.title !== undefined) patch.title = normalizeText(patch.title);
      if (patch.description !== undefined)
        patch.description = normalizeText(patch.description);
      if (
        patch.status !== undefined &&
        !INCIDENT_STATUSES.includes(normalizeIncidentStatus(patch.status))
      )
        return res.status(400).json({ message: "Invalid incident status" });
      if (
        patch.severity !== undefined &&
        !["Low", "Medium", "High", "Critical"].includes(patch.severity)
      )
        return res.status(400).json({ message: "Invalid incident severity" });
      if (patch.visibleTo !== undefined) {
        const knownUserIds = new Set(
          (await store.users()).map((user) => user.id),
        );
        patch.visibleTo = [
          ...new Set(
            (Array.isArray(patch.visibleTo) ? patch.visibleTo : []).filter((id) =>
              knownUserIds.has(id),
            ),
          ),
        ];
      }
      if (!Object.keys(patch).length)
        return res
          .status(400)
          .json({ message: "No permitted incident changes supplied" });
      let incident;
      if (patch.status !== undefined) {
        if (!store.transitionIncident)
          return res.status(500).json({ message: "Incident lifecycle transitions are unavailable" });
        const transitionPatch = {
          deadlineAt: patch.deadlineAt,
          ownerId: patch.ownerId,
          escalationLevel: patch.escalationLevel,
          verificationEvidence: Array.isArray(patch.verificationEvidence) ? patch.verificationEvidence : [],
          reason: patch.transitionReason,
        };
        const recordPatch = { ...patch };
        for (const key of ['status', 'deadlineAt', 'ownerId', 'escalationLevel', 'verificationEvidence', 'transitionReason']) delete recordPatch[key];
        const transitionWork = async (transactionStore) => {
          let next = await transactionStore.transitionIncident(req.params.id, patch.status, { actor: req.user, ...transitionPatch });
          if (Object.keys(recordPatch).length) next = await transactionStore.updateIncident(req.params.id, recordPatch);
          return next;
        };
        try {
          incident = await (store.withTransaction ? store.withTransaction(transitionWork) : transitionWork(store));
        } catch (error) {
          if (error.code === 'INVALID_INCIDENT_TRANSITION')
            return res.status(409).json({ message: error.message });
          throw error;
        }
      } else {
        delete patch.transitionReason;
        delete patch.deadlineAt;
        delete patch.ownerId;
        delete patch.escalationLevel;
        delete patch.verificationEvidence;
        incident = await store.updateIncident(req.params.id, patch);
      }
      if (!incident)
        return res.status(404).json({ message: "Incident not found" });
      emitIncidentToViewers("incident:updated", incident);
      res.json(incident);
    }),
  );
  app.delete(
    "/api/incidents/:id",
    auth,
    adminOnly,
    rateLimit,
    asyncRoute(async (req, res) => {
      const current = (await store.incidents()).find((item) => item.id === req.params.id);
      if (!current) return res.status(404).json({ message: "Incident not found" });
      if (!canAccessIncident(req.user, current)) return res.status(404).json({ message: "Incident not found" });
      await store.deleteIncident(req.params.id);
      await recordAudit(store, req, { action: "incident.deleted", entityType: "incident", entityId: current.id });
      emitAuthorized("incident:deleted", req.params.id, current);
      res.status(204).end();
    }),
  );
  app.post(
    "/api/incidents/:id/chat",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      const incident = (await store.incidents()).find(
        (item) => item.id === req.params.id,
      );
      if (!incident)
        return res.status(404).json({ message: "Incident not found" });
      if (!canAccessIncident(req.user, incident))
        return res
          .status(403)
          .json({
            message:
              "Only assigned viewers and command can open this incident chat",
          });
      const room = await store.incidentChatRoom(incident, req.user);
      emitChatRoom(io, room);
      res.json(room);
    }),
  );
  app.post(
    "/api/incidents/:id/assign",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      const incident = (await store.incidents()).find(
        (item) => item.id === req.params.id,
      );
      if (!incident)
        return res.status(404).json({ message: "Incident not found" });
      const assignedUserId = String(req.body.assignedUserId || "").trim();
      const message = normalizeText(req.body.message || "").trim();
      if (!assignedUserId || !message)
        return res
          .status(400)
          .json({
            message: "Choose a field user and include an operational instruction",
          });
      const target = (await store.users()).find(
        (user) => user.id === assignedUserId && user.active,
      );
      if (!target)
        return res.status(404).json({ message: "Assigned user not found" });
      if (!["Agent", "Supervisor", "Response Team"].includes(target.role))
        return res
          .status(400)
          .json({
            message: "Incidents may only be assigned to operational field roles",
          });
      if (
        !isAdminRole(req.user) &&
        !canSupervisorAssign(req.user, incident, target)
      )
        return res
          .status(403)
          .json({
            message:
              "Supervisors may only assign incidents in their own LGA and ward",
          });
      const sameAssignmentValue = (left, right) => String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
      if ((target.state && incident.state && !sameAssignmentValue(target.state, incident.state)) ||
          (target.lga && incident.lga && !sameAssignmentValue(target.lga, incident.lga)) ||
          (target.role !== 'Supervisor' && target.ward && incident.ward && !sameAssignmentValue(target.ward, incident.ward)))
        return res.status(403).json({ message: 'The assignee is not responsible for this incident geography.' });
      const visibleTo = [...new Set([...(incident.visibleTo || []).filter((id) => id !== incident.assignedTo), assignedUserId])];
      const assignmentWork = async (transactionStore) => {
        const reassigned = Boolean(incident.assignedTo && incident.assignedTo !== assignedUserId);
        const transitionHistory = [
          ...(incident.lifecycle?.transitionHistory || []),
          { from: normalizeIncidentStatus(incident.status), to: normalizeIncidentStatus(incident.status), actorId: req.user.id, at: new Date().toISOString(), reason: reassigned ? 'incident reassigned' : 'incident assignment' },
        ];
        let updated = await transactionStore.updateIncident(incident.id, {
          assignedTo: assignedUserId,
          visibleTo,
          lifecycle: { ...(incident.lifecycle || {}), ownerId: assignedUserId, transitionHistory },
        });
        if (transactionStore.grantEvidenceAccess) {
          for (const evidence of incident.media || []) {
            const evidenceId = evidence?.id || evidence?.evidenceId;
            if (evidenceId) await transactionStore.grantEvidenceAccess(evidenceId, { actorId: req.user.id, userIds: [assignedUserId], reason: reassigned ? 'incident reassignment' : 'incident assignment' });
          }
        }
        if (transactionStore.transitionIncident && normalizeIncidentStatus(updated.status) === 'reported')
          updated = await transactionStore.transitionIncident(incident.id, 'triaged', { actor: req.user, reason: 'assignment triage' });
        if (transactionStore.transitionIncident && normalizeIncidentStatus(updated.status) === 'triaged')
          updated = await transactionStore.transitionIncident(incident.id, 'assigned', { actor: req.user, ownerId: assignedUserId, reason: reassigned ? 'reassignment' : 'field assignment' });
        const notification = await transactionStore.createNotification({
          id: createId("notif"), userId: assignedUserId, incidentId: incident.id, senderId: req.user.id, message,
          incidentType: incident.reportType || "Incident assignment", read: false, createdAt: new Date().toISOString(),
        });
        return { incident: updated, notification };
      };
      const { incident: lifecycleUpdated, notification } = await (store.withTransaction ? store.withTransaction(assignmentWork) : assignmentWork(store));
      emitIncidentToViewers("incident:updated", lifecycleUpdated);
      emitNotification(notification);
      res.json({ incident: lifecycleUpdated, notification });
    }),
  );

}
