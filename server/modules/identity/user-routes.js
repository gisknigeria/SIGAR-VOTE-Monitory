import { validateOyoAssignment } from "../geography/validation.js";
import { resolveOptionalCoordinate } from "../foundation/geography-query.js";
import { recordAudit } from "../foundation/audit-helper.js";
import bcrypt from "bcryptjs";
import { createId, sanitizeString, validatePassword, validateEmail } from "../../security.js";
import { canManageRank } from "../../../shared/electionData.js";
export function registerUserRoutes({ app, auth, adminOnly, rateLimit, asyncRoute, store, io, publicUser, visibleUsersFor, canManageUsers, canCreateUser, canDeleteUser, superAdminOnly, emitAuthorized }) {
  app.get(
    "/api/users",
    auth,
    rateLimit,
    asyncRoute(async (req, res) =>
      res.json(visibleUsersFor(req.user, await store.users()).map(publicUser)),
    ),
  );
  app.get(
    "/api/report-viewers",
    auth,
    rateLimit,
    asyncRoute(async (req, res) =>
      res.json(visibleUsersFor(req.user, await store.users()).map(publicUser)),
    ),
  );
  app.post(
    "/api/users",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      if (!canManageUsers(req.user))
        return res
          .status(403)
          .json({ message: "You do not have lower ranks to manage" });
      const email = String(req.body.email || "")
        .trim()
        .toLowerCase();
      const role = req.body.role || "Agent";
      const rank = String(req.body.rank || "").trim();
      if (!req.body.name || !validateEmail(email) || !req.body.password)
        return res
          .status(400)
          .json({ message: "Name, a valid email and password are required" });
      if (!rank) return res.status(400).json({ message: "Rank is required" });
      if (!canCreateUser(req.user, rank, role))
        return res
          .status(403)
          .json({ message: "You can only create accounts below your rank" });
      if (!validatePassword(String(req.body.password || "")))
        return res
          .status(400)
          .json({
            message:
              "Password must be at least 12 characters and include upper, lower, number, and special characters.",
          });
      if (
        (await store.users()).some((user) => user.email.toLowerCase() === email)
      )
        return res
          .status(409)
          .json({ message: "An account with that email already exists" });
      const user = {
        id: createId("u"),
        name: sanitizeString(req.body.name).trim(),
        email,
        password: await bcrypt.hash(String(req.body.password), 10),
        role,
        rank: role,
        active: true,
        unit: req.body.unit || "Field Unit",
        unitType: String(req.body.unitType || "Division").trim(),
        command: String(req.body.command || "").trim(),
        division: String(req.body.division || "").trim(),
        station: String(req.body.station || "").trim(),
        state: String(req.body.state || "").trim(),
        lga: String(req.body.lga || "").trim(),
        ward: String(req.body.ward || "").trim(),
        pollingUnit: String(req.body.pollingUnit || "").trim(),
        lat: resolveOptionalCoordinate(req.body.lat),
        lng: resolveOptionalCoordinate(req.body.lng),
      };
      try { Object.assign(user, validateOyoAssignment(user, { multipleWards: user.role === 'Supervisor' })); }
      catch (error) { return res.status(400).json({ message: error.message }); }
      const created = await store.createUser(user);
      await recordAudit(store, req, { action: "identity.user_created", entityType: "user", entityId: created.id, details: { email: created.email, role: created.role }, geography: { state: created.state, lga: created.lga, ward: created.ward, pollingUnit: created.pollingUnit } });
      emitAuthorized("user:created", publicUser(created), created);
      res.status(201).json(publicUser(created));
    }),
  );
  app.delete(
    "/api/users/:id",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      if (req.params.id === req.user.id)
        return res
          .status(400)
          .json({ message: "You cannot delete your own account" });
      const target = (await store.users()).find(
        (user) => user.id === req.params.id,
      );
      if (!canDeleteUser(req.user, target))
        return res
          .status(403)
          .json({ message: "You are not allowed to delete this account" });
      const deleted = await store.deleteUser(req.params.id);
      if (!deleted)
        return res.status(404).json({ message: "Personnel account not found" });
      await recordAudit(store, req, { action: "identity.user_deleted", entityType: "user", entityId: target.id, details: { email: target.email, role: target.role } });
      emitAuthorized("user:deleted", req.params.id, target);
      res.status(204).end();
    }),
  );
  app.put(
    "/api/users/:id",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      const target = (await store.users()).find(
        (user) => user.id === req.params.id,
      );
      if (!target) return res.status(404).json({ message: "User not found" });
      if (req.user.id === target.id)
        return res
          .status(400)
          .json({
            message: "Use the profile endpoint to update your own account",
          });
      if (
        req.user.id !== target.id &&
        req.user.role !== "Super Admin" &&
        !canManageRank(req.user.rank, target.rank)
      )
        return res
          .status(403)
          .json({ message: "You can only update accounts below your rank" });
      const changes = {
        name: String(req.body.name || target.name).trim(),
        email: String(req.body.email || target.email)
          .trim()
          .toLowerCase(),
        role: target.role,
        rank: target.rank,
        active: target.active,
        unit: String(req.body.unit || target.unit).trim(),
        unitType: String(req.body.unitType || target.unitType).trim(),
        command: String(req.body.command || target.command).trim(),
        division: String(req.body.division || target.division).trim(),
        station: String(req.body.station || target.station).trim(),
        state: String(req.body.state || target.state).trim(),
        lga: String(req.body.lga || target.lga).trim(),
        ward: String(req.body.ward || target.ward).trim(),
        pollingUnit: String(req.body.pollingUnit || target.pollingUnit).trim(),
        lat: resolveOptionalCoordinate(req.body.lat, target.lat ?? null),
        lng: resolveOptionalCoordinate(req.body.lng, target.lng ?? null),
      };
      const existing = (await store.users()).find(
        (user) =>
          user.id !== target.id &&
          user.email.toLowerCase() === changes.email.toLowerCase(),
      );
      if (existing)
        return res.status(409).json({ message: "Email is already in use" });
      try { Object.assign(changes, validateOyoAssignment(changes, { multipleWards: changes.role === 'Supervisor' })); }
      catch (error) { return res.status(400).json({ message: error.message }); }
      const updated = await store.updateUser(req.params.id, changes);
      await recordAudit(store, req, { action: "identity.user_updated", entityType: "user", entityId: updated.id, details: { changedFields: Object.keys(changes) } });
      emitAuthorized("user:updated", publicUser(updated), updated);
      res.json(publicUser(updated));
    }),
  );
  app.put(
    "/api/users/:id/role",
    auth,
    adminOnly,
    rateLimit,
    asyncRoute(async (req, res) => {
      const target = (await store.users()).find(
        (user) => user.id === req.params.id,
      );
      if (!target) return res.status(404).json({ message: "User not found" });
      if (!canManageRank(req.user.rank, target.rank))
        return res
          .status(403)
          .json({
            message: "You can only change roles for accounts below your rank",
          });
      const allowedRoles = ["Supervisor", "Agent"];
      const newRole = String(req.body.role || "").trim();
      if (!allowedRoles.includes(newRole))
        return res
          .status(400)
          .json({ message: "Role must be Supervisor or Agent" });
      if (newRole === target.role && !req.body.ward)
        return res.status(400).json({ message: "No changes to apply" });
      const changes = {
        name: target.name,
        email: target.email,
        role: newRole,
        rank: newRole,
        active: target.active,
        unit: target.unit,
        unitType: target.unitType,
        command: target.command,
        division: target.division,
        station: target.station,
        state: req.body.state ? String(req.body.state).trim() : target.state,
        lga: req.body.lga ? String(req.body.lga).trim() : target.lga,
        ward: req.body.ward ? String(req.body.ward).trim() : target.ward,
        pollingUnit:
          newRole === "Supervisor"
            ? target.pollingUnit || ""
            : req.body.pollingUnit
              ? String(req.body.pollingUnit).trim()
              : target.pollingUnit,
        lat: target.lat,
        lng: target.lng,
      };
      try { Object.assign(changes, validateOyoAssignment(changes, { multipleWards: changes.role === 'Supervisor' })); }
      catch (error) { return res.status(400).json({ message: error.message }); }
      const updated = await store.updateUser(req.params.id, changes);
      await recordAudit(store, req, { action: "identity.user_role_changed", entityType: "user", entityId: updated.id, details: { from: target.role, to: newRole } });
      emitAuthorized("user:updated", publicUser(updated), updated);
      res.json(publicUser(updated));
    }),
  );
  app.put(
    "/api/users/:id/password",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      const users = await store.users();
      const target = users.find((user) => user.id === req.params.id);
      if (!target) return res.status(404).json({ message: "Account not found" });
      if (target.id === req.user.id)
        return res
          .status(400)
          .json({
            message: "Use the profile endpoint to change your own password",
          });
      if (!canDeleteUser(req.user, target))
        return res
          .status(403)
          .json({ message: "You cannot reset this account password" });
      const password = String(req.body.password || "");
      if (!validatePassword(password))
        return res
          .status(400)
          .json({
            message:
              "Password must be at least 12 characters and include upper, lower, number, and special characters.",
          });
      await store.updateUserPassword(target.id, await bcrypt.hash(password, 12));
      await recordAudit(store, req, { action: "identity.password_reset_by_admin", entityType: "user", entityId: target.id, source: "access-control" });
      res.status(204).end();
    }),
  );
  app.post(
    "/api/users/:id/access-review",
    auth,
    adminOnly,
    rateLimit,
    asyncRoute(async (req, res) => {
      const target = (await store.users()).find((user) => user.id === req.params.id);
      if (!target) return res.status(404).json({ message: "Account not found" });
      try {
        const review = await store.recordAccessReview(target.id, { reviewedBy: req.user.id, notes: req.body?.notes });
        await recordAudit(store, req, { action: "identity.access_reviewed", entityType: "user", entityId: target.id, details: { notes: review.notes }, source: "access-control" });
        res.status(201).json(review);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    }),
  );

}
