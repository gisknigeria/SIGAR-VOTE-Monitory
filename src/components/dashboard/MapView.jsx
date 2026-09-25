import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import { oyoBoundariesQuery } from "../../queries/boundaries.js";
import { apiRequest } from "../../api/client.js";
import LayerControlPanel, { layerGeometry } from "./LayerControlPanel.jsx";
import { STREET_TILES } from "../../config.js";

const DATA_LAYERS = ["none", "population", "network"];
const DATA_LAYER_LABEL = { none: "Data layer: off", population: "Data layer: Population", network: "Data layer: Network" };

export default function MapView({
  incidents,
  officers,
  cameras,
  mapLayers,
  emergencyAlerts,
  analysisLayers,
  selected,
  onSelect,
  onMapClick,
  mapRef,
  layer,
  drawMode,
  areas,
  measurePoints,
  routePoints,
  routeResult,
  routeUserPoint,
  onAreaCreated,
  onToolPoint,
  onMarkerTool,
  isAdmin,
  onLayerToggle,
  onLayerOpacity,
  showBoundaryLayer,
  showStateBorders,
  showLgaBorders,
  showBoundaryNames,
  partyMapAnalysis,
  selectedBoundaryState,
  onBoundarySelect,
  onBoundaryClear,
  focusedOfficerId,
  onClearOfficerFocus,
  helpers,
  authToken,
  dataLayer = "none",
  onDataLayerChange,
}) {
  const { formatDistance, formatDuration, hexToRgba, LINE_STYLES, OYO_CENTER, pointArray, pointIconSvg, REPORT_TYPE_STYLES, reportCenter, reportIconSvg, reportStyle, totalDistance } = helpers;
  const el = useRef(null);
  const leaflet = useRef(null);
  const overlays = useRef([]);
  const areaLayers = useRef([]);
  const customLayers = useRef([]);
  const toolLayers = useRef([]);
  const tile = useRef(null);
  const boundaryOverlay = useRef(null);
  const lgaOverlay = useRef(null);
  const nigeriaStateOverlay = useRef(null);
  const nigeriaLgaOverlay = useRef(null);
  const nigeriaStateLabels = useRef([]);
  const nigeriaLgaLabels = useRef([]);
  const hoverBoundaryLayer = useRef(null);
  const dataLayerOverlay = useRef(null);
  const dataLayerControl = useRef(null);
  const dataLayerLegend = useRef(null);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const { data: oyoBoundaries } = useQuery(oyoBoundariesQuery);

  const populationQuery = useQuery({
    queryKey: ["demographics-datasets", "population", "lga", authToken],
    queryFn: ({ signal }) => apiRequest("/demographics/datasets?metric=population&resolution=lga", authToken, { signal }),
    enabled: Boolean(authToken) && dataLayer === "population",
    staleTime: 10 * 60_000,
  });
  const connectivityQuery = useQuery({
    queryKey: ["connectivity-datasets", "lga", authToken],
    queryFn: ({ signal }) => apiRequest("/connectivity/datasets?resolution=lga", authToken, { signal }),
    enabled: Boolean(authToken) && dataLayer === "network",
    staleTime: 10 * 60_000,
  });

  const normalizeLgaKey = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

  const populationByLga = useMemo(() => {
    const map = new Map();
    for (const dataset of populationQuery.data || []) {
      for (const record of dataset.records) {
        if (record.geography.lga) map.set(normalizeLgaKey(record.geography.lga), record.value);
      }
    }
    return map;
  }, [populationQuery.data]);

  const networkByLga = useMemo(() => {
    const map = new Map();
    for (const dataset of connectivityQuery.data || []) {
      for (const record of dataset.records) {
        if (record.geography.lga && record.observationType === "measured") {
          map.set(normalizeLgaKey(record.geography.lga), { ...record.coverage, avgLatencyMs: record.signal?.avgLatencyMs ?? null });
        }
      }
    }
    return map;
  }, [connectivityQuery.data]);

  const normalizeBoundaryKey = (value) =>
    String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  const normalizeLgaMatch = (value) =>
    String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const escapeMapText = (value) =>
    String(value || "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const partyLgaResults = useMemo(
    () => Object.fromEntries(Object.entries(partyMapAnalysis?.byLga || {}).map(([name, result]) => [normalizeLgaMatch(name), result])),
    [partyMapAnalysis],
  );

  const getStateKey = (feature) =>
    normalizeBoundaryKey(
      feature.properties?.STATE_NAME ||
        feature.properties?.ADM1_EN ||
        feature.properties?.state ||
        feature.properties?.STATE ||
        feature.properties?.state_name ||
        feature.properties?.admin1Name ||
        feature.properties?.NAME_1 ||
        feature.properties?.name ||
        feature.properties?.NAME ||
        "",
    );

  const getLgaKey = (feature) =>
    normalizeBoundaryKey(
      feature.properties?.ADM2_EN ||
        feature.properties?.lga_name ||
        feature.properties?.LGA ||
        feature.properties?.lga ||
        feature.properties?.LTNAME ||
        "",
    );

  const getBoundaryLabel = (feature) =>
    feature.properties?.STATE_NAME ||
    feature.properties?.state ||
    feature.properties?.NAME ||
    feature.properties?.name ||
    feature.properties?.ADM2_EN ||
    feature.properties?.lga_name ||
    feature.properties?.LGA ||
    feature.properties?.lga ||
    feature.properties?.shapeName ||
    "";

  const buildBoundaryFeatures = () =>
    mapLayers
      .filter(
        (layerItem) =>
          layerItem.visible !== false &&
          layerItem.type === "geojson" &&
          layerItem.data?.features,
      )
      .flatMap((layerItem) =>
        layerItem.data.features.filter((feature) => {
          if (!feature.geometry?.type?.includes("Polygon")) return false;
          const p = feature.properties || {};
          // Exclude features picked up by dedicated state/LGA overlays
          const isStateFeature = p.STATE_NAME || p.admin1Name || p.NAME_1 || p.State || (p.state && !p.ADM2_EN && !p.lga_name && !p.LGA);
          const isLgaFeature = p.ADM2_EN || p.lga_name || p.LGA || p.lga || p.LTNAME;
          if (isStateFeature || isLgaFeature) return false;
          return true;
        }),
      );

  const handleBoundaryClick = (feature) => {
    const label = getBoundaryLabel(feature);
    const stateKey = getStateKey(feature);
    const lgaKey = getLgaKey(feature);
    const selectedKey = stateKey || lgaKey || label;
    onBoundarySelect?.(selectedKey, label);
  };

  const dataLayerRef = useRef(dataLayer);
  const onDataLayerChangeRef = useRef(onDataLayerChange);
  useEffect(() => {
    dataLayerRef.current = dataLayer;
    onDataLayerChangeRef.current = onDataLayerChange;
  });

  useEffect(() => {
    if (leaflet.current || !el.current) return;
    const map = L.map(el.current, {
      zoomControl: false,
      doubleClickZoom: false,
    }).setView(OYO_CENTER, 9);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    const DataLayerControl = L.Control.extend({
      onAdd() {
        const button = L.DomUtil.create("button", "map-data-layer-toggle");
        button.type = "button";
        button.textContent = DATA_LAYER_LABEL.none;
        L.DomEvent.disableClickPropagation(button);
        button.onclick = () => {
          const current = dataLayerRef.current;
          const next = DATA_LAYERS[(DATA_LAYERS.indexOf(current) + 1) % DATA_LAYERS.length];
          onDataLayerChangeRef.current?.(next);
        };
        this._button = button;
        return button;
      },
      update(value) {
        if (!this._button) return;
        this._button.textContent = DATA_LAYER_LABEL[value] || DATA_LAYER_LABEL.none;
        this._button.classList.toggle("active", value !== "none");
      },
    });
    dataLayerControl.current = new DataLayerControl({ position: "topright" }).addTo(map);

    leaflet.current = map;
    mapRef.current = map;
    return () => {
      overlays.current.forEach((x) => x.remove());
      areaLayers.current.forEach((x) => x.remove());
      toolLayers.current.forEach((x) => x.remove());
      overlays.current = [];
      areaLayers.current = [];
      toolLayers.current = [];
      map.remove();
      leaflet.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    dataLayerControl.current?.update(dataLayer);
  }, [dataLayer]);

  useEffect(() => {
    if (!leaflet.current) return;
    tile.current?.remove();
    const maptilerKey = import.meta.env.VITE_MAPTILER_KEY;
    const osm = () =>
      maptilerKey
        ? L.tileLayer(
            `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${maptilerKey}`,
            {
              crossOrigin: true,
              maxZoom: 19,
              attribution: "&copy; MapTiler &copy; OpenStreetMap contributors",
            },
          )
        : L.tileLayer(STREET_TILES.url, {
            crossOrigin: true,
            maxZoom: 19,
            subdomains: STREET_TILES.subdomains,
            attribution: STREET_TILES.attribution,
          });
    const esri = (service) =>
      L.tileLayer(
        `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`,
        { crossOrigin: true, maxZoom: 19, attribution: "Tiles &copy; Esri" },
      );
    const imagery = () => esri("World_Imagery");
    const topo = () => esri("World_Topo_Map");
    const esriStreet = () => esri("World_Street_Map");
    const terrain = () =>
      L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
        crossOrigin: true,
        maxZoom: 17,
        attribution: "&copy; OpenTopoMap contributors",
      });
    let layers;
    if (layer === "Terrain") layers = [terrain()];
    else if (layer === "Topo") layers = [topo()];
    else if (layer === "EsriStreet") layers = [esriStreet()];
    else if (layer === "Satellite") layers = [imagery()];
    else layers = [osm()];
    tile.current = L.layerGroup(layers).addTo(leaflet.current);
    tile.current.eachLayer((x) => x.bringToBack());
  }, [layer]);
  useEffect(() => {
    if (!leaflet.current) return;
    overlays.current.forEach((x) => x.remove());
    overlays.current = [];
    incidents.forEach((item) => {
      const style = reportStyle(item);
      const layerStyle = {
        color: style.color,
        fillColor: style.fillColor || style.color,
        opacity: Number(style.opacity ?? 0.8),
        fillOpacity: Number(style.fillOpacity ?? 0.18),
        weight: 3,
      };
      let reportLayer;
      if (item.geometry?.type === "circle")
        reportLayer = L.circle(item.geometry.center, {
          ...layerStyle,
          radius: Number(item.geometry.radius || style.radius || 250),
        });
      else if (item.geometry?.type === "freehand")
        reportLayer = L.polygon(item.geometry.points, layerStyle);
      else if (style.geometryType === "circle")
        reportLayer = L.circle([item.lat, item.lng], {
          ...layerStyle,
          radius: Number(style.radius || 250),
        });
      if (reportLayer) {
        reportLayer
          .addTo(leaflet.current)
          .on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            onSelect(item);
          })
          .bindTooltip(item.title || item.reportType, { sticky: true });
        overlays.current.push(reportLayer);
      }
      const center = reportCenter(item.geometry) || {
        lat: item.lat,
        lng: item.lng,
      };
      const icon = L.divIcon({
        className: "",
        html: `<div class="report-marker" style="--pin:${style.color};--fill:${style.fillColor || style.color};--alpha:${Number(style.opacity ?? 0.85)}"><span style="display:grid;place-items:center;font-size:11px;font-weight:800;font-family:Inter,Arial,sans-serif">${reportIconSvg(style.icon || REPORT_TYPE_STYLES[item.reportType]?.icon || "IP", "#ffffff", 14)}</span></div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });
      const marker = L.marker([center.lat, center.lng], { icon })
        .addTo(leaflet.current)
        .on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelect(item);
        });
      marker.bindTooltip(item.title, { direction: "top" });
      overlays.current.push(marker);
    });
    officers.forEach((item) => {
      const locationName = item.locationName || item.unit || "Last known location";
      const shortName = String(item.name || "User").trim().split(/\s+/).pop();
      const isFocused = item.id === focusedOfficerId;
      const coordinateLabel = `${Number(item.lat).toFixed(5)}, ${Number(item.lng).toFixed(5)}`;
      const freshnessLabel = item.hasLiveLocation ? "Current live location" : "Last known location";
      const updatedLabel = item.lastSeen
        ? `Updated ${new Date(item.lastSeen).toLocaleString()}`
        : "No live update time available";
      const icon = L.divIcon({
        className: "",
        html: `<div class="officer-marker ${item.status.toLowerCase()}"><span></span>${escapeMapText(shortName)}</div>`,
        iconSize: [92, 28],
        iconAnchor: [12, 14],
      });
      const marker = L.marker([item.lat, item.lng], { icon }).addTo(
        leaflet.current,
      );
      marker.bindPopup(
        `<div class="marker-popup"><b>${escapeMapText(item.name)}</b><br>${escapeMapText(locationName)}<br>Status: ${escapeMapText(item.status)}${item.lastSeen ? `<br>Last GPS: ${new Date(item.lastSeen).toLocaleTimeString()}` : ""}${item.speed != null ? `<br>Speed: ${Math.round(item.speed * 3.6)} km/h` : ""}<div class="marker-actions"><button data-tool="measure">Measure from here</button><button data-tool="route">Route from here</button></div></div>`,
      );
      marker.bindTooltip(
        `<div class="officer-location-label"><div class="officer-location-label-head"><strong>${escapeMapText(item.name)}</strong>${isFocused ? '<button type="button" data-close-officer-label aria-label="Close user location label">×</button>' : ""}</div><span>${escapeMapText(freshnessLabel)}</span><b>${escapeMapText(locationName)}</b><small>${escapeMapText(coordinateLabel)}</small><em>${escapeMapText(updatedLabel)}</em></div>`,
        {
          permanent: isFocused,
          direction: "top",
          offset: [0, -10],
          className: "officer-location-tooltip",
          interactive: isFocused,
        },
      );
      marker.on("tooltipopen", (event) => {
        const closeButton = event.tooltip
          .getElement()
          ?.querySelector("[data-close-officer-label]");
        if (closeButton) {
          closeButton.onclick = (clickEvent) => {
            L.DomEvent.stopPropagation(clickEvent);
            onClearOfficerFocus?.("");
          };
        }
      });
      marker.on("popupopen", (event) =>
        event.popup
          .getElement()
          ?.querySelectorAll("[data-tool]")
          .forEach((button) =>
            button.addEventListener("click", () =>
              onMarkerTool(button.dataset.tool, {
                lat: Number(item.lat),
                lng: Number(item.lng),
                label: item.name,
              }),
            ),
          ),
      );
      overlays.current.push(marker);
    });
    cameras.forEach((item) => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="camera-marker ${item.feedType === "Drone" ? "drone" : ""}">CAM</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const marker = L.marker([item.lat, item.lng], { icon }).addTo(
        leaflet.current,
      );
      marker.bindPopup(
        `<div class="marker-popup"><b>${item.name}</b><br>${item.feedType || item.type || "Camera"}<br>${Number(item.lat).toFixed(5)}, ${Number(item.lng).toFixed(5)}<div class="marker-actions"><button data-tool="measure">Measure from here</button><button data-tool="route">Route from here</button></div></div>`,
      );
      marker.on("popupopen", (event) =>
        event.popup
          .getElement()
          ?.querySelectorAll("[data-tool]")
          .forEach((button) =>
            button.addEventListener("click", () =>
              onMarkerTool(button.dataset.tool, {
                lat: Number(item.lat),
                lng: Number(item.lng),
                label: item.name,
              }),
            ),
          ),
      );
      overlays.current.push(marker);
    });
    emergencyAlerts.forEach((alert) => {
      const icon = L.divIcon({
        className: "",
        html: '<div class="emergency-marker">SOS</div>',
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      });
      const marker = L.marker([alert.lat, alert.lng], { icon }).addTo(
        leaflet.current,
      );
      marker.bindPopup(
        `<div class="marker-popup emergency-popup"><b>Emergency: ${alert.name}</b><br>${alert.type || "Emergency"}${alert.text ? `<br>${alert.text}` : ""}<br>${Number(alert.lat).toFixed(5)}, ${Number(alert.lng).toFixed(5)}</div>`,
      );
      overlays.current.push(marker);
    });
  }, [incidents, officers, cameras, emergencyAlerts, onMarkerTool, focusedOfficerId, onClearOfficerFocus]);
  useEffect(() => {
    if (!leaflet.current) return;
    areaLayers.current.forEach((x) => x.remove());
    areaLayers.current = [];
    areas.forEach((area) => {
      const style = {
        color: "#38bdf8",
        weight: 2,
        fillColor: "#1689cf",
        fillOpacity: 0.16,
        dashArray: "7 5",
      };
      const layerArea =
        area.type === "circle"
          ? L.circle(area.center, { ...style, radius: area.radius })
          : L.polygon(area.points, style);
      const label = `<b>${area.title || (area.type === "circle" ? "Command radius" : "Operational area")}</b>${area.note ? `<br>${area.note}` : ""}`;
      layerArea.addTo(leaflet.current).bindTooltip(label);
      areaLayers.current.push(layerArea);
    });
  }, [areas]);
  useEffect(() => {
    if (!leaflet.current) return;
    toolLayers.current.forEach((x) => x.remove());
    toolLayers.current = [];
    if (measurePoints.length) {
      measurePoints.forEach((point, index) => {
        const latlng = pointArray(point);
        const marker = L.circleMarker(latlng, {
          radius: 5,
          color: "#facc15",
          fillColor: "#facc15",
          fillOpacity: 1,
          weight: 2,
        })
          .addTo(leaflet.current)
          .bindTooltip(index === 0 ? "Measure start" : `Point ${index + 1}`, {
            direction: "top",
          });
        toolLayers.current.push(marker);
      });
      if (measurePoints.length > 1) {
        const line = L.polyline(measurePoints.map(pointArray), {
          color: "#facc15",
          weight: 4,
          dashArray: "8 6",
        }).addTo(leaflet.current);
        const label = L.marker(
          pointArray(measurePoints[measurePoints.length - 1]),
          {
            icon: L.divIcon({
              className: "tool-distance-label",
              html: `Distance: ${formatDistance(totalDistance(measurePoints))}`,
            }),
          },
        ).addTo(leaflet.current);
        toolLayers.current.push(line, label);
      }
    }
    if (routeResult?.points?.length) {
      const route = L.polyline(routeResult.points, {
        color: "#22c55e",
        weight: 6,
        opacity: 0.9,
      }).addTo(leaflet.current);
      const start = L.circleMarker(routeResult.points[0], {
        radius: 6,
        color: "#bbf7d0",
        fillColor: "#22c55e",
        fillOpacity: 1,
        weight: 2,
      })
        .addTo(leaflet.current)
        .bindTooltip("Route start", { direction: "top" });
      const end = L.circleMarker(
        routeResult.points[routeResult.points.length - 1],
        {
          radius: 6,
          color: "#bbf7d0",
          fillColor: "#16a34a",
          fillOpacity: 1,
          weight: 2,
        },
      )
        .addTo(leaflet.current)
        .bindTooltip("Route end", { direction: "top" });
      const label = L.marker(
        routeResult.points[Math.floor(routeResult.points.length / 2)],
        {
          icon: L.divIcon({
            className: "tool-route-label",
            html: `${formatDistance(routeResult.distance)} - ${formatDuration(routeResult.duration)}`,
          }),
        },
      ).addTo(leaflet.current);
      toolLayers.current.push(route, start, end, label);
      if (routeUserPoint?.lat && routeUserPoint?.lng) {
        const here = L.circleMarker([routeUserPoint.lat, routeUserPoint.lng], {
          radius: 7,
          color: "#ffffff",
          fillColor: "#2563eb",
          fillOpacity: 1,
          weight: 3,
        })
          .addTo(leaflet.current)
          .bindTooltip("You are here", { direction: "top" });
        toolLayers.current.push(here);
      }
    } else if (routePoints.length) {
      routePoints.forEach((point, index) => {
        const marker = L.circleMarker(pointArray(point), {
          radius: 6,
          color: "#bbf7d0",
          fillColor: index ? "#16a34a" : "#22c55e",
          fillOpacity: 1,
          weight: 2,
        })
          .addTo(leaflet.current)
          .bindTooltip(index ? "Route destination" : "Route start", {
            direction: "top",
          });
        toolLayers.current.push(marker);
      });
      if (routePoints.length > 1) {
        const line = L.polyline(routePoints.map(pointArray), {
          color: "#86efac",
          weight: 3,
          dashArray: "6 6",
        }).addTo(leaflet.current);
        toolLayers.current.push(line);
      }
    }
    analysisLayers.forEach((item) => {
      const style = {
        color: item.color || "#38bdf8",
        fillColor: item.fillColor || item.color || "#38bdf8",
        fillOpacity: item.fillOpacity ?? 0.18,
        opacity: item.opacity ?? 0.85,
        weight: item.weight || 3,
        dashArray: item.dashArray || "",
      };
      let layerItem;
      if (item.type === "circle")
        layerItem = L.circle(item.center, {
          ...style,
          radius: item.radius || 500,
        });
      if (item.type === "line") layerItem = L.polyline(item.points, style);
      if (item.type === "marker")
        layerItem = L.circleMarker(item.center, {
          ...style,
          radius: item.radius || 8,
        });
      if (layerItem) {
        layerItem
          .addTo(leaflet.current)
          .bindTooltip(item.label || "Analysis result", { sticky: true });
        toolLayers.current.push(layerItem);
      }
    });
  }, [measurePoints, routePoints, routeResult, routeUserPoint, analysisLayers]);
  useEffect(() => {
    if (!leaflet.current) return;
    customLayers.current.forEach((x) => x.remove());
    customLayers.current = [];
    mapLayers
      .filter((layerItem) => layerItem.visible !== false)
      .forEach((layerItem) => {
        try {
          let custom;
          if (layerItem.type === "geojson" && layerItem.data) {
            const color = layerItem.color || "#facc15";
            const fillColor =
              layerItem.fillColor || layerItem.color || "#f59e0b";
            const opacity = layerItem.opacity ?? 0.65;
            const category = layerGeometry(layerItem);
            const lineWeight = Number(layerItem.lineWeight || 2);
            const pointSize = Number(layerItem.pointSize || 24);
            const pointIcon = layerItem.pointIcon || "pin";
            const pointIconColor = layerItem.pointIconColor || "#ffffff";
            const popupFields = String(layerItem.popupFields || "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);
            const renderValue = (value) =>
              value == null || value === "" ? "" : String(value).slice(0, 90);
            custom = L.geoJSON(layerItem.data, {
              style: (feature) => {
                const geometryType = feature.geometry?.type || "";
                const polygon =
                  geometryType.includes("Polygon") || category === "Polygon";
                return {
                  color,
                  weight: lineWeight,
                  dashArray: LINE_STYLES[layerItem.lineStyle || "solid"],
                  fillColor,
                  fillOpacity: polygon
                    ? (layerItem.fillOpacity ?? opacity * 0.22)
                    : 0,
                  opacity,
                };
              },
              pointToLayer: (feature, latlng) =>
                L.marker(latlng, {
                  icon: L.divIcon({
                    className: "gis-point-marker",
                    html: `<span style="display:grid;place-items:center;width:${pointSize + 10}px;height:${pointSize + 10}px;background:${hexToRgba(color, Number(layerItem.opacity ?? 0.65))};border:2px solid ${pointIconColor};border-radius:50%;box-shadow:0 0 0 3px #0005,0 0 14px ${color}88">${pointIconSvg(pointIcon, pointIconColor, pointSize)}</span>`,
                    iconSize: [pointSize + 14, pointSize + 14],
                    iconAnchor: [(pointSize + 14) / 2, (pointSize + 14) / 2],
                  }),
                }),
              onEachFeature: (feature, layerGeo) => {
                const labelField = layerItem.labelField || "name";
                const label =
                  feature.properties?.[labelField] ||
                  feature.properties?.name ||
                  feature.properties?.Name ||
                  feature.properties?.NAME ||
                  feature.properties?.ADM2_EN ||
                  feature.properties?.lga_name ||
                  feature.properties?.shapeName ||
                  feature.properties?.title ||
                  layerItem.name;
                if (layerItem.showLabels !== false && label)
                  layerGeo.bindTooltip(String(label), { sticky: true });
                const fields = popupFields.length
                  ? popupFields
                  : Object.keys(feature.properties || {}).slice(0, 6);
                const rows = fields
                  .map((key) =>
                    feature.properties?.[key] != null
                      ? `<div><b>${key}</b><span>${renderValue(feature.properties[key])}</span></div>`
                      : "",
                  )
                  .join("");
                layerGeo.bindPopup(
                  `<div class="gis-popup"><strong>${label || layerItem.name}</strong><small>${layerItem.operationalUse || layerItem.category || "Map layer"}</small>${rows}</div>`,
                );
              },
            });
          }
          if (layerItem.type === "raster" && layerItem.url && layerItem.bounds)
            custom = L.imageOverlay(layerItem.url, layerItem.bounds, {
              opacity: layerItem.opacity ?? 0.65,
              crossOrigin: true,
            });
          if (custom) {
            custom.addTo(leaflet.current);
            customLayers.current.push(custom);
          }
        } catch (error) {
          console.warn("Map layer failed:", layerItem.name, error);
        }
      });
  }, [mapLayers]);

  // Nigeria state and LGA boundary overlays (built-in, independent of uploaded layers)
  useEffect(() => {
    const map = leaflet.current;
    if (!map) return;
    // Clean up state overlay and labels
    nigeriaStateOverlay.current?.remove();
    nigeriaStateOverlay.current = null;
    nigeriaStateLabels.current.forEach(l => l.remove());
    nigeriaStateLabels.current = [];
    if (!showStateBorders) return;
    // Oyo State outline only; LGA polygons are rendered separately.
    const uploadedStateFeatures = mapLayers
      .filter(l => l.visible !== false && l.type === "geojson" && l.data?.features)
      .flatMap(l => l.data.features.filter(f => {
        const p = f.properties || {};
        const stateName = p.STATE_NAME || p.ADM1_EN || p.admin1Name || p.NAME_1 || p.State || p.state || "";
        const hasLga = p.ADM2_EN || p.lga_name || p.LGA || p.lga || p.LTNAME;
        const isPolygon = f.geometry?.type?.includes("Polygon");
        return stateName && !hasLga && normalizeBoundaryKey(stateName).includes("oyo") && isPolygon;
      }));
    const stateFeatures = uploadedStateFeatures.length
      ? uploadedStateFeatures
      : (oyoBoundaries.state?.features || []);
    if (!stateFeatures.length) return;
    const stateLayer = L.geoJSON(
      { type: "FeatureCollection", features: stateFeatures },
      {
        pane: "overlayPane",
        style: () => ({
          color: "#ffd166",
          weight: 6,
          dashArray: "",
          fillOpacity: 0.08,
          fillColor: "#f59e0b",
          opacity: 1,
        }),
        onEachFeature: (feature, layerGeo) => {
          const name =
            feature.properties?.STATE_NAME ||
            feature.properties?.ADM1_EN ||
            feature.properties?.admin1Name ||
            feature.properties?.NAME_1 ||
            feature.properties?.State ||
            feature.properties?.state ||
            feature.properties?.name ||
            feature.properties?.NAME ||
            "";
          if (name) {
            layerGeo.bindTooltip(name, { permanent: false, sticky: true, className: "nigeria-state-tooltip" });
            // Permanent label at centroid
            try {
              const center = layerGeo.getBounds().getCenter();
              if (showBoundaryNames) {
                const label = L.marker(center, {
                  icon: L.divIcon({
                    className: "nigeria-state-label",
                    html: `<span>${escapeMapText(name)}</span>`,
                    iconSize: null,
                    iconAnchor: [0, 0],
                  }),
                  interactive: false,
                  zIndexOffset: -100,
                });
                label.addTo(map);
                nigeriaStateLabels.current.push(label);
              }
            } catch {}
          }
          layerGeo.on({
            mouseover: (e) => {
              e.target.setStyle({ weight: 8, color: "#fff2a8", fillOpacity: 0.16, opacity: 1 });
              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) e.target.bringToFront();
            },
            mouseout: (e) => stateLayer.resetStyle(e.target),
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              const key = String(name).trim().toLowerCase().replace(/\s+/g, " ");
              onBoundarySelect?.(key, name);
            },
          });
        },
      },
    ).addTo(map);
    nigeriaStateOverlay.current = stateLayer;
    stateLayer.bringToFront();
  }, [showStateBorders, showBoundaryNames, mapLayers, onBoundarySelect, oyoBoundaries.state]);

  // Oyo State LGA boundary overlay (from uploaded GeoJSON layers).
  useEffect(() => {
    const map = leaflet.current;
    if (!map) return;
    nigeriaLgaOverlay.current?.remove();
    nigeriaLgaOverlay.current = null;
    nigeriaLgaLabels.current.forEach(l => l.remove());
    nigeriaLgaLabels.current = [];
    if (!showLgaBorders) return;
    const uploadedLgaFeatures = mapLayers
      .filter(l => l.visible !== false && l.type === "geojson" && l.data?.features)
      .flatMap(l => l.data.features.filter(f => {
        const p = f.properties || {};
        const hasLga = p.ADM2_EN || p.lga_name || p.LGA || p.lga || p.LTNAME;
        const stateName = p.STATE_NAME || p.ADM1_EN || p.admin1Name || p.NAME_1 || p.State || p.state || "";
        const belongsToOyo = stateName
          ? normalizeBoundaryKey(stateName).includes("oyo")
          : normalizeBoundaryKey(l.name).includes("oyo");
        const isPolygon = f.geometry?.type?.includes("Polygon");
        return hasLga && belongsToOyo && isPolygon;
      }));
    const lgaFeatures = uploadedLgaFeatures.length
      ? uploadedLgaFeatures
      : (oyoBoundaries.lgas?.features || []);
    if (!lgaFeatures.length) return;
    const lgaLayer = L.geoJSON(
      { type: "FeatureCollection", features: lgaFeatures },
      {
        pane: "overlayPane",
        style: (feature) => {
          const name = feature.properties?.ADM2_EN || feature.properties?.lga_name || feature.properties?.LGA || feature.properties?.lga || feature.properties?.LTNAME || feature.properties?.name || "";
          const status = partyLgaResults[normalizeLgaMatch(name)]?.status || (partyMapAnalysis?.party ? "no-data" : "");
          const colors = {
            winning: { line: "#16a34a", fill: "#22c55e" },
            losing: { line: "#dc2626", fill: "#ef4444" },
            tied: { line: "#ca8a04", fill: "#facc15" },
            "no-data": { line: "#ca8a04", fill: "#facc15" },
          };
          const selectedColor = colors[status];
          return {
            color: selectedColor?.line || "#22d3ee",
            weight: selectedColor ? 3.5 : 2.75,
            dashArray: selectedColor ? "" : "7 5",
            fillOpacity: selectedColor ? 0.42 : 0.025,
            fillColor: selectedColor?.fill || "#22d3ee",
            opacity: 1,
          };
        },
        onEachFeature: (feature, layerGeo) => {
          const name =
            feature.properties?.ADM2_EN ||
            feature.properties?.lga_name ||
            feature.properties?.LGA ||
            feature.properties?.lga ||
            feature.properties?.LTNAME ||
            feature.properties?.name ||
            "";
          if (name) {
            const performance = partyLgaResults[normalizeLgaMatch(name)];
            const status = performance?.status || (partyMapAnalysis?.party ? "no-data" : "");
            const statusLabel = status === "winning" ? "Winning" : status === "losing" ? "Losing" : status === "tied" ? "Tied" : status === "no-data" ? "No submitted result" : "";
            const margin = performance?.margin ? ` · margin ${Number(performance.margin).toLocaleString()}` : "";
            const tooltip = partyMapAnalysis?.party
              ? `<strong>${escapeMapText(name)}</strong><br>${escapeMapText(partyMapAnalysis.party)}: ${escapeMapText(statusLabel)}${escapeMapText(margin)}`
              : escapeMapText(name);
            layerGeo.bindTooltip(tooltip, { permanent: false, sticky: true, className: "nigeria-lga-tooltip" });
          }
          layerGeo.on({
            mouseover: (e) => {
              e.target.setStyle({ weight: 4, color: "#a5f3fc", fillOpacity: 0.14, opacity: 1 });
              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) e.target.bringToFront();
            },
            mouseout: (e) => lgaLayer.resetStyle(e.target),
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              const key = String(name).trim().toLowerCase().replace(/\s+/g, " ");
              onBoundarySelect?.(key, name);
            },
          });
        },
      },
    ).addTo(map);
    nigeriaLgaOverlay.current = lgaLayer;
    lgaLayer.bringToFront();

    // Create LGA name labels
    if (showBoundaryNames && lgaFeatures.length) {
      lgaFeatures.forEach((feature) => {
        const name = feature.properties?.ADM2_EN || feature.properties?.lga_name || feature.properties?.LGA || feature.properties?.lga || feature.properties?.LTNAME || feature.properties?.name || "";
        if (!name || !feature.geometry?.coordinates?.length) return;

        try {
          // Calculate centroid from polygon coordinates
          const coords = feature.geometry.coordinates[0] || [];
          const lats = coords.map(c => c[1]);
          const lngs = coords.map(c => c[0]);
          const centroidLat = (Math.min(...lats) + Math.max(...lats)) / 2;
          const centroidLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

          const labelMarker = L.marker([centroidLat, centroidLng], {
            icon: L.divIcon({
              className: "lga-name-label",
              html: `<div class="lga-label-text">${escapeMapText(name)}</div>`,
              iconSize: [120, 30],
              iconAnchor: [60, 15],
            }),
            interactive: false,
            pane: "overlayPane",
          }).addTo(map);

          nigeriaLgaLabels.current.push(labelMarker);
        } catch {}
      });
    }
  }, [showLgaBorders, showBoundaryNames, mapLayers, onBoundarySelect, oyoBoundaries.lgas, partyMapAnalysis, partyLgaResults]);

  // Population / network data-layer choropleth, toggled by the on-map "Data layer" button.
  useEffect(() => {
    const map = leaflet.current;
    if (!map) return;
    dataLayerOverlay.current?.remove();
    dataLayerOverlay.current = null;
    dataLayerLegend.current?.remove();
    dataLayerLegend.current = null;
    if (dataLayer === "none") return;
    const lgaFeatures = oyoBoundaries.lgas?.features || [];
    if (!lgaFeatures.length) return;

    const valueFor = (name) => {
      const key = normalizeLgaKey(name);
      if (dataLayer === "population") return populationByLga.get(key) ?? null;
      const network = networkByLga.get(key);
      return network ? network.avgDownloadKbps : null;
    };
    const values = lgaFeatures.map((f) => valueFor(f.properties?.ADM2_EN)).filter((v) => v !== null && v !== undefined);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    const colorFor = (value) => {
      if (value === null || value === undefined) return "#4a4a55";
      const ratio = max > min ? (value - min) / (max - min) : 0.5;
      const stops = dataLayer === "population"
        ? [[254, 240, 217], [252, 141, 89], [179, 0, 0]]
        : [[178, 24, 43], [253, 219, 199], [33, 102, 172]];
      const scaled = ratio * (stops.length - 1);
      const lower = stops[Math.floor(scaled)];
      const upper = stops[Math.min(stops.length - 1, Math.ceil(scaled))];
      const t = scaled - Math.floor(scaled);
      const mix = lower.map((c, i) => Math.round(c + (upper[i] - c) * t));
      return `rgb(${mix.join(",")})`;
    };
    const formatValue = (name) => {
      const key = normalizeLgaKey(name);
      if (dataLayer === "population") {
        const value = populationByLga.get(key);
        return value ? `${value.toLocaleString()} people (2006 census)` : "No population figure available";
      }
      const network = networkByLga.get(key);
      if (!network) return "No measured network data for this quarter -- not the same as confirmed no coverage";
      return `${(network.avgDownloadKbps / 1000).toFixed(1)} Mbps avg down, ${(network.avgUploadKbps / 1000).toFixed(1)} Mbps avg up, ${network.avgLatencyMs}ms latency (${network.totalTests} real tests, Ookla Q2 2026)`;
    };

    const overlay = L.geoJSON(
      { type: "FeatureCollection", features: lgaFeatures },
      {
        pane: "overlayPane",
        style: (feature) => {
          const value = valueFor(feature.properties?.ADM2_EN);
          return { color: "#1b1420", weight: 1.5, fillOpacity: value === null || value === undefined ? 0.35 : 0.72, fillColor: colorFor(value) };
        },
        onEachFeature: (feature, layerGeo) => {
          const name = feature.properties?.ADM2_EN || "";
          layerGeo.bindTooltip(`<strong>${escapeMapText(name)}</strong><br>${escapeMapText(formatValue(name))}`, { sticky: true, className: "nigeria-lga-tooltip" });
          layerGeo.on({ click: (e) => { L.DomEvent.stopPropagation(e); handleBoundaryClick(feature); } });
        },
      },
    ).addTo(map);
    overlay.bringToFront();
    dataLayerOverlay.current = overlay;

    const Legend = L.Control.extend({
      onAdd() {
        const div = L.DomUtil.create("div", "map-data-layer-legend");
        const title = dataLayer === "population" ? "Population (2006 census)" : "Measured download speed (Ookla, Q2 2026)";
        const lowLabel = dataLayer === "population" ? Math.round(min).toLocaleString() : `${(min / 1000).toFixed(1)} Mbps`;
        const highLabel = dataLayer === "population" ? Math.round(max).toLocaleString() : `${(max / 1000).toFixed(1)} Mbps`;
        div.innerHTML = `
          <div class="map-data-layer-legend-title">${escapeMapText(title)}</div>
          <div class="map-data-layer-legend-gradient" style="background:linear-gradient(90deg, ${colorFor(min)}, ${colorFor((min + max) / 2)}, ${colorFor(max)})"></div>
          <div class="map-data-layer-legend-scale"><span>${lowLabel}</span><span>${highLabel}</span></div>
          <div class="map-data-layer-legend-nodata"><span class="map-data-layer-legend-swatch"></span> No data for this LGA</div>
        `;
        return div;
      },
    });
    dataLayerLegend.current = new Legend({ position: "bottomleft" }).addTo(map);

    return () => {
      overlay.remove();
      dataLayerLegend.current?.remove();
    };
  }, [dataLayer, oyoBoundaries.lgas, populationByLga, networkByLga]);

  useEffect(() => {
    const map = leaflet.current;
    if (!map) return;

    boundaryOverlay.current?.remove();
    boundaryOverlay.current = null;
    lgaOverlay.current?.remove();
    lgaOverlay.current = null;
    hoverBoundaryLayer.current = null;

    if (!showBoundaryLayer) {
      return;
    }

    const boundaryFeatures = buildBoundaryFeatures();
    if (!boundaryFeatures.length) return;

    const boundaryGeo = L.geoJSON(
      { type: "FeatureCollection", features: boundaryFeatures },
      {
        pane: "overlayPane",
        style: () => ({
          color: "#facc15",
          weight: 3,
          dashArray: "6 4",
          fillOpacity: 0.04,
          opacity: 0.95,
        }),
        onEachFeature: (feature, layerGeo) => {
          const label = getBoundaryLabel(feature);
          layerGeo.on({
            mouseover: (e) => {
              const target = e.target;
              hoverBoundaryLayer.current = target;
              target.setStyle({
                weight: 4,
                color: "#f59e0b",
                fillOpacity: 0.18,
                opacity: 1,
              });
              if (label) {
                target.bindTooltip(label, { sticky: true }).openTooltip();
              }
              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge)
                target.bringToFront();
            },
            mouseout: (e) => {
              const target = e.target;
              if (boundaryGeo) boundaryGeo.resetStyle(target);
              target.closeTooltip();
            },
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              handleBoundaryClick(feature);
            },
          });
        },
      },
    ).addTo(map);

    boundaryOverlay.current = boundaryGeo;
    boundaryGeo.bringToFront();
  }, [mapLayers, showBoundaryLayer]);

  useEffect(() => {
    const map = leaflet.current;
    if (!map) return;

    lgaOverlay.current?.remove();
    lgaOverlay.current = null;

    if (!showBoundaryLayer || !selectedBoundaryState) return;

    const boundaryFeatures = buildBoundaryFeatures();
    const normalized = normalizeBoundaryKey(selectedBoundaryState);
    const lgaFeatures = boundaryFeatures.filter((feature) => {
      const stateKey = getStateKey(feature);
      const lgaKey = getLgaKey(feature);
      if (stateKey && stateKey === normalized) return true;
      if (lgaKey && lgaKey === normalized) return true;
      return false;
    });

    if (!lgaFeatures.length) return;

    const lgaGeo = L.geoJSON(
      { type: "FeatureCollection", features: lgaFeatures },
      {
        pane: "overlayPane",
        style: () => ({
          color: "#34d399",
          weight: 4,
          dashArray: "3 6",
          fillOpacity: 0.1,
          opacity: 0.98,
        }),
        onEachFeature: (feature, layerGeo) => {
          const label = getBoundaryLabel(feature);
          if (label) layerGeo.bindTooltip(label, { sticky: true });
          layerGeo.on({
            mouseover: (e) => {
              const target = e.target;
              target.setStyle({
                weight: 5,
                color: "#22c55e",
                fillOpacity: 0.22,
                opacity: 1,
              });
              if (label) target.openTooltip();
              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge)
                target.bringToFront();
            },
            mouseout: (e) => {
              if (lgaGeo) lgaGeo.resetStyle(e.target);
              e.target.closeTooltip();
            },
          });
        },
      },
    ).addTo(map);
    lgaGeo.bringToFront();

    lgaOverlay.current = lgaGeo;
  }, [selectedBoundaryState, showBoundaryLayer, mapLayers]);

  useEffect(() => {
    const map = leaflet.current;
    if (!map) return;
    let center = null;
    let preview = null;
    let points = [];
    let drawing = false;
    if (drawMode === "freehand") map.dragging.disable();
    const clearPreview = () => {
      if (preview) preview.remove();
      preview = null;
    };
    const click = (e) => {
      if (drawMode === "measure" || drawMode === "route")
        return onToolPoint(drawMode, e.latlng);
      if (drawMode === "freehand") return;
      if (drawMode !== "circle") return;
      if (!center) {
        center = e.latlng;
        preview = L.circle(center, {
          radius: 20,
          color: "#38bdf8",
          dashArray: "6 4",
          fillOpacity: 0.12,
        }).addTo(map);
      } else {
        const radius = center.distanceTo(e.latlng);
        clearPreview();
        onAreaCreated({
          id: `area-${Date.now()}`,
          type: "circle",
          center: [center.lat, center.lng],
          radius,
        });
        center = null;
      }
    };
    const context = (e) => {
      e.originalEvent.preventDefault();
      if (!drawMode) map.zoomIn();
    };
    const down = (e) => {
      if (drawMode !== "freehand") return;
      drawing = true;
      points = [[e.latlng.lat, e.latlng.lng]];
      map.dragging.disable();
      preview = L.polyline(points, { color: "#38bdf8", weight: 3 }).addTo(map);
    };
    const move = (e) => {
      if (drawMode === "circle" && center && preview)
        preview.setRadius(center.distanceTo(e.latlng));
      if (drawing) {
        points.push([e.latlng.lat, e.latlng.lng]);
        preview.setLatLngs(points);
      }
    };
    const up = () => {
      if (!drawing) return;
      drawing = false;
      clearPreview();
      if (points.length > 2)
        onAreaCreated({ id: `area-${Date.now()}`, type: "freehand", points });
      points = [];
    };
    const doubleClick = (e) => {
      if (!drawMode) onMapClick(e.latlng);
    };
    map.doubleClickZoom.disable();
    map.on("click", click);
    map.on("dblclick", doubleClick);
    map.on("contextmenu", context);
    map.on("mousedown", down);
    map.on("mousemove", move);
    map.on("mouseup", up);
    map.getContainer().style.cursor = drawMode ? "crosshair" : "";
    return () => {
      map.off("click", click);
      map.off("dblclick", doubleClick);
      map.off("contextmenu", context);
      map.off("mousedown", down);
      map.off("mousemove", move);
      map.off("mouseup", up);
      clearPreview();
      map.dragging.enable();
      map.getContainer().style.cursor = "";
    };
  }, [drawMode, onAreaCreated, onMapClick, onToolPoint]);
  useEffect(() => {
    if (selected && leaflet.current)
      leaflet.current.flyTo([selected.lat, selected.lng], 15);
  }, [selected]);
  return (
    <>
      <div ref={el} className={`map map-${layer.toLowerCase()}`} />
      {partyMapAnalysis?.party && (
        <div className="party-map-legend" role="status" aria-label={`LGA performance map for ${partyMapAnalysis.party}`}>
          <strong>{partyMapAnalysis.party} by LGA</strong>
          <span><i className="winning" /> Winning</span>
          <span><i className="losing" /> Losing</span>
          <span><i className="undecided" /> Tied / no result</span>
        </div>
      )}
      {mapLayers.length > 0 && !layerPanelOpen && (
        <button
          className="layer-panel-open-btn"
          onClick={() => setLayerPanelOpen(true)}
          title="Toggle custom map layers"
        >
          Layers ({mapLayers.filter((item) => item.visible !== false).length}/
          {mapLayers.length})
        </button>
      )}
      {layerPanelOpen && (
        <LayerControlPanel
          layers={mapLayers}
          isAdmin={isAdmin}
          onToggle={onLayerToggle}
          onOpacity={onLayerOpacity}
          onClose={() => setLayerPanelOpen(false)}
        />
      )}
    </>
  );
}

