import { createId, normalizeText, validateExternalUrl, validateCoordinates } from "../../security.js";
import { resolveOptionalCoordinate } from "../foundation/geography-query.js";
export function registerCameraRoutes({ app, auth, adminOnly, rateLimit, asyncRoute, store, io, emitAuthorized, canAccessGeography }) {
  app.get(
    "/api/cameras",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => res.json((await store.cameras()).filter((camera) => canAccessGeography(req.user, camera)))),
  );
  app.post(
    "/api/cameras",
    auth,
    adminOnly,
    rateLimit,
    asyncRoute(async (req, res) => {
      if (!req.body.name || !req.body.url)
        return res
          .status(400)
          .json({ message: "Camera name and stream URL are required" });
      if (!validateExternalUrl(req.body.url, ["https:"]))
        return res
          .status(400)
          .json({
            message:
              "Camera URL must be an HTTPS URL without embedded credentials",
          });
      const lat = resolveOptionalCoordinate(req.body.lat);
      const lng = resolveOptionalCoordinate(req.body.lng);
      if ((lat === null) !== (lng === null))
        return res.status(400).json({ message: "Provide both camera coordinates, or neither if the location is unknown" });
      if (lat !== null && !validateCoordinates(lat, lng))
        return res.status(400).json({ message: "Invalid camera coordinates" });
      const camera = {
        id: createId("cam"),
        name: normalizeText(req.body.name),
        type: normalizeText(req.body.type || "CCTV"),
        url: String(req.body.url),
        lat,
        lng,
        state: String(req.body.state || 'Oyo').trim(),
        lga: String(req.body.lga || '').trim(),
        ward: String(req.body.ward || '').trim(),
        pollingUnit: String(req.body.pollingUnit || '').trim(),
        status: "Online",
        createdAt: new Date().toISOString(),
      };
      const created = await store.createCamera(camera);
      emitAuthorized("camera:created", created, created);
      res.status(201).json(created);
    }),
  );
  app.delete(
    "/api/cameras/:id",
    auth,
    adminOnly,
    rateLimit,
    asyncRoute(async (req, res) => {
      const camera = (await store.cameras()).find((item) => item.id === req.params.id);
      if (!camera) return res.status(404).json({ message: 'Camera not found' });
      await store.deleteCamera(req.params.id);
      emitAuthorized("camera:deleted", req.params.id, camera || {});
      res.status(204).end();
    }),
  );

}
