import { createId, normalizeText, sanitizeString, validateCoordinates } from "../../security.js";
import { joinSocketToChatRooms } from "../../chat-realtime.js";
export function registerFieldRealtime({ app, auth, rateLimit, io, store, socketLimiter, authenticateToken, activeCameraShares, isAdminRole, reverseLocation, logIp, emitEmergencyAlert, canAccessUserGeography }) {
  const emitAuthorizedUserEvent = async (event, payload, subject) => {
    for (const client of io.sockets.sockets.values()) {
      try {
        const recipient = await authenticateToken(client.handshake.auth?.token || "");
        client.data.authUser = recipient;
        if (isAdminRole(recipient) || canAccessUserGeography(recipient, subject)) client.emit(event, payload);
      } catch {
        client.disconnect(true);
      }
    }
  };
  app.post("/api/gps/ping", auth, rateLimit, async (req, res) => {
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (!validateCoordinates(lat, lng))
      return res.status(400).json({ message: "Invalid GPS coordinates" });
    const point = {
      lat,
      lng,
      accuracy: Math.max(0, Math.min(Number(req.body.accuracy) || 0, 100_000)),
      userId: req.user.id,
      timestamp: new Date().toISOString(),
    };
    await emitAuthorizedUserEvent("gps:broadcast", point, req.user);
    res.json({ received: true });
  });
  io.use((socket, next) => {
    authenticateToken(socket.handshake.auth?.token || "")
      .then((user) => {
        socket.data.authUser = user;
        next();
      })
      .catch(() => next(new Error("Unauthorized realtime connection")));
  });
  io.on("connection", async (socket) => {
    const refreshSocketUser = async () => {
      try {
        const user = await authenticateToken(socket.handshake.auth?.token || "");
        socket.data.authUser = user;
        socket.data.user = { ...(socket.data.user || {}), ...user, userId: user.id };
        return user;
      } catch {
        socket.emit("operation:error", { message: "Session expired. Please sign in again." });
        socket.disconnect(true);
        return null;
      }
    };
    socket.data.user = {
      ...socket.data.authUser,
      userId: socket.data.authUser.id,
    };
    try {
      await joinSocketToChatRooms(
        socket,
        store,
        socket.data.authUser,
        isAdminRole,
      );
    } catch (error) {
      console.error("[chat] Could not join realtime rooms:", error.message);
      socket.emit("operation:error", {
        message: "Realtime chat could not be initialized.",
      });
    }
    socket.on("gps:update", async (point) => {
      const user = await refreshSocketUser();
      if (!user) return;
      if (
        !socketLimiter.hit(`gps:${socket.data.authUser.id}`, 30, 60_000).allowed
      )
        return;
      const lat = Number(point?.lat);
      const lng = Number(point?.lng);
      if (!validateCoordinates(lat, lng)) return;
      const safePoint = {
        userId: user.id,
        lat,
        lng,
        accuracy: Math.max(0, Math.min(Number(point?.accuracy) || 0, 100_000)),
        timestamp: new Date().toISOString(),
      };
      socket.data.user = { ...(socket.data.user || {}), ...safePoint };
      await emitAuthorizedUserEvent("gps:broadcast", safePoint, user);
    });
    socket.on("gps:stop", async () => {
      const user = await refreshSocketUser();
      if (!user) return;
      await emitAuthorizedUserEvent("gps:offline", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      }, user);
    });
    socket.on("emergency:send", async (alert) => {
      const user = await refreshSocketUser();
      if (!user) return;
      if (
        !socketLimiter.hit(`emergency:${socket.data.authUser.id}`, 5, 60_000)
          .allowed
      )
        return socket.emit("operation:error", {
          message: "Too many emergency alerts. Please try again shortly.",
        });
      const ip = socket.handshake.address || "unknown";
      const lat = Number(alert?.lat);
      const lng = Number(alert?.lng);
      if (!validateCoordinates(lat, lng))
        return socket.emit("operation:error", {
          message: "Invalid emergency location",
        });
      const alertId = createId("em");
      logIp(
        "SOS",
        { id: user.id, name: user.name, role: user.role },
        alertId,
        ip,
      );
      emitEmergencyAlert(socket, {
        ...(socket.data.user || {}),
        id: alertId,
        type: normalizeText(alert?.type || "Emergency"),
        text: normalizeText(alert?.text || ""),
        lat,
        lng,
        userId: user.id,
        name: user.name,
        role: user.role,
      });
    });
    socket.on("camera:register", async (clientData) => {
      const user = await refreshSocketUser();
      if (!user) return;
      const lat = Number(clientData?.lat);
      const lng = Number(clientData?.lng);
      const safeUser = {
        ...socket.data.authUser,
        userId: socket.data.authUser.id,
      };
      if (validateCoordinates(lat, lng)) Object.assign(safeUser, { lat, lng });
      socket.data.cameraUser = {
        userId: safeUser.userId,
        name: safeUser.name,
        role: safeUser.role,
      };
      socket.data.user = { ...(socket.data.user || {}), ...safeUser };
      socket.join(`camera:user:${safeUser.userId}`);
      if (isAdminRole(safeUser))
        socket.emit("camera:shares:list", [...activeCameraShares.values()]);
    });
    socket.on("camera:share:start", async (payload) => {
      const currentUser = await refreshSocketUser();
      if (!currentUser) return;
      if (
        !["Agent", "Supervisor", "Response Team"].includes(
          socket.data.authUser.role,
        )
      )
        return;
      const currentPosition = socket.data.user || {};
      const lat = Number(currentPosition.lat);
      const lng = Number(currentPosition.lng);
      const safePayload = {
        userId: socket.data.authUser.id,
        name: socket.data.authUser.name,
        role: socket.data.authUser.role,
        mode: normalizeText(payload?.mode || ""),
        lga: sanitizeString(socket.data.authUser.lga || ""),
        ward: sanitizeString(socket.data.authUser.ward || ""),
        pollingUnit: sanitizeString(socket.data.authUser.pollingUnit || ""),
        station: sanitizeString(socket.data.authUser.station || ""),
        ...(validateCoordinates(lat, lng)
          ? {
              lat,
              lng,
              accuracy: Math.max(
                0,
                Math.min(Number(currentPosition.accuracy) || 0, 100_000),
              ),
            }
          : {}),
      };
      activeCameraShares.set(safePayload.userId, safePayload);
      await emitAuthorizedUserEvent("camera:share:start", safePayload, currentUser);
      if (validateCoordinates(lat, lng)) {
        reverseLocation(lat, lng)
          .then(async (location) => {
            const active = activeCameraShares.get(safePayload.userId);
            if (!active) return;
            const updated = { ...active, location };
            activeCameraShares.set(safePayload.userId, updated);
            await emitAuthorizedUserEvent("camera:share:start", updated, currentUser);
          })
          .catch((error) =>
            console.error(
              "[camera] location watermark lookup failed:",
              error.message,
            ),
          );
      }
    });
    socket.on("camera:share:stop", async () => {
      const currentUser = await refreshSocketUser();
      if (!currentUser) return;
      const userId = socket.data.authUser.id;
      activeCameraShares.delete(userId);
      await emitAuthorizedUserEvent("camera:share:stop", { userId }, currentUser);
    });
    socket.on("camera:view:request", async ({ officerId } = {}) => {
      if (process.env.ENABLE_LEGACY_CAMERA_SIGNALING !== 'true') {
        socket.emit('operation:error', { code: 'MEDIA_SERVICE_REQUIRED', message: 'Live video now uses the dedicated media service.' });
        return;
      }
      const viewer = await refreshSocketUser();
      if (!viewer) return;
      if (
        !isAdminRole(socket.data.authUser) ||
        !activeCameraShares.has(officerId)
      )
        return;
      io.to(`camera:user:${officerId}`).emit("camera:viewer:request", {
        viewerSocketId: socket.id,
      });
    });
    socket.on("camera:signal", async ({ target, data } = {}) => {
      if (process.env.ENABLE_LEGACY_CAMERA_SIGNALING !== 'true') {
        socket.emit('operation:error', { code: 'MEDIA_SERVICE_REQUIRED', message: 'Live video signaling now uses the dedicated media service.' });
        return;
      }
      const sender = await refreshSocketUser();
      if (!sender) return;
      if (
        !socketLimiter.hit(`signal:${socket.data.authUser.id}`, 120, 60_000)
          .allowed
      )
        return;
      const peer = io.sockets.sockets.get(target);
      if (!peer || JSON.stringify(data || {}).length > 100_000) return;
      const senderIsAdmin = isAdminRole(socket.data.authUser);
      let peerUser;
      try { peerUser = await authenticateToken(peer.handshake.auth?.token || ""); }
      catch { peer.disconnect(true); return; }
      peer.data.authUser = peerUser;
      const peerIsAdmin = isAdminRole(peerUser);
      if (senderIsAdmin === peerIsAdmin) return;
      if (!senderIsAdmin && !canAccessUserGeography(sender, peerUser)) return;
      io.to(target).emit("camera:signal", {
        from: socket.id,
        fromUserId: socket.data.authUser.id,
        fromName: socket.data.authUser.name,
        data,
      });
    });
    socket.on("disconnect", () => {
      const user = socket.data.cameraUser;
      if (
        ["Agent", "Supervisor", "Response Team"].includes(user?.role) &&
        activeCameraShares.has(user.userId)
      ) {
        activeCameraShares.delete(user.userId);
        emitAuthorizedUserEvent("camera:share:stop", { userId: user.userId }, user).catch(() => {});
      }
    });
  });

}
