import { createHash } from 'node:crypto';
import { deployment, requireOyoState } from "../../config/deployment.js";
import { validateResultEntries } from "./validation.js";
import { validateOyoAssignment } from '../geography/validation.js';
import { createId, sanitizeString, validateMediaPayload, validateCoordinates } from "../../security.js";
import { getRegistrationLocationOptions } from "../../../shared/electionData.js";
import { normalizeSyncEnvelope, syncConflictResponse } from '../foundation/sync-contract.js';
export function registerResultRoutes({ app, auth, rateLimit, adminOnly, superAdminOnly, asyncRoute, store, io, normalizeKey, logIp, getClientIp, emitIncidentToViewers }) {
  app.get(
    "/api/parties",
    auth,
    rateLimit,
    asyncRoute(async (_, res) => res.json(await store.parties())),
  );
  app.put(
    "/api/parties",
    auth,
    adminOnly,
    rateLimit,
    asyncRoute(async (req, res) => {
      const seen = new Set();
      const parties = (Array.isArray(req.body.parties) ? req.body.parties : [])
        .map((value) => sanitizeString(value).trim().slice(0, 100))
        .filter((value) => {
          if (!value) return false;
          const key = value.toLocaleLowerCase("en-NG");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 100);
      const saved = await store.setParties(parties);
      io.emit("parties:updated", saved);
      res.json(saved);
    }),
  );
  app.post(
    "/api/results",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      if (
        !["Agent", "Supervisor", "Admin", "Super Admin"].includes(req.user.role)
      )
        return res
          .status(403)
          .json({ message: "This role cannot submit polling-unit results" });
      const parties = await store.parties();
      let entries;
      try { entries = validateResultEntries(req.body.results, parties); }
      catch (error) { return res.status(400).json({ message: error.message }); }
      const media = Array.isArray(req.body.media)
        ? req.body.media.slice(0, 3)
        : [];
      const mediaValidation = validateMediaPayload(media);
      if (!mediaValidation.valid)
        return res
          .status(400)
          .json({
            message: mediaValidation.errors[0] || "Invalid media payload",
          });
      if (!media.some((item) => item?.type === "image"))
        return res
          .status(400)
          .json({ message: "A photograph of the signed result is required" });
      const lat = Number(req.body.lat);
      const lng = Number(req.body.lng);
      if (!validateCoordinates(lat, lng))
        return res.status(400).json({ message: "Current location is required" });
      const fieldRole = ["Agent", "Supervisor"].includes(req.user.role);
      let state;
      try { state = requireOyoState((fieldRole ? req.user.state : req.body.state || req.user.state) || deployment.state); }
      catch (error) { return res.status(400).json({ message: error.message }); }
      const lga = String(fieldRole ? req.user.lga : req.body.lga || "").trim();
      const ward = String(req.user.role === 'Agent' ? req.user.ward : req.body.ward || req.user.ward || '').trim();
      const pollingUnit = String(
        req.user.role === "Agent"
          ? req.user.pollingUnit
          : req.body.pollingUnit || req.user.pollingUnit || "",
      ).trim();
      if (!state || !lga || !ward || !pollingUnit)
        return res
          .status(400)
          .json({
            message: "A valid state, LGA, ward, and polling unit are required",
          });
      if (req.user.role === 'Supervisor' && !String(req.user.ward || '').split(',').map(value => value.trim()).includes(ward))
        return res.status(403).json({ message: 'Supervisors may only submit results for their assigned wards.' });
      try { validateOyoAssignment({ state, lga, ward, pollingUnit }); }
      catch (error) { return res.status(400).json({ message: error.message }); }
      const wardUnits = getRegistrationLocationOptions(
        state,
        lga,
        ward,
      ).pollingUnits;
      if (
        !wardUnits.some(
          (unit) => normalizeKey(unit) === normalizeKey(pollingUnit),
        )
      )
        return res
          .status(403)
          .json({ message: "That polling unit is not assigned to this ward" });
      if (
        req.user.role === "Agent" &&
        normalizeKey(pollingUnit) !== normalizeKey(req.user.pollingUnit)
      )
        return res
          .status(403)
          .json({
            message: "Agents can only report their assigned polling unit",
          });
      const resultSource =
        req.user.role === "Agent"
          ? "Agent"
          : req.user.role === "Supervisor"
            ? "Supervisor"
            : "Command Centre";
      const createdAt = new Date().toISOString();
      let syncEnvelope;
      try { syncEnvelope = normalizeSyncEnvelope({ ...req.body, submissionId: req.body.submissionId || req.body.id || createId('result-sync'), captureTime: req.body.captureTime || createdAt }, 'result'); }
      catch (error) { return res.status(400).json({ code: 'SYNC_INVALID', message: error.message }); }
      const geography = store.canonicalGeography
        ? store.canonicalGeography({ state, lga, ward, pollingUnit })
        : { country: 'Nigeria', state, lga, ward, pollingUnit, scopeId: deployment.scopeId };
      const sourceReleaseId = String(req.body.referenceReleaseId || req.body.referenceDataReleaseId || '').trim();
      if (!sourceReleaseId || typeof store.referenceDataReleases !== 'function')
        return res.status(400).json({ message: 'An approved reference data release is required for operational records.' });
      const approvedReleases = await store.referenceDataReleases({ status: 'approved' });
      const sourceRelease = approvedReleases.find((release) => release.id === sourceReleaseId);
      if (!sourceRelease)
        return res.status(400).json({ message: 'The referenced source release is not approved or does not exist.' });
      if (String(sourceRelease.scopeId || sourceRelease.records?.[0]?.scopeId || deployment.scopeId) !== String(deployment.scopeId))
        return res.status(400).json({ message: 'The referenced source release is outside the active deployment scope.' });
      const covered = (sourceRelease.records || []).some((record) =>
        record.validationStatus !== 'quarantined' &&
        (!record.state || normalizeKey(record.state) === normalizeKey(state)) &&
        (!record.lga || normalizeKey(record.lga) === normalizeKey(lga)) &&
        (!record.ward || normalizeKey(record.ward) === normalizeKey(ward)) &&
        (!record.pollingUnit || normalizeKey(record.pollingUnit) === normalizeKey(pollingUnit)),
      );
      if (!covered)
        return res.status(400).json({ message: 'The referenced approved source release does not cover this geography.' });
      const submissionId = syncEnvelope.submissionId;
      const normalizedPayload = {
        submissionId,
        state,
        lga,
        ward,
        pollingUnit,
        lat,
        lng,
        results: entries,
        media: media.map((item) => ({
          type: item?.type || 'image',
          mimeType: item?.mimeType || 'image/png',
          data: item?.data || '',
        })),
      };
      const payloadHash = store.hashPayload
        ? store.hashPayload(normalizedPayload)
        : createHash('sha256').update(JSON.stringify(normalizedPayload)).digest('hex');
      syncEnvelope.payloadHash = payloadHash;
      const existingSubmission = !store.withTransaction && store.getFieldSubmission
        ? await store.getFieldSubmission(submissionId)
        : null;
      if (existingSubmission) {
        if (String(existingSubmission.payloadHash || '').toLowerCase() === payloadHash.toLowerCase()) {
          return res.status(201).json({
            message: 'Submission replay accepted',
            replayed: true,
            submissionId,
            payloadHash,
            submission: existingSubmission,
          });
        }
        return res.status(409).json({
          message: 'Submission conflict: this submission ID has already been used with different payload content.',
        });
      }
      const provenance = store.sourceProvenance
        ? store.sourceProvenance({
            classification: 'field-observed',
            source: 'manual-submission',
            recordedBy: req.user.id,
            recordedAt: createdAt,
            verificationStatus: 'unverified',
            electionId: sourceRelease.records?.[0]?.electionId || deployment.electionId,
            sourceVersion: sourceRelease.sourceVersion,
            sourceReleaseId,
          })
        : {
            classification: 'field-observed',
            sourceType: 'field-observed',
            source: 'manual-submission',
            sourceVersion: sourceRelease.sourceVersion,
            electionId: sourceRelease.records?.[0]?.electionId || deployment.electionId,
            sourceReleaseId,
            recordedBy: req.user.id,
            recordedAt: createdAt,
            verificationStatus: 'unverified',
            isAuthoritative: false,
            acceptedBy: '',
          };
      const resultId = createId("r");
      const resultRecord = {
        id: createId("rr"),
        resultId,
        submissionId,
        payloadHash,
        electionId: sourceRelease.records?.[0]?.electionId || deployment.electionId,
        scopeId: deployment.scopeId,
        sourceReleaseId,
        captureTime: syncEnvelope.captureTime,
        serverReceiptTime: syncEnvelope.serverReceiptTime,
        recordVersion: syncEnvelope.recordVersion,
        geography,
        provenance,
        state,
        lga,
        ward,
        pollingUnit,
        resultSource,
        submittedBy: req.user.id,
        submittedByRole: req.user.role,
        resultCount: JSON.stringify(entries),
        evidence: media.map((item) => ({
          id: createId('ev'),
          type: item?.type || 'file',
          mimeType: item?.mimeType || 'image/png',
          source: 'field-submission',
          url: item?.data || '',
          uploadedAt: createdAt,
          uploadedBy: req.user.id,
          classification: 'field-observed',
        })),
        createdAt,
        updatedAt: createdAt,
      };
      const result = {
        id: resultId,
        title: `Polling Unit Result - ${sanitizeString(pollingUnit)}`,
        description: `Submitted by ${sanitizeString(req.user.name)} at ${createdAt}`,
        reportType: "Polling Unit Result",
        severity: "Low",
        status: "Submitted",
        lat,
        lng,
        assignedTo: "",
        visibleTo: [],
        media,
        geometry: null,
        style: {
          source: "result",
          resultSource,
          submittedByRole: req.user.role,
          state: deployment.state,
          scopeId: deployment.scopeId,
          geography,
          provenance,
          icon: "POI",
          color: "#d9aa4b",
          fillColor: "#d9aa4b",
        },
        lga,
        ward,
        pollingUnit,
        resultCount: JSON.stringify(entries),
        createdAt,
        createdBy: req.user.id,
      };
      const persistSubmission = async (transactionStore) => {
        let protectedEvidence;
        if (transactionStore.protectMediaPayload) {
          try {
            protectedEvidence = await transactionStore.protectMediaPayload(media, {
              actorId: req.user.id,
              allowedUserIds: [req.user.id],
              source: 'result-submission',
              custodyEvent: 'captured-and-submitted',
            });
          } catch (error) {
            return { validationError: error };
          }
        }
        const persistedResultRecord = { ...resultRecord, evidence: protectedEvidence || resultRecord.evidence };
        const persistedResult = { ...result, media: protectedEvidence || result.media };
        const resultWrite = await transactionStore.createResultRecord(persistedResultRecord, { returnMetadata: true });
        const createdResultRecord = resultWrite.record || resultWrite;
        if (resultWrite.created === false) {
          const created = transactionStore.incidents
            ? (await transactionStore.incidents()).find((item) => item.id === createdResultRecord.resultId)
            : null;
          return { replayed: true, createdResultRecord, created, persistedAuditEntries: [] };
        }
        const created = await transactionStore.createIncident(persistedResult);
        const submissionRecord = {
          submissionId,
          payloadHash,
          resultId: createdResultRecord.id,
          createdAt,
          actorId: req.user.id,
          geography,
        };
        if (transactionStore.saveFieldSubmission) {
          await transactionStore.saveFieldSubmission(submissionRecord);
        }
        const auditLogger = transactionStore.createAuditEntry || (() => null);
        const auditEntry = auditLogger({
          actorId: req.user.id,
          actorRole: req.user.role,
          action: 'result_submitted',
          entityType: 'result',
          entityId: createdResultRecord.id,
          details: { state, lga, ward, pollingUnit, resultCount: JSON.stringify(entries), source: resultSource },
          source: 'manual-submission',
          scopeId: deployment.scopeId,
          geography,
        });
        const secondAuditEntry = auditLogger({
          actorId: req.user.id,
          actorRole: req.user.role,
          action: 'result_recorded',
          entityType: 'result',
          entityId: createdResultRecord.id,
          details: { status: 'stored', evidenceCount: createdResultRecord.evidence.length },
          source: 'result-service',
          scopeId: deployment.scopeId,
          geography,
        });
        const persistedAuditEntries = [];
        for (const entry of [auditEntry, secondAuditEntry].filter(Boolean)) {
          if (transactionStore.appendAuditEntry) {
            persistedAuditEntries.push(await transactionStore.appendAuditEntry(entry));
          } else if (transactionStore.createAuditEntry && transactionStore.createAuditEntry !== auditLogger) {
            persistedAuditEntries.push(await transactionStore.createAuditEntry(entry));
          } else {
            persistedAuditEntries.push(entry);
          }
        }
        return { replayed: false, createdResultRecord, created, persistedAuditEntries };
      };
      let persisted;
      try {
        persisted = await (store.withTransaction ? store.withTransaction(persistSubmission) : persistSubmission(store));
      } catch (error) {
        if (error.code === 'RESULT_SUBMISSION_CONFLICT') {
          return res.status(409).json({ code: error.code, message: error.message, conflict: { submissionId } });
        }
        throw error;
      }
      if (persisted.validationError) {
        return res.status(400).json({ message: persisted.validationError.message });
      }
      if (persisted.replayed) {
        return res.status(201).json({
          ...(persisted.created || {}),
          message: 'Submission replay accepted',
          replayed: true,
          submissionId,
          payloadHash,
          submission: { submissionId, payloadHash, resultId: persisted.createdResultRecord.id, actorId: persisted.createdResultRecord.submittedBy, geography: persisted.createdResultRecord.geography },
          resultRecord: persisted.createdResultRecord,
          evidence: persisted.createdResultRecord.evidence,
          provenance: persisted.createdResultRecord.provenance,
          geography: persisted.createdResultRecord.geography,
          audit: persisted.persistedAuditEntries,
        });
      }
      logIp("result", req.user, persisted.created.id, getClientIp(req));
      emitIncidentToViewers("incident:created", persisted.created);
      res.status(201).json({ ...persisted.created, resultRecord: persisted.createdResultRecord, evidence: persisted.createdResultRecord.evidence, provenance: persisted.createdResultRecord.provenance, geography: persisted.createdResultRecord.geography, audit: persisted.persistedAuditEntries });
    }),
  );

}
