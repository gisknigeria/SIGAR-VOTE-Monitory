import { createId, sanitizeString } from "../../security.js";
export function registerLayerRoutes({ app, auth, superAdminOnly, rateLimit, asyncRoute, store, io, isAdminRole, emitAuthorized }) {
  app.get(
    "/api/map-layers",
    auth,
    rateLimit,
    asyncRoute(async (_, res) => res.json(await store.mapLayers())),
  );
  app.post(
    "/api/map-layers",
    auth,
    superAdminOnly,
    rateLimit,
    asyncRoute(async (req, res) => {
      if (!req.body.name || !req.body.type)
        return res
          .status(400)
          .json({ message: "Layer name and type are required" });
      const layer = {
        id: createId("layer"),
        name: sanitizeString(req.body.name).trim(),
        type: req.body.type,
        data: req.body.data || null,
        url: sanitizeString(req.body.url || ""),
        bounds: req.body.bounds || null,
        opacity: Number(req.body.opacity) || 0.65,
        fillOpacity: Number(req.body.fillOpacity ?? 0.18),
        category:
          sanitizeString(
            req.body.category ||
              (req.body.type === "raster" ? "Raster" : "Point"),
          ).trim() || "Point",
        operationalUse:
          sanitizeString(req.body.operationalUse || "Reference").trim() ||
          "Reference",
        color: sanitizeString(req.body.color || "#facc15"),
        fillColor: sanitizeString(
          req.body.fillColor || req.body.color || "#f59e0b",
        ),
        lineWeight: Number(req.body.lineWeight) || 2,
        lineStyle: sanitizeString(req.body.lineStyle || "solid"),
        pointIcon: sanitizeString(req.body.pointIcon || "pin"),
        pointIconColor: sanitizeString(req.body.pointIconColor || "#ffffff"),
        pointSize: Number(req.body.pointSize ?? 2),
        showLabels: req.body.showLabels ?? true,
        labelField: sanitizeString(req.body.labelField || "name"),
        labelColor: sanitizeString(req.body.labelColor || "#3f0b1b"),
        popupFields: sanitizeString(req.body.popupFields || ""),
        visible: req.body.visible ?? true,
        zIndex: Number(req.body.zIndex) || 0,
        createdAt: new Date().toISOString(),
      };
      const created = await store.createMapLayer(layer);
      emitAuthorized("map-layer:created", created, created);
      res.status(201).json(created);
    }),
  );
  app.put(
    "/api/map-layers/:id",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      const allowedKeys = isAdminRole(req.user)
        ? [
            "visible",
            "opacity",
            "fillOpacity",
            "color",
            "fillColor",
            "lineWeight",
            "lineStyle",
            "pointIcon",
            "pointIconColor",
            "pointSize",
            "showLabels",
            "labelField",
            "labelColor",
            "popupFields",
            "category",
            "operationalUse",
            "name",
            "zIndex",
          ]
        : ["visible"];
      const changes = {};
      for (const key of allowedKeys) {
        if (req.body[key] === undefined) continue;
        changes[key] = [
          "opacity",
          "fillOpacity",
          "lineWeight",
          "pointSize",
          "zIndex",
        ].includes(key)
          ? Number(req.body[key])
          : req.body[key];
      }
      if (!Object.keys(changes).length)
        return res
          .status(400)
          .json({ message: "No permitted layer changes supplied" });
      const updated = await store.updateMapLayer(req.params.id, changes);
      if (!updated)
        return res.status(404).json({ message: "Map layer not found" });
      emitAuthorized("map-layer:updated", updated, updated);
      res.json(updated);
    }),
  );
  app.delete(
    "/api/map-layers/:id",
    auth,
    superAdminOnly,
    rateLimit,
    asyncRoute(async (req, res) => {
      const layer = (await store.mapLayers()).find((item) => item.id === req.params.id);
      if (!layer) return res.status(404).json({ message: "Map layer not found" });
      await store.deleteMapLayer(req.params.id);
      emitAuthorized("map-layer:deleted", req.params.id, layer || {});
      res.status(204).end();
    }),
  );

}
