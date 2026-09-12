import { canManageRank, normalizeCommand } from '../../../shared/electionData.js';
import { isAdminRole } from '../../middleware/auth.js';
export function createAccessPolicy({ io }) {
  const canManageUsers = (user) =>
    user?.role === "Super Admin" || user?.role === "Admin";
  const parseWardList = (value) =>
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const wardMatches = (userWard, viewerWard) => {
    const viewerWards = new Set(
      parseWardList(viewerWard).map((item) => normalizeKey(item)),
    );
    return parseWardList(userWard)
      .map((item) => normalizeKey(item))
      .some((item) => viewerWards.has(item));
  };
  const visibleUsersFor = (viewer, users) => {
    const visibleUsers = users.filter(
      (user) => user.id !== viewer.id && user.role !== "Super Admin",
    );
    if (isAdminRole(viewer)) return visibleUsers;
    if (viewer.role === "Supervisor")
      return visibleUsers.filter(
        (user) =>
          user.role === "Agent" &&
          normalizeKey(user.lga) === normalizeKey(viewer.lga) &&
          wardMatches(user.ward, viewer.ward),
      );
    if (viewer.role === "Agent") return [];
    return visibleUsers.filter((user) => canManageRank(viewer.rank, user.rank));
  };
  const canCreateUser = (viewer, rank, role) => {
    if (viewer.role === "Super Admin")
      return ["Agent", "Supervisor", "Response Team", "Admin"].includes(role);
    if (viewer.role === "Admin")
      return ["Agent", "Supervisor", "Response Team"].includes(role);
    return false;
  };
  const canDeleteUser = (viewer, target) => {
    if (!target || target.id === viewer.id) return false;
    if (viewer.role === "Super Admin") return true;
    if (viewer.role === "Admin")
      return target.role !== "Super Admin" && target.role !== "Admin";
    return canManageRank(viewer.rank, target.rank);
  };
  const canAccessRoom = (viewer, room) =>
    !!room && (isAdminRole(viewer) || room.members?.includes(viewer.id));
  const isSosIncident = (incident) =>
    incident?.reportType === "SOS-Emergency" || incident?.style?.source === "sos";
  const sameZone = (viewer, incident) =>
    !!viewer?.lga &&
    !!viewer?.ward &&
    normalizeKey(viewer.lga) === normalizeKey(incident?.lga) &&
    wardMatches(incident?.ward, viewer.ward);
  const canAccessIncident = (viewer, incident) =>
    isAdminRole(viewer) ||
    (viewer?.role === "Supervisor" && sameZone(viewer, incident)) ||
    incident.createdBy === viewer.id ||
    incident.assignedTo === viewer.id ||
    (incident.visibleTo || []).includes(viewer.id);
  const canSupervisorAssign = (viewer, incident, target) =>
    viewer?.role === "Supervisor" &&
    canAccessIncident(viewer, incident) &&
    (target?.id === viewer.id || visibleUsersFor(viewer, [target]).length > 0);
  const emitIncidentToViewers = (event, incident) => {
    for (const client of io.sockets.sockets.values()) {
      if (
        client.data.authUser &&
        canAccessIncident(client.data.authUser, incident)
      )
        client.emit(event, incident);
    }
  };
  const emitNotification = (notification) => {
    for (const client of io.sockets.sockets.values()) {
      if (client.data.authUser?.id === notification.userId)
        client.emit("notification:new", notification);
    }
  };
  const normalizeKey = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();
  const sameValue = (left, right) => !!normalizeKey(left) && normalizeKey(left) === normalizeKey(right);
  const canAccessGeography = (viewer, geography = {}) => {
    if (!viewer || !geography) return false;
    if (isAdminRole(viewer)) return true;
    if (geography.state && !sameValue(viewer.state || 'Oyo', geography.state)) return false;
    if (!viewer.lga || (geography.lga && !sameValue(viewer.lga, geography.lga))) return false;
    if (viewer.role === 'Supervisor') return !geography.ward || wardMatches(geography.ward, viewer.ward);
    if (viewer.role === 'Agent') {
      if (!geography.ward || !wardMatches(geography.ward, viewer.ward)) return false;
      return !geography.pollingUnit || sameValue(viewer.pollingUnit, geography.pollingUnit);
    }
    return sameOperationalSpace(viewer, geography);
  };
  const canAccessUserGeography = (viewer, target) => canAccessGeography(viewer, target);
  const emitAuthorized = (event, payload, geography = payload?.geography || payload) => {
    for (const client of io.sockets.sockets.values()) {
      if (client.data.authUser && canAccessGeography(client.data.authUser, geography)) client.emit(event, payload);
    }
  };
  const normalizeCommandKey = (value) =>
    normalizeCommand(value || "").toLowerCase();
  const userIdOf = (user) => user?.userId || user?.id;
  const distanceMeters = (a, b) => {
    const lat1 = Number(a?.lat);
    const lng1 = Number(a?.lng);
    const lat2 = Number(b?.lat);
    const lng2 = Number(b?.lng);
    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;
    const toRad = (degrees) => (degrees * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const startLat = toRad(lat1);
    const endLat = toRad(lat2);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };
  const isControlRoomUser = (user) =>
    isAdminRole(user) || normalizeKey(user?.unit).includes("control room");
  const sameOperationalSpace = (sender, receiver) => {
    if (!userIdOf(sender) || userIdOf(sender) === userIdOf(receiver))
      return false;
    const senderUnitType = normalizeKey(
      sender.unitType || sender.unit || sender.role,
    );
    if (senderUnitType.includes("station")) {
      return (
        !!normalizeKey(sender.station || sender.unit) &&
        normalizeKey(sender.station || sender.unit) ===
          normalizeKey(receiver.station || receiver.unit)
      );
    }
    if (senderUnitType.includes("division")) {
      return (
        !!normalizeKey(sender.division || sender.unit) &&
        normalizeKey(sender.division || sender.unit) ===
          normalizeKey(receiver.division || receiver.unit)
      );
    }
    return (
      !!normalizeCommandKey(sender.command || sender.unit) &&
      normalizeCommandKey(sender.command || sender.unit) ===
        normalizeCommandKey(receiver.command || receiver.unit)
    );
  };
  const sosVisibleTo = (alert) => {
    const ids = new Set();
    for (const socket of io.sockets.sockets.values()) {
      const user = socket.data.user;
      const id = userIdOf(user);
      if (!id || id === userIdOf(alert) || isControlRoomUser(user)) continue;
      const local =
        user.role === "Supervisor"
          ? sameZone(user, alert)
          : sameOperationalSpace(alert, user);
      const nearby =
        user.role !== "Supervisor" && distanceMeters(alert, user) <= 5000;
      if (local || nearby) ids.add(id);
    }
    return [...ids];
  };
  const emitEmergencyAlert = (sourceSocket, alert) => {
    const normalized = {
      ...alert,
      id: alert.id || `em-${Date.now()}`,
      timestamp: alert.timestamp || new Date().toISOString(),
    };
    for (const socket of io.sockets.sockets.values()) {
      if (socket.id === sourceSocket.id) continue;
      const user = socket.data.user;
      if (!user?.userId) continue;
      const controlRoom = isControlRoomUser(user);
      const localResponder =
        user.role === "Supervisor"
          ? sameZone(user, normalized)
          : sameOperationalSpace(normalized, user);
      const nearbyResponder =
        !controlRoom &&
        user.role !== "Supervisor" &&
        distanceMeters(normalized, user) <= 5000;
      if (controlRoom || localResponder || nearbyResponder) {
        socket.emit("emergency:alert", { ...normalized, silent: controlRoom });
      }
    }
  };

  return { canManageUsers, visibleUsersFor, canCreateUser, canDeleteUser, canAccessRoom, isSosIncident, canAccessIncident, canSupervisorAssign, emitIncidentToViewers, emitNotification, normalizeKey, canAccessGeography, canAccessUserGeography, emitAuthorized, sosVisibleTo, emitEmergencyAlert };
}
