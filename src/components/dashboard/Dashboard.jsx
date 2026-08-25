import { useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { lazy, Suspense } from "react";
import L from "leaflet";
import { io } from "socket.io-client";
import {
  FaBullseye,
  FaCamera,
  FaChartBar,
  FaCircle,
  FaComments,
  FaDrawPolygon,
  FaEraser,
  FaEye,
  FaEyeSlash,
  FaHome,
  FaKey,
  FaLocationArrow,
  FaMapMarkedAlt,
  FaMicrophone,
  FaMicrophoneSlash,
  FaRoute,
  FaRulerCombined,
  FaSearch,
  FaShareAlt,
  FaSignOutAlt,
  FaStreetView,
  FaSyncAlt,
  FaTimes,
  FaTools,
  FaUserCog,
  FaVideo,
  FaVolumeDown,
  FaVolumeMute,
  FaVolumeUp,
} from "react-icons/fa";
import { LuLocateFixed } from "react-icons/lu";
import {
  MdLocationPin,
  MdPlace,
  MdPushPin,
  MdHome,
  MdBusiness,
  MdSchool,
  MdLocalHospital,
  MdAccountBalance,
  MdFactory,
  MdStore,
  MdMosque,
  MdChurch,
  MdLocalGasStation,
  MdDirectionsBus,
  MdTrain,
  MdFlight,
  MdAnchor,
  MdLocalShipping,
  MdConstruction,
  MdTraffic,
  MdLocalParking,
  MdVideocam,
  MdSettingsInputAntenna,
  MdFlashOn,
  MdLocalFireDepartment,
  MdWaterDrop,
  MdPark,
  MdGrass,
  MdTerrain,
  MdSignpost,
  MdSecurity,
  MdWarning,
  MdOutlineRadio,
  MdAccessible,
  MdRecycling,
  MdPolyline,
  MdHexagon,
  MdImage,
  MdFilterHdr,
  MdCropSquare,
  MdAdjust,
} from "react-icons/md";
import ProfileModal from "./ProfileModal.jsx";
import DashboardChatPanel from "./ChatPanel.jsx";
import DashboardEmergencyPanel from "./EmergencyPanel.jsx";
import DashboardMapDataPanel from "./MapDataPanel.jsx";
import DashboardToolsPanel from "./ToolsPanel.jsx";
import Toast from "../ui/Toast.jsx";
import NotificationCenter from "./NotificationCenter.jsx";
import AssignIncidentModal from "./AssignIncidentModal.jsx";
import IncidentNotificationModal from "./IncidentNotificationModal.jsx";
import SupervisorIncidentListModal from "./SupervisorIncidentListModal.jsx";
import PreElectionAnalysis from "./PreElectionAnalysis.jsx";

const loadFieldModals = () => import("./FieldModals.jsx");
const DashboardCameraPanel = lazy(() => import("./CameraPanel.jsx"));
const IncidentForm = lazy(() => loadFieldModals().then((module) => ({ default: module.IncidentForm })));
const OfficerManager = lazy(() => loadFieldModals().then((module) => ({ default: module.OfficerManager })));
const PartyManager = lazy(() => loadFieldModals().then((module) => ({ default: module.PartyManager })));
const PollingResultForm = lazy(() => loadFieldModals().then((module) => ({ default: module.PollingResultForm })));

const API = "/api";
const OYO_CENTER = [7.3775, 3.947];
const RESULT_SOURCES = ["Agent", "Supervisor", "INEC IReV"];
const OYO_BOUNDS = [
  [6.73, 2.67],
  [8.38, 4.6],
];
const severityColor = {
  Low: "#38bdf8",
  Medium: "#facc15",
  High: "#fb923c",
  Critical: "#ef4444",
};
const FIELD_TEAM_POSITIONS = [
  [7.3898, 3.8951],
  [7.4182, 3.9137],
  [7.8429, 3.9368],
  [8.1335, 4.2436],
  [7.2526, 3.4332],
];
const MAP_LAYERS = [
  { key: "Street", label: "Open Street Map", title: "OpenStreetMap streets" },
  {
    key: "Satellite",
    label: "Satellite imagery",
    title: "Esri World Imagery satellite without labels",
  },
  { key: "Topo", label: "Topographic map", title: "Esri topographic map" },
  { key: "Terrain", label: "OpenTopoMap", title: "OpenTopoMap terrain" },
  { key: "EsriStreet", label: "Esri street map", title: "Esri street map" },
];
const LAYER_CATEGORIES = ["Point", "Line", "Polygon", "Raster"];
const CATEGORY_ICONS = {
  Point: "point",
  Line: "line",
  Polygon: "polygon",
  Raster: "raster",
};
const CATEGORY_ICON_COMPONENTS = {
  Point: MdLocationPin,
  Line: MdPolyline,
  Polygon: MdHexagon,
  Raster: MdImage,
};
const CategoryIcon = ({ cat, ...props }) => {
  const Ic = CATEGORY_ICON_COMPONENTS[cat] || MdFilterHdr;
  return <Ic {...props} />;
};
const CATEGORY_COLORS = {
  Point: "#fb923c",
  Line: "#facc15",
  Polygon: "#38bdf8",
  Raster: "#818cf8",
};
const LEGACY_CATEGORY_GEOMETRY = {
  Roads: "Line",
  Boundary: "Polygon",
  Water: "Polygon",
  Vegetation: "Polygon",
  "No-Go Zone": "Polygon",
  Settlement: "Point",
  Custom: "Point",
};
const layerGeometry = (layer) =>
  LAYER_CATEGORIES.includes(layer?.category)
    ? layer.category
    : layer?.type === "raster"
      ? "Raster"
      : LEGACY_CATEGORY_GEOMETRY[layer?.category] || "Point";
const LAYER_COLORS_PRESET = [
  "#38bdf8",
  "#facc15",
  "#4ade80",
  "#f87171",
  "#818cf8",
  "#fb923c",
  "#60a5fa",
  "#e2e8f0",
];
// POINT_ICONS: each entry is {key, label, Component} for the picker UI, and key is stored as pointIcon value
const POINT_ICONS = [
  { key: "pin", label: "Pin", Component: MdLocationPin },
  { key: "place", label: "Place", Component: MdPlace },
  { key: "pushpin", label: "Push Pin", Component: MdPushPin },
  { key: "home", label: "Home", Component: MdHome },
  { key: "business", label: "Building", Component: MdBusiness },
  { key: "school", label: "School", Component: MdSchool },
  { key: "hospital", label: "Hospital", Component: MdLocalHospital },
  { key: "bank", label: "Bank", Component: MdAccountBalance },
  { key: "factory", label: "Factory", Component: MdFactory },
  { key: "store", label: "Store", Component: MdStore },
  { key: "mosque", label: "Mosque", Component: MdMosque },
  { key: "church", label: "Church", Component: MdChurch },
  { key: "fuel", label: "Fuel", Component: MdLocalGasStation },
  { key: "busstop", label: "Bus Stop", Component: MdDirectionsBus },
  { key: "train", label: "Train", Component: MdTrain },
  { key: "airport", label: "Airport", Component: MdFlight },
  { key: "anchor", label: "Anchor", Component: MdAnchor },
  { key: "truck", label: "Truck", Component: MdLocalShipping },
  { key: "construction", label: "Construction", Component: MdConstruction },
  { key: "traffic", label: "Traffic", Component: MdTraffic },
  { key: "parking", label: "Parking", Component: MdLocalParking },
  { key: "camera", label: "Camera", Component: MdVideocam },
  { key: "antenna", label: "Antenna", Component: MdSettingsInputAntenna },
  { key: "electric", label: "Electric", Component: MdFlashOn },
  { key: "fire", label: "Fire", Component: MdLocalFireDepartment },
  { key: "water", label: "Water", Component: MdWaterDrop },
  { key: "park", label: "Park", Component: MdPark },
  { key: "vegetation", label: "Vegetation", Component: MdGrass },
  { key: "terrain", label: "Terrain", Component: MdTerrain },
  { key: "bridge", label: "Bridge", Component: MdSignpost },
  { key: "security", label: "Security", Component: MdSecurity },
  { key: "warning", label: "Warning", Component: MdWarning },
  { key: "radiation", label: "Radiation", Component: MdOutlineRadio },
  { key: "accessible", label: "Accessible", Component: MdAccessible },
  { key: "recycle", label: "Recycle", Component: MdRecycling },
];
// Render a point icon component by key (for React UI)
const PointIconComponent = ({ iconKey, size = 18, color = "currentColor" }) => {
  const entry = POINT_ICONS.find((p) => p.key === iconKey);
  const Ic = entry?.Component || MdLocationPin;
  return <Ic size={size} color={color} />;
};
const hexToRgba = (hex, alpha = 1) => {
  const value = hex?.replace("#", "") || "";
  if (value.length !== 6) return hex;
  const int = parseInt(value, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
// Render a point icon as SVG string for Leaflet divIcon HTML
const pointIconSvg = (iconKey, color = "#ffffff", size = 20) => {
  return renderToStaticMarkup(
    <PointIconComponent iconKey={iconKey} size={size} color={color} />,
  );
};
const reportIconSvg = (iconKey, color = "#ffffff", size = 18) => {
  return renderToStaticMarkup(
    <ReportIcon iconKey={iconKey || "IP"} size={size} color={color} />,
  );
};
const LINE_STYLES = { solid: "", dashed: "9 7", dotted: "2 7" };
const OPERATIONAL_USES = [
  "Reference",
  "Field Route",
  "Checkpoint",
  "Hotspot",
  "No-Go Zone",
  "Response Asset",
  "Camera Coverage",
  "Emergency Service",
  "Community Place",
];
const INCIDENT_TYPES = [
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
];
const POLLING_RESULT_TYPE = "Polling Unit Result";
const COMMAND_PARTY = "Party";
const REPORT_TYPES = [...INCIDENT_TYPES, POLLING_RESULT_TYPE];

function parseResultEntries(rawText = "") {
  return (rawText || "")
    .split(/\n|,/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const match = segment.match(/^([^:=]+)[:=]\s*(\d+(?:\.\d+)?)/);
      if (match) {
        return { label: match[1].trim() || "Party", value: Number(match[2]) };
      }
      const numericMatch = segment.match(/(\d+(?:\.\d+)?)/);
      if (!numericMatch) return null;
      return {
        label: segment.replace(numericMatch[0], "").trim() || "Count",
        value: Number(numericMatch[1]),
      };
    })
    .filter(Boolean);
}
const REPORT_TYPE_STYLES = {
  "BS-Black Spot": {
    icon: "BS",
    color: "#dc2626",
    fillColor: "#ef4444",
    opacity: 0.75,
    fillOpacity: 0.22,
    geometryType: "circle",
    radius: 350,
  },
  "KP-Key Point": {
    icon: "KP",
    color: "#2563eb",
    fillColor: "#60a5fa",
    opacity: 0.8,
    fillOpacity: 0.16,
  },
  "VP-Vulnerable Point": {
    icon: "VP",
    color: "#f59e0b",
    fillColor: "#fbbf24",
    opacity: 0.8,
    fillOpacity: 0.18,
  },
  "POI-Point of Interest": {
    icon: "POI",
    color: "#8b5cf6",
    fillColor: "#a78bfa",
    opacity: 0.8,
    fillOpacity: 0.16,
  },
  "IP-Incident Point": {
    icon: "IP",
    color: "#ef4444",
    fillColor: "#f87171",
    opacity: 0.85,
    fillOpacity: 0.16,
  },
  "SOS-Emergency": {
    icon: "SOS",
    color: "#dc2626",
    fillColor: "#ef4444",
    opacity: 0.95,
    fillOpacity: 0.24,
  },
  Custom: {
    icon: "custom",
    color: "#38bdf8",
    fillColor: "#7dd3fc",
    opacity: 0.8,
    fillOpacity: 0.16,
  },
};
const REPORT_TYPE_ICONS = {
  "BS-Black Spot": FaBullseye,
  "KP-Key Point": FaKey,
  "VP-Vulnerable Point": MdWarning,
  "POI-Point of Interest": MdPlace,
  "IP-Incident Point": MdLocationPin,
  "SOS-Emergency": MdWarning,
  BS: FaBullseye,
  KP: FaKey,
  VP: MdWarning,
  POI: MdPlace,
  IP: MdLocationPin,
  SOS: MdWarning,
  custom: MdHexagon,
  Custom: MdHexagon,
};
const ReportIcon = ({ iconKey, size = 14, color = "currentColor" }) => {
  const pointEntry = POINT_ICONS.find((p) => p.key === iconKey);
  if (pointEntry?.Component) {
    const Icon = pointEntry.Component;
    return <Icon size={size} color={color} />;
  }
  const Icon = REPORT_TYPE_ICONS[iconKey] || REPORT_TYPE_ICONS.Custom;
  return (
    <Icon size={size} color={color} aria-hidden="true" focusable="false" />
  );
};
const ReportTypeIcon = ({ type, size = 14, color = "currentColor" }) => {
  return <ReportIcon iconKey={type} size={size} color={color} />;
};
const EMERGENCY_TYPES = INCIDENT_TYPES;
const ANALYTIC_TOOLS = [
  "Measure Distance",
  "Aggregate Points",
  "Calculate Density",
  "Create Buffers",
  "Measure Buffer",
  "Create Drive-Time Areas",
  "Extract Data",
  "Find Hot Spots",
  "Find Nearest",
  "Summarize Nearby",
  "Geo-Lookup",
];
const ANALYTIC_HELP = {
  "Measure Distance":
    "Click points on the map to measure real distance along a road or path.",
  "Aggregate Points":
    "Counts incidents by category and places summary bubbles on the map.",
  "Calculate Density":
    "Draws larger orange rings where incidents are close together within 3 km.",
  "Create Buffers": "Draws 500 m blue safety buffers around incident points.",
  "Measure Buffer":
    "Lets you draw a circle area, then opens the incident form for that buffer.",
  "Create Drive-Time Areas":
    "Starts route mode so you can click a start and destination for road distance and time.",
  "Extract Data": "Downloads incident data as a CSV spreadsheet.",
  "Find Hot Spots":
    "Highlights clusters where multiple incidents are near each other.",
  "Find Nearest":
    "Draws a green line from the selected incident or map center to the nearest field responder.",
  "Summarize Nearby":
    "Counts incidents within 5 km of the selected incident or map center.",
  "Geo-Lookup": "Looks up the address/name for the current map center.",
};
const formatDistance = (meters) =>
  meters >= 1000
    ? `${(meters / 1000).toFixed(meters >= 10000 ? 1 : 2)} km`
    : `${Math.round(meters)} m`;
const formatDuration = (seconds) =>
  seconds >= 3600
    ? `${Math.floor(seconds / 3600)} hr ${Math.round((seconds % 3600) / 60)} min`
    : `${Math.max(1, Math.round(seconds / 60))} min`;
const pointArray = (point) =>
  Array.isArray(point) ? point : [point.lat, point.lng];
const totalDistance = (points) =>
  points.reduce(
    (sum, point, index) =>
      index
        ? sum +
          L.latLng(pointArray(points[index - 1])).distanceTo(
            L.latLng(pointArray(point)),
          )
        : 0,
    0,
  );
const reportStyle = (item) => ({
  ...(REPORT_TYPE_STYLES[item?.reportType] || REPORT_TYPE_STYLES.Custom),
  ...(item?.style || {}),
});
const reportCenter = (geometry) =>
  geometry?.type === "circle"
    ? { lat: geometry.center[0], lng: geometry.center[1] }
    : geometry?.type === "freehand" && geometry.points?.length
      ? {
          lat:
            geometry.points.reduce((sum, p) => sum + p[0], 0) /
            geometry.points.length,
          lng:
            geometry.points.reduce((sum, p) => sum + p[1], 0) /
            geometry.points.length,
        }
      : null;
let emergencyRingTimer = null;
const stopEmergencyRing = () => {
  if (emergencyRingTimer) clearInterval(emergencyRingTimer);
  emergencyRingTimer = null;
};
const playEmergencyRing = (alert = {}) => {
  stopEmergencyRing();
  navigator.vibrate?.([700, 250, 700, 250, 900]);
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const beep = () => {
      navigator.vibrate?.([700, 250, 700]);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    };
    [0, 650, 1300, 1950].forEach((offset) => setTimeout(beep, offset));
    emergencyRingTimer = setInterval(beep, 3000);
    setTimeout(() => {
      stopEmergencyRing();
      ctx.close?.();
    }, 60000);
  } catch {}
  const title = `Emergency from ${alert.name || "field agent"}`;
  const body = `${alert.type || "Emergency"}${alert.text ? ` - ${alert.text}` : ""}`;
  if ("Notification" in window && Notification.permission === "granted") {
    navigator.serviceWorker?.ready
      .then((reg) =>
        reg.showNotification(title, {
          body,
          tag: alert.id || "election-monitor-emergency",
          renotify: true,
          requireInteraction: true,
          icon: "/bsa-logo.png",
        }),
      )
      .catch(() => new Notification(title, { body, requireInteraction: true }));
  } else if ("Notification" in window && Notification.permission === "default")
    Notification.requestPermission().catch(() => {});
};

async function request(path, token, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const contentType = response.headers.get("content-type") || "";
  const body = response.status === 204 ? null : contentType.includes("application/json") ? await response.json().catch(() => ({})) : await response.text().catch(() => "");
  if (!response.ok) {
    const message = typeof body === "object" && body ? body.message : String(body || "").trim();
    const html = contentType.includes("text/html") || /<!doctype|<html[\s>]|<style[\s>]/i.test(message);
    if (response.status === 429) throw new Error("Too many requests. Please wait a moment and try again.");
    if (!html && message && message.length <= 300) throw new Error(message);
    throw new Error(response.status >= 500 ? "Service temporarily unavailable. Please try again shortly." : `Request failed (${response.status})`);
  }
  return body;
}

const OFFLINE_VIDEO_DB = "election-monitor-offline-video";
const OFFLINE_VIDEO_STORE = "clips";
const openOfflineVideoDb = () =>
  new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(OFFLINE_VIDEO_DB, 1);
    openRequest.onupgradeneeded = () => {
      if (!openRequest.result.objectStoreNames.contains(OFFLINE_VIDEO_STORE))
        openRequest.result.createObjectStore(OFFLINE_VIDEO_STORE, { keyPath: "id" });
    };
    openRequest.onsuccess = () => resolve(openRequest.result);
    openRequest.onerror = () => reject(openRequest.error);
  });
const offlineVideoTransaction = async (mode, action) => {
  const db = await openOfflineVideoDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(OFFLINE_VIDEO_STORE, mode);
    const result = action(transaction.objectStore(OFFLINE_VIDEO_STORE));
    transaction.oncomplete = () => { db.close(); resolve(result?.result); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
};
const listOfflineVideos = async () => {
  const db = await openOfflineVideoDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(OFFLINE_VIDEO_STORE, "readonly");
    const getRequest = transaction.objectStore(OFFLINE_VIDEO_STORE).getAll();
    getRequest.onsuccess = () =>
      resolve(getRequest.result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
    getRequest.onerror = () => reject(getRequest.error);
    transaction.oncomplete = () => db.close();
  });
};
const deleteOfflineVideo = (id) =>
  offlineVideoTransaction("readwrite", (store) => store.delete(id));
const queueOfflineVideo = async (blob, details) => {
  await offlineVideoTransaction("readwrite", (store) =>
    store.put({
      id: `offline-video-${Date.now()}-${crypto.randomUUID?.() || Math.random()}`,
      blob,
      createdAt: new Date().toISOString(),
      ...details,
    }),
  );
  const clips = await listOfflineVideos();
  for (const clip of clips.slice(0, Math.max(0, clips.length - 20)))
    await deleteOfflineVideo(clip.id);
};
const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

function LayerControlPanel({ layers, isAdmin, onToggle, onOpacity, onClose }) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedCats, setExpandedCats] = useState({});
  const grouped = layers.reduce((acc, layer) => {
    const cat = layerGeometry(layer);
    (acc[cat] ||= []).push(layer);
    return acc;
  }, {});
  const visibleCount = layers.filter((layer) => layer.visible !== false).length;
  return (
    <div className="layer-control-panel">
      <div className="lcp-head">
        <div>
          <span className="eyebrow">CUSTOM MAP</span>
          <b className="lcp-title">
            Map Layers{" "}
            <span className="lcp-count">
              {visibleCount}/{layers.length}
            </span>
          </b>
        </div>
        <div className="lcp-actions">
          <button
            className="lcp-icon-btn"
            onClick={() => setCollapsed((x) => !x)}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <MdAdjust size={13} /> : <MdAdjust size={13} />}
          </button>
          <button className="lcp-icon-btn" onClick={onClose} title="Close">
            <FaTimes size={12} />
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="lcp-body">
          <div className="lcp-all-row">
            <button
              className="lcp-all-btn"
              onClick={() =>
                layers.forEach((layer) => onToggle(layer.id, true))
              }
            >
              Show all
            </button>
            <button
              className="lcp-all-btn"
              onClick={() =>
                layers.forEach((layer) => onToggle(layer.id, false))
              }
            >
              Hide all
            </button>
          </div>
          {!layers.length && (
            <div className="lcp-empty">
              No custom layers uploaded yet.
              {isAdmin && " Upload shapefiles via System Administrator -> Map Data."}
            </div>
          )}
          {Object.entries(grouped).map(([cat, catLayers]) => (
            <div className="lcp-group" key={cat}>
              <button
                className="lcp-cat-row"
                onClick={() =>
                  setExpandedCats((old) => ({
                    ...old,
                    [cat]: old[cat] === false,
                  }))
                }
              >
                <span
                  className="lcp-cat-icon"
                  style={{ color: CATEGORY_COLORS[cat] || "#e2e8f0" }}
                >
                  <CategoryIcon cat={cat} size={14} />
                </span>
                <span className="lcp-cat-name">{cat}</span>
                <span className="lcp-cat-count">{catLayers.length}</span>
                <span className="lcp-cat-arrow">
                  {expandedCats[cat] === false ? (
                    <MdAdjust size={10} />
                  ) : (
                    <MdAdjust size={10} />
                  )}
                </span>
              </button>
              {expandedCats[cat] !== false &&
                catLayers.map((layer) => (
                  <div className="lcp-layer-row" key={layer.id}>
                    <span
                      className="lcp-swatch"
                      style={{
                        background:
                          layer.color ||
                          CATEGORY_COLORS[layerGeometry(layer)] ||
                          "#38bdf8",
                      }}
                    />
                    <div className="lcp-layer-info">
                      <span className="lcp-layer-name">{layer.name}</span>
                      <span className="lcp-layer-type">
                        {layer.type === "raster" ? "Raster" : "Map layer"} -{" "}
                        {layerGeometry(layer)}
                      </span>
                    </div>
                    {isAdmin && (
                      <input
                        className="lcp-opacity"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={layer.opacity ?? 0.65}
                        title={`Opacity: ${Math.round((layer.opacity ?? 0.65) * 100)}%`}
                        onChange={(e) =>
                          onOpacity(layer.id, Number(e.target.value))
                        }
                      />
                    )}
                    <button
                      className={`lcp-toggle ${layer.visible !== false ? "on" : "off"}`}
                      onClick={() =>
                        onToggle(layer.id, layer.visible === false)
                      }
                      title={
                        layer.visible !== false ? "Hide layer" : "Show layer"
                      }
                    >
                      {layer.visible !== false ? (
                        <MdVideocam size={14} />
                      ) : (
                        <MdVideocam size={14} style={{ opacity: 0.3 }} />
                      )}
                    </button>
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MapView({
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
  historicalMapAnalysis,
  onHistoricalLgaSelect,
  onHistoricalWardSelect,
  onHistoricalPollingUnitSelect,
  onHistoricalBack,
  onHistoricalClose,
  selectedBoundaryState,
  onBoundarySelect,
  onBoundaryClear,
}) {
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
  const wardOverlay = useRef(null);
  const nigeriaStateLabels = useRef([]);
  const nigeriaLgaLabels = useRef([]);
  const wardLabels = useRef([]);
  const hoverBoundaryLayer = useRef(null);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [oyoBoundaries, setOyoBoundaries] = useState({ state: null, lgas: null });
  const [oyoWardBoundaries, setOyoWardBoundaries] = useState({ lga: "", wards: null, notice: "" });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/boundaries/oyo`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Boundary service unavailable")))
      .then(data => setOyoBoundaries({ state: data.state || null, lgas: data.lgas || null }))
      .catch(error => {
        if (error.name !== "AbortError") console.warn("Oyo boundaries could not be loaded:", error.message);
      });
    return () => controller.abort();
  }, []);

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
  const historicalLgaResults = useMemo(
    () => Object.fromEntries(Object.entries(historicalMapAnalysis?.byLga || {}).map(([name, result]) => [normalizeLgaMatch(name), result])),
    [historicalMapAnalysis],
  );
  const historicalWardResults = useMemo(
    () => Object.fromEntries((historicalMapAnalysis?.wardDetail?.areas || []).map(result => [normalizeLgaMatch(result.name), result])),
    [historicalMapAnalysis?.wardDetail],
  );
  const historicalPartyColor = (party) => ({
    APC: '#2563eb', PDP: '#dc2626', LP: '#16a34a', NNPP: '#7c3aed', ACCORD: '#f59e0b', A: '#f59e0b', ADC: '#0891b2', SDP: '#ea580c',
  })[String(party || '').toUpperCase()] || '#64748b';
  const compactPartyShares = (area) => {
    const listed = (area?.parties || []).slice(0, 3);
    const otherPercentage = (area?.parties || []).slice(3).reduce((sum, item) => sum + Number(item.percentage || 0), 0);
    return [...listed, ...(otherPercentage > 0 ? [{ party: 'Others', percentage: Number(otherPercentage.toFixed(2)) }] : [])];
  };
  const historicalWardForFeature = feature => {
    const properties = feature?.properties || {};
    const names = [properties.ward, ...String(properties.ward_alt_names || "").split(",")].map(normalizeLgaMatch).filter(Boolean);
    return names.map(name => historicalWardResults[name]).find(Boolean);
  };

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

  useEffect(() => {
    if (leaflet.current || !el.current) return;
    const map = L.map(el.current, {
      zoomControl: false,
      doubleClickZoom: false,
    }).setView(OYO_CENTER, 9);
    L.control.zoom({ position: "bottomright" }).addTo(map);
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
    if (!leaflet.current) return;
    tile.current?.remove();
    const osm = () =>
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        crossOrigin: true,
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
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
      const icon = L.divIcon({
        className: "",
        html: `<div class="officer-marker ${item.status.toLowerCase()}"><span></span>${item.name.split(" ")[1]}</div>`,
        iconSize: [92, 28],
        iconAnchor: [12, 14],
      });
      const marker = L.marker([item.lat, item.lng], { icon }).addTo(
        leaflet.current,
      );
      marker.bindPopup(
        `<div class="marker-popup"><b>${item.name}</b><br>${item.unit}<br>Status: ${item.status}${item.lastSeen ? `<br>Last GPS: ${new Date(item.lastSeen).toLocaleTimeString()}` : ""}${item.speed != null ? `<br>Speed: ${Math.round(item.speed * 3.6)} km/h` : ""}<div class="marker-actions"><button data-tool="measure">Measure from here</button><button data-tool="route">Route from here</button></div></div>`,
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
  }, [incidents, officers, cameras, emergencyAlerts, onMarkerTool]);
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
          const historical = historicalLgaResults[normalizeLgaMatch(name)];
          const status = partyLgaResults[normalizeLgaMatch(name)]?.status || (partyMapAnalysis?.party ? "no-data" : "");
          const colors = {
            winning: { line: "#16a34a", fill: "#22c55e" },
            losing: { line: "#dc2626", fill: "#ef4444" },
            tied: { line: "#ca8a04", fill: "#facc15" },
            "no-data": { line: "#ca8a04", fill: "#facc15" },
          };
          const selectedColor = historical
            ? { line: "#22d3ee", fill: historicalPartyColor(historical.winner) }
            : colors[status];
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
            const historical = historicalLgaResults[normalizeLgaMatch(name)];
            const performance = partyLgaResults[normalizeLgaMatch(name)];
            const status = performance?.status || (partyMapAnalysis?.party ? "no-data" : "");
            const statusLabel = status === "winning" ? "Winning" : status === "losing" ? "Losing" : status === "tied" ? "Tied" : status === "no-data" ? "No submitted result" : "";
            const margin = performance?.margin ? ` · margin ${Number(performance.margin).toLocaleString()}` : "";
            const historicalShares = compactPartyShares(historical).map(item => `${escapeMapText(item.party)} ${escapeMapText(item.percentage)}%`).join(" · ");
            const tooltip = historicalMapAnalysis
              ? `<strong>${escapeMapText(name)}</strong><br>Winner: ${escapeMapText(historical?.winner || "No recorded result")}<br>${historicalShares || "No recorded party shares"}`
              : partyMapAnalysis?.party
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
              if (historicalMapAnalysis) {
                if (layerGeo.getBounds?.().isValid?.()) leaflet.current?.fitBounds(layerGeo.getBounds(), { padding: [40, 40], maxZoom: 11 });
                onHistoricalLgaSelect?.(name);
                return;
              }
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
  }, [showLgaBorders, showBoundaryNames, mapLayers, onBoundarySelect, oyoBoundaries.lgas, partyMapAnalysis, partyLgaResults, historicalMapAnalysis, historicalLgaResults, onHistoricalLgaSelect]);

  useEffect(() => {
    const lga = historicalMapAnalysis?.selectedLga?.name;
    if (!lga) {
      setOyoWardBoundaries({ lga: "", wards: null, notice: "" });
      return undefined;
    }
    const controller = new AbortController();
    fetch(`${API}/boundaries/oyo/wards?lga=${encodeURIComponent(lga)}`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Ward boundary service unavailable")))
      .then(data => setOyoWardBoundaries({ lga, wards: data.wards || null, notice: data.notice || "" }))
      .catch(error => {
        if (error.name !== "AbortError") setOyoWardBoundaries({ lga, wards: null, notice: error.message || "Ward boundaries unavailable" });
      });
    return () => controller.abort();
  }, [historicalMapAnalysis?.selectedLga?.name]);

  useEffect(() => {
    const map = leaflet.current;
    if (!map) return;
    wardOverlay.current?.remove();
    wardOverlay.current = null;
    wardLabels.current.forEach(label => label.remove());
    wardLabels.current = [];
    const features = oyoWardBoundaries.wards?.features || [];
    if (!historicalMapAnalysis?.selectedLga || !features.length) return;
    const layer = L.geoJSON({ type: "FeatureCollection", features }, {
      pane: "overlayPane",
      style: feature => {
        const name = feature.properties?.ward || "";
        const result = historicalWardForFeature(feature);
        const fillColor = result ? historicalPartyColor(result.winner) : "#64748b";
        return { color: "#f0abfc", weight: 2.7, dashArray: result ? "" : "5 4", fillColor, fillOpacity: result ? 0.28 : 0.05, opacity: 1 };
      },
      onEachFeature: (feature, wardLayer) => {
        const name = feature.properties?.ward || feature.properties?.ward_alt_names || "Ward";
        const result = historicalWardForFeature(feature);
        const shares = compactPartyShares(result).map(item => `${escapeMapText(item.party)} ${escapeMapText(item.percentage)}%`).join(" · ");
        wardLayer.bindTooltip(`<strong>${escapeMapText(name)}</strong><br>${result ? `Winner: ${escapeMapText(result.winner)}<br>${shares}` : "Historical result not matched"}`, { sticky: true, className: "nigeria-lga-tooltip" });
        wardLayer.on({
          mouseover: event => {
            event.target.setStyle({ weight: 4, color: "#ffffff", fillOpacity: 0.42 });
            event.target.bringToFront();
          },
          mouseout: event => layer.resetStyle(event.target),
          click: event => {
            L.DomEvent.stopPropagation(event);
            const selectedWard = historicalWardForFeature(feature);
            if (selectedWard) onHistoricalWardSelect?.(selectedWard);
          },
        });
        if (showBoundaryNames) {
          const center = wardLayer.getBounds().getCenter();
          wardLabels.current.push(L.marker(center, {
            icon: L.divIcon({ className: "ward-name-label", html: `<div class="ward-label-text">${escapeMapText(name)}</div>`, iconSize: [110, 26], iconAnchor: [55, 13] }),
            interactive: false,
            pane: "overlayPane",
          }).addTo(map));
        }
      },
    }).addTo(map);
    wardOverlay.current = layer;
    layer.bringToFront();
    return () => {
      layer.remove();
      wardLabels.current.forEach(label => label.remove());
      wardLabels.current = [];
    };
  }, [oyoWardBoundaries.wards, historicalMapAnalysis?.selectedLga, historicalMapAnalysis?.wardDetail, historicalWardResults, showBoundaryNames, onHistoricalWardSelect]);

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
      {historicalMapAnalysis && (
        <aside className="historical-map-panel" aria-label="Previous election history">
          <header>
            <div><span>PREVIOUS ELECTION HISTORY</span><strong>{historicalMapAnalysis.year} {historicalMapAnalysis.election}</strong></div>
            <button type="button" onClick={onHistoricalClose} aria-label="Close previous election history">×</button>
          </header>
          <p className="historical-map-notice">{historicalMapAnalysis.notice || "Geographic figures are evidence transcriptions and may not reconcile with declared totals."}</p>
          {historicalMapAnalysis.error && <p className="historical-map-error">{historicalMapAnalysis.error}</p>}
          {historicalMapAnalysis.loading && <p className="historical-map-loading">Loading historical distribution…</p>}
          {!historicalMapAnalysis.loading && !historicalMapAnalysis.selectedLga && <>
            <p className="historical-map-instruction">Select a coloured LGA to see its party percentages{historicalMapAnalysis.availableLevels?.includes("ward") ? ", then drill into wards and polling units." : "."}</p>
            <div className="historical-winner-legend">{Object.entries(historicalMapAnalysis.winnerCounts || {}).map(([party, count]) => <span key={party}><i style={{ background: historicalPartyColor(party) }} /> {party}: {count} LGA{count === 1 ? "" : "s"}</span>)}</div>
          </>}
          {historicalMapAnalysis.selectedLga && <>
            <div className="historical-breadcrumb">
              <button type="button" onClick={() => onHistoricalBack?.("lgas")}>Oyo LGAs</button><span>›</span>
              {historicalMapAnalysis.selectedWard ? <button type="button" onClick={() => onHistoricalBack?.("wards")}>{historicalMapAnalysis.selectedLga.name}</button> : <b>{historicalMapAnalysis.selectedLga.name}</b>}
              {historicalMapAnalysis.selectedWard && <><span>›</span>{historicalMapAnalysis.selectedPollingUnit ? <button type="button" onClick={() => onHistoricalBack?.("polling-units")}>{historicalMapAnalysis.selectedWard.name}</button> : <b>{historicalMapAnalysis.selectedWard.name}</b>}</>}
            </div>
            <div className="historical-selected-summary">
              <strong>{historicalMapAnalysis.selectedPollingUnit?.name || historicalMapAnalysis.selectedWard?.name || historicalMapAnalysis.selectedLga.name}</strong>
              <span>Winner: <b>{historicalMapAnalysis.selectedPollingUnit?.winner || historicalMapAnalysis.selectedWard?.winner || historicalMapAnalysis.selectedLga.winner || "No result"}</b></span>
              <div>{compactPartyShares(historicalMapAnalysis.selectedPollingUnit || historicalMapAnalysis.selectedWard || historicalMapAnalysis.selectedLga).map(item => <small key={item.party}>{item.party} {item.percentage}%</small>)}</div>
              {historicalMapAnalysis.selectedPollingUnit && <div className="historical-pu-meta"><small>Registered: {historicalMapAnalysis.selectedPollingUnit.registeredVoters?.toLocaleString?.() ?? "Unavailable"}</small><small>Accredited: {historicalMapAnalysis.selectedPollingUnit.accreditedVoters?.toLocaleString?.() ?? "Unavailable"}</small><small>Recorded votes: {historicalMapAnalysis.selectedPollingUnit.totalVotes?.toLocaleString?.() ?? "Unavailable"}</small>{historicalMapAnalysis.selectedPollingUnit.confidence != null && <small>Transcription confidence: {historicalMapAnalysis.selectedPollingUnit.confidence}%</small>}</div>}
            </div>
            {historicalMapAnalysis.detailLoading && <p className="historical-map-loading">Loading the next level…</p>}
            {!historicalMapAnalysis.detailLoading && !historicalMapAnalysis.selectedPollingUnit && historicalMapAnalysis.detail?.areas?.length > 0 && <div className="historical-area-list">{historicalMapAnalysis.detail.areas.map(area => <button type="button" key={area.id} onClick={() => historicalMapAnalysis.detail.level === "ward" ? onHistoricalWardSelect?.(area) : onHistoricalPollingUnitSelect?.(area)}><span><i style={{ background: historicalPartyColor(area.winner) }} /><b>{area.name}</b><em>{area.code}</em></span><span><strong>{area.winner || "No result"}</strong><small>View</small></span></button>)}</div>}
            {!historicalMapAnalysis.detailLoading && historicalMapAnalysis.detailMessage && <p className="historical-map-instruction">{historicalMapAnalysis.detailMessage}</p>}
            {oyoWardBoundaries.notice && !historicalMapAnalysis.selectedWard && <p className="historical-boundary-note">Ward outlines: GRID3 operational boundaries; not authoritative.</p>}
          </>}
          <footer>Colours show the party with the most recorded votes. “Others” combines parties outside the top three in that area.</footer>
        </aside>
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

const cameraWatermarkLines = (feed = {}) => {
  const location = feed.location || {};
  const primary = location.label || (Number.isFinite(Number(feed.lat)) && Number.isFinite(Number(feed.lng)) ? `${Number(feed.lat).toFixed(5)}, ${Number(feed.lng).toFixed(5)}` : "Location awaiting GPS");
  return [
    primary,
    location.street && location.street !== primary ? location.street : "",
    `Polling Unit: ${feed.pollingUnit || feed.station || "Not assigned"}`,
    `Ward: ${feed.ward || "Not assigned"}  •  LGA: ${feed.lga || "Not assigned"}`,
    Number(feed.accuracy) > 0 ? `GPS accuracy ±${Math.round(Number(feed.accuracy))} m` : "",
  ].filter(Boolean);
};

function StreamVideo({ src, stream, muted = false, showControls = true, watermark }) {
  const ref = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [soundMuted, setSoundMuted] = useState(muted);
  const [volume, setVolume] = useState(muted ? 0 : 1);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
      return () => {
        video.srcObject = null;
      };
    }
    if (!src) return;
    let hls;
    let disposed = false;
    const attachSource = async () => {
      if (src.includes(".m3u8") && !video.canPlayType("application/vnd.apple.mpegurl")) {
        const { default: Hls } = await import("hls.js");
        if (disposed) return;
        if (Hls.isSupported()) {
          hls = new Hls({ lowLatencyMode: true });
          hls.loadSource(src);
          hls.attachMedia(video);
          return;
        }
      }
      video.src = src;
    };
    attachSource();
    return () => {
      disposed = true;
      hls?.destroy();
      video.removeAttribute("src");
    };
  }, [src, stream]);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = soundMuted || volume === 0;
    video.volume = Math.max(0, Math.min(1, volume));
  }, [soundMuted, volume]);
  const toggleSound = () => {
    if (soundMuted || volume === 0) {
      setSoundMuted(false);
      if (volume === 0) setVolume(1);
    } else {
      setSoundMuted(true);
    }
  };
  const toggleRecording = () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    const video = ref.current;
    try {
      const source =
        stream || video?.captureStream?.() || video?.mozCaptureStream?.();
      if (!source)
        throw new Error("Recording is not supported in this browser");
      chunksRef.current = [];
      const recorder = new MediaRecorder(source, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : "video/webm",
      });
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `election-monitor-recording-${Date.now()}.webm`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
      recorderRef.current = recorder;
      recorder.start(1000);
      setRecording(true);
    } catch (error) {
      alert(error.message || "Unable to start recording this stream");
    }
  };
  return (
    <div className="recordable-video">
      <video ref={ref} controls={showControls} autoPlay playsInline muted={soundMuted} />
      {watermark && <div className="video-location-watermark">{cameraWatermarkLines(watermark).map((line, index) => index === 0 ? <strong key={line}>{line}</strong> : <span key={`${line}-${index}`}>{line}</span>)}<small>© OpenStreetMap contributors</small></div>}
      {showControls && (
        <>
          <div className="stream-audio-controls">
            <button type="button" onClick={toggleSound} title={soundMuted || volume === 0 ? "Turn sound on" : "Turn sound off"} aria-label={soundMuted || volume === 0 ? "Turn sound on" : "Turn sound off"}>
              {soundMuted || volume === 0 ? <FaVolumeMute /> : volume < 0.5 ? <FaVolumeDown /> : <FaVolumeUp />}
            </button>
            <input type="range" min="0" max="1" step="0.05" value={soundMuted ? 0 : volume} onChange={(event) => { const nextVolume = Number(event.target.value); setVolume(nextVolume); setSoundMuted(nextVolume === 0); }} aria-label="Stream volume" title={`Volume ${Math.round((soundMuted ? 0 : volume) * 100)}%`} />
            <span>{Math.round((soundMuted ? 0 : volume) * 100)}%</span>
          </div>
          <button type="button" className={`stream-record-button ${recording ? "record-stop" : ""}`} onClick={toggleRecording}>
            {recording ? "Stop & save" : "Record"}
          </button>
        </>
      )}
    </div>
  );
}

function AnalyticsPanel({
  incidents,
  officers,
  mapLayers,
  selected,
  onClose,
  onTool,
  onCsv,
  onClear,
  full,
  embedded = false,
}) {
  const resultReports = useMemo(
    () => incidents.filter((item) => item.reportType === POLLING_RESULT_TYPE),
    [incidents],
  );
  const pollingUnitSummaries = useMemo(() => {
    const grouped = new Map();
    resultReports.forEach((item) => {
      const unit = (item.pollingUnit || "Unspecified polling unit").trim();
      if (!grouped.has(unit)) {
        grouped.set(unit, {
          unit,
          count: 0,
          total: 0,
          submissions: [],
          breakdown: new Map(),
        });
      }
      const entry = grouped.get(unit);
      entry.count += 1;
      entry.submissions.push(item);
      const directVotes = Number(String(item.resultCount || "").trim());
      const legacyParty = [
        ...parseResultEntries(item.resultCount),
        ...(item.partyResult ? parseResultEntries(item.partyResult) : []),
      ].find(({ label }) => /^party$/i.test(String(label).trim()))?.value;
      const numbers = [{ label: COMMAND_PARTY, value: Number.isFinite(directVotes) ? directVotes : Number(legacyParty || 0) }];
      entry.total += numbers.reduce((sum, value) => sum + value.value, 0);
      numbers.forEach((detail) => {
        const existing = entry.breakdown.get(detail.label) || { label: detail.label, total: 0 };
        existing.total += detail.value;
        entry.breakdown.set(detail.label, existing);
      });
    });
    return Array.from(grouped.values())
      .map((entry) => ({
        ...entry,
        breakdown: Array.from(entry.breakdown.values()).sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total);
  }, [resultReports]);
  const [result, setResult] = useState("Click an analysis tool to execute");
  const pointLayers = mapLayers.filter(
    (layer) => layer.category === "Point" || layer.type === "geojson",
  );
  const severityLevels = ["Low", "Medium", "High", "Critical"];
  const severityBreakdown = useMemo(
    () =>
      severityLevels.map((level) => [
        level,
        incidents.filter((item) => item.severity === level).length,
      ]),
    [incidents],
  );
  const reportTypeBreakdown = useMemo(() => {
    const counts = incidents.reduce((acc, item) => {
      const key = item.reportType || "Custom";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [incidents]);
  const maxSeverity = Math.max(
    1,
    ...severityBreakdown.map(([, count]) => count),
  );
  const maxType = Math.max(1, ...reportTypeBreakdown.map(([, count]) => count));
  const highRiskCount = incidents.filter((item) =>
    ["High", "Critical"].includes(item.severity),
  ).length;
  const isToday = (d) => {
    if (!d) return false;
    const dt = new Date(d);
    const now = new Date();
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate();
  };
  const sosToday = incidents.filter((i) => (i.reportType === "SOS-Emergency" || i.reportType === "SOS") && isToday(i.createdAt)).length;
  const incidentsToday = incidents.filter((i) => isToday(i.createdAt) && i.reportType !== POLLING_RESULT_TYPE).length;
  const anythingToday = incidents.filter((i) => isToday(i.createdAt)).length;
  const run = async (tool) => setResult(await onTool(tool));
  const totalIncidents = incidents.length;
  const resolvedCount = incidents.filter(i => i.status === "Resolved").length;
  const openCount = incidents.filter(i => i.status === "Open" || !i.status).length;
  const resolvedPct = totalIncidents ? Math.round((resolvedCount / totalIncidents) * 100) : 0;

  // Donut chart values for severity
  const severityColors = { Low: "#38bdf8", Medium: "#facc15", High: "#fb923c", Critical: "#ef4444" };
  const donutR = 54;
  const donutCx = 70;
  const donutCy = 70;
  const donutCirc = 2 * Math.PI * donutR;
  let donutOffset = 0;
  const donutSlices = severityBreakdown
    .filter(([, c]) => c > 0)
    .map(([level, count]) => {
      const pct = count / Math.max(1, totalIncidents);
      const dash = pct * donutCirc;
      const slice = { level, count, dash, offset: donutOffset, color: severityColors[level] };
      donutOffset += dash;
      return slice;
    });

  return (
    <section className={embedded ? "analytics-embedded" : full ? "results-center" : "analytics-panel"}>
      {/* Header */}
      {!embedded && <div className="results-center-head ap-head">
        <div>
          <span className="eyebrow">INTELLIGENCE DASHBOARD</span>
          <h1>Map Analysis &amp; Reports</h1>
          <p>Live operational pulse — incident distribution &amp; field analytics</p>
        </div>
        <div className="ap-head-right">
          <div className="analytics-pulse">● Live</div>
          <button className="icon-btn" onClick={onClose} title="Close">
            <FaTimes />
          </button>
        </div>
      </div>}

      <div className="results-center-body ap-body">

        {/* KPI stat cards */}
        <div className="ap-kpi-row">
          <div className="ap-kpi-card ap-kpi-red">
            <span className="ap-kpi-label">Total Incidents</span>
            <strong className="ap-kpi-val">{totalIncidents}</strong>
            <span className="ap-kpi-sub">{openCount} open · {resolvedCount} resolved</span>
          </div>
          <div className="ap-kpi-card ap-kpi-orange">
            <span className="ap-kpi-label">High Risk</span>
            <strong className="ap-kpi-val">{highRiskCount}</strong>
            <span className="ap-kpi-sub">High + Critical severity</span>
          </div>
          <div className="ap-kpi-card ap-kpi-red2">
            <span className="ap-kpi-label">SOS Today</span>
            <strong className="ap-kpi-val">{sosToday}</strong>
            <span className="ap-kpi-sub">Emergency alerts today</span>
          </div>
          <div className="ap-kpi-card ap-kpi-amber">
            <span className="ap-kpi-label">Incidents Today</span>
            <strong className="ap-kpi-val">{incidentsToday}</strong>
            <span className="ap-kpi-sub">{anythingToday} total reports today</span>
          </div>
          <div className="ap-kpi-card ap-kpi-blue">
            <span className="ap-kpi-label">Field Personnel</span>
            <strong className="ap-kpi-val">{officers.length}</strong>
            <span className="ap-kpi-sub">{pointLayers.length} point layers active</span>
          </div>
          <div className="ap-kpi-card ap-kpi-green">
            <span className="ap-kpi-label">Resolved</span>
            <strong className="ap-kpi-val">{resolvedPct}%</strong>
            <span className="ap-kpi-sub">{resolvedCount} of {totalIncidents} incidents</span>
          </div>
        </div>

        {/* Charts row */}
        <div className="ap-charts-row">

          {/* Donut — severity */}
          <div className="ap-card ap-donut-card">
            <div className="ap-card-head">
              <b>Severity Breakdown</b>
              <span>Incident intensity distribution</span>
            </div>
            <div className="ap-donut-wrap">
              <svg viewBox="0 0 140 140" className="ap-donut-svg" role="img" aria-label="Severity donut chart">
                <circle cx={donutCx} cy={donutCy} r={donutR} fill="none" stroke="#1a2f42" strokeWidth="18" />
                {donutSlices.length === 0 && (
                  <circle cx={donutCx} cy={donutCy} r={donutR} fill="none" stroke="#1a2f42" strokeWidth="18" />
                )}
                {donutSlices.map(({ level, dash, offset, color }) => (
                  <circle
                    key={level}
                    cx={donutCx} cy={donutCy} r={donutR}
                    fill="none"
                    stroke={color}
                    strokeWidth="18"
                    strokeDasharray={`${dash} ${donutCirc - dash}`}
                    strokeDashoffset={-offset + donutCirc * 0.25}
                    strokeLinecap="butt"
                    style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
                  />
                ))}
                <text x={donutCx} y={donutCy - 6} textAnchor="middle" className="ap-donut-big">{totalIncidents}</text>
                <text x={donutCx} y={donutCy + 12} textAnchor="middle" className="ap-donut-sub">total</text>
              </svg>
              <div className="ap-donut-legend">
                {severityBreakdown.map(([level, count]) => (
                  <div className="ap-legend-row" key={level}>
                    <span className="ap-legend-dot" style={{ background: severityColors[level], boxShadow: `0 0 6px ${severityColors[level]}99` }} />
                    <span className="ap-legend-label">{level}</span>
                    <strong className="ap-legend-val">{count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bar chart — report types */}
          <div className="ap-card ap-bar-card">
            <div className="ap-card-head">
              <b>Report Type Breakdown</b>
              <span>Top incident categories</span>
            </div>
            <div className="ap-bar-list">
              {reportTypeBreakdown.length === 0 && (
                <div className="ap-empty">No reports yet</div>
              )}
              {reportTypeBreakdown.map(([type, count]) => {
                const pct = Math.round((count / Math.max(1, totalIncidents)) * 100);
                const col = REPORT_TYPE_STYLES[type]?.color || "#38bdf8";
                return (
                  <div className="ap-bar-row" key={type}>
                    <div className="ap-bar-meta">
                      <span className="ap-bar-icon"><ReportTypeIcon type={type} size={13} color={col} /></span>
                      <span className="ap-bar-name">{type}</span>
                      <strong className="ap-bar-count">{count}</strong>
                    </div>
                    <div className="ap-bar-track">
                      <div className="ap-bar-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${col}cc, ${col}55)`, boxShadow: `0 0 8px ${col}66` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resolution progress */}
          <div className="ap-card ap-progress-card">
            <div className="ap-card-head">
              <b>Resolution Progress</b>
              <span>Incident closure rate</span>
            </div>
            <div className="ap-progress-wrap">
              <svg viewBox="0 0 120 120" className="ap-ring-svg" role="img" aria-label="Resolution ring">
                <circle cx="60" cy="60" r="48" fill="none" stroke="#1a2f42" strokeWidth="12" />
                <circle cx="60" cy="60" r="48" fill="none"
                  stroke="url(#resolveGrad)" strokeWidth="12"
                  strokeDasharray={`${(resolvedPct / 100) * 301.6} 301.6`}
                  strokeDashoffset="75.4"
                  strokeLinecap="round"
                  style={{ filter: "drop-shadow(0 0 8px #34d39988)" }}
                />
                <defs>
                  <linearGradient id="resolveGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                </defs>
                <text x="60" y="55" textAnchor="middle" className="ap-donut-big">{resolvedPct}%</text>
                <text x="60" y="72" textAnchor="middle" className="ap-donut-sub">resolved</text>
              </svg>
              <div className="ap-progress-stats">
                <div className="ap-pstat"><span>Open</span><b style={{color:"#fb923c"}}>{openCount}</b></div>
                <div className="ap-pstat"><span>Resolved</span><b style={{color:"#34d399"}}>{resolvedCount}</b></div>
                <div className="ap-pstat"><span>Total</span><b>{totalIncidents}</b></div>
                <div className="ap-pstat"><span>Selected</span><b style={{color:"#facc15",fontSize:"10px"}}>{selected?.title || "None"}</b></div>
              </div>
            </div>
          </div>
        </div>

        {/* Polling unit summaries */}
        {pollingUnitSummaries.length > 0 && (
          <div className="ap-card ap-polls-card">
            <div className="ap-card-head">
              <b>Polling Unit Vote Results</b>
              <span>{pollingUnitSummaries.length} unit{pollingUnitSummaries.length === 1 ? "" : "s"} submitted</span>
            </div>
            <div className="polling-unit-list">
              {pollingUnitSummaries.map((entry) => (
                <div className="polling-unit-item" key={entry.unit}>
                  <div>
                    <strong>{entry.unit}</strong>
                    <small>{entry.count} submission{entry.count === 1 ? "" : "s"}</small>
                  </div>
                  <b>Total {entry.total}</b>
                  <div className="polling-unit-breakdown">
                    {entry.breakdown.map((detail) => (
                      <div className="polling-unit-breakdown-row" key={detail.label}>
                        <span>{detail.label}</span>
                        <b>{detail.total}</b>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}

function ResultsCenter({ incidents, parties = [], officers = [], personnel = [], mapLayers = [], selected, onClose, authToken, canAdmin = false, initialFocusParty = "", onPartyMapChange, onShowHistoricalMap, onFocusLocation, onTool, onCsv, onClear }) {
  const [view, setView] = useState("pulse");
  const [resultSourceFilter, setResultSourceFilter] = useState("");
  const [focusParty, setFocusParty] = useState(initialFocusParty);
  const [outlook, setOutlook] = useState("");
  const [outlookLoading, setOutlookLoading] = useState(false);
  const [postElectionBrief, setPostElectionBrief] = useState("");
  const [postElectionLoading, setPostElectionLoading] = useState(false);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState("");
  const [newsSummary, setNewsSummary] = useState("");
  const [newsSummaryError, setNewsSummaryError] = useState("");
  const [newsSummaryLoading, setNewsSummaryLoading] = useState(false);
  const [irevPilot, setIrevPilot] = useState(null);
  const [irevLoading, setIrevLoading] = useState(false);
  const [irevError, setIrevError] = useState("");
  const [irevDrafts, setIrevDrafts] = useState({});
  const [irevExtractingIds, setIrevExtractingIds] = useState(() => new Set());
  const [irevFailedIds, setIrevFailedIds] = useState(() => new Set());
  const [irevAutoStopped, setIrevAutoStopped] = useState(false);
  const [irevAiStoppedReason, setIrevAiStoppedReason] = useState("");
  const irevResumeTimerRef = useRef(null);
  const [irevSection, setIrevSection] = useState("uploads");
  const [irevSearch, setIrevSearch] = useState("");
  const [irevPreview, setIrevPreview] = useState(null);
  const [compareWithIrev, setCompareWithIrev] = useState(false);
  const [irevCompareLoading, setIrevCompareLoading] = useState(false);
  const [fieldMismatchDetail, setFieldMismatchDetail] = useState(null);
  useEffect(() => {
    if (view !== "news" || news.length) return;
    setNewsLoading(true);
    request("/news?q=Oyo State politics INEC elections parties security SBK PDP governorship 2027", authToken).then(data => setNews(data.articles || [])).catch(error => { setNews([]); setNewsError(error.message || "News service unavailable"); }).finally(() => setNewsLoading(false));
  }, [view, news.length]);
  const loadIrevPilot = async (force = false) => {
    setIrevLoading(true);
    setIrevError("");
    try {
      const pilot = await request(`/irev/oyo${force ? "?refresh=1" : ""}`, authToken);
      setIrevPilot(pilot);
      setIrevDrafts((current) => ({
        ...Object.fromEntries((pilot.uploads || []).filter((upload) => upload.extraction?.provider === "gemini").map((upload) => [upload.id, upload.extraction])),
        ...Object.fromEntries(Object.entries(current).filter(([, extraction]) => extraction?.provider === "gemini")),
      }));
      return pilot;
    } catch (error) {
      setIrevError(error.message || "The official IReV feed is unavailable.");
      return null;
    } finally {
      setIrevLoading(false);
    }
  };
  useEffect(() => {
    if (!["irev", "post"].includes(view)) return undefined;
    let stopped = false;
    let timer = null;
    const poll = async () => {
      const pilot = await loadIrevPilot();
      if (!stopped) timer = window.setTimeout(poll, Math.max(60_000, Number(pilot?.refreshIntervalMs) || 300_000));
    };
    poll();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [view, authToken]);
  const extractIrevText = async (uploadId) => {
    setIrevExtractingIds((current) => new Set(current).add(uploadId));
    setIrevError("");
    try {
      const result = await request("/irev/oyo/ocr", authToken, { method: "POST", body: JSON.stringify({ uploadId }) });
      setIrevDrafts((current) => ({ ...current, [uploadId]: result }));
    } catch (error) {
      if (["IREV_IMAGE_RATE_LIMITED", "OCR_QUEUE_RATE_LIMITED"].includes(error.code) || (error.status === 429 && !["AI_QUOTA_EXHAUSTED", "AI_RATE_LIMITED"].includes(error.code))) {
        setIrevError("");
        setIrevAutoStopped(true);
        setIrevAiStoppedReason(error.message || "OCR is temporarily paused and will resume automatically.");
        window.clearTimeout(irevResumeTimerRef.current);
        irevResumeTimerRef.current = window.setTimeout(() => { setIrevAutoStopped(false); setIrevAiStoppedReason(""); }, 60_000);
      } else if (["AI_QUOTA_EXHAUSTED", "AI_RATE_LIMITED"].includes(error.code)) {
        setIrevFailedIds((current) => new Set(current).add(uploadId));
        setIrevError("");
        setIrevAutoStopped(true);
        setIrevAiStoppedReason(error.message);
      } else if (/configure|not configured|service unavailable|api key/i.test(error.message || "")) {
        setIrevFailedIds((current) => new Set(current).add(uploadId));
        setIrevError("");
        setIrevAutoStopped(true);
        setIrevAiStoppedReason(error.message);
      } else {
        setIrevFailedIds((current) => new Set(current).add(uploadId));
        setIrevError(error.message || "Image-to-text extraction failed.");
      }
    } finally {
      setIrevExtractingIds((current) => { const next = new Set(current); next.delete(uploadId); return next; });
    }
  };
  useEffect(() => () => window.clearTimeout(irevResumeTimerRef.current), []);
  const openIrevPreview = (upload) => {
    setIrevPreview(upload);
    if (canAdmin && !irevDrafts[upload.id] && !irevExtractingIds.has(upload.id)) extractIrevText(upload.id);
  };
  useEffect(() => {
    if ((!['irev', 'post'].includes(view) && !compareWithIrev) || !canAdmin || irevAutoStopped || !irevPilot?.uploads?.length) return undefined;
    const availableSlots = Math.max(0, 2 - irevExtractingIds.size);
    const nextUploads = irevPilot.uploads.filter((upload) => !irevDrafts[upload.id] && !irevFailedIds.has(upload.id) && !irevExtractingIds.has(upload.id)).slice(0, availableSlots);
    if (!nextUploads.length) return undefined;
    const timer = window.setTimeout(() => nextUploads.forEach((upload) => extractIrevText(upload.id)), 5_000);
    return () => window.clearTimeout(timer);
  }, [view, compareWithIrev, canAdmin, irevAutoStopped, irevPilot, irevDrafts, irevExtractingIds, irevFailedIds]);
  const reports = useMemo(
    () => incidents.filter((item) => item.reportType === POLLING_RESULT_TYPE),
    [incidents],
  );
  const summary = useMemo(() => {
    const rows = reports.map((report) => {
      let results = [];
      try { const parsed = JSON.parse(report.resultCount || "[]"); if (Array.isArray(parsed)) results = parsed; } catch { results = parseResultEntries(report.resultCount).map(item => ({ party: item.label, votes: item.value })); }
      const creatorRole = personnel.find((person) => person.id === report.createdBy)?.role || officers.find((officer) => officer.id === report.createdBy)?.role;
      const resultSource = report.style?.resultSource || (creatorRole === "Supervisor" ? "Supervisor" : creatorRole === "Admin" || creatorRole === "Super Admin" ? "INEC IReV" : "Agent");
      return { ...report, results, resultSource };
    });
    const historicalParties = rows.flatMap(row => row.results.map(item => item.party));
    const partyNames = [...new Set([...parties, ...historicalParties].filter(Boolean))];
    const totals = Object.fromEntries(partyNames.map(party => [party, rows.reduce((sum, row) => sum + Number(row.results.find(item => item.party === party)?.votes || 0), 0)]));
    return {
      partyNames, totals,
      rows: rows.sort((a, b) => `${a.lga}${a.ward}${a.pollingUnit}`.localeCompare(`${b.lga}${b.ward}${b.pollingUnit}`)),
    };
  }, [reports, parties, personnel, officers]);
  const sourceStats = useMemo(() => RESULT_SOURCES.map((source) => {
    const rows = summary.rows.filter((row) => row.resultSource === source);
    const liveIrevUploads = source === "INEC IReV" ? Number(irevPilot?.submitted || 0) : 0;
    return {
      source,
      submissions: Math.max(rows.length, liveIrevUploads),
      units: new Set(rows.map((row) => `${row.lga}|${row.ward}|${row.pollingUnit}`)).size,
      votes: rows.reduce((total, row) => total + row.results.reduce((sum, item) => sum + Number(item.votes || 0), 0), 0),
      liveIrevUploads,
    };
  }), [summary.rows, irevPilot]);
  const fieldResultRows = useMemo(() => summary.rows.filter((row) => row.resultSource !== "INEC IReV"), [summary.rows]);
  const fieldResultTotals = useMemo(() => Object.fromEntries(summary.partyNames.map((party) => [party, fieldResultRows.reduce((total, row) => total + Number(row.results.find((item) => item.party === party)?.votes || 0), 0)])), [fieldResultRows, summary.partyNames]);
  const fieldTopParties = useMemo(() => Object.keys(fieldResultTotals).filter((party) => fieldResultTotals[party] > 0).sort((a, b) => fieldResultTotals[b] - fieldResultTotals[a]).slice(0, 6), [fieldResultTotals]);
  const displayedResultRows = useMemo(
    () => resultSourceFilter ? fieldResultRows.filter((row) => row.resultSource === resultSourceFilter) : fieldResultRows,
    [fieldResultRows, resultSourceFilter],
  );
  const normalizeResultKeyPart = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const resultUnitKey = (row) => [row.lga, row.ward, row.pollingUnit].map(normalizeResultKeyPart).join("|");
  const fieldRowsByUnit = useMemo(() => {
    const units = new Map();
    fieldResultRows.forEach((row) => {
      const key = resultUnitKey(row);
      if (!units.has(key)) units.set(key, {});
      const current = units.get(key)[row.resultSource];
      if (!current || new Date(row.createdAt).getTime() >= new Date(current.createdAt).getTime()) units.get(key)[row.resultSource] = row;
    });
    return units;
  }, [fieldResultRows]);
  const filteredIrevUploads = useMemo(() => {
    const query = irevSearch.trim().toLowerCase();
    const uploads = irevPilot?.uploads || [];
    if (!query) return uploads;
    return uploads.filter((upload) => [upload.puCode, upload.pollingUnit, upload.ward, upload.lga].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [irevPilot, irevSearch]);
  const irevResultRows = useMemo(() => (irevPilot?.uploads || []).map((upload) => ({ ...upload, results: irevDrafts[upload.id]?.results || [] })).filter((upload) => upload.results.length), [irevPilot, irevDrafts]);
  const irevRowsByUnit = useMemo(() => new Map(irevResultRows.map((row) => [resultUnitKey(row), row])), [irevResultRows]);
  const irevOnlyTotals = useMemo(() => irevResultRows.reduce((totals, upload) => {
    upload.results.forEach(({ party, votes }) => { totals[party] = (totals[party] || 0) + Number(votes || 0); });
    return totals;
  }, {}), [irevResultRows]);
  const irevTopParties = useMemo(() => Object.keys(irevOnlyTotals).filter((party) => irevOnlyTotals[party] > 0).sort((a, b) => irevOnlyTotals[b] - irevOnlyTotals[a]).slice(0, 5), [irevOnlyTotals]);
  const top6 = useMemo(() => summary.partyNames.filter((party) => summary.totals[party] > 0).sort((a,b) => summary.totals[b]-summary.totals[a]).slice(0,6), [summary]);
  const winLoss = useMemo(() => {
    const groups = (key) => {
      const map = new Map();
      for (const row of summary.rows) { const id = key(row); if (!map.has(id)) map.set(id, { label: id, rows: [] }); map.get(id).rows.push(row); }
      return [...map.values()].map(group => {
        const votes = Object.fromEntries(summary.partyNames.map(p => [p, group.rows.reduce((n,r) => n + Number(r.results.find(x => x.party === p)?.votes || 0), 0)]));
        const max = Math.max(0, ...Object.values(votes));
        const leaders = max ? summary.partyNames.filter(p => votes[p] === max) : [];
        return { ...group, votes, max, leaders, winner: leaders.length === 1 ? leaders[0] : null, tied: leaders.length > 1 };
      });
    };
    return { wards: groups(r => `${r.lga || "Unknown LGA"} / ${r.ward || "Unknown Ward"}`), lgas: groups(r => r.lga || "Unknown LGA") };
  }, [summary]);
  const forecast = useMemo(() => {
    const total = Object.values(summary.totals).reduce((a, b) => a + b, 0);
    const ranked = summary.partyNames.slice().sort((a,b) => summary.totals[b] - summary.totals[a]);
    const leader = ranked[0] || null;
    const second = ranked[1] ? summary.totals[ranked[1]] : 0;
    const margin = leader ? summary.totals[leader] - second : 0;
    const coverage = new Set(summary.rows.map(r => `${r.lga}|${r.ward}|${r.pollingUnit}`)).size;
    return { leader, margin, total, coverage, confidence: total && leader ? Math.min(99, Math.round((summary.totals[leader] / total) * 100 + Math.min(20, coverage / 10))) : 0 };
  }, [summary]);
  const partyAnalysis = useMemo(() => {
    if (!focusParty || view !== "action") return null;
    const wards = winLoss.wards.filter(g => g.winner === focusParty).length;
    const assessedLgas = winLoss.lgas.filter(g => g.max > 0);
    const winningLgas = assessedLgas.filter(g => g.winner === focusParty).map(g => {
      const runnerUp = Object.entries(g.votes).filter(([party]) => party !== focusParty).sort((a, b) => b[1] - a[1])[0] || ["No challenger", 0];
      return { name: g.label, votes: g.votes[focusParty] || 0, opponent: runnerUp[0], opponentVotes: runnerUp[1], margin: (g.votes[focusParty] || 0) - runnerUp[1] };
    }).sort((a, b) => b.margin - a.margin);
    const losingLgas = assessedLgas.filter(g => g.winner && g.winner !== focusParty).map(g => ({
      name: g.label,
      votes: g.votes[focusParty] || 0,
      opponent: g.winner,
      opponentVotes: g.votes[g.winner] || 0,
      margin: (g.votes[g.winner] || 0) - (g.votes[focusParty] || 0)
    })).sort((a, b) => b.margin - a.margin);
    const tiedLgas = assessedLgas.filter(g => g.tied && g.leaders.includes(focusParty)).map(g => g.label);
    const incidentsForParty = incidents.filter(i => String(i.description || "").toLowerCase().includes(focusParty.toLowerCase())).length;
    return { votes: summary.totals[focusParty] || 0, wards, lgas: winningLgas.length, winningLgas, losingLgas, tiedLgas, incidents: incidentsForParty };
  }, [focusParty, incidents, summary, winLoss, view]);
  useEffect(() => {
    if (!onPartyMapChange) return;
    if (!focusParty || !partyAnalysis) {
      onPartyMapChange(null);
      return;
    }
    const byLga = {};
    partyAnalysis.winningLgas.forEach(item => { byLga[item.name] = { ...item, status: "winning" }; });
    partyAnalysis.losingLgas.forEach(item => { byLga[item.name] = { ...item, status: "losing" }; });
    partyAnalysis.tiedLgas.forEach(name => { byLga[name] = { name, status: "tied" }; });
    onPartyMapChange({ party: focusParty, byLga });
  }, [focusParty, partyAnalysis, onPartyMapChange]);
  const actionableIntel = useMemo(() => {
    const critical = incidents.filter(i => i.severity === "Critical" || i.reportType === "SOS-Emergency").length;
    const open = incidents.filter(i => !["Resolved", "Submitted"].includes(i.status)).length;
    return { critical, otherOpen: Math.max(0, open - critical) };
  }, [incidents]);
  const postElection = useMemo(() => {
    const unitKey = (row) => `${row.lga || ""}|${row.ward || ""}|${row.pollingUnit || ""}`;
    const compareResults = (left, right) => summary.partyNames.every((party) => {
      const partyKey = normalizeResultKeyPart(party);
      const leftVotes = Number(left?.results?.find((item) => normalizeResultKeyPart(item.party) === partyKey)?.votes || 0);
      const rightVotes = Number(right?.results?.find((item) => normalizeResultKeyPart(item.party) === partyKey)?.votes || 0);
      return leftVotes === rightVotes;
    });
    const fieldMismatches = [...fieldRowsByUnit.entries()].filter(([, pair]) => pair.Agent && pair.Supervisor && !compareResults(pair.Agent, pair.Supervisor));
    const irevMismatches = [...fieldRowsByUnit.entries()].filter(([key, pair]) => {
      const official = irevRowsByUnit.get(key);
      const field = pair.Supervisor || pair.Agent;
      return official && field && !compareResults(field, official);
    });
    const uniqueSourceUnits = new Set(summary.rows.map((row) => `${unitKey(row)}|${row.resultSource}`));
    const duplicates = Math.max(0, summary.rows.length - uniqueSourceUnits.size);
    const missingEvidence = fieldResultRows.filter((row) => !Array.isArray(row.media) || row.media.length === 0);
    const zeroVoteSheets = fieldResultRows.filter((row) => row.results.reduce((sum, item) => sum + Number(item.votes || 0), 0) === 0);
    const fieldPairCount = [...fieldRowsByUnit.values()].filter((pair) => pair.Agent && pair.Supervisor).length;
    const irevComparableCount = [...fieldRowsByUnit.keys()].filter((key) => irevRowsByUnit.has(key)).length;
    const readinessPenalty = (missingEvidence.length / Math.max(1, fieldResultRows.length)) * 35
      + (fieldMismatches.length / Math.max(1, fieldPairCount)) * 25
      + (irevMismatches.length / Math.max(1, irevComparableCount)) * 25
      + (duplicates / Math.max(1, summary.rows.length)) * 10
      + (zeroVoteSheets.length / Math.max(1, fieldResultRows.length)) * 5;
    const readinessScore = summary.rows.length ? Math.max(0, Math.min(100, 100 - Math.round(readinessPenalty))) : 0;

    const canonicalRows = [...fieldRowsByUnit.values()].map((pair) => pair.Supervisor || pair.Agent).filter(Boolean);
    const spatialGroups = new Map();
    canonicalRows.forEach((row) => {
      const label = `${row.lga || "Unknown LGA"} / ${row.ward || "Unknown Ward"}`;
      if (!spatialGroups.has(label)) spatialGroups.set(label, []);
      spatialGroups.get(label).push(row);
    });
    const wardSpatial = [...spatialGroups.entries()].map(([label, rows]) => {
      const votes = Object.fromEntries(summary.partyNames.map((party) => [party, rows.reduce((sum, row) => sum + Number(row.results.find((item) => item.party === party)?.votes || 0), 0)]));
      const max = Math.max(0, ...Object.values(votes));
      const leaders = max ? summary.partyNames.filter((party) => votes[party] === max) : [];
      const group = { label, rows, votes, winner: leaders.length === 1 ? leaders[0] : null };
      const totalVotes = Object.values(group.votes).reduce((sum, value) => sum + Number(value || 0), 0);
      const ranked = Object.entries(group.votes).sort((a, b) => b[1] - a[1]);
      const margin = Number(ranked[0]?.[1] || 0) - Number(ranked[1]?.[1] || 0);
      const [lga, ward] = group.label.split(" / ");
      const relatedIncidents = incidents.filter((item) => item.reportType !== POLLING_RESULT_TYPE && normalizeResultKeyPart(item.lga) === normalizeResultKeyPart(lga) && normalizeResultKeyPart(item.ward) === normalizeResultKeyPart(ward));
      const point = group.rows.find((row) => Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng)));
      return { ...group, lga, ward, totalVotes, margin, reports: group.rows.length, incidentCount: relatedIncidents.length, criticalCount: relatedIncidents.filter((item) => item.severity === "Critical" || item.reportType === "SOS-Emergency").length, lat: Number(point?.lat), lng: Number(point?.lng) };
    }).sort((a, b) => b.totalVotes - a.totalVotes);

    const chronological = canonicalRows.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const trendParties = top6.slice(0, 4);
    const running = Object.fromEntries(trendParties.map((party) => [party, 0]));
    let runningAllVotes = 0;
    const trendPoints = chronological.map((row, index) => {
      trendParties.forEach((party) => { running[party] += Number(row.results.find((item) => item.party === party)?.votes || 0); });
      runningAllVotes += row.results.reduce((sum, item) => sum + Number(item.votes || 0), 0);
      return { index, shares: Object.fromEntries(trendParties.map((party) => [party, runningAllVotes ? (running[party] / runningAllVotes) * 100 : 0])) };
    });
    const trendSeries = trendParties.map((party) => ({
      party,
      points: trendPoints.map((point, index) => `${trendPoints.length < 2 ? 0 : (index / (trendPoints.length - 1)) * 320},${96 - point.shares[party] * 0.9}`).join(" "),
      share: trendPoints.at(-1)?.shares?.[party] || 0,
      movement: (trendPoints.at(-1)?.shares?.[party] || 0) - (trendPoints[Math.max(0, Math.floor(trendPoints.length / 2) - 1)]?.shares?.[party] || 0),
    }));

    const people = new Map(personnel.map((person) => [person.id, person]));
    const creatorIds = [...new Set(fieldResultRows.map((row) => row.createdBy).filter(Boolean))];
    const performance = creatorIds.map((creatorId) => {
      const rows = fieldResultRows.filter((row) => row.createdBy === creatorId);
      const evidenceRate = rows.length ? rows.filter((row) => Array.isArray(row.media) && row.media.length > 0).length / rows.length : 0;
      let comparable = 0; let matching = 0;
      rows.forEach((row) => {
        const pair = fieldRowsByUnit.get(resultUnitKey(row)) || {};
        const counterpart = row.resultSource === "Agent" ? pair.Supervisor : pair.Agent;
        if (counterpart) { comparable += 1; if (compareResults(row, counterpart)) matching += 1; }
      });
      const consistencyRate = comparable ? matching / comparable : 0.5;
      const authoredIncidents = incidents.filter((item) => item.createdBy === creatorId && item.reportType !== POLLING_RESULT_TYPE);
      const closureRate = authoredIncidents.length ? authoredIncidents.filter((item) => item.status === "Resolved").length / authoredIncidents.length : 1;
      return { id: creatorId, name: people.get(creatorId)?.name || creatorId, role: people.get(creatorId)?.role || rows[0]?.resultSource || "Field", submissions: rows.length, evidenceRate, consistencyRate, closureRate };
    });
    const maxSubmissions = Math.max(1, ...performance.map((item) => item.submissions));
    performance.forEach((item) => { item.score = Math.round(item.evidenceRate * 35 + item.consistencyRate * 35 + item.closureRate * 10 + (item.submissions / maxSubmissions) * 20); });
    performance.sort((a, b) => b.score - a.score || b.submissions - a.submissions);

    return { readinessScore, fieldMismatches, irevMismatches, duplicates, missingEvidence, zeroVoteSheets, wardSpatial, trendSeries, performance };
  }, [summary, fieldRowsByUnit, fieldResultRows, irevRowsByUnit, winLoss, incidents, top6, personnel]);
  const actions = useMemo(() => [
    `Prioritize: ${actionableIntel.critical} critical/SOS item${actionableIntel.critical === 1 ? "" : "s"} for response verification.`,
    `Review: ${actionableIntel.otherOpen} other open incident${actionableIntel.otherOpen === 1 ? "" : "s"}.`,
  ], [actionableIntel]);
  const cleanSummaryText = (value) => String(value || "").replace(/\*\*/g, "").trim();
  const aiBriefingSections = useMemo(() => {
    const text = cleanSummaryText(outlook);
    if (!text) return [];
    const knownHeadings = ["EXECUTIVE ASSESSMENT", "EVIDENCE & PATTERNS", "RISKS & UNCERTAINTIES", "ACTIONABLE NEXT STEPS", "CONFIDENCE"];
    const sections = [];
    let current = null;
    text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).forEach(line => {
      const normalized = line.replace(/:$/, "").toUpperCase();
      if (knownHeadings.includes(normalized)) {
        current = { title: normalized, lines: [] };
        sections.push(current);
        return;
      }
      if (!current) {
        current = { title: "OPERATIONAL BRIEFING", lines: [] };
        sections.push(current);
      }
      current.lines.push(line.replace(/^[-•]\s*/, ""));
    });
    return sections;
  }, [outlook]);
  const runOperationalAnalysis = async () => {
    const safeIncidents = incidents.slice(0, 100).map(item => ({
      id: item.id,
      title: item.title,
      description: String(item.description || "").slice(0, 500),
      reportType: item.reportType,
      severity: item.severity,
      status: item.status,
      lga: item.lga,
      ward: item.ward,
      pollingUnit: item.pollingUnit,
      assignedTo: item.assignedTo,
      mediaCount: Array.isArray(item.media) ? item.media.length : 0,
      createdAt: item.createdAt,
    }));
    const severityCounts = incidents.reduce((counts, item) => ({ ...counts, [item.severity || "Unknown"]: (counts[item.severity || "Unknown"] || 0) + 1 }), {});
    const statusCounts = incidents.reduce((counts, item) => ({ ...counts, [item.status || "Unknown"]: (counts[item.status || "Unknown"] || 0) + 1 }), {});
    setOutlookLoading(true);
    setOutlook("");
    try {
      const response = await request("/analysis/ai", authToken, {
        method: "POST",
        body: JSON.stringify({ context: {
          generatedAt: new Date().toISOString(),
          projection: forecast,
          resultSummary: { submissions: reports.length, partyTotals: summary.totals, assessedWards: winLoss.wards.length, assessedLgas: winLoss.lgas.length },
          selectedParty: focusParty || null,
          partyAnalysis,
          incidentSummary: { total: incidents.length, severityCounts, statusCounts, actionableIntel },
          incidents: safeIncidents,
          currentActions: actions,
        } }),
      });
      setOutlook(response.analysis || "No operational analysis returned.");
    } catch (error) {
      setOutlook(error.message || "Operational analysis unavailable.");
    } finally {
      setOutlookLoading(false);
    }
  };
  const runPostElectionAnalysis = async () => {
    setPostElectionLoading(true);
    setPostElectionBrief("");
    try {
      const response = await request("/analysis/ai", authToken, {
        method: "POST",
        body: JSON.stringify({ context: {
          analysisMode: "POST_ELECTION",
          generatedAt: new Date().toISOString(),
          projection: forecast,
          resultSummary: { submissions: reports.length, partyTotals: summary.totals, assessedWards: winLoss.wards.length, assessedLgas: winLoss.lgas.length },
          evidenceAndLitigation: { readinessScore: postElection.readinessScore, missingEvidence: postElection.missingEvidence.length, fieldMismatches: postElection.fieldMismatches.length, irevMismatches: postElection.irevMismatches.length, duplicateSubmissions: postElection.duplicates, zeroVoteSheets: postElection.zeroVoteSheets.length },
          spatialConcentrations: postElection.wardSpatial.slice(0, 10).map((item) => ({ ward: item.label, submittedVotes: item.totalVotes, leader: item.winner, margin: item.margin, incidents: item.incidentCount, criticalIncidents: item.criticalCount })),
          reportingPerformance: postElection.performance.slice(0, 12).map((item) => ({ name: item.name, role: item.role, score: item.score, submissions: item.submissions, evidenceRate: Math.round(item.evidenceRate * 100), consistencyRate: Math.round(item.consistencyRate * 100) })),
          objective: "Assess evidence preservation for possible litigation, operational lessons for the next election cycle, and objective field-team performance. Keep all recommendations neutral and evidence-based.",
        } }),
      });
      setPostElectionBrief(response.analysis || "No post-election briefing returned.");
    } catch (error) {
      setPostElectionBrief(error.message || "Post-election AI analysis is unavailable.");
    } finally {
      setPostElectionLoading(false);
    }
  };
  const toggleIrevComparison = async () => {
    if (compareWithIrev) return setCompareWithIrev(false);
    setIrevCompareLoading(true);
    const pilot = await loadIrevPilot();
    setIrevCompareLoading(false);
    if (pilot?.configured && pilot.uploads?.length) setCompareWithIrev(true);
    else setIrevError("Oyo 2027 governorship IReV results are not available yet.");
  };
  const partyVoteFor = (row, party) => Number(row?.results?.find((result) => normalizeResultKeyPart(result.party) === normalizeResultKeyPart(party))?.votes || 0);
  const renderFieldVote = (row, party) => {
    const ownVotes = partyVoteFor(row, party);
    const pair = fieldRowsByUnit.get(resultUnitKey(row)) || {};
    const hasBothFieldSources = Boolean(pair.Agent && pair.Supervisor);
    const agentVotes = partyVoteFor(pair.Agent, party);
    const supervisorVotes = partyVoteFor(pair.Supervisor, party);
    const fieldMismatch = hasBothFieldSources && agentVotes !== supervisorVotes;
    const irevRow = irevRowsByUnit.get(resultUnitKey(row));
    const irevParty = irevRow?.results?.find((result) => normalizeResultKeyPart(result.party) === normalizeResultKeyPart(party));
    const irevVotes = Number(irevParty?.votes || 0);
    const irevMismatch = compareWithIrev && irevParty && ownVotes !== irevVotes;
    const count = <><strong>{ownVotes.toLocaleString()}</strong>{irevMismatch && <small className="irev-count-mismatch">IReV: {irevVotes.toLocaleString()}</small>}</>;
    return fieldMismatch
      ? <button type="button" className="field-count-mismatch" onClick={() => setFieldMismatchDetail({ pollingUnit: row.pollingUnit, lga: row.lga, ward: row.ward, party, agentVotes, supervisorVotes })}>{count}</button>
      : <span className="field-count-match">{count}</span>;
  };
  const runPreElectionAnalysis = (context) => request("/analysis/ai", authToken, {
    method: "POST",
    body: JSON.stringify({ context }),
  });
  return (
    <div className="results-center">
      <header className="results-center-head">
        <div>
          <span className="eyebrow">INTELLIGENCE DASHBOARD</span>
          <h1>Analytics Dashboard</h1>
          <p>Live operational pulse, election results, actions, and news.</p>
        </div>
        <button className="icon-btn" onClick={onClose} title="Close dashboard"><FaTimes /></button>
      </header>
      <div className="rc-tab-bar"><button className={view === "pulse" ? "rc-tab active" : "rc-tab"} onClick={() => setView("pulse")}>Pulse</button><button className={view === "action" ? "rc-tab active" : "rc-tab"} onClick={() => setView("action")}>Action</button><button className={["breakdown", "winloss", "winloss-lga"].includes(view) ? "rc-tab active" : "rc-tab"} onClick={() => setView("breakdown")}>Result</button><button className={view === "pre" ? "rc-tab active" : "rc-tab"} onClick={() => setView("pre")}>Pre-Election</button><button className={view === "post" ? "rc-tab active" : "rc-tab"} onClick={() => setView("post")}>Post-Election</button><button className={view === "irev" ? "rc-tab active" : "rc-tab"} onClick={() => setView("irev")}>IReV</button><button className={view === "news" ? "rc-tab active" : "rc-tab"} onClick={() => setView("news")}>News</button></div>
      <main className="results-center-body">
        {view === "pulse" && <AnalyticsPanel incidents={incidents} officers={officers} mapLayers={mapLayers} selected={selected} onClose={onClose} onTool={onTool} onCsv={onCsv} onClear={onClear} embedded />}
        {view === "pre" && <PreElectionAnalysis onAnalyze={runPreElectionAnalysis} onShowHistoricalMap={onShowHistoricalMap} />}
        {["breakdown", "winloss", "winloss-lga"].includes(view) && <div className="wl-sub-tabs result-view-tabs"><button className={view === "breakdown" ? "wl-sub-tab active" : "wl-sub-tab"} onClick={() => setView("breakdown")}>Polling Unit Breakdown</button><button className={view !== "breakdown" ? "wl-sub-tab active" : "wl-sub-tab"} onClick={() => setView("winloss")}>Win / Loss Analysis</button></div>}
        {["winloss", "winloss-lga"].includes(view) && <section className="result-total-strip"><article className="result-total-card grand"><span>Current projection</span><strong>{forecast.leader || "—"}</strong><small>{forecast.confidence}% indicative confidence; not a final result</small></article><article className="result-total-card"><span>Vote margin</span><strong>{forecast.margin.toLocaleString()}</strong><small>Against second place</small></article><article className="result-total-card"><span>Units covered</span><strong>{forecast.coverage.toLocaleString()}</strong><small>Unique submitted units</small></article></section>}
        {view === "news" && <section className="result-table-card"><div className="result-table-title"><div><h2>Oyo State News</h2><p>General Oyo State coverage, including politics, INEC, elections, parties, governance, security, and major local developments.</p></div><div className="analysis-actions news-actions"><button className="primary action-btn refresh-news-btn" onClick={() => { setNews([]); setNewsSummary(""); setNewsSummaryError(""); setView("news"); }}><FaSyncAlt /> <span>Refresh</span></button><button className="secondary action-btn summary-action-btn" disabled={!news.length || newsSummaryLoading} onClick={() => { setNewsSummaryLoading(true); setNewsSummaryError(""); request("/news/summary", authToken, { method: "POST", body: JSON.stringify({ articles: news }) }).then((x) => { setNewsSummary(x.summary || "No summary available yet."); if (x.provider === "local") setNewsSummaryError("The summary service was unavailable, so a local fallback was generated."); else setNewsSummaryError(""); }).catch((error) => { setNewsSummary(""); setNewsSummaryError(error.message || "The summary request failed."); }).finally(() => setNewsSummaryLoading(false)); }}><MdFlashOn /> <span>{newsSummaryLoading ? "Working…" : "Summary"}</span></button></div></div>{newsSummary && <div className="news-summary">{cleanSummaryText(newsSummary)}</div>}{newsSummaryError && <p className="muted">{newsSummaryError}</p>}{newsLoading ? <p>Loading current headlines…</p> : <div className="news-list">{news.map(item => <article className="news-item" key={item.url}><a href={item.url} target="_blank" rel="noreferrer"><h3>{item.title}</h3></a><small>{item.source} · {item.publishedAt ? new Date(item.publishedAt).toLocaleString() : "Recent"}</small></article>)}{!news.length && <p>No current Oyo State headlines available.</p>}</div>}</section>}
        {view === "action" && <section className="result-table-card" style={{ marginBottom: 16 }}>
          <div className="result-table-title">
            <div><h2>Insight</h2><p>Realtime analysis of performance, insight &amp; operational intelligence</p></div>
            <div className="analysis-actions"><button className="primary action-btn summary-action-btn" disabled={outlookLoading} onClick={runOperationalAnalysis}><MdFlashOn /> <span>{outlookLoading ? "Analyzing…" : "Operational Analysis"}</span></button></div>
          </div>
          <div className="actionable-intel">
            <h3>Actionable Intel</h3>
            <div className={`actionable-intel-grid ${focusParty ? "party-only" : ""}`}>
              {!focusParty && <article className="actionable-intel-card prioritize"><span>Prioritize</span><p><strong>{actionableIntel.critical}</strong> critical/SOS item{actionableIntel.critical === 1 ? "" : "s"} for response verification.</p></article>}
              {!focusParty && <article className="actionable-intel-card review"><span>Review</span><p><strong>{actionableIntel.otherOpen}</strong> other open incident{actionableIntel.otherOpen === 1 ? "" : "s"}</p></article>}
              <article className="actionable-intel-card party"><span>Party focus</span><label className="party-focus-field"><select value={focusParty} onChange={e => setFocusParty(e.target.value)} aria-label="Select party for operational analysis"><option value="">No parties</option>{summary.partyNames.map(p => <option key={p} value={p}>{p}</option>)}</select></label></article>
            </div>
          </div>
          {partyAnalysis && <article className="party-result-card"><header><span>Focused result</span><strong>{focusParty}</strong></header><div><section><span>Total votes</span><b>{partyAnalysis.votes.toLocaleString()}</b></section><section><span>Wards leading</span><b>{partyAnalysis.wards}</b></section><section><span>LGAs leading</span><b>{partyAnalysis.lgas}</b></section><section><span>Related incidents</span><b>{partyAnalysis.incidents}</b></section></div></article>}
          {aiBriefingSections.length > 0 && <section className="ai-intelligence-response"><header><div><span>AI Intelligence</span><h3>Operational assessment &amp; actions</h3></div></header><div className="ai-intelligence-grid">{aiBriefingSections.map(section => <article className={section.title === "ACTIONABLE NEXT STEPS" ? "ai-section actionable" : "ai-section"} key={section.title}><h4>{section.title}</h4>{section.lines.map((line, index) => <p key={`${section.title}-${index}`}>{section.title === "ACTIONABLE NEXT STEPS" && <span className="ai-action-number">{index + 1}</span>}{line}</p>)}</article>)}</div></section>}
        </section>}
        {view === "post" && <section className="post-election-dashboard">
          <div className="post-election-head">
            <div><span className="eyebrow">AFTER RESULTS</span><h2>Post-Election Analysis</h2><p>Evidence readiness, result trends, spatial concentration, operational lessons and field performance.</p></div>
            <button className="primary action-btn" disabled={postElectionLoading || !summary.rows.length} onClick={runPostElectionAnalysis}><MdFlashOn /> {postElectionLoading ? "Analyzing…" : "Generate AI Brief"}</button>
          </div>
          <p className="post-election-caution">These are provisional analytical indicators from submitted records—not certified results, legal conclusions, turnout estimates or voter-targeting advice.</p>
          <div className="post-kpi-grid">
            <article className={postElection.readinessScore >= 80 ? "ready" : postElection.readinessScore >= 55 ? "review" : "risk"}><span>Evidence readiness</span><strong>{postElection.readinessScore}%</strong><small>For legal-team review</small></article>
            <article><span>Field discrepancies</span><strong>{postElection.fieldMismatches.length}</strong><small>Agent vs Supervisor</small></article>
            <article><span>IReV discrepancies</span><strong>{postElection.irevMismatches.length}</strong><small>Where official sheets are available</small></article>
            <article><span>Missing evidence</span><strong>{postElection.missingEvidence.length}</strong><small>Field result submissions</small></article>
            <article><span>Duplicate updates</span><strong>{postElection.duplicates}</strong><small>Same source and polling unit</small></article>
          </div>

          <div className="post-analysis-grid">
            <article className="post-card trend-card">
              <header><div><h3>Voting Pattern Trend</h3><p>Cumulative share as field submissions arrived</p></div><b>{postElection.trendSeries.length} parties</b></header>
              {postElection.trendSeries.length ? <><svg className="post-trend-chart" viewBox="0 0 320 100" preserveAspectRatio="none" aria-label="Cumulative party vote share trend">{postElection.trendSeries.map((series, index) => <polyline key={series.party} points={series.points} fill="none" stroke={["#facc15", "#4ade80", "#38bdf8", "#fb7185"][index]} strokeWidth="3" vectorEffect="non-scaling-stroke" />)}</svg><div className="post-trend-legend">{postElection.trendSeries.map((series, index) => <div key={series.party}><i style={{background:["#facc15", "#4ade80", "#38bdf8", "#fb7185"][index]}} /><span>{series.party}</span><strong>{series.share.toFixed(1)}%</strong><small className={series.movement >= 0 ? "up" : "down"}>{series.movement >= 0 ? "+" : ""}{series.movement.toFixed(1)} pts</small></div>)}</div></> : <p className="post-empty">Submit polling-unit results to generate a trend.</p>}
            </article>

            <article className="post-card litigation-card">
              <header><div><h3>Litigation Preparation</h3><p>Records requiring preservation or reconciliation</p></div></header>
              <div className="litigation-list">
                <div><span>Unsigned / missing result evidence</span><b>{postElection.missingEvidence.length}</b></div>
                <div><span>Agent–Supervisor count conflicts</span><b>{postElection.fieldMismatches.length}</b></div>
                <div><span>Field–IReV count conflicts</span><b>{postElection.irevMismatches.length}</b></div>
                <div><span>Zero-total result sheets</span><b>{postElection.zeroVoteSheets.length}</b></div>
                <div><span>Duplicate source submissions</span><b>{postElection.duplicates}</b></div>
              </div>
              <p className="post-card-note">Preserve original files, timestamps, submitter identity and chain-of-custody records before making corrections.</p>
            </article>
          </div>

          <article className="post-card spatial-card">
            <header><div><h3>Spatial Distribution &amp; Hotspots</h3><p>Wards ranked by submitted vote volume, margin and reported incidents</p></div><small>High volume means reporting concentration—not verified turnout.</small></header>
            <div className="spatial-grid">{postElection.wardSpatial.slice(0, 12).map((item, index) => <button type="button" key={item.label} onClick={() => Number.isFinite(item.lat) && onFocusLocation?.(item)} disabled={!Number.isFinite(item.lat)}><span className="spatial-rank">#{index + 1}</span><div><strong>{item.label}</strong><small>{item.winner || "No leader"} · margin {item.margin.toLocaleString()}</small></div><div><b>{item.totalVotes.toLocaleString()}</b><small>{item.reports} reports · {item.incidentCount} incidents</small></div>{item.criticalCount > 0 && <em>{item.criticalCount} critical</em>}</button>)}{!postElection.wardSpatial.length && <p className="post-empty">No ward-level result distribution is available.</p>}</div>
          </article>

          <div className="post-analysis-grid">
            <article className="post-card next-cycle-card">
              <header><div><h3>Next Election Cycle</h3><p>Operational improvements from the current evidence</p></div></header>
              <ol>
                <li><b>Close evidence gaps:</b> obtain signed result media for {postElection.missingEvidence.length} submission{postElection.missingEvidence.length === 1 ? "" : "s"}.</li>
                <li><b>Reconcile counts:</b> verify {postElection.fieldMismatches.length + postElection.irevMismatches.length} conflicting unit record{postElection.fieldMismatches.length + postElection.irevMismatches.length === 1 ? "" : "s"} against original sheets.</li>
                <li><b>Strengthen deployment:</b> review the {postElection.wardSpatial.filter((item) => item.incidentCount > 0).length} ward{postElection.wardSpatial.filter((item) => item.incidentCount > 0).length === 1 ? "" : "s"} with result-linked operational incidents.</li>
                <li><b>Improve reporting discipline:</b> coach teams below 70% performance and document corrective actions before the next exercise.</li>
              </ol>
            </article>
            <article className="post-card performance-card">
              <header><div><h3>Performance &amp; Reward Review</h3><p>Objective score: evidence 35%, consistency 35%, volume 20%, closure 10%</p></div></header>
              <div className="performance-list">{postElection.performance.slice(0, 10).map((item, index) => <div key={item.id}><span>{index + 1}</span><div><strong>{item.name}</strong><small>{item.role} · {item.submissions} submissions</small></div><div className="performance-meter"><i style={{width:`${item.score}%`}} /></div><b>{item.score}%</b>{item.score >= 80 && item.submissions > 0 && <em>Reward review</em>}</div>)}{!postElection.performance.length && <p className="post-empty">No attributable field submissions are available.</p>}</div>
            </article>
          </div>
          {postElectionBrief && <article className="post-card post-ai-brief"><header><div><h3>AI Post-Election Brief</h3><p>Neutral synthesis for command, evidence and planning teams</p></div></header><div>{cleanSummaryText(postElectionBrief)}</div></article>}
        </section>}
        {partyAnalysis && view !== "breakdown" && view !== "irev" && view !== "news" && <section className="party-lga-analysis"><div className="party-lga-summary"><div><span>Selected party</span><strong>{focusParty}</strong></div><div className="winning"><span>LGAs winning</span><strong>{partyAnalysis.winningLgas.length}</strong></div><div className="losing"><span>LGAs losing</span><strong>{partyAnalysis.losingLgas.length}</strong></div><div><span>Total votes</span><strong>{partyAnalysis.votes.toLocaleString()}</strong></div></div><div className="party-lga-columns"><section className="party-lga-column winning"><header><div><span className="performance-dot" />Winning LGAs</div><b>{partyAnalysis.winningLgas.length}</b></header><div className="party-lga-list">{partyAnalysis.winningLgas.map(item => <article key={item.name}><div><strong>{item.name}</strong><small>Ahead of {item.opponent}</small></div><div><b>+{item.margin.toLocaleString()}</b><small>{item.votes.toLocaleString()} votes</small></div></article>)}{!partyAnalysis.winningLgas.length && <p>No confirmed LGA lead for {focusParty} yet.</p>}</div></section><section className="party-lga-column losing"><header><div><span className="performance-dot" />Losing LGAs</div><b>{partyAnalysis.losingLgas.length}</b></header><div className="party-lga-list">{partyAnalysis.losingLgas.map(item => <article key={item.name}><div><strong>{item.name}</strong><small>Behind {item.opponent}</small></div><div><b>-{item.margin.toLocaleString()}</b><small>{item.votes.toLocaleString()} votes</small></div></article>)}{!partyAnalysis.losingLgas.length && <p>No confirmed LGA loss for {focusParty} yet.</p>}</div></section></div>{partyAnalysis.tiedLgas.length > 0 && <p className="party-tied-note">Tied in: {partyAnalysis.tiedLgas.join(", ")}.</p>}<p className="party-analysis-note">Leading in {partyAnalysis.wards} wards. Related incident mentions: {partyAnalysis.incidents}. Based only on submitted polling-unit results.</p></section>}
        {view === "winloss" && <section className="result-table-card"><div className="result-table-title"><div><h2>Win / Loss Analysis</h2><p>Leading party by ward and LGA from submitted polling-unit results.</p></div><b>Top {top6.length} parties</b></div><div className="wl-sub-tabs"><button className="wl-sub-tab active">By Ward</button><button className="wl-sub-tab" onClick={() => setView("winloss-lga")}>By LGA</button></div><div className="result-table-scroll"><table className="result-progress-table"><thead><tr><th>Ward</th><th>Winner</th>{top6.map(p => <th key={p}>{p}</th>)}</tr></thead><tbody>{winLoss.wards.map(g => <tr key={g.label}><td>{g.label}</td><td><b>{g.winner || "—"}</b></td>{top6.map(p => <td key={p}>{g.votes[p].toLocaleString()} {g.winner === p ? "✓" : g.winner ? "✕" : ""}</td>)}</tr>)}{!winLoss.wards.length && <tr><td colSpan={top6.length + 2} className="result-empty">No ward-level data available yet.</td></tr>}</tbody></table></div></section>}
        {view === "winloss-lga" && <section className="result-table-card"><div className="result-table-title"><div><h2>LGA Win / Loss Analysis</h2><p>Leading party in each Local Government Area.</p></div></div><div className="wl-sub-tabs"><button className="wl-sub-tab" onClick={() => setView("winloss")}>By Ward</button><button className="wl-sub-tab active">By LGA</button></div><div className="result-table-scroll"><table className="result-progress-table"><thead><tr><th>LGA</th><th>Winner</th>{top6.map(p => <th key={p}>{p}</th>)}</tr></thead><tbody>{winLoss.lgas.map(g => <tr key={g.label}><td><b>{g.label}</b></td><td><b>{g.winner || "—"}</b></td>{top6.map(p => <td key={p}>{g.votes[p].toLocaleString()} {g.winner === p ? "✓" : g.winner ? "✕" : ""}</td>)}</tr>)}</tbody></table></div></section>}
        {["winloss", "winloss-lga"].includes(view) && <div className="result-table-card" style={{marginTop: 16}}><p className="muted">Select a party in the Action tab to compare its wins and losses. Results update automatically as new submissions arrive.</p></div>}
        {view !== "breakdown" ? null : <>
        <section className="result-source-grid field-source-grid" aria-label="Result submission sources">
          {sourceStats.filter((item) => item.source !== "INEC IReV").map((item) => <button type="button" className={`result-source-card ${resultSourceFilter === item.source ? "active" : ""}`} key={item.source} onClick={() => setResultSourceFilter((current) => current === item.source ? "" : item.source)}><span>{item.source}</span><strong>{item.submissions}</strong><small>{item.units} polling unit{item.units === 1 ? "" : "s"} · {item.votes.toLocaleString()} votes</small></button>)}
          <article className="result-source-card field-total"><span>Field submissions</span><strong>{fieldResultRows.length}</strong><small>Agent and Supervisor updates</small></article>
        </section>
        {irevAiStoppedReason && <div className="irev-ai-stopped"><MdWarning /><div><strong>OCR status</strong><span>{irevAiStoppedReason}</span></div></div>}
        </>}
        {view === "irev" && <section className="irev-pilot-card">
          <header className="irev-pilot-head">
            <div><span className="eyebrow">OFFICIAL SOURCE · OYO 2027 GOVERNORSHIP</span><h2>INEC IReV — Oyo Governorship</h2><p>Prepared only for Oyo governorship polling-unit result sheets and automatic verification.</p></div>
            <div className="irev-pilot-actions"><a href={irevPilot?.portalUrl || "https://irev.inecnigeria.org/"} target="_blank" rel="noreferrer">Open IReV</a><button type="button" disabled={irevLoading || irevPilot?.configured === false} onClick={() => loadIrevPilot(true)}><FaSyncAlt /> {irevLoading ? "Checking…" : irevPilot?.configured === false ? "Awaiting INEC" : "Refresh now"}</button></div>
          </header>
          {irevError && <div className="error">{irevError}</div>}
          {irevAiStoppedReason && <div className="irev-ai-stopped"><MdWarning /><div><strong>OCR status</strong><span>{irevAiStoppedReason}</span></div></div>}
          {irevPilot && <>
            {irevSection === "results" && irevResultRows.length > 0 && <section className="result-total-strip irev-result-totals">{irevTopParties.map((party) => <article className="result-total-card" key={party}><span>{party}</span><strong>{irevOnlyTotals[party].toLocaleString()}</strong></article>)}</section>}
            <div className="irev-pilot-stats"><div><span>Uploaded</span><strong>{irevPilot.submitted.toLocaleString()}</strong></div><div><span>Expected</span><strong>{irevPilot.expected.toLocaleString()}</strong></div><div><span>Coverage</span><strong>{irevPilot.expected ? `${((irevPilot.submitted / irevPilot.expected) * 100).toFixed(1)}%` : "—"}</strong></div><div><span>Last checked</span><strong>{new Date(irevPilot.fetchedAt).toLocaleTimeString()}</strong></div></div>
            {irevPilot.notice && <p className="irev-verification-note"><MdWarning /> {irevPilot.notice}</p>}
            {!irevPilot.configured && <div className="irev-activation-panel governorship-only"><div><span>6 February 2027</span><strong>Oyo Governorship Election</strong></div></div>}
            <div className="wl-sub-tabs irev-sub-tabs"><button className={irevSection === "uploads" ? "wl-sub-tab active" : "wl-sub-tab"} onClick={() => setIrevSection("uploads")}>Polling-unit uploads</button>{irevResultRows.length > 0 && <button className={irevSection === "results" ? "wl-sub-tab active" : "wl-sub-tab"} onClick={() => setIrevSection("results")}>Results</button>}{irevExtractingIds.size > 0 && <span>Reading {irevExtractingIds.size} sheets in parallel… {irevResultRows.length.toLocaleString()} ready</span>}</div>
            {irevSection === "uploads" && <>
            <div className="irev-table-toolbar"><div><strong>{irevPilot.configured ? "All uploaded polling units" : "Oyo result-sheet feed"}</strong><span>{irevPilot.configured ? `${filteredIrevUploads.length.toLocaleString()} of ${irevPilot.uploads.length.toLocaleString()} sheets shown` : "Waiting for INEC activation"}</span></div><label><FaSearch /><input disabled={!irevPilot.configured} value={irevSearch} onChange={(event) => setIrevSearch(event.target.value)} placeholder={irevPilot.configured ? "Search LGA, ward, polling unit or PU code" : "Search activates with the live feed"} />{irevSearch && <button type="button" onClick={() => setIrevSearch("")} aria-label="Clear IReV search"><FaTimes /></button>}</label></div>
            <div className="irev-table-scroll">
              <table className="result-progress-table irev-full-table">
                <thead><tr><th>#</th><th>LGA</th><th>Ward</th><th>Polling unit</th><th>PU code</th><th>Uploaded</th><th>Status</th><th>Result sheet</th></tr></thead>
                <tbody>{filteredIrevUploads.map((upload, index) => <tr key={upload.id}><td>{index + 1}</td><td><b>{upload.lga || "—"}</b></td><td>{upload.ward || "—"}</td><td>{upload.pollingUnit || "—"}</td><td><strong>{upload.puCode}</strong></td><td>{upload.uploadedAt ? new Date(upload.uploadedAt).toLocaleString() : "—"}</td><td><span className="irev-awaiting-badge">{upload.verificationStatus}</span></td><td><button className="irev-sheet-link" type="button" onClick={() => openIrevPreview(upload)}>View image</button></td></tr>)}{!filteredIrevUploads.length && <tr><td className="result-empty" colSpan="8">No Oyo governorship result sheets are available yet.</td></tr>}</tbody>
              </table>
            </div>
            </>}
            {irevSection === "results" && <>
              <div className="irev-table-scroll"><table className="result-progress-table irev-results-table"><thead><tr><th>LGA</th><th>Ward</th><th>Polling unit</th>{irevTopParties.map((party) => <th key={party}>{party}</th>)}</tr></thead><tbody>{irevResultRows.map((upload) => <tr key={upload.id}><td><b>{upload.lga || "—"}</b></td><td>{upload.ward || "—"}</td><td>{upload.pollingUnit || upload.puCode}</td>{irevTopParties.map((party) => <td key={party}><strong>{Number(upload.results.find((result) => result.party === party)?.votes || 0).toLocaleString()}</strong></td>)}</tr>)}{!irevResultRows.length && <tr><td className="result-empty" colSpan={irevTopParties.length + 3}>Result sheets are being read automatically.</td></tr>}</tbody></table></div>
            </>}
            {irevPreview && <div className="irev-preview-backdrop" onClick={() => setIrevPreview(null)}><section className="irev-preview-modal" onClick={(event) => event.stopPropagation()}><header><div><span className="eyebrow">INEC IREV RESULT SHEET</span><h2>{irevPreview.puCode}</h2><p>{irevPreview.lga} · {irevPreview.ward} · {irevPreview.pollingUnit}</p></div><button type="button" className="icon-btn" onClick={() => setIrevPreview(null)} aria-label="Close image preview"><FaTimes /></button></header><div className="irev-preview-body"><div className="irev-preview-image"><img src={irevPreview.imageUrl} alt={`INEC IReV result sheet for ${irevPreview.puCode}`} /></div><aside><div className="irev-preview-actions"><a href={irevPreview.imageUrl} download target="_blank" rel="noreferrer">Download image</a></div><h3>Party results</h3>{irevExtractingIds.has(irevPreview.id) && <p className="muted">Reading party votes…</p>}{irevDrafts[irevPreview.id] ? <div className="irev-ocr-draft"><div className="irev-party-results">{(irevDrafts[irevPreview.id].results || []).map(({ party, votes }) => <div key={party}><strong>{party}</strong><b>{Number(votes).toLocaleString()}</b></div>)}</div></div> : !canAdmin ? <p className="muted">Automatic extraction is available to administrators.</p> : !irevExtractingIds.has(irevPreview.id) && <p className="muted">This result sheet is queued for automatic reading.</p>}</aside></div></section></div>}
          </>}
          {!irevPilot && irevLoading && <p className="muted">Connecting to the official IReV feed…</p>}
        </section>}
        {view !== "breakdown" ? null : <>
        <section className="result-total-strip">
          {fieldTopParties.map(party => <article className="result-total-card" key={party}><span>{party}</span><strong>{fieldResultTotals[party].toLocaleString()}</strong></article>)}
        </section>
        <section className="result-table-card">
          <div className="result-table-title"><div><h2>Polling-unit breakdown</h2><p>{resultSourceFilter ? `${resultSourceFilter} submissions only. Select the active source card again to show all.` : "Agent and Supervisor counts with field evidence."}</p></div><div className="result-compare-actions"><button type="button" className={compareWithIrev ? "irev-compare-btn active" : "irev-compare-btn"} disabled={irevCompareLoading} onClick={toggleIrevComparison}>{irevCompareLoading ? "Loading IReV…" : compareWithIrev ? "IReV comparison on" : "Compare with IReV"}</button><b>{displayedResultRows.length} shown</b></div></div>
          <div className="result-table-scroll">
            <table className="result-progress-table">
              <thead><tr><th>Source</th><th>LGA</th><th>Ward</th><th>Polling unit</th>{fieldTopParties.map(party => <th key={party}>{party}</th>)}<th>Location</th><th>Evidence</th><th>Uploaded</th></tr></thead>
              <tbody>
                {displayedResultRows.map((row) => (
                  <tr key={row.id}><td><span className={`result-source-badge source-${row.resultSource.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{row.resultSource}</span></td><td>{row.lga || "—"}</td><td>{row.ward || "—"}</td><td><b>{row.pollingUnit || "—"}</b></td>{fieldTopParties.map(party => <td key={party}>{renderFieldVote(row, party)}</td>)}<td>{Number(row.lat).toFixed(5)}, {Number(row.lng).toFixed(5)}</td><td><div className="result-evidence">{(row.media || []).filter((item) => item.type === "image").slice(0, 2).map((item, index) => <a href={item.data} target="_blank" rel="noreferrer" key={`${row.id}-${index}`}><img src={item.data} alt={`Evidence for ${row.pollingUnit}`} /></a>)}</div></td><td>{new Date(row.createdAt).toLocaleString()}</td></tr>
                ))}
                {!displayedResultRows.length && <tr><td className="result-empty" colSpan={fieldTopParties.length + 8}>No {resultSourceFilter || "polling-unit"} results have been uploaded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        {fieldMismatchDetail && <div className="field-mismatch-backdrop" onClick={() => setFieldMismatchDetail(null)}><section className="field-mismatch-modal" onClick={(event) => event.stopPropagation()}><header><div><span>{fieldMismatchDetail.lga} · {fieldMismatchDetail.ward}</span><h3>{fieldMismatchDetail.pollingUnit}</h3></div><button type="button" onClick={() => setFieldMismatchDetail(null)} aria-label="Close comparison"><FaTimes /></button></header><h4>{fieldMismatchDetail.party}</h4><div><article><span>Agent reported</span><strong>{fieldMismatchDetail.agentVotes.toLocaleString()}</strong></article><article><span>Supervisor reported</span><strong>{fieldMismatchDetail.supervisorVotes.toLocaleString()}</strong></article></div></section></div>}
        </>}
      </main>
    </div>
  );
}

function Dashboard({ session, onLogout, onSessionUpdate }) {
  const [incidents, setIncidents] = useState([]);
  const [users, setUsers] = useState([]);
  const [reportUsers, setReportUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [newPoint, setNewPoint] = useState(null);
  const [newResultPoint, setNewResultPoint] = useState(null);
  const [parties, setParties] = useState([]);
  const [partyManagerOpen, setPartyManagerOpen] = useState(false);
  const [filter, setFilter] = useState("All");
  const [hiddenReportIds, setHiddenReportIds] = useState(() =>
    JSON.parse(localStorage.getItem("hidden-report-ids") || "[]"),
  );
  const [showReports, setShowReports] = useState(true);
  const [showSosIncidents, setShowSosIncidents] = useState(true);
  const [layer, setLayer] = useState("Street");
  const [coords, setCoords] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [manageOfficers, setManageOfficers] = useState(false);
  const [mapDataPanel, setMapDataPanel] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [supervisorIncidentsOpen, setSupervisorIncidentsOpen] = useState(false);
  const [partyMapAnalysis, setPartyMapAnalysis] = useState(null);
  const [historicalMapAnalysis, setHistoricalMapAnalysis] = useState(null);
  const [analysisLayers, setAnalysisLayers] = useState([]);
  const [pendingAreaAction, setPendingAreaAction] = useState(null);
  const [areaSearchResult, setAreaSearchResult] = useState(null);
  const [sosHolding, setSosHolding] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);
  const [activeEmergency, setActiveEmergency] = useState(null);
  const [mapLayers, setMapLayers] = useState([]);
  const [showBoundaryLayer, setShowBoundaryLayer] = useState(true);
  const [showStateBorders, setShowStateBorders] = useState(true);
  const [showLgaBorders, setShowLgaBorders] = useState(true);
  const [showBoundaryNames, setShowBoundaryNames] = useState(false);
  const [selectedBoundaryState, setSelectedBoundaryState] = useState("");
  const [selectedBoundaryLabel, setSelectedBoundaryLabel] = useState("");
  const [drawMode, setDrawMode] = useState("");
  const [areas, setAreas] = useState(() =>
    JSON.parse(localStorage.getItem("command-areas") || "[]"),
  );

  const showHistoricalMap = async (dataset) => {
    const office = dataset?.geography?.office;
    if (!office) return;
    setResultsOpen(false);
    setPartyMapAnalysis(null);
    setShowLgaBorders(true);
    setHistoricalMapAnalysis({ year: dataset.year, election: dataset.election, office, loading: true, byLga: {}, availableLevels: dataset.geography.levels });
    try {
      const data = await request(`/history/oyo/${dataset.year}/${office}`, session.token);
      const byLga = Object.fromEntries((data.areas || []).map(area => [area.name, area]));
      const winnerCounts = (data.areas || []).reduce((counts, area) => ({ ...counts, [area.winner || "No result"]: (counts[area.winner || "No result"] || 0) + 1 }), {});
      setHistoricalMapAnalysis(current => current?.office === office ? { ...current, ...data, election: dataset.election, loading: false, byLga, winnerCounts } : current);
      mapRef.current?.flyTo(OYO_CENTER, 8);
    } catch (error) {
      setHistoricalMapAnalysis(current => current?.office === office ? { ...current, loading: false, error: error.message || "Historical map data is unavailable." } : current);
    }
  };

  const selectHistoricalLga = async (name) => {
    const normalize = value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const current = historicalMapAnalysis;
    const lga = Object.values(current?.byLga || {}).find(area => normalize(area.name) === normalize(name));
    if (!current || !lga) return;
    if (!current.availableLevels?.includes("ward")) {
      setHistoricalMapAnalysis({ ...current, selectedLga: lga, selectedWard: null, selectedPollingUnit: null, detail: null, wardDetail: null, pollingUnitDetail: null, detailMessage: "Ward and polling-unit transcriptions are not available for this election in the connected archive." });
      return;
    }
    setHistoricalMapAnalysis({ ...current, selectedLga: lga, selectedWard: null, selectedPollingUnit: null, detail: null, wardDetail: null, pollingUnitDetail: null, detailMessage: "", detailLoading: true });
    try {
      const detail = await request(`/history/oyo/2023/presidential/lga/${lga.id}`, session.token);
      setHistoricalMapAnalysis(latest => latest?.selectedLga?.id === lga.id ? { ...latest, detail, wardDetail: detail, detailLoading: false } : latest);
    } catch (error) {
      setHistoricalMapAnalysis(latest => latest?.selectedLga?.id === lga.id ? { ...latest, detailLoading: false, detailMessage: error.message || "Ward history is unavailable." } : latest);
    }
  };

  const selectHistoricalWard = async (ward) => {
    const current = historicalMapAnalysis;
    const lga = current?.selectedLga;
    if (!lga || !ward?.code) return;
    setHistoricalMapAnalysis({ ...current, selectedWard: ward, selectedPollingUnit: null, detail: null, pollingUnitDetail: null, detailMessage: "", detailLoading: true });
    try {
      const wardCode = ward.code.replaceAll("/", "-");
      const detail = await request(`/history/oyo/2023/presidential/lga/${lga.id}/ward/${wardCode}`, session.token);
      setHistoricalMapAnalysis(latest => latest?.selectedWard?.code === ward.code ? { ...latest, detail, pollingUnitDetail: detail, detailLoading: false } : latest);
    } catch (error) {
      setHistoricalMapAnalysis(latest => latest?.selectedWard?.code === ward.code ? { ...latest, detailLoading: false, detailMessage: error.message || "Polling-unit history is unavailable." } : latest);
    }
  };

  const selectHistoricalPollingUnit = pollingUnit => setHistoricalMapAnalysis(current => current ? { ...current, selectedPollingUnit: pollingUnit } : current);
  const backHistoricalMap = level => setHistoricalMapAnalysis(current => {
    if (!current) return current;
    if (level === "polling-units") return { ...current, selectedPollingUnit: null, detail: current.pollingUnitDetail, detailMessage: "", detailLoading: false };
    if (level === "wards") return { ...current, selectedWard: null, selectedPollingUnit: null, detail: current.wardDetail, detailMessage: "", detailLoading: false };
    return { ...current, selectedLga: null, selectedWard: null, selectedPollingUnit: null, detail: null, wardDetail: null, pollingUnitDetail: null, detailMessage: "", detailLoading: false };
  });

  const clearBoundarySelection = () => {
    setSelectedBoundaryState("");
    setSelectedBoundaryLabel("");
  };
  const [measurePoints, setMeasurePoints] = useState([]);
  const [routePoints, setRoutePoints] = useState([]);
  const [routeResult, setRouteResult] = useState(null);
  const [routeStartInput, setRouteStartInput] = useState("");
  const [routeEndInput, setRouteEndInput] = useState("");
  const [gpsPositions, setGpsPositions] = useState({});
  const [sharingGps, setSharingGps] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [cameraPanel, setCameraPanel] = useState(false);
  const [phoneShares, setPhoneShares] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [turnStatus, setTurnStatus] = useState({ provider: "checking", region: "", route: "pending" });
  const [sharingCamera, setSharingCamera] = useState(false);
  const [selfCameraPreview, setSelfCameraPreview] = useState(false);
  const [cameraPreviewMode, setCameraPreviewMode] = useState(true); // true = show preview, false = background mode
  const [cameraFacingMode, setCameraFacingMode] = useState("environment");
  const [cameraMicMuted, setCameraMicMuted] = useState(false);
  const [cameraLocation, setCameraLocation] = useState(null);
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [ipLogOpen, setIpLogOpen] = useState(false);
  const [ipLogData, setIpLogData] = useState([]);
  const [ipLogLoading, setIpLogLoading] = useState(false);
  const [ipLogFilter, setIpLogFilter] = useState("all");
  const [situationalOpen, setSituationalOpen] = useState(false);
  const [liveIncidentsOpen, setLiveIncidentsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [gpsRequiredBlocked, setGpsRequiredBlocked] = useState(session.user.role === "Agent");
  const [chatPanel, setChatPanel] = useState(false);
  const [chatRooms, setChatRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [assignIncident, setAssignIncident] = useState(null);
  const [notificationDetail, setNotificationDetail] = useState(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [mapMenu, setMapMenu] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(
    () => Number(localStorage.getItem("sidebar-width")) || 340,
  );
  const mapRef = useRef(null);
  const socketRef = useRef(null);
  const gpsWatchRef = useRef(null);
  const gpsBestRef = useRef(null);
  const sosHoldTimerRef = useRef(null);
  const sosLongTriggeredRef = useRef(false);
  const localCameraStreamRef = useRef(null);
  const cameraMicMutedRef = useRef(false);
  const rtcPeersRef = useRef({});
  const sharingCameraRef = useRef(false);
  const offlineRecorderRef = useRef(null);
  const offlineChunksRef = useRef([]);
  const offlineSegmentTimerRef = useRef(null);
  const offlineFallbackRef = useRef(false);
  const offlineUploadRef = useRef(false);
  const activeRoomRef = useRef(null);
  const wakeLockRef = useRef(null);
  const silentAudioRef = useRef(null);
  const officers = useMemo(
    () =>
      users
        .filter((u) => ["Response Team", "Agent"].includes(u.role))
        .map((u, index) => {
          const live = gpsPositions[u.id];
          return {
            ...u,
            lat:
              live?.lat ??
              (Number(u.lat) ||
                FIELD_TEAM_POSITIONS[index % FIELD_TEAM_POSITIONS.length][0]),
            lng:
              live?.lng ??
              (Number(u.lng) ||
                FIELD_TEAM_POSITIONS[index % FIELD_TEAM_POSITIONS.length][1]),
            status: live?.offline
              ? "Offline"
              : live
                ? "Active"
                : index < 2
                  ? "Idle"
                  : "Offline",
            speed: live?.speed,
            heading: live?.heading,
            lastSeen: live?.timestamp,
            unit: u.unit || `Field Unit ${String(index + 1).padStart(2, "0")}`,
          };
        }),
    [users, gpsPositions],
  );
  const canAdmin = ["Admin", "Super Admin"].includes(session.user.role);
  const isAgent = session.user.role === "Agent";
  const isSupervisor = session.user.role === "Supervisor";
  const isFieldRole = isAgent || isSupervisor;
  const canCreateCustomReportType = ["Admin", "Super Admin"].includes(
    session.user.role,
  );
  const canManagePersonnel =
    ["Super Admin", "Admin"].includes(session.user.role);
  const parseWardList = (value) => String(value || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  const wardInScope = (itemWard, viewerWard) => {
    const viewerWards = new Set(parseWardList(viewerWard));
    return parseWardList(itemWard).some((ward) => viewerWards.has(ward));
  };
  const isSupervisorWardRelevant = (item) => {
    if (!isSupervisor || !session.user.lga || !session.user.ward || !item) return false;
    return String(item.lga || "").trim().toLowerCase() === String(session.user.lga).trim().toLowerCase()
      && wardInScope(item.ward, session.user.ward);
  };
  const canSeeReport = (item) =>
    canAdmin ||
    (isSupervisor && (item.assignedTo === session.user.id || isSupervisorWardRelevant(item))) ||
    item.createdBy === session.user.id ||
    item.assignedTo === session.user.id ||
    (item.visibleTo || []).includes(session.user.id);
  const flushOfflineVideoQueue = async () => {
    if (offlineUploadRef.current || !navigator.onLine) return;
    offlineUploadRef.current = true;
    try {
      const clips = await listOfflineVideos();
      for (const clip of clips) {
        const data = await blobToDataUrl(clip.blob);
        const point = gpsBestRef.current || session.user;
        await request("/incidents", session.token, {
          method: "POST",
          body: JSON.stringify({
            title: "Recovered offline field video",
            description: `Automatically recorded while live video was unavailable. Captured ${new Date(clip.createdAt).toLocaleString()}.`,
            reportType: "Network Connectivity",
            severity: "High",
            status: "Open",
            lat: Number(clip.lat ?? point.lat) || OYO_CENTER[0],
            lng: Number(clip.lng ?? point.lng) || OYO_CENTER[1],
            assignedTo: "",
            visibleTo: [],
            media: [{
              name: `offline-field-video-${Date.now()}.${clip.blob.type.includes("mp4") ? "mp4" : "webm"}`,
              type: "video",
              mimeType: clip.blob.type,
              size: clip.blob.size,
              data,
            }],
            style: { source: "offline-video", icon: "video", color: "#d9aa4b", fillColor: "#ecc86f" },
          }),
        });
        await deleteOfflineVideo(clip.id);
      }
      if (clips.length) {
        setNotice(`${clips.length} offline video ${clips.length === 1 ? "clip" : "clips"} sent to admin`);
        setTimeout(() => setNotice(""), 4000);
      }
    } catch {
      // Keep queued clips on the device and retry on the next connection.
    } finally {
      offlineUploadRef.current = false;
    }
  };
  const startOfflineVideoRecording = (reason = "Live connection unavailable") => {
    const stream = localCameraStreamRef.current;
    if (!stream || offlineRecorderRef.current || typeof MediaRecorder === "undefined") return;
    offlineFallbackRef.current = true;
    const mimeType = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(type => MediaRecorder.isTypeSupported(type)) || "";
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 400000,
      audioBitsPerSecond: 32000,
    });
    offlineChunksRef.current = [];
    offlineRecorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data?.size) offlineChunksRef.current.push(event.data);
    };
    recorder.onstop = async () => {
      clearTimeout(offlineSegmentTimerRef.current);
      offlineRecorderRef.current = null;
      const blob = new Blob(offlineChunksRef.current, { type: recorder.mimeType || mimeType || "video/webm" });
      offlineChunksRef.current = [];
      if (blob.size) {
        const point = gpsBestRef.current || session.user;
        await queueOfflineVideo(blob, { lat: point.lat, lng: point.lng }).catch(() => {});
        if (navigator.onLine) flushOfflineVideoQueue();
      }
      if (offlineFallbackRef.current && sharingCameraRef.current)
        setTimeout(() => startOfflineVideoRecording(reason), 250);
    };
    recorder.start(5000);
    offlineSegmentTimerRef.current = setTimeout(() => recorder.stop(), 45000);
    navigator.storage?.persist?.().catch(() => {});
    setNotice(`${reason}. Recording safely on this device.`);
  };
  const stopOfflineVideoRecording = () => {
    offlineFallbackRef.current = false;
    clearTimeout(offlineSegmentTimerRef.current);
    if (offlineRecorderRef.current?.state !== "inactive")
      offlineRecorderRef.current?.stop();
  };
  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);
  useEffect(() => {
    navigator.serviceWorker?.ready
      .then((reg) => {
        if (reg.waiting) setUpdateReady(true);
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            )
              setUpdateReady(true);
          });
        });
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    Promise.all([
      request("/incidents", session.token),
      request("/users", session.token),
      request("/report-viewers", session.token),
      request("/cameras", session.token),
      request("/map-layers", session.token),
      request("/chat/rooms", session.token),
      request("/parties", session.token),
      request("/notifications", session.token),
    ])
      .then(([a, b, viewers, c, d, e, partyList, notificationList]) => {
        setIncidents(a);
        setUsers(b);
        setReportUsers(viewers.filter((user) => user.role !== "Super Admin"));
        setCameras(c);
        setMapLayers(d);
        setChatRooms(e);
        setParties(partyList);
        setNotifications(notificationList);
      })
      .catch((err) => {
        if (err.message.includes("Session expired")) onLogout();
        else setNotice(err.message);
      });
    const socket = io({
      transports: ["polling", "websocket"],
      auth: { token: session.token },
      reconnectionAttempts: 10,
      timeout: 15000,
    });
    socketRef.current = socket;
    window.addEventListener("online", flushOfflineVideoQueue);
    if (navigator.onLine) flushOfflineVideoQueue();
    socket.on("connect_error", () => {
      setNotice("Realtime connection is reconnecting...");
      if (localCameraStreamRef.current)
        startOfflineVideoRecording("Network connection unavailable");
    });
    socket.on("disconnect", () => {
      if (localCameraStreamRef.current)
        startOfflineVideoRecording("Network connection lost");
    });
    const announceCameraShare = () =>
      socket.emit("camera:share:start", {
        userId: session.user.id,
        name: session.user.name,
        type: "Phone",
        role: session.user.role,
        email: session.user.email,
        lga: session.user.lga,
        ward: session.user.ward,
        pollingUnit: session.user.pollingUnit,
        station: session.user.station,
      });
    const registerCameraUser = () => {
      socket.emit("camera:register", {
        userId: session.user.id,
        name: session.user.name,
        role: session.user.role,
        rank: session.user.rank,
        unit: session.user.unit,
        unitType: session.user.unitType,
        command: session.user.command,
        division: session.user.division,
        station: session.user.station,
        lat: session.user.lat,
        lng: session.user.lng,
      });
      if (localCameraStreamRef.current) announceCameraShare();
      stopOfflineVideoRecording();
      flushOfflineVideoQueue();
    };
    socket.on("connect", registerCameraUser);
    if (socket.connected) registerCameraUser();
    const fallbackIceServers = [{ urls: "stun:stun.l.google.com:19302" }];
    const iceConfigurationPromise = request("/turn/credentials", session.token)
      .then((result) => {
        const provider = result?.provider || "stun-fallback";
        const region = result?.region || "";
        const iceServers = Array.isArray(result?.iceServers) && result.iceServers.length
          ? result.iceServers
          : fallbackIceServers;
        setTurnStatus({ provider, region, route: provider === "metered" ? "ready" : "fallback" });
        return { iceServers, provider, region };
      })
      .catch((error) => {
        console.warn("[camera] TURN credentials unavailable; using STUN fallback", error);
        setTurnStatus({ provider: "stun-fallback", region: "", route: "fallback" });
        return { iceServers: fallbackIceServers, provider: "stun-fallback", region: "" };
      });
    const detectIceRoute = async (pc) => {
      try {
        const stats = await pc.getStats();
        let selectedPair = null;
        stats.forEach((report) => {
          if (report.type === "transport" && report.selectedCandidatePairId)
            selectedPair = stats.get(report.selectedCandidatePairId) || selectedPair;
        });
        if (!selectedPair) {
          stats.forEach((report) => {
            if (report.type === "candidate-pair" && report.state === "succeeded" && (report.nominated || report.selected))
              selectedPair = report;
          });
        }
        const localCandidate = selectedPair?.localCandidateId ? stats.get(selectedPair.localCandidateId) : null;
        const remoteCandidate = selectedPair?.remoteCandidateId ? stats.get(selectedPair.remoteCandidateId) : null;
        return [localCandidate, remoteCandidate].some((candidate) => candidate?.candidateType === "relay") ? "turn" : "direct";
      } catch {
        return "direct";
      }
    };
    const makePeer = async (key, remoteUserId) => {
      const iceConfiguration = await iceConfigurationPromise;
      const pc = new RTCPeerConnection({
        iceServers: iceConfiguration.iceServers,
      });
      const connectionTimer = setTimeout(() => {
        if (pc.connectionState !== "connected" && localCameraStreamRef.current)
          startOfflineVideoRecording("Live video could not connect");
      }, 15000);
      pc.onconnectionstatechange = async () => {
        if (pc.connectionState === "connected") {
          clearTimeout(connectionTimer);
          stopOfflineVideoRecording();
          const route = await detectIceRoute(pc);
          setTurnStatus({ provider: iceConfiguration.provider, region: iceConfiguration.region, route });
          setNotice(route === "turn" ? "Live video connected via Metered TURN" : "Live video connected directly");
          setTimeout(() => setNotice(""), 2500);
        } else if (["failed", "disconnected"].includes(pc.connectionState)) {
          startOfflineVideoRecording(
            pc.connectionState === "failed"
              ? "Live video could not connect"
              : "Live video connection interrupted",
          );
        }
      };
      pc.onicecandidate = (event) => {
        if (event.candidate)
          socket.emit("camera:signal", {
            target: key,
            data: { candidate: event.candidate },
          });
      };
      if (remoteUserId)
        pc.ontrack = (event) =>
          setRemoteStreams((old) => ({
            ...old,
            [remoteUserId]: event.streams[0],
          }));
      rtcPeersRef.current[key] = pc;
      return pc;
    };
    socket.on("incident:created", (x) => {
      if (canSeeReport(x))
        setIncidents((old) =>
          old.some((i) => i.id === x.id) ? old : [x, ...old],
        );
    });
    socket.on("parties:updated", setParties);
    socket.on("incident:updated", (x) =>
      setIncidents((old) =>
        canSeeReport(x)
          ? old.map((i) => (i.id === x.id ? x : i))
          : old.filter((i) => i.id !== x.id),
      ),
    );
    socket.on("incident:deleted", (id) => {
      setIncidents((old) => old.filter((i) => i.id !== id));
      setSelected((old) => (old?.id === id ? null : old));
    });
    socket.on("notification:new", (item) => {
      setNotifications((old) => [item, ...old.filter((notification) => notification.id !== item.id)]);
      setNotice(`New assignment: ${item.incidentType || "Incident"}`);
    });
    socket.on("emergency:alert", (alert) => {
      const normalized = {
        ...alert,
        lat: Number(alert.lat),
        lng: Number(alert.lng),
      };
      setEmergencyAlerts((old) =>
        [normalized, ...old.filter((item) => item.id !== normalized.id)].slice(
          0,
          12,
        ),
      );
      setActiveEmergency(normalized);
      setGpsPositions((old) => ({
        ...old,
        [normalized.userId]: {
          ...(old[normalized.userId] || {}),
          lat: normalized.lat,
          lng: normalized.lng,
          timestamp: normalized.timestamp,
          offline: false,
        },
      }));
      if (!normalized.silent) playEmergencyRing(normalized);
      setNotice(`Emergency from ${normalized.name}`);
      mapRef.current?.flyTo([normalized.lat, normalized.lng], 17);
    });
    socket.on("user:created", (x) => {
      if (session.user.role !== "Super Admin" && x.role === "Super Admin") {
        return;
      }
      setUsers((old) => (old.some((u) => u.id === x.id) ? old : [...old, x]));
      setReportUsers((old) =>
        x.id === session.user.id || old.some((u) => u.id === x.id)
          ? old
          : [...old, x],
      );
    });
    socket.on("user:deleted", (id) => {
      setUsers((old) => old.filter((u) => u.id !== id));
      setReportUsers((old) => old.filter((u) => u.id !== id));
    });
    socket.on("gps:broadcast", (point) =>
      setGpsPositions((old) => ({
        ...old,
        [point.userId]: {
          ...point,
          lat: Number(point.lat),
          lng: Number(point.lng),
          offline: false,
        },
      })),
    );
    socket.on("gps:offline", (point) =>
      setGpsPositions((old) => ({
        ...old,
        [point.userId]: {
          ...(old[point.userId] || {}),
          ...point,
          offline: true,
        },
      })),
    );
    socket.on("camera:created", (camera) =>
      setCameras((old) =>
        old.some((x) => x.id === camera.id) ? old : [...old, camera],
      ),
    );
    socket.on("camera:deleted", (id) =>
      setCameras((old) => old.filter((x) => x.id !== id)),
    );
    socket.on("map-layer:created", (item) =>
      setMapLayers((old) =>
        old.some((x) => x.id === item.id) ? old : [item, ...old],
      ),
    );
    socket.on("map-layer:updated", (item) =>
      setMapLayers((old) => old.map((x) => (x.id === item.id ? item : x))),
    );
    socket.on("map-layer:deleted", (id) =>
      setMapLayers((old) => old.filter((x) => x.id !== id)),
    );
    socket.on("chat:room", (room) =>
      setChatRooms((old) =>
        old.some((x) => x.id === room.id)
          ? old.map((x) => (x.id === room.id ? room : x))
          : [room, ...old],
      ),
    );
    socket.on("chat:message", ({ roomId, message }) => {
      if (activeRoomRef.current?.id === roomId)
        setChatMessages((old) =>
          old.some((x) => x.id === message.id) ? old : [...old, message],
        );
    });
    socket.on("chat:deleted", (id) => {
      setChatRooms((old) => old.filter((x) => x.id !== id));
      if (activeRoomRef.current?.id === id) {
        setActiveRoom(null);
        setChatMessages([]);
      }
    });
    socket.on("camera:shares:list", (feeds) => setPhoneShares(feeds));
    socket.on("camera:share:start", (feed) =>
      setPhoneShares((old) =>
        old.some((x) => x.userId === feed.userId)
          ? old.map((item) => item.userId === feed.userId ? { ...item, ...feed } : item)
          : [...old, feed],
      ),
    );
    socket.on("camera:share:stop", ({ userId }) => {
      setPhoneShares((old) => old.filter((x) => x.userId !== userId));
      setRemoteStreams((old) => {
        const next = { ...old };
        delete next[userId];
        return next;
      });
    });
    socket.on("camera:viewer:request", async ({ viewerSocketId }) => {
      const stream = localCameraStreamRef.current;
      if (!stream) return;
      const pc = await makePeer(viewerSocketId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("camera:signal", {
        target: viewerSocketId,
        data: { sdp: pc.localDescription },
      });
    });
    socket.on("camera:signal", async ({ from, fromUserId, data }) => {
      let pc = rtcPeersRef.current[from];
      if (data.sdp?.type === "offer") {
        pc ||= await makePeer(from, fromUserId);
        await pc.setRemoteDescription(data.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("camera:signal", {
          target: from,
          data: { sdp: pc.localDescription },
        });
      } else if (data.sdp?.type === "answer" && pc)
        await pc.setRemoteDescription(data.sdp);
      else if (data.candidate && pc)
        await pc.addIceCandidate(data.candidate).catch(() => {});
    });
    // Restart camera stream when app returns to foreground after being backgrounded
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && sharingCameraRef.current) {
        // Re-acquire wake lock (it gets released when tab hides)
        acquireWakeLock();
        // Check if our video track got killed by the browser
        const stream = localCameraStreamRef.current;
        const videoTrack = stream?.getVideoTracks()[0];
        if (!videoTrack || videoTrack.readyState === "ended") {
          try {
            const facingMode = cameraFacingMode;
            const newStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: true,
            });
            newStream.getAudioTracks().forEach((track) => { track.enabled = !cameraMicMutedRef.current; });
            localCameraStreamRef.current = newStream;
            // Replace tracks in all active peer connections
            Object.values(rtcPeersRef.current).forEach((pc) => {
              const newVideo = newStream.getVideoTracks()[0];
              const newAudio = newStream.getAudioTracks()[0];
              pc.getSenders().forEach((sender) => {
                if (sender.track?.kind === "video" && newVideo) sender.replaceTrack(newVideo);
                if (sender.track?.kind === "audio" && newAudio) sender.replaceTrack(newAudio);
              });
            });
            // Re-announce to server so admin can re-request if needed
            socketRef.current?.emit("camera:share:start", {
              userId: session.user.id,
              name: session.user.name,
              type: "Phone",
              role: session.user.role,
              email: session.user.email,
              lga: session.user.lga,
              ward: session.user.ward,
              pollingUnit: session.user.pollingUnit,
              station: session.user.station,
            });
            newStream.getVideoTracks()[0]?.addEventListener("ended", () => {
              if (localCameraStreamRef.current !== newStream) return;
              sharingCameraRef.current = false;
              stopOfflineVideoRecording();
              socketRef.current?.emit("camera:share:stop", { userId: session.user.id });
              setSharingCamera(false);
              setSelfCameraPreview(false);
              releaseWakeLock();
              stopSilentAudio();
            });
          } catch {}
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      if (gpsWatchRef.current != null)
        navigator.geolocation?.clearWatch(gpsWatchRef.current);
      stopOfflineVideoRecording();
      localCameraStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());
      Object.values(rtcPeersRef.current).forEach((pc) => pc.close());
      socket.close();
      socketRef.current = null;
      window.removeEventListener("online", flushOfflineVideoQueue);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseWakeLock();
      stopSilentAudio();
    };
  }, []);
  const visible = incidents.filter(
    (i) => filter === "All" || i.severity === filter || i.status === filter,
  );
  const mapVisibleIncidents = showReports
    ? incidents.filter(
        (i) =>
          !hiddenReportIds.includes(i.id) &&
          (showSosIncidents ||
            (i.reportType !== "SOS-Emergency" && i.style?.source !== "sos")),
      )
    : [];
  const save = async (form) => {
    const item = await request("/incidents", session.token, {
      method: "POST",
      body: JSON.stringify({
        ...form,
        createdBy: session.user.id,
        createdAt: new Date().toISOString(),
      }),
    });
    const savedItem = {
      ...form,
      id: item.id,
      createdBy: session.user.id,
      createdAt: item.createdAt || new Date().toISOString(),
      pollingUnit: form.pollingUnit || "",
      resultCount: form.resultCount || "",
    };
    setIncidents((old) =>
      old.some((i) => i.id === savedItem.id) ? old : [savedItem, ...old],
    );
    setNewPoint(null);
    setSelected(savedItem);
    setDrawMode("");
    setNotice("Incident submitted successfully");
    setTimeout(() => setNotice(""), 2500);
  };
  const updateStatus = async (status) => {
    const item = await request(`/incidents/${selected.id}`, session.token, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    setIncidents((old) => old.map((i) => (i.id === item.id ? item : i)));
    setSelected(item);
  };
  const fetchIpLog = async () => {
    setIpLogLoading(true);
    try {
      const data = await request("/admin/ip-log?limit=200", session.token);
      setIpLogData(data);
    } catch (e) {
      setNotice(e.message || "Unable to load IP log");
    } finally {
      setIpLogLoading(false);
    }
  };
  const deleteIncident = async () => {
    if (
      !selected ||
      !window.confirm(
        `Delete incident "${selected.title}"? This cannot be undone.`,
      )
    )
      return;
    const id = selected.id;
    await request(`/incidents/${id}`, session.token, { method: "DELETE" });
    setIncidents((old) => old.filter((i) => i.id !== id));
    setSelected(null);
    setNotice("Incident deleted");
    setTimeout(() => setNotice(""), 2500);
  };
  const toggleReportOnMap = (report) =>
    setHiddenReportIds((old) => {
      const next = old.includes(report.id)
        ? old.filter((id) => id !== report.id)
        : [...old, report.id];
      localStorage.setItem("hidden-report-ids", JSON.stringify(next));
      return next;
    });
  const jump = (e) => {
    e.preventDefault();
    const [lat, lng] = coords.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng))
      mapRef.current.flyTo([lat, lng], 15);
  };
  const geocode = async (e) => {
    e.preventDefault();
    const term = search.trim().toLowerCase();
    if (!term) return;
    const local =
      incidents.find((x) =>
        `${x.title} ${x.description} ${x.status} ${x.severity}`
          .toLowerCase()
          .includes(term),
      ) ||
      officers.find((x) =>
        `${x.name} ${x.unit} ${x.status}`.toLowerCase().includes(term),
      ) ||
      mapCameras.find((x) =>
        `${x.name} ${x.feedType}`.toLowerCase().includes(term),
      );
    if (local?.lat && local?.lng) {
      mapRef.current.flyTo([Number(local.lat), Number(local.lng)], 16);
      if (local.title) setSelected(local);
      return;
    }
    const queries = [
      search,
      `${search}, Nigeria`,
      `${search}, Oyo State, Nigeria`,
    ];
    for (const q of queries) {
      const data = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`,
      )
        .then((r) => r.json())
        .catch(() => []);
      if (data[0]) {
        mapRef.current.flyTo([+data[0].lat, +data[0].lon], 14);
        return;
      }
    }
    setNotice("Location not found");
  };
  const currentUserPoint = () => {
    const point = gpsPositions[session.user.id] || session.user;
    return Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng))
      ? { lat: Number(point.lat), lng: Number(point.lng), label: "My location" }
      : null;
  };
  const geocodePlace = async (value) => {
    const text = String(value || "").trim();
    if (!text) throw new Error("Enter a start and destination");
    if (/^(my location|current location|here)$/i.test(text)) {
      const here = currentUserPoint();
      if (!here) throw new Error("Your location is not available yet");
      return here;
    }
    const coordMatch = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coordMatch) {
      return { lat: Number(coordMatch[1]), lng: Number(coordMatch[2]), label: text };
    }
    const queries = [text, `${text}, Nigeria`, `${text}, Oyo State, Nigeria`];
    for (const q of queries) {
      const data = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`,
      )
        .then((r) => r.json())
        .catch(() => []);
      if (data[0]) {
        return { lat: Number(data[0].lat), lng: Number(data[0].lon), label: data[0].display_name || text };
      }
    }
    throw new Error(`Could not find "${text}"`);
  };
  const loadRoute = async (points) => {
    if (points.length < 2) return;
    const [a, b] = points;
    setNotice("Calculating route...");
    try {
      const data = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`,
      ).then((r) => r.json());
      if (!data.routes?.[0])
        throw new Error("No road route found between those points");
      const route = data.routes[0];
      const result = {
        points: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        distance: route.distance,
        duration: route.duration,
        start: a,
        end: b,
      };
      setRouteResult(result);
      mapRef.current?.fitBounds(L.latLngBounds(result.points).pad(0.18));
      setNotice(
        `Route ready: ${formatDistance(route.distance)} - ${formatDuration(route.duration)}`,
      );
    } catch (error) {
      setRouteResult(null);
      setNotice(error.message || "Unable to calculate route");
    }
    setTimeout(() => setNotice(""), 3500);
  };
  const addToolPoint = (mode, latlng) => {
    const point = { lat: latlng.lat, lng: latlng.lng };
    setCoords(`${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`);
    if (mode === "measure") {
      setRoutePoints([]);
      setRouteResult(null);
      setMeasurePoints((old) => {
        const next = [...old, point];
        if (next.length > 1)
          setNotice(
            `Measured distance: ${formatDistance(totalDistance(next))}`,
          );
        return next;
      });
      return;
    }
    setMeasurePoints([]);
    setRoutePoints((old) => {
      const next = old.length >= 2 ? [point] : [...old, point];
      setRouteResult(null);
      setNotice(
        next.length === 1
          ? "Route start set. Pick destination."
          : "Calculating route...",
      );
      if (next.length === 2) loadRoute(next);
      return next;
    });
  };
  const startToolFromPoint = (mode, point) => {
    const start = { lat: Number(point.lat), lng: Number(point.lng) };
    setDrawMode(mode);
    setCoords(`${start.lat.toFixed(6)}, ${start.lng.toFixed(6)}`);
    if (mode === "measure") {
      setMeasurePoints([start]);
      setRoutePoints([]);
      setRouteResult(null);
      setNotice(`Measurement started from ${point.label || "selected point"}`);
    } else {
      setRoutePoints([start]);
      setMeasurePoints([]);
      setRouteResult(null);
      setNotice(
        `Route start set from ${point.label || "selected point"}. Pick destination.`,
      );
    }
    mapRef.current?.closePopup();
  };
  const clearMapTools = () => {
    setMeasurePoints([]);
    setRoutePoints([]);
    setRouteResult(null);
    setAnalysisLayers([]);
    setDrawMode("");
    setMapMenu("");
  };
  const routeFromInputs = async (event) => {
    event?.preventDefault();
    try {
      const start = await geocodePlace(routeStartInput);
      const end = await geocodePlace(routeEndInput);
      setDrawMode("route");
      setMeasurePoints([]);
      setRoutePoints([start, end]);
      await loadRoute([start, end]);
    } catch (error) {
      setNotice(error.message || "Unable to find route");
      setTimeout(() => setNotice(""), 3500);
    }
  };
  const rerouteFromHere = async () => {
    if (!routeResult?.end) {
      setNotice("Create a route first");
      return;
    }
    const here = currentUserPoint();
    if (!here) {
      setNotice("Your location is not available yet");
      return;
    }
    setRouteStartInput("My location");
    setRoutePoints([here, routeResult.end]);
    await loadRoute([here, routeResult.end]);
  };
  const currentMapPoint = () => {
    const live = gpsBestRef.current;
    if (Number.isFinite(Number(live?.lat)) && Number.isFinite(Number(live?.lng)))
      return { lat: Number(live.lat), lng: Number(live.lng) };
    const center = mapRef.current?.getCenter();
    return center
      ? { lat: center.lat, lng: center.lng }
      : { lat: OYO_CENTER[0], lng: OYO_CENTER[1] };
  };
  const openIncidentPointForm = () => {
    clearMapTools();
    setNewPoint(currentMapPoint());
    setNotice("Incident point ready. Complete the incident form.");
  };
  const openPollingUnitResultForm = () => {
    clearMapTools();
    const point = gpsBestRef.current || currentMapPoint();
    setNewResultPoint({ lat: Number(point.lat), lng: Number(point.lng) });
    setNotice("Result form ready with your polling unit, location and current time.");
  };
  const savePollingResult = async (payload) => {
    const item = await request("/results", session.token, { method: "POST", body: JSON.stringify(payload) });
    setIncidents(old => old.some(entry => entry.id === item.id) ? old : [item, ...old]);
    setNewResultPoint(null);
    setNotice("Polling unit result submitted successfully");
    setTimeout(() => setNotice(""), 3000);
  };
  const saveParties = async (partyList) => {
    const saved = await request("/parties", session.token, { method: "PUT", body: JSON.stringify({ parties: partyList }) });
    setParties(saved); setPartyManagerOpen(false); setNotice("Political-party list updated");
  };
  const pickIncidentPoint = () => {
    clearMapTools();
    setNotice("Click the map to pick an incident point.");
  };
  const startIncidentArea = (mode) => {
    clearMapTools();
    setDrawMode(mode);
    setNotice(
      mode === "circle"
        ? "Click center, then edge, to create an incident area."
        : "Draw the incident area by hand.",
    );
  };
  const setMapDrawTool = (mode) => {
    setMapMenu("");
    setDrawMode((current) => (current === mode ? "" : mode));
    if (mode === "measure") {
      setRoutePoints([]);
      setRouteResult(null);
    }
    if (mode === "route") setMeasurePoints([]);
  };
  const hasMapTools =
    measurePoints.length > 0 ||
    routePoints.length > 0 ||
    !!routeResult ||
    analysisLayers.length > 0 ||
    !!drawMode;
  const fitToPoints = (points, fallbackBounds = OYO_BOUNDS) => {
    const valid = points.filter(
      (point) =>
        Number.isFinite(Number(point.lat)) &&
        Number.isFinite(Number(point.lng)),
    );
    if (valid.length > 1)
      mapRef.current?.fitBounds(
        L.latLngBounds(
          valid.map((point) => [Number(point.lat), Number(point.lng)]),
        ).pad(0.18),
      );
    else if (valid.length === 1)
      mapRef.current?.flyTo([Number(valid[0].lat), Number(valid[0].lng)], 14);
    else mapRef.current?.fitBounds(fallbackBounds);
  };
  const routeUserPoint = currentUserPoint();
  const routeGuide = routeResult
    ? (() => {
        const destination = routeResult.end;
        const remaining =
          routeUserPoint && destination
            ? L.latLng(routeUserPoint.lat, routeUserPoint.lng).distanceTo([
                destination.lat,
                destination.lng,
              ])
            : null;
        return remaining
          ? `${formatDistance(remaining)} from destination. Route: ${formatDistance(routeResult.distance)} - ${formatDuration(routeResult.duration)}`
          : `Route: ${formatDistance(routeResult.distance)} - ${formatDuration(routeResult.duration)}`;
      })()
    : "";
  const focusDefaultExtent = () => {
    const user = session.user;
    const unitType = String(user.unitType || user.role || "").toLowerCase();
    const isHeadquarters =
      canAdmin ||
      unitType.includes("command center");
    if (isHeadquarters) {
      mapRef.current?.fitBounds(OYO_BOUNDS);
      return;
    }
    const localUsers = users.filter(
      (item) =>
        (user.lga && item.lga === user.lga) ||
        (user.unit && item.unit === user.unit),
    );
    const localIds = new Set(localUsers.map((item) => item.id));
    const localReports = incidents.filter(
      (item) =>
        localIds.has(item.assignedTo) ||
        localIds.has(item.createdBy) ||
        (item.visibleTo || []).some((id) => localIds.has(id)),
    );
    fitToPoints(
      [...localUsers, ...localReports, user],
      isHeadquarters
        ? OYO_BOUNDS
        : [
            [Number(user.lat) - 0.08, Number(user.lng) - 0.08],
            [Number(user.lat) + 0.08, Number(user.lng) + 0.08],
          ],
    );
  };
  const createOfficer = async (form) => {
    const user = await request("/users", session.token, {
      method: "POST",
      body: JSON.stringify(form),
    });
    setUsers((old) =>
      old.some((u) => u.id === user.id) ? old : [...old, user],
    );
    setNotice(`${user.name} created`);
    setTimeout(() => setNotice(""), 2500);
  };
  const updateOfficer = async (form) => {
    if (!form?.id) throw new Error("No user selected for update");
    const user = await request(`/users/${form.id}`, session.token, {
      method: "PUT",
      body: JSON.stringify(form),
    });
    setUsers((old) => old.map((u) => (u.id === user.id ? user : u)));
    setNotice(`${user.name} updated`);
    setTimeout(() => setNotice(""), 2500);
    return user;
  };
  const updateUserPassword = async (user, password) => {
    await request(`/users/${user.id}/password`, session.token, {
      method: "PUT",
      body: JSON.stringify({ password }),
    });
    setNotice(`Password updated for ${user.name}`);
    setTimeout(() => setNotice(""), 2500);
  };
  const changeUserRole = async (user, changes) => {
    const updated = await request(`/users/${user.id}/role`, session.token, {
      method: "PUT",
      body: JSON.stringify(changes),
    });
    setUsers((old) => old.map((u) => (u.id === updated.id ? updated : u)));
    const action = updated.role !== user.role
      ? (updated.role === "Supervisor" ? "promoted to Supervisor" : "demoted to Agent")
      : "ward updated";
    setNotice(`${updated.name} ${action}`);
    setTimeout(() => setNotice(""), 3000);
    return updated;
  };
  const changeOwnPassword = async () => {
    const password = window.prompt("Enter your new password");
    if (!password) return;
    await updateUserPassword(session.user, password);
  };
  const saveProfile = async (form) => {
    const updated = await request("/profile", session.token, { method: "PUT", body: JSON.stringify(form) });
    onSessionUpdate(updated);
    setProfileOpen(false);
    setProfileMenuOpen(false);
    setNotice("Profile updated");
  };
  const refreshApp = async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    if (reg?.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    setNotice(
      updateReady ? "Installing new update..." : "Checking for update...",
    );
    setTimeout(() => window.location.reload(), 800);
  };
  const selectChatRoom = async (room) => {
    setActiveRoom(room);
    setChatPanel(true);
    setChatMessages(
      await request(`/chat/rooms/${room.id}/messages`, session.token),
    );
  };
  const createChatRoom = async (form) => {
    const room = await request("/chat/rooms", session.token, {
      method: "POST",
      body: JSON.stringify({
        name: form.name,
        memberIds: form.userId ? [form.userId] : [],
      }),
    });
    setChatRooms((old) =>
      old.some((x) => x.id === room.id) ? old : [room, ...old],
    );
    await selectChatRoom(room);
  };
  const sendChatMessage = async (payload) => {
    if (!activeRoom) return;
    const messagePayload = typeof payload === "string" ? { body: payload, attachments: [] } : payload;
    const message = await request(
      `/chat/rooms/${activeRoom.id}/messages`,
      session.token,
      { method: "POST", body: JSON.stringify(messagePayload) },
    );
    setChatMessages((old) =>
      old.some((x) => x.id === message.id) ? old : [...old, message],
    );
  };
  const addChatMember = async (room, userId) => {
    const updated = await request(
      `/chat/rooms/${room.id}/members`,
      session.token,
      { method: "POST", body: JSON.stringify({ userId }) },
    );
    setChatRooms((old) => old.map((x) => (x.id === updated.id ? updated : x)));
    setActiveRoom(updated);
    setNotice("Personnel added to chat");
    setTimeout(() => setNotice(""), 2500);
  };
  const deleteChatRoom = async (room) => {
    if (
      !room ||
      !window.confirm(`Delete chat "${room.name}"? Messages will be removed.`)
    )
      return;
    await request(`/chat/rooms/${room.id}`, session.token, {
      method: "DELETE",
    });
    setChatRooms((old) => old.filter((x) => x.id !== room.id));
    if (activeRoom?.id === room.id) {
      setActiveRoom(null);
      setChatMessages([]);
    }
    setNotice("Chat deleted");
    setTimeout(() => setNotice(""), 2500);
  };
  const openIncidentChat = async (incident) => {
    const room = await request(
      `/incidents/${incident.id}/chat`,
      session.token,
      { method: "POST" },
    );
    setChatRooms((old) =>
      old.some((x) => x.id === room.id)
        ? old.map((x) => (x.id === room.id ? room : x))
        : [room, ...old],
    );
    await selectChatRoom(room);
  };
  const assignIncidentToField = async ({ incidentId, assignedUserId, message }) => {
    const result = await request(`/incidents/${incidentId}/assign`, session.token, {
      method: "POST",
      body: JSON.stringify({ assignedUserId, message }),
    });
    setIncidents((old) => old.map((item) => item.id === result.incident.id ? result.incident : item));
    setSelected((old) => old?.id === result.incident.id ? result.incident : old);
    setNotice("Incident assigned and field user notified");
    return result;
  };
  const claimIncident = async (incidentId) => assignIncidentToField({
    incidentId,
    assignedUserId: session.user.id,
    message: 'Claimed by the assigned-area supervisor for response and follow-up.',
  });
  const openNotification = async (notification) => {
    let incident = incidents.find((item) => item.id === notification.incidentId) || null;
    if (!incident && notification.incidentId) {
      try { incident = await request(`/incidents/${notification.incidentId}`, session.token); } catch {}
    }
    if (!notification.read) {
      try {
        const updated = await request(`/notifications/${notification.id}/read`, session.token, { method: "PUT" });
        setNotifications((old) => old.map((item) => item.id === updated.id ? updated : item));
        notification = updated;
      } catch {}
    }
    setNotificationDetail({ notification, incident });
  };
  const resolveNotificationIncident = async (incident) => {
    if (!incident) return;
    const updated = await request(`/incidents/${incident.id}`, session.token, {
      method: "PUT", body: JSON.stringify({ status: "Resolved" }),
    });
    setIncidents((old) => old.map((item) => item.id === updated.id ? updated : item));
    setSelected((old) => old?.id === updated.id ? updated : old);
    setNotificationDetail(null);
    setNotice("Assignment marked resolved");
  };
  const deleteOfficer = async (officer) => {
    if (
      !window.confirm(
        `Delete ${officer.name}? Their assigned incidents will become unassigned.`,
      )
    )
      return;
    await request(`/users/${officer.id}`, session.token, { method: "DELETE" });
    setUsers((old) => old.filter((u) => u.id !== officer.id));
    setNotice(`${officer.name} deleted`);
    setTimeout(() => setNotice(""), 2500);
  };
  const addArea = (area) => {
    const center = reportCenter(area);
    if (canAdmin) {
      setPendingAreaAction(area);
      setDrawMode("");
      return;
    }
    setNewPoint({
      ...(center || { lat: OYO_CENTER[0], lng: OYO_CENTER[1] }),
      geometry: area,
    });
    setDrawMode("");
    setNotice("Incident area captured. Complete the incident form.");
    setTimeout(() => setNotice(""), 2500);
  };
  const reportPendingArea = () => {
    const area = pendingAreaAction;
    if (!area) return;
    const center = reportCenter(area);
    setPendingAreaAction(null);
    setNewPoint({ ...(center || { lat: OYO_CENTER[0], lng: OYO_CENTER[1] }), geometry: area });
  };
  const searchPendingArea = () => {
    const area = pendingAreaAction;
    if (!area) return;
    const inside = (point) => {
      if (!Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lng))) return false;
      if (area.type === "circle") return L.latLng(area.center).distanceTo(L.latLng(point.lat, point.lng)) <= area.radius;
      return L.polygon(area.points).getBounds().contains([point.lat, point.lng]);
    };
    const agents = officers.filter(inside);
    const foundIncidents = incidents.filter(inside);
    const pollingUnits = [...new Set(agents.map((agent) => agent.pollingUnit).filter(Boolean))];
    const result = {
      id: `search-${Date.now()}`,
      createdAt: new Date().toISOString(),
      area,
      agents,
      incidents: foundIncidents,
      pollingUnits,
      mapLayerCount: mapLayers.length,
      radius: area.type === "circle" ? area.radius : null,
      diameter: area.type === "circle" ? area.radius * 2 : null,
    };
    setAreas((old) => [...old, { ...area, title: "Saved area search" }]);
    setPendingAreaAction(null);
    setAreaSearchResult(result);
  };
  const areaSearchText = (result) => [
    `Area search — ${new Date(result.createdAt).toLocaleString()}`,
    `Agents: ${result.agents.length}`,
    `Polling units: ${result.pollingUnits.length}`,
    `Incidents: ${result.incidents.length}`,
    `Map layers: ${result.mapLayerCount}`,
    result.radius ? `Radius: ${formatDistance(result.radius)}` : null,
    result.diameter ? `Diameter: ${formatDistance(result.diameter)}` : null,
    result.pollingUnits.length ? `Polling units: ${result.pollingUnits.join(", ")}` : null,
  ].filter(Boolean).join("\n");
  const saveAreaSearch = (result) => {
    const saved = JSON.parse(localStorage.getItem("command-saved-area-searches") || "[]");
    localStorage.setItem("command-saved-area-searches", JSON.stringify([result, ...saved].slice(0, 50)));
    setNotice("Area search saved on this device");
    setTimeout(() => setNotice(""), 2500);
  };
  const shareAreaSearch = async (result) => {
    const text = areaSearchText(result);
    try {
      if (navigator.share) await navigator.share({ title: "Election monitoring area search", text });
      else {
        await navigator.clipboard.writeText(text);
        setNotice("Search result copied — paste it into your messaging app");
      }
    } catch (error) {
      if (error.name !== "AbortError") setNotice("Could not share this search result");
    }
  };
  const clearAreas = () => {
    if (!areas.length || !window.confirm("Remove all drawn operational areas?"))
      return;
    setAreas([]);
    localStorage.removeItem("command-areas");
  };
  const toggleGps = () => {
    if (sharingGps) {
      if (isAgent) { setNotice("Location sharing is required for Agent accounts"); return; }
      if (gpsWatchRef.current != null)
        navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
      gpsBestRef.current = null;
      socketRef.current?.emit("gps:stop", { userId: session.user.id });
      setSharingGps(false);
      setNotice("Location sharing stopped");
      return;
    }
    if (!navigator.geolocation) {
      setNotice("GPS is not available in this browser");
      return;
    }
    setSharingGps(true);
    setNotice("Acquiring GPS fix...");
    gpsBestRef.current = null;

    // Accuracy thresholds — only accept fixes within these bounds
    const ACCURACY_GOOD = 25;
    const ACCURACY_MAX = 150;
    const BROADCAST_INTERVAL = 4000;
    let lastBroadcast = 0;
    let warmUpCount = 0;

    const onPosition = (position) => {
      const { latitude, longitude, accuracy, speed, heading } = position.coords;

      const fixAge = Date.now() - Number(position.timestamp || Date.now());
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy)) return;
      if (accuracy > ACCURACY_MAX || fixAge > 15000) {
        setNotice(`Waiting for accurate GPS… current accuracy ±${Math.round(accuracy || 0)} m`);
        return;
      }

      const prev = gpsBestRef.current;
      const now = Date.now();
      let lat = latitude;
      let lng = longitude;
      if (prev) {
        const elapsedSeconds = Math.max(1, (now - new Date(prev.timestamp).getTime()) / 1000);
        const distance = L.latLng(prev.lat, prev.lng).distanceTo([latitude, longitude]);
        const impliedSpeed = distance / elapsedSeconds;
        const jumpAllowance = Math.max(80, accuracy * 3, Number(prev.accuracy || 0) * 3);
        if (distance > jumpAllowance && impliedSpeed > 75 && accuracy >= Number(prev.accuracy || accuracy)) {
          setNotice("Ignoring an inaccurate GPS jump; checking again…");
          return;
        }
        if (distance <= jumpAllowance) {
          const currentWeight = Math.min(0.85, Math.max(0.55, Number(prev.accuracy || accuracy) / (Number(prev.accuracy || accuracy) + accuracy)));
          lat = prev.lat * (1 - currentWeight) + latitude * currentWeight;
          lng = prev.lng * (1 - currentWeight) + longitude * currentWeight;
        }
      }
      gpsBestRef.current = {
        userId: session.user.id,
        lat,
        lng,
        accuracy,
        speed: speed ?? 0,
        heading: heading ?? 0,
        timestamp: new Date(now).toISOString(),
      };
      // Agent accounts remain locked until a fresh, acceptably accurate fix exists.
      if (isAgent) setGpsRequiredBlocked(false);

      warmUpCount++;

      // During warm-up (first 3 fixes) only show notice, don't broadcast yet
      // unless the fix is already very good
      const isGood = accuracy <= ACCURACY_GOOD;
      if (warmUpCount < 3 && !isGood) {
        setNotice(`GPS warming up… accuracy ±${Math.round(accuracy)} m`);
        return;
      }

      const best = gpsBestRef.current;
      // Throttle broadcasts — don't flood the server
      if (now - lastBroadcast < BROADCAST_INTERVAL && !isGood) return;
      lastBroadcast = now;

      const point = {
        userId: session.user.id,
        lat: best.lat,
        lng: best.lng,
        accuracy: best.accuracy,
        speed: best.speed,
        heading: best.heading,
        timestamp: new Date().toISOString(),
      };

      socketRef.current?.emit("gps:update", point);
      setGpsPositions((old) => ({
        ...old,
        [session.user.id]: { ...point, offline: false },
      }));

      const accuracyLabel = best.accuracy <= ACCURACY_GOOD
        ? `±${Math.round(best.accuracy)} m (good)`
        : `±${Math.round(best.accuracy)} m`;
      setNotice(`GPS live — ${accuracyLabel}`);
      setTimeout(() => setNotice(""), 4000);
    };

    const onError = (error) => {
      if (gpsWatchRef.current != null)
        navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
      gpsBestRef.current = null;
      setSharingGps(false);
      if (isAgent) setGpsRequiredBlocked(true);
      setNotice(error.code === 1
        ? "Location permission was denied — enable location in your browser settings and try again"
        : "A valid location could not be obtained — check GPS and try again");
    };

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      onPosition,
      onError,
      {
        enableHighAccuracy: true,
        maximumAge: 0,        // never use a cached position
        timeout: 20000,       // allow longer to get a proper fix
      },
    );
  };
  useEffect(() => {
    if (isAgent && !sharingGps) toggleGps();
  }, []);
  useEffect(() => () => clearTimeout(sosHoldTimerRef.current), []);
  const locateMe = () => {
    const flyToPoint = (point, message = "Centered on your location") => {
      if (!point) return;
      mapRef.current?.flyTo([Number(point.lat), Number(point.lng)], 17);
      setCoords(`${Number(point.lat).toFixed(6)}, ${Number(point.lng).toFixed(6)}`);
      setNotice(message);
      setTimeout(() => setNotice(""), 2500);
    };
    // Use the best GPS fix we already have if it's recent (< 10 s old)
    const best = gpsBestRef.current;
    if (best && (Date.now() - new Date(best.timestamp).getTime()) < 10000) {
      flyToPoint(best, `Centered on your location ±${Math.round(best.accuracy)} m`);
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          flyToPoint({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }, `Centered on your location ±${Math.round(position.coords.accuracy)} m`),
        () =>
          flyToPoint(
            gpsPositions[session.user.id] || session.user,
            "Centered on last known location",
          ),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      );
      return;
    }
    flyToPoint(gpsPositions[session.user.id] || session.user, "Centered on last known location");
  };
  const sendEmergency = async (details) => {
    const verified = gpsBestRef.current;
    const verifiedFresh = verified && Date.now() - new Date(verified.timestamp).getTime() < 30000;
    const fallback = (verifiedFresh ? verified : null) || gpsPositions[session.user.id] || session.user;
    const dispatch = async (point) => {
      const alert = {
        id: `em-${Date.now()}`,
        userId: session.user.id,
        name: session.user.name,
        role: session.user.role,
        rank: session.user.rank,
        unit: session.user.unit,
        unitType: session.user.unitType,
        command: session.user.command,
        division: session.user.division,
        station: session.user.station,
        type: details.type || "Emergency",
        text: details.text || "",
        lat: Number(point.lat),
        lng: Number(point.lng),
        timestamp: new Date().toISOString(),
      };
      try {
        const saved = await request("/incidents", session.token, {
          method: "POST",
          body: JSON.stringify({
            title: `SOS - ${alert.type}`,
            description: `${alert.name}${alert.text ? `: ${alert.text}` : ""}`,
            reportType: "SOS-Emergency",
            severity: "Critical",
            status: "Open",
            lat: alert.lat,
            lng: alert.lng,
            assignedTo: "",
            visibleTo: [],
            media: [],
            style: {
              source: "sos",
              icon: "SOS",
              color: "#dc2626",
              fillColor: "#ef4444",
              opacity: 0.95,
            },
          }),
        });
        alert.incidentId = saved.id;
        setIncidents((old) =>
          old.some((item) => item.id === saved.id) ? old : [saved, ...old],
        );
      } catch (error) {
        setNotice(error.message || "SOS sent, but could not store incident");
      }
      socketRef.current?.emit("emergency:send", alert);
      setEmergencyOpen(false);
      setEmergencyAlerts((old) => [alert, ...old].slice(0, 12));
      setNotice("Emergency alert sent to app users");
      mapRef.current?.flyTo([alert.lat, alert.lng], 17);
    };
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        (p) => dispatch(
          p.coords.accuracy <= 100
            ? { lat: p.coords.latitude, lng: p.coords.longitude }
            : { lat: fallback.lat || OYO_CENTER[0], lng: fallback.lng || OYO_CENTER[1] },
        ),
        () =>
          dispatch({
            lat: fallback.lat || OYO_CENTER[0],
            lng: fallback.lng || OYO_CENTER[1],
          }),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
      );
    else
      dispatch({
        lat: fallback.lat || OYO_CENTER[0],
        lng: fallback.lng || OYO_CENTER[1],
      });
  };
  const startSosHold = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearTimeout(sosHoldTimerRef.current);
    sosLongTriggeredRef.current = false;
    setSosHolding(true);
    sosHoldTimerRef.current = setTimeout(() => {
      sosLongTriggeredRef.current = true;
      setSosHolding(false);
      sendEmergency({ type: "Emergency", text: "" });
    }, 5000);
  };
  const cancelSosHold = () => {
    clearTimeout(sosHoldTimerRef.current);
    sosHoldTimerRef.current = null;
    setSosHolding(false);
  };
  const openSosNormally = (event) => {
    if (sosLongTriggeredRef.current) {
      event.preventDefault();
      sosLongTriggeredRef.current = false;
      return;
    }
    setEmergencyOpen(true);
  };
  const sosHoldProps = {
    onPointerDown: startSosHold,
    onPointerUp: cancelSosHold,
    onPointerCancel: cancelSosHold,
    onPointerLeave: cancelSosHold,
    onContextMenu: (event) => event.preventDefault(),
    onClick: openSosNormally,
  };
  const dismissEmergency = () => {
    stopEmergencyRing();
    setActiveEmergency(null);
  };
  const deleteEmergency = (alert) => {
    stopEmergencyRing();
    setEmergencyAlerts((old) => old.filter((item) => item.id !== alert.id));
    setActiveEmergency((old) => (old?.id === alert.id ? null : old));
    setNotice("SOS removed from this map");
    setTimeout(() => setNotice(""), 2200);
  };
  const runAnalyticTool = async (tool) => {
    const points = incidents.filter(
      (item) =>
        Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)),
    );
    const clearAnalysis = () => {
      setAnalysisLayers([]);
      setMeasurePoints([]);
      setRoutePoints([]);
      setRouteResult(null);
    };
    if (tool === "Measure Distance") {
      clearAnalysis();
      setDrawMode("measure");
      return "Click points on the map. The yellow line will show the real measured distance.";
    }
    if (tool === "Aggregate Points") {
      clearAnalysis();
      const counts = points.reduce(
        (acc, item) => ({
          ...acc,
          [item.reportType || "Incident"]:
            (acc[item.reportType || "Incident"] || 0) + 1,
        }),
        {},
      );
      setAnalysisLayers(
        Object.entries(counts).map(([key, value], index) => ({
          type: "marker",
          center: [OYO_CENTER[0] + index * 0.03, OYO_CENTER[1] + index * 0.03],
          radius: 7 + value,
          color: REPORT_TYPE_STYLES[key]?.color || "#38bdf8",
          fillColor: REPORT_TYPE_STYLES[key]?.fillColor || "#38bdf8",
          fillOpacity: 0.45,
          label: `${key}: ${value}`,
        })),
      );
      return (
        Object.entries(counts)
          .map(([key, value]) => `${key}: ${value}`)
          .join(" - ") || "No incident points to aggregate"
      );
    }
    if (tool === "Calculate Density") {
      clearAnalysis();
      setAnalysisLayers(
        points.slice(0, 60).map((item) => {
          const neighbors = points.filter(
            (other) =>
              L.latLng(item.lat, item.lng).distanceTo([other.lat, other.lng]) <=
              3000,
          ).length;
          return {
            type: "circle",
            center: [item.lat, item.lng],
            radius: 250 + neighbors * 120,
            color: "#f59e0b",
            fillColor: "#f59e0b",
            fillOpacity: Math.min(0.08 + neighbors * 0.025, 0.45),
            label: `${neighbors} incidents within 3 km`,
          };
        }),
      );
      return `Drew density rings for ${Math.min(points.length, 60)} incident points. Approx overall density: ${(points.length / 28000).toFixed(4)} points/km-`;
    }
    if (tool === "Create Buffers") {
      clearAnalysis();
      setAnalysisLayers(
        points
          .slice(0, 25)
          .map((item) => ({
            type: "circle",
            center: [item.lat, item.lng],
            radius: 500,
            color: "#38bdf8",
            fillColor: "#38bdf8",
            fillOpacity: 0.12,
            label: `500m buffer: ${item.title}`,
          })),
      );
      return `Drew 500m buffers for ${Math.min(points.length, 25)} incident points`;
    }
    if (tool === "Measure Buffer") {
      clearAnalysis();
      setDrawMode("circle");
      return "Click a center point, then click the buffer edge. It will open the incident form with that circle area.";
    }
    if (tool === "Create Drive-Time Areas") {
      clearAnalysis();
      setDrawMode("route");
      return "Click a start point and destination. The green road route and travel estimate will appear on the map.";
    }
    if (tool === "Extract Data") {
      const csv = [
        "title,type,severity,status,lat,lng",
        ...points.map((item) =>
          [
            item.title,
            item.reportType,
            item.severity,
            item.status,
            item.lat,
            item.lng,
          ]
            .map((value) => `"${String(value || "").replace(/"/g, '""')}"`)
            .join(","),
        ),
      ].join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `election-monitor-incident-export-${Date.now()}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return `Downloaded CSV with ${points.length} incidents. Field personnel: ${officers.length}. Map layers: ${mapLayers.length}.`;
    }
    if (tool === "Find Hot Spots") {
      clearAnalysis();
      const hot = points
        .map((item) => ({
          ...item,
          neighbors: points.filter(
            (other) =>
              L.latLng(item.lat, item.lng).distanceTo([other.lat, other.lng]) <=
              2500,
          ).length,
        }))
        .filter((item) => item.neighbors > 1)
        .sort((a, b) => b.neighbors - a.neighbors)
        .slice(0, 8);
      setAnalysisLayers(
        hot.map((item) => ({
          type: "circle",
          center: [item.lat, item.lng],
          radius: 650 + item.neighbors * 120,
          color: "#ef4444",
          fillColor: "#ef4444",
          fillOpacity: 0.22,
          label: `Hot spot: ${item.neighbors} nearby incidents`,
        })),
      );
      return hot.length
        ? `Drew ${hot.length} hot spot areas. Top has ${hot[0].neighbors} nearby incidents.`
        : "No hot spot found yet. Need incidents close together.";
    }
    if (tool === "Find Nearest") {
      clearAnalysis();
      const base = selected || mapRef.current?.getCenter();
      if (!base) return "Select an incident or center the map first";
      const nearest = officers
        .map((o) => ({
          ...o,
          distance: L.latLng(base.lat, base.lng).distanceTo([o.lat, o.lng]),
        }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (nearest)
        setAnalysisLayers([
          {
            type: "line",
            points: [
              [base.lat, base.lng],
              [nearest.lat, nearest.lng],
            ],
            color: "#22c55e",
            weight: 4,
            label: `Nearest: ${nearest.name} - ${formatDistance(nearest.distance)}`,
          },
          {
            type: "marker",
            center: [nearest.lat, nearest.lng],
            radius: 9,
            color: "#22c55e",
            fillColor: "#22c55e",
            label: nearest.name,
          },
        ]);
      return nearest
        ? `Nearest responder: ${nearest.name} - ${formatDistance(nearest.distance)}. Green line drawn.`
        : "No field responders available";
    }
    if (tool === "Summarize Nearby") {
      clearAnalysis();
      const center = selected || mapRef.current?.getCenter();
      if (!center) return "Select an incident or center the map first";
      const nearby = points.filter(
        (item) =>
          L.latLng(center.lat, center.lng).distanceTo([item.lat, item.lng]) <=
          5000,
      );
      setAnalysisLayers([
        {
          type: "circle",
          center: [center.lat, center.lng],
          radius: 5000,
          color: "#a855f7",
          fillColor: "#a855f7",
          fillOpacity: 0.12,
          label: `${nearby.length} incidents within 5 km`,
        },
      ]);
      return `${nearby.length} incidents within 5 km. Purple circle drawn.`;
    }
    if (tool === "Geo-Lookup") {
      clearAnalysis();
      const center = mapRef.current?.getCenter();
      if (!center) return "Map center not available";
      const data = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${center.lat}&lon=${center.lng}`,
      )
        .then((r) => r.json())
        .catch(() => null);
      setAnalysisLayers([
        {
          type: "marker",
          center: [center.lat, center.lng],
          radius: 10,
          color: "#38bdf8",
          fillColor: "#38bdf8",
          label:
            data?.display_name ||
            `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`,
        },
      ]);
      return (
        data?.display_name ||
        `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`
      );
    }
    setDrawMode("measure");
    return "Click points on the map to measure distance";
  };
  const importCsvPoints = (file, setResult) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result || "")
        .split(/\r?\n/)
        .filter(Boolean);
      const headers =
        lines
          .shift()
          ?.split(",")
          .map((x) => x.trim().toLowerCase()) || [];
      const latIndex = headers.findIndex((x) =>
        ["lat", "latitude", "y"].includes(x),
      );
      const lngIndex = headers.findIndex((x) =>
        ["lon", "lng", "longitude", "x"].includes(x),
      );
      if (latIndex < 0 || lngIndex < 0)
        return setResult("CSV needs latitude/longitude columns");
      const features = lines
        .map((line) => line.split(","))
        .map((cols) => ({
          lat: Number(cols[latIndex]),
          lng: Number(cols[lngIndex]),
          cols,
        }))
        .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng))
        .map((row, index) => ({
          type: "Feature",
          properties: { name: row.cols[0] || `CSV point ${index + 1}` },
          geometry: { type: "Point", coordinates: [row.lng, row.lat] },
        }));
      const layer = {
        id: `csv-${Date.now()}`,
        name: file.name.replace(/\.csv$/i, ""),
        type: "geojson",
        category: "Point",
        operationalUse: "CSV Plot Points",
        color: "#22c55e",
        pointIcon: "place",
        pointIconColor: "#ffffff",
        pointSize: 18,
        data: { type: "FeatureCollection", features },
        visible: true,
        opacity: 0.85,
      };
      setMapLayers((old) => [layer, ...old]);
      if (features.length)
        mapRef.current?.fitBounds(L.geoJSON(layer.data).getBounds().pad(0.12));
      setResult(`Plotted ${features.length} CSV points on the map`);
    };
    reader.readAsText(file);
  };
  const openStreetPhotos = () => {
    const center = mapRef.current?.getCenter();
    if (!center) return;
    window.open(
      `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${center.lat},${center.lng}`,
      "_blank",
      "noopener,noreferrer",
    );
  };
  const shareMap = async (custom = {}) => {
    try {
      setNotice("Creating map screenshot...");
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(mapRef.current.getContainer(), {
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#09131e",
        logging: false,
      });
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png", 0.95),
      );
      if (!blob) throw new Error("Screenshot could not be created");
      const file = new File(
        [blob],
        `${custom.filePrefix || "Election-Monitor"}-${selected?.id || Date.now()}.png`,
        { type: "image/png" },
      );
      const shareData = {
        title:
          custom.title ||
          (selected ? `Incident: ${selected.title}` : "Election monitoring map"),
        text:
          custom.text ||
          (selected
            ? `${selected.title} - ${selected.severity} - ${selected.status}`
            : "Election monitoring command map"),
        files: [file],
      };
      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare(shareData))
      ) {
        await navigator.share(shareData);
        setNotice("Map shared");
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setNotice(
          "Screenshot downloaded - attach it in WhatsApp, Facebook or other apps",
        );
      }
    } catch (error) {
      if (error.name !== "AbortError")
        setNotice(error.message || "Could not share this map");
    }
    setTimeout(() => setNotice(""), 3500);
  };
  const shareAreas = () => {
    const area = areas[areas.length - 1];
    if (!area) return setNotice("Draw an area first");
    shareMap({
      filePrefix: "election-monitor-area",
      title: area.title || "Election monitoring operational area",
      text: `${area.title || "Election monitoring operational area"}${area.note ? ` - ${area.note}` : ""}`,
    });
  };
  // Keep the device awake while camera is sharing
  const acquireWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          // Re-acquire if we lost it and still sharing (e.g. tab became visible again)
          if (sharingCameraRef.current) acquireWakeLock();
        });
      }
    } catch {}
  };
  const releaseWakeLock = () => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  };
  // Silent audio context trick — keeps JS alive in browsers that throttle hidden tabs
  const startSilentAudio = () => {
    if (silentAudioRef.current) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001; // Nearly silent
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      silentAudioRef.current = { ctx, oscillator };
    } catch {}
  };
  const stopSilentAudio = () => {
    try {
      silentAudioRef.current?.oscillator.stop();
      silentAudioRef.current?.ctx.close();
    } catch {}
    silentAudioRef.current = null;
  };
  const getCameraStream = async (facingMode, includeAudio = true, exact = false) => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
      throw new Error("Camera sharing requires HTTPS and a supported browser");
    return navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: exact ? { exact: facingMode } : { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: includeAudio,
    });
  };
  const toggleCamera = async () => {
    if (sharingCamera) {
      sharingCameraRef.current = false;
      stopOfflineVideoRecording();
      localCameraStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());
      localCameraStreamRef.current = null;
      Object.values(rtcPeersRef.current).forEach((pc) => pc.close());
      rtcPeersRef.current = {};
      socketRef.current?.emit("camera:share:stop", { userId: session.user.id });
      setSharingCamera(false);
      setSelfCameraPreview(false);
      setCameraMicMuted(false);
      setCameraLocation(null);
      cameraMicMutedRef.current = false;
      releaseWakeLock();
      stopSilentAudio();
      setNotice("Camera sharing stopped");
      return;
    }
    try {
      const stream = await getCameraStream(cameraFacingMode);
      localCameraStreamRef.current = stream;
      stream.getAudioTracks().forEach((track) => { track.enabled = true; });
      sharingCameraRef.current = true;
      setSharingCamera(true);
      setCameraMicMuted(false);
      cameraMicMutedRef.current = false;
      setSelfCameraPreview(cameraPreviewMode);
      acquireWakeLock();
      startSilentAudio();
      const cameraPoint = gpsBestRef.current || gpsPositions[session.user.id] || session.user;
      if (Number.isFinite(Number(cameraPoint?.lat)) && Number.isFinite(Number(cameraPoint?.lng))) {
        request(`/location/reverse?lat=${encodeURIComponent(cameraPoint.lat)}&lng=${encodeURIComponent(cameraPoint.lng)}`, session.token)
          .then(setCameraLocation)
          .catch(() => setCameraLocation(null));
      }
      socketRef.current?.emit("camera:share:start", {
        userId: session.user.id,
        name: session.user.name,
        type: "Phone",
        role: session.user.role,
        email: session.user.email,
        lga: session.user.lga,
        ward: session.user.ward,
        pollingUnit: session.user.pollingUnit,
        station: session.user.station,
      });
      setNotice("Phone camera is live to command");
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (localCameraStreamRef.current !== stream) return;
        sharingCameraRef.current = false;
        stopOfflineVideoRecording();
        socketRef.current?.emit("camera:share:stop", { userId: session.user.id });
        setSharingCamera(false);
        setSelfCameraPreview(false);
        releaseWakeLock();
        stopSilentAudio();
      });
      if (!socketRef.current?.connected)
        startOfflineVideoRecording("Network connection unavailable");
    } catch (error) {
      setNotice(
        error.name === "NotAllowedError"
          ? "Camera permission was denied"
          : error.message || "Unable to start this camera",
      );
    }
    setTimeout(() => setNotice(""), 3000);
  };
  const toggleCameraMicrophone = () => {
    const audioTracks = localCameraStreamRef.current?.getAudioTracks() || [];
    if (!audioTracks.length) {
      setNotice("No microphone is available for this stream");
      setTimeout(() => setNotice(""), 2500);
      return;
    }
    const nextMuted = !cameraMicMuted;
    audioTracks.forEach((track) => { track.enabled = !nextMuted; });
    setCameraMicMuted(nextMuted);
    cameraMicMutedRef.current = nextMuted;
    setNotice(nextMuted ? "Microphone muted" : "Microphone live");
    setTimeout(() => setNotice(""), 2000);
  };
  const switchCamera = async () => {
    if (!sharingCamera || !localCameraStreamRef.current) return;
    const oldStream = localCameraStreamRef.current;
    const oldVideoTrack = oldStream.getVideoTracks()[0];
    const audioTracks = oldStream.getAudioTracks();
    const nextFacingMode = cameraFacingMode === "environment" ? "user" : "environment";
    try {
      oldVideoTrack?.stop();
      let cameraOnlyStream;
      try {
        cameraOnlyStream = await getCameraStream(nextFacingMode, false, true);
      } catch {
        cameraOnlyStream = await getCameraStream(nextFacingMode, false, false);
      }
      const nextVideoTrack = cameraOnlyStream.getVideoTracks()[0];
      if (!nextVideoTrack) throw new Error("The selected camera is unavailable");
      const nextStream = new MediaStream([nextVideoTrack, ...audioTracks]);
      localCameraStreamRef.current = nextStream;
      setCameraFacingMode(nextFacingMode);
      setSelfCameraPreview(false);
      Object.values(rtcPeersRef.current).forEach((pc) => {
        const videoSender = pc.getSenders().find((sender) => sender.track?.kind === "video");
        if (videoSender) videoSender.replaceTrack(nextVideoTrack);
      });
      setNotice(`${nextFacingMode === "user" ? "Front" : "Back"} camera active`);
      nextStream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (localCameraStreamRef.current !== nextStream) return;
        sharingCameraRef.current = false;
        stopOfflineVideoRecording();
        socketRef.current?.emit("camera:share:stop", { userId: session.user.id });
        setSharingCamera(false);
        setSelfCameraPreview(false);
        releaseWakeLock();
        stopSilentAudio();
      });
    } catch (error) {
      try {
        const restoredStream = await getCameraStream(cameraFacingMode);
        restoredStream.getAudioTracks().forEach((track) => { track.enabled = !cameraMicMuted; });
        localCameraStreamRef.current = restoredStream;
        Object.values(rtcPeersRef.current).forEach((pc) => {
          const videoSender = pc.getSenders().find((sender) => sender.track?.kind === "video");
          const audioSender = pc.getSenders().find((sender) => sender.track?.kind === "audio");
          if (videoSender) videoSender.replaceTrack(restoredStream.getVideoTracks()[0]);
          if (audioSender) audioSender.replaceTrack(restoredStream.getAudioTracks()[0]);
        });
      } catch {}
      setNotice(
        error.name === "NotAllowedError"
          ? "Camera permission was denied"
          : error.message || "Unable to switch camera",
      );
    }
    setTimeout(() => setNotice(""), 2500);
  };
  const createCamera = async (form) => {
    const camera = await request("/cameras", session.token, {
      method: "POST",
      body: JSON.stringify(form),
    });
    setCameras((old) =>
      old.some((x) => x.id === camera.id) ? old : [...old, camera],
    );
    setNotice("Camera feed registered");
  };
  const deleteCamera = async (camera) => {
    if (!window.confirm(`Delete camera "${camera.name}"?`)) return;
    await request(`/cameras/${camera.id}`, session.token, { method: "DELETE" });
    setCameras((old) => old.filter((x) => x.id !== camera.id));
  };
  const createMapLayer = async (form) => {
    const item = await request("/map-layers", session.token, {
      method: "POST",
      body: JSON.stringify(form),
    });
    setMapLayers((old) =>
      old.some((x) => x.id === item.id) ? old : [item, ...old],
    );
    setNotice("Map layer added");
    setTimeout(() => setNotice(""), 2500);
  };
  const updateMapLayer = async (id, changes) => {
    const before = mapLayers.find((layerItem) => layerItem.id === id);
    setMapLayers((old) =>
      old.map((layerItem) =>
        layerItem.id === id ? { ...layerItem, ...changes } : layerItem,
      ),
    );
    try {
      const updated = await request(`/map-layers/${id}`, session.token, {
        method: "PUT",
        body: JSON.stringify(changes),
      });
      setMapLayers((old) =>
        old.map((layerItem) => (layerItem.id === id ? updated : layerItem)),
      );
    } catch (err) {
      if (before)
        setMapLayers((old) =>
          old.map((layerItem) => (layerItem.id === id ? before : layerItem)),
        );
      setNotice("Could not save layer change");
      setTimeout(() => setNotice(""), 2500);
    }
  };
  const toggleMapLayer = (id, visible) => updateMapLayer(id, { visible });
  const updateLayerOpacity = (id, opacity) => updateMapLayer(id, { opacity });
  const deleteMapLayer = async (item) => {
    if (!window.confirm(`Delete map layer "${item.name}"?`)) return;
    await request(`/map-layers/${item.id}`, session.token, {
      method: "DELETE",
    });
    setMapLayers((old) => old.filter((x) => x.id !== item.id));
  };
  const viewPhoneCamera = (officerId) => {
    if (!socketRef.current?.connected) {
      setNotice("Realtime connection is offline. Please retry in a moment.");
      return;
    }
    socketRef.current.emit("camera:view:request", { officerId });
    setNotice("Connecting to live phone camera...");
    setTimeout(() => setNotice(""), 5000);
  };
  const mapCameras = useMemo(
    () => [
      ...cameras.map((c) => ({ ...c, feedType: c.type || "CCTV" })),
      ...phoneShares
        .map((feed) => {
          const officer = officers.find((o) => o.id === feed.userId);
          return officer
            ? {
                id: `phone-${feed.userId}`,
                name: feed.name,
                feedType: "Phone",
                lat: officer.lat,
                lng: officer.lng,
              }
            : null;
        })
        .filter(Boolean),
    ],
    [cameras, phoneShares, officers],
  );
  const showCameraOnMap = (feed) => {
    setCameraPanel(false);
    setTimeout(
      () =>
        mapRef.current?.flyTo(
          [Number(feed.lat), Number(feed.lng)],
          feed.feedType === "Drone" ? 16 : 17,
        ),
      80,
    );
  };
  const resizeSidebar = (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const move = (moveEvent) => {
      const maxWidth = Math.max(80, window.innerWidth - 80);
      const next = Math.min(
        maxWidth,
        Math.max(48, startWidth + moveEvent.clientX - startX),
      );
      setSidebarWidth(next);
      localStorage.setItem("sidebar-width", String(next));
      requestAnimationFrame(() => mapRef.current?.invalidateSize());
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("resizing-sidebar");
    };
    document.body.classList.add("resizing-sidebar");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <main className={`app-shell role-${session.user.role.toLowerCase().replaceAll(" ", "-")}`}>
      {operationsOpen && (
        <button
          className="operations-backdrop"
          onClick={() => setOperationsOpen(false)}
          aria-label="Close sidebar"
        ></button>
      )}
      {!isAgent && (
        <aside
          className={`command-sidebar ${operationsOpen ? "open" : ""}`}
          style={{ "--sidebar-width": `${sidebarWidth}px` }}
        >
          <div className="sidebar-brand">
            <div className="brand-small">
              <img className="sidebar-logo" src="/bsa-logo.png" alt="BSA Oyo Ahead logo" />
              <div>
                <b>Election Monitoring</b>
                <span>Command Center • Oyo</span>
              </div>
            </div>
            <button
              className="mobile-close"
              onClick={() => setOperationsOpen(false)}
            >
              <FaTimes />
            </button>
          </div>
          <div className="sidebar-user">
            <span>
              {session.user.name
                .split(" ")
                .map((x) => x[0])
                .join("")}
            </span>
            <div>
              <b>{session.user.name}</b>
              <small>
                {session.user.role === "Admin"
                  ? "Admin"
                  : session.user.role === "Super Admin"
                    ? "System Administrator"
                    : session.user.role}
              </small>
              {(session.user.role === "Admin" || session.user.role === "Super Admin") && (
                <span className="role-pill">
                  {session.user.role === "Super Admin" ? "SUPER ADMIN" : "ADMIN"}
                </span>
              )}
            </div>
            <div className="sidebar-user-actions">
              <button
                className="sidebar-user-btn"
                onClick={() => { setProfileOpen(true); setOperationsOpen(false); }}
                title="Profile"
              >
                <FaKey />
              </button>
              <button
                className="sidebar-user-btn logout"
                onClick={onLogout}
                title="Logout"
              >
                <FaSignOutAlt />
              </button>
            </div>
          </div>
          <form className="sidebar-search" onSubmit={geocode}>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="14"
              height="14"
              style={{ flexShrink: 0, color: "#4e6a84" }}
            >
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="M15 15l-3-3" />
            </svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setSearch("")}
              >
                <FaTimes />
              </button>
            )}
          </form>
            <>
              {isSupervisor && <div className="sidebar-actions supervisor-actions">
                <button onClick={() => setSupervisorIncidentsOpen(true)}>
                  <FaChartBar /> Incident Queue
                </button>
                <button onClick={openPollingUnitResultForm}>
                  <ReportIcon iconKey="POI" size={15} /> Polling Result
                </button>
                <button onClick={openIncidentPointForm}>
                  <ReportIcon iconKey="IP" size={15} /> Report Incident
                </button>
                <button className={sharingGps ? "sharing" : ""} onClick={toggleGps}>
                  <FaBullseye /> {sharingGps ? "Stop GPS" : "Share GPS"}
                </button>
                <button className={sharingCamera ? "sharing" : ""} onClick={toggleCamera}>
                  <FaVideo /> {sharingCamera ? "Stop Camera" : "Share Camera"}
                </button>
                <button onClick={shareMap}><FaLocationArrow /> Share Map</button>
                <button className={`emergency-open ${sosHolding ? "sos-holding" : ""}`} {...sosHoldProps}>SOS</button>
                <button onClick={onLogout}><FaSignOutAlt /> Logout</button>
              </div>}
              {!isSupervisor && <div className="sidebar-actions compact">
                <button
                  onClick={() => {
                    setToolsOpen((value) => {
                      const next = !value;
                      if (next) {
                        setSituationalOpen(false);
                        setLiveIncidentsOpen(false);
                      }
                      return next;
                    });
                  }}
                  className={toolsOpen ? "active" : ""}
                >
                  <FaTools /> Tools
                </button>
                {toolsOpen && (
                  <DashboardToolsPanel
                    onClose={() => setToolsOpen(false)}
                    canAdmin={canAdmin}
                    canCreateIncidentAreas={canCreateCustomReportType}
                    canManagePersonnel={canManagePersonnel}
                    isSuperAdmin={session.user.role === "Super Admin"}
                    sharingGps={sharingGps}
                    sharingCamera={sharingCamera}
                    chatCount={chatRooms.length}
                    cameraCount={phoneShares.length + cameras.length}
                    mapLayerCount={mapLayers.length}
                    updateReady={updateReady}
                    drawMode={drawMode}
                    hasMapTools={hasMapTools}
                    hasAreas={areas.length > 0}
                    onMeasure={() => setMapDrawTool("measure")}
                    onRoute={() => setMapDrawTool("route")}
                    onCircleReport={() => setMapDrawTool("circle")}
                    onFreehandReport={() => setMapDrawTool("freehand")}
                    onClearMapTools={clearMapTools}
                    onShareAreas={shareAreas}
                    onClearAreas={clearAreas}
                    onManageOfficers={() => setManageOfficers(true)}
                    onMapData={() => setMapDataPanel(true)}
                    onGps={toggleGps}
                    onCameraShare={toggleCamera}
                    onCameras={() => setCameraPanel(true)}
                    onChat={() => setChatPanel(true)}
                    onRefresh={refreshApp}
                    onPassword={() => { setProfileOpen(true); setOperationsOpen(false); }}
                  />
                )}
                <button onClick={() => setResultsOpen(true)}>
                  <FaChartBar /> Results & Forecast
                </button>
                {canAdmin && (
                  <button onClick={() => setPartyManagerOpen(true)}>
                    <FaUserCog /> Political Parties
                  </button>
                )}
              </div>}
              <div className="sidebar-dropdown-section situational-section officer-summary">
                <button
                  className={`sidebar-section-toggle sidebar-nav-dropdown situational-toggle ${situationalOpen ? "open" : ""}`}
                  aria-expanded={situationalOpen}
                  onClick={() => setSituationalOpen((value) => {
                    const next = !value;
                    if (next) {
                      setLiveIncidentsOpen(false);
                      setToolsOpen(false);
                    }
                    return next;
                  })}
                >
                  <h3>Users</h3>
                  <span>{situationalOpen ? "−" : "+"}</span>
                </button>
                {situationalOpen && (
                  <div className="sidebar-dropdown-body">
                    {officers.map((o) => (
                      <div className="officer-row" key={o.id}>
                        <i className={o.status.toLowerCase()}></i>
                        <div>
                          <b>{o.rank ? `${o.rank} ${o.name}` : o.name}</b>
                          <small>{o.unit}</small>
                        </div>
                        <span>{o.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="sidebar-dropdown-section live-section">
                <button
                  className={`sidebar-section-toggle sidebar-nav-dropdown live-toggle ${liveIncidentsOpen ? "open" : ""}`}
                  aria-expanded={liveIncidentsOpen}
                  onClick={() => setLiveIncidentsOpen((value) => {
                    const next = !value;
                    if (next) {
                      setSituationalOpen(false);
                      setToolsOpen(false);
                    }
                    return next;
                  })}
                >
                  <h2>Live Incidence <em>{incidents.length}</em></h2>
                  <span>{liveIncidentsOpen ? "−" : "+"}</span>
                </button>
                {liveIncidentsOpen && (
                  <div className="sidebar-dropdown-body">
                    <div className="filters">
                      {["All", "Critical", "High", "Open"].map((x) => (
                        <button
                          className={filter === x ? "active" : ""}
                          onClick={() => setFilter(x)}
                          key={x}
                        >
                          {x}
                        </button>
                      ))}
                    </div>
                    <div className="incident-list">
                      {visible.map((item) => (
                        <button
                          className={`incident-card ${selected?.id === item.id ? "selected" : ""}`}
                          onClick={() => {
                            setSelected(item);
                            setOperationsOpen(false);
                          }}
                          key={item.id}
                        >
                          <span
                            className="severity"
                            style={{ background: reportStyle(item).color }}
                          ></span>
                          <div>
                            <div className="card-top">
                              <b>{item.title}</b>
                              <time>
                                {new Date(item.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </time>
                            </div>
                            <p>{item.description}</p>
                            <div className="chips">
                              <span
                                className="report-type-chip"
                                aria-label={item.reportType || "Incident"}
                              >
                                <ReportTypeIcon
                                  type={item.reportType}
                                  size={12}
                                  color={reportStyle(item).color}
                                />
                                <em>{item.reportType || "Incident"}</em>
                              </span>
                              <span>{item.status}</span>
                              <span>
                                {officers
                                  .find((x) => x.id === item.assignedTo)
                                  ?.name.split(" ")[1] || "Unassigned"}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          <button
            className="sidebar-resizer"
            onPointerDown={resizeSidebar}
            aria-label="Resize sidebar"
            title="Drag to resize sidebar"
          ></button>
        </aside>
      )}
      <section className="map-wrap">
        <button
          className="mobile-menu-fab"
          onClick={() => setOperationsOpen(true)}
          title="Open menu"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <rect x="2" y="4" width="16" height="2" rx="1" />
            <rect x="2" y="9" width="16" height="2" rx="1" />
            <rect x="2" y="14" width="16" height="2" rx="1" />
          </svg>
          <span>{incidents.length > 0 ? incidents.length : ""}</span>
        </button>
        <div className="map-top-controls" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <div className="map-top-left">
            {!isFieldRole && <div className={`map-home-menu home-menu ${mapMenu === "home" ? "open" : ""}`}>
              <button
                className="map-menu-trigger"
                type="button"
                title="Map home and display"
                onClick={() => setMapMenu((value) => (value === "home" ? "" : "home"))}
              >
                <FaHome />
              </button>
              <div className="map-home-dropdown">
                <button
                  onClick={() => {
                    focusDefaultExtent();
                    setMapMenu("");
                  }}
                >
                  Default Extent
                </button>
                <button
                  className={!showReports ? "active" : ""}
                  onClick={() => {
                    setShowReports((value) => !value);
                    setMapMenu("");
                  }}
                >
                   Incidents <span>{showReports ? "Hide" : "Show"}</span>
                </button>
                <button
                  className={!showSosIncidents ? "active" : ""}
                  onClick={() => {
                    setShowSosIncidents((value) => !value);
                    setMapMenu("");
                  }}
                >
                   SOS <span>{showSosIncidents ? "Hide" : "Show"}</span>
                </button>
                <button
                  className={(showStateBorders || showLgaBorders) ? "active" : ""}
                  onClick={() => {
                    const next = !(showStateBorders || showLgaBorders);
                    setShowStateBorders(next);
                    setShowLgaBorders(next);
                    setMapMenu("");
                  }}
                >
                  Borders <span>{showStateBorders || showLgaBorders ? "Hide" : "Show"}</span>
                </button>
                <button
                  className={showBoundaryNames ? "active" : ""}
                  disabled={!showStateBorders && !showLgaBorders}
                  onClick={() => {
                    setShowBoundaryNames(value => !value);
                    setMapMenu("");
                  }}
                  title={showBoundaryNames ? "Hide boundary labels" : "Show boundary labels"}
                >
                  <span>Labels</span>
                  <span>{showBoundaryNames ? "Hide" : "Show"}</span>
                </button>
              </div>
            </div>}
            {!isAgent && <div className={`map-home-menu incident-menu ${mapMenu === "incident" ? "open" : ""}`}>
              <button
                className="map-menu-trigger"
                type="button"
                title="New incident"
                onClick={() => {
                  if (!canCreateCustomReportType && !isSupervisor) {
                    openIncidentPointForm();
                    return;
                  }
                  setMapMenu((value) => (value === "incident" ? "" : "incident"));
                }}
              >
                <ReportIcon iconKey="IP" size={14} />
              </button>
              {(canCreateCustomReportType || isSupervisor) && (
                <div className="map-home-dropdown">
                  {(canCreateCustomReportType || isSupervisor) && <button
                    onClick={() => {
                      pickIncidentPoint();
                      setMapMenu("");
                    }}
                  >
                    <ReportIcon iconKey="IP" size={14} /> Point
                  </button>}
                  {(canCreateCustomReportType || isSupervisor) && <button
                    onClick={() => {
                      openPollingUnitResultForm();
                      setMapMenu("");
                    }}
                  >
                    <ReportIcon iconKey="POI" size={14} /> Polling Unit Result
                  </button>}
                  <button
                    onClick={() => {
                      startIncidentArea("circle");
                      setMapMenu("");
                    }}
                  >
                    <FaCircle /> Buffer
                  </button>
                  <button
                    onClick={() => {
                      startIncidentArea("freehand");
                      setMapMenu("");
                    }}
                  >
                    <FaDrawPolygon /> Freehand
                  </button>
                </div>
              )}
            </div>}
            {!isFieldRole && <div className={`map-home-menu map-layer-menu ${mapMenu === "layers" ? "open" : ""}`}>
              <button
                className="map-menu-trigger"
                type="button"
                title="Base map"
                onClick={() => setMapMenu((value) => (value === "layers" ? "" : "layers"))}
              >
                <FaMapMarkedAlt />
              </button>
              <div className="map-home-dropdown">
                <label className="map-layer-select-label">
                  <span>BASE MAP</span>
                  <select
                    value={layer}
                    onChange={(e) => {
                      setLayer(e.target.value);
                      setMapMenu("");
                    }}
                  >
                    {MAP_LAYERS.map((x) => (
                      <option value={x.key} key={x.key} title={x.title}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>}
            {!isFieldRole && <button
              className="map-action street-view-tool icon-only"
              onClick={openStreetPhotos}
              title="Street View"
            >
              <FaStreetView />
            </button>}
            {!isFieldRole && hasMapTools && (
              <button
                className={`map-action clear-tools-btn ${drawMode || measurePoints.length || routePoints.length || analysisLayers.length ? "active" : ""}`}
                onClick={() => {
                  clearMapTools();
                }}
                title="Clear tools"
              >
                <FaEraser />
              </button>
            )}
            <button
              className={`map-action share-location-action ${sharingGps ? "active" : ""}`}
              onClick={toggleGps}
              title={sharingGps ? "Stop location sharing" : "Share location"}
            >
              <LuLocateFixed />
            </button>
            <button
              className={`map-action camera-share-action ${sharingCamera ? "active" : ""}`}
              onClick={toggleCamera}
              title={sharingCamera ? "Stop camera sharing" : "Share camera"}
            >
              <FaVideo />
            </button>
            <button
              className="map-action result-center-open"
              onClick={() => setResultsOpen(true)}
              title="Actions, reports, results, forecast, and news"
            >
              Dashboard
            </button>
           
           
           
            {canAdmin && (
              <button
                className="map-action camera-count"
                onClick={() => setCameraPanel(true)}
                title="Cameras"
              >
                <FaCamera />
                <i>{phoneShares.length + cameras.length}</i>
              </button>
            )}
            {!isAgent && <button
              className="map-action share-map-action"
              onClick={() => shareMap()}
              title="Share map"
            >
              <FaLocationArrow />
            </button>}
            {isAgent && <button
              className="map-action result-report-action"
              onClick={openPollingUnitResultForm}
              title="Report polling unit result"
            >
              Result
            </button>}
            <button
              className={`map-action emergency-open ${sosHolding ? "sos-holding" : ""}`}
              {...sosHoldProps}
              title="Tap for SOS form or hold 5 seconds to send immediately"
            >
              SOS
            </button>
          </div>
          <div className="map-top-right">
            <NotificationCenter notifications={notifications} onOpen={openNotification} />
            {!isFieldRole && <form className="coord-jump" onSubmit={jump}>
              <span>COORD</span>
              <input
                value={coords}
                onChange={(e) => setCoords(e.target.value)}
                placeholder="7.3775, 3.9470"
              />
              <button>GO</button>
            </form>}
            {selectedBoundaryLabel && showBoundaryLayer && (
              <div className="boundary-info-card">
                <strong>Selected</strong>
                <span>{selectedBoundaryLabel}</span>
              </div>
            )}
            <div className={`profile-menu ${profileMenuOpen ? "open" : ""}`}>
              <button className="map-action logout-btn" onClick={() => setProfileMenuOpen(value => !value)} title="Profile menu"><span>{session.user.name?.[0] || "U"}</span></button>
              <div className="profile-dropdown"><div><b>{session.user.name}</b><small>{session.user.role}</small></div><button onClick={() => setProfileOpen(true)}><FaKey /> Profile</button><button onClick={onLogout}><FaSignOutAlt /> Logout</button></div>
            </div>
          </div>
        </div>
        {isAgent && <div className="agent-field-screen">
          <div className="agent-notification-anchor"><NotificationCenter notifications={notifications} onOpen={openNotification} /></div>
          <img className="agent-brand-logo" src="/bsa-logo.png" alt="BSA Oyo Ahead logo" />
          <span className="eyebrow">FIELD REPORTING</span>
          <h1>{session.user.pollingUnit || "Polling unit agent"}</h1>
          <p>{[session.user.lga, session.user.ward].filter(Boolean).join(" • ")}</p>
          <div className="agent-action-grid">
            <button className="agent-action-card result" onClick={openPollingUnitResultForm}>
              <ReportIcon iconKey="POI" size={22} />
              <b>Report result</b>
              <span>Add counts and signed-result photo</span>
            </button>
            <button className={`agent-action-card ${sharingGps ? "active" : ""}`} onClick={toggleGps}>
              <LuLocateFixed />
              <b>{sharingGps ? "Stop GPS" : "Share GPS & location"}</b>
              <span>{sharingGps ? "Your live position is being shared" : "Send your current field position"}</span>
            </button>
            <button className={`agent-action-card ${sharingCamera ? "active" : ""}`} onClick={toggleCamera}>
              <FaVideo />
              <b>{sharingCamera ? "Stop camera" : "Share camera"}</b>
              <span>Send your live phone camera to command</span>
            </button>
            <button className={`agent-action-card sos ${sosHolding ? "sos-holding" : ""}`} {...sosHoldProps}>
              <strong>SOS</strong>
              <b>Send emergency alert</b>
              <span>Alert your command immediately and provide a situation report</span>
            </button>
          </div>
          <button className="agent-logout" onClick={onLogout}><FaSignOutAlt /> Logout</button>
        </div>}
        {!isAgent && <MapView
          incidents={mapVisibleIncidents}
          officers={officers}
          cameras={mapCameras}
          mapLayers={mapLayers}
          emergencyAlerts={showSosIncidents ? emergencyAlerts : []}
          analysisLayers={analysisLayers}
          selected={selected}
          onSelect={setSelected}
          onMapClick={(p, copyOnly) => {
            setCoords(`${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`);
            navigator.clipboard?.writeText(
              `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`,
            );
            if (!copyOnly) setNewPoint(p);
          }}
          mapRef={mapRef}
          layer={layer}
          drawMode={drawMode}
          areas={areas}
          measurePoints={measurePoints}
          routePoints={routePoints}
          routeResult={routeResult}
          routeUserPoint={routeUserPoint}
          onAreaCreated={addArea}
          onToolPoint={addToolPoint}
          onMarkerTool={startToolFromPoint}
          isAdmin={canAdmin}
          onLayerToggle={toggleMapLayer}
          onLayerOpacity={updateLayerOpacity}
          showBoundaryLayer={showBoundaryLayer}
          showStateBorders={showStateBorders}
          showLgaBorders={showLgaBorders}
          showBoundaryNames={showBoundaryNames}
          partyMapAnalysis={partyMapAnalysis}
          historicalMapAnalysis={historicalMapAnalysis}
          onHistoricalLgaSelect={selectHistoricalLga}
          onHistoricalWardSelect={selectHistoricalWard}
          onHistoricalPollingUnitSelect={selectHistoricalPollingUnit}
          onHistoricalBack={backHistoricalMap}
          onHistoricalClose={() => setHistoricalMapAnalysis(null)}
          selectedBoundaryState={selectedBoundaryState}
          onBoundarySelect={(id, label) => {
            setSelectedBoundaryState(id);
            setSelectedBoundaryLabel(label);
          }}
          onBoundaryClear={clearBoundarySelection}
        />}
        {!isAgent && <button
          className="my-location-target"
          onClick={locateMe}
          title="Locate me"
        >
          <LuLocateFixed />
        </button>}
      </section>
      {selfCameraPreview && localCameraStreamRef.current && (
        <div className="self-camera-preview">
          <div className="self-camera-preview-head">
            <b><i></i> LIVE</b>
            <div className="self-camera-preview-actions">
              <button type="button" className={cameraMicMuted ? "mic-muted" : "mic-live"} title={cameraMicMuted ? "Unmute microphone" : "Mute microphone"} onClick={toggleCameraMicrophone}>
                {cameraMicMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                <span>{cameraMicMuted ? "Unmute" : "Mute"}</span>
              </button>
              <button
                type="button"
                title="Hide preview (keep sharing)"
                onClick={() => {
                  setCameraPreviewMode(false);
                  setSelfCameraPreview(false);
                }}
              >
                <FaEyeSlash />
                <span>Hide</span>
              </button>
              <button type="button" title="Switch camera" onClick={switchCamera}>
                <FaCamera />
                <span>Flip</span>
              </button>
              <button type="button" className="end-live-head" title="End live camera" onClick={toggleCamera}>
                <FaTimes />
                <span>End live</span>
              </button>
            </div>
          </div>
          <StreamVideo
            stream={localCameraStreamRef.current}
            muted={true}
            showControls={false}
            watermark={{
              ...session.user,
              ...(gpsPositions[session.user.id] || gpsBestRef.current || {}),
              location: cameraLocation,
            }}
          />
          <div className="self-camera-preview-footer">
            <span>{cameraFacingMode === "environment" ? "Back camera" : "Front camera"}</span>
            <button type="button" onClick={toggleCamera}><FaTimes /> End live</button>
          </div>
        </div>
      )}
      {sharingCamera && !selfCameraPreview && localCameraStreamRef.current && (
        <div className="camera-live-pill">
          <i></i>
          <span>LIVE</span>
          <button type="button" className={cameraMicMuted ? "mic-muted" : "mic-live"} title={cameraMicMuted ? "Unmute microphone" : "Mute microphone"} onClick={toggleCameraMicrophone}>
            {cameraMicMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
          </button>
          <button
            type="button"
            title="Show preview"
            onClick={() => {
              setCameraPreviewMode(true);
              setSelfCameraPreview(true);
            }}
          >
            <FaEye />
          </button>
          <button
            type="button"
            title="End camera"
            onClick={toggleCamera}
          >
            <FaTimes />
          </button>
        </div>
      )}
      {selected && (
        <section className="detail">
          <div className="panel-title">
            <div>
              <span className="eyebrow">
                INCIDENT {selected.id.toUpperCase()}
              </span>
              <h2>{selected.title}</h2>
            </div>
            <button className="icon-btn" onClick={() => setSelected(null)}>
              <FaTimes />
            </button>
          </div>
          <div className="detail-hero">
            {selected.reportType !== POLLING_RESULT_TYPE && (
              <span style={{ color: reportStyle(selected).color }}>
                <FaCircle size={10} /> {selected.severity.toUpperCase()}
              </span>
            )}
            <b>{selected.status}</b>
          </div>
          <div
            className="report-type-badge"
            title={selected.reportType || "IP-Incident Point"}
          >
            <ReportTypeIcon
              type={selected.reportType}
              size={14}
              color={reportStyle(selected).color}
            />
            <span>{selected.reportType || "IP-Incident Point"}</span>
          </div>
          <p>{selected.description || "No written notes added."}</p>
          {selected.reportType === POLLING_RESULT_TYPE && (
            <div className="report-result-summary">
              <b>Polling unit</b>
              <p>
                {selected.pollingUnit ||
                  String(selected.description || "")
                    .split("\n\nDeclared result counts:\n")[0]
                    ?.replace("Polling unit: ", "") ||
                  "Not provided"}
              </p>
              <b>{COMMAND_PARTY} votes</b>
              <pre>
                {selected.resultCount ||
                  String(selected.description || "")
                    .split(`\n\n${COMMAND_PARTY} vote count:\n`)[1] ||
                  `No ${COMMAND_PARTY} vote count was recorded yet.`}
              </pre>
            </div>
          )}
          {selected.media?.length > 0 && (
            <div className="report-media-grid">
              {selected.media.map((item, index) =>
                item.type === "video" ? (
                  <div className="report-video-attachment" key={index}>
                    <video controls playsInline preload="metadata">
                      <source
                        src={item.data}
                        type={
                          item.mimeType ||
                          (String(item.data || "").startsWith("data:video/mp4")
                            ? "video/mp4"
                            : "video/webm")
                        }
                      />
                    </video>
                    <a href={item.data} download={item.name || `report-video-${index + 1}.webm`}>
                      Download video
                    </a>
                  </div>
                ) : (
                  <img
                    key={index}
                    src={item.data}
                    alt={item.name || `Incident attachment ${index + 1}`}
                  />
                ),
              )}
            </div>
          )}
          <dl>
            <div>
              <dt>LOCATION</dt>
              <dd>
                {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
              </dd>
            </div>
            <div>
              <dt>MAP DISPLAY</dt>
              <dd>
                {hiddenReportIds.includes(selected.id)
                  ? "Hidden on your map"
                  : selected.geometry?.type
                    ? `${selected.geometry.type} area`
                    : "Visible point/area"}
              </dd>
            </div>
            <div>
              <dt>ASSIGNED UNIT</dt>
              <dd>
                {canAdmin ? (
                  <select
                    className="assign-select"
                    value={selected.assignedTo || ""}
                    onChange={async (e) => {
                      const item = await request(`/incidents/${selected.id}`, session.token, {
                        method: "PUT",
                        body: JSON.stringify({ assignedTo: e.target.value }),
                      });
                      setIncidents((old) => old.map((i) => (i.id === item.id ? item : i)));
                      setSelected(item);
                    }}
                  >
                    <option value="">— Unassigned —</option>
                    {users
                      .filter((u) => u.role === "Response Team")
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}{u.station ? ` · ${u.station}` : ""}
                        </option>
                      ))}
                    {users.filter((u) => u.role === "Agent").length > 0 && (
                      <optgroup label="── Agents ──">
                        {users
                          .filter((u) => u.role === "Agent")
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}{u.pollingUnit ? ` · ${u.pollingUnit}` : ""}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                ) : (
                  reportUsers.find((x) => x.id === selected.assignedTo)?.name ||
                  officers.find((x) => x.id === selected.assignedTo)?.name ||
                  "Unassigned"
                )}
              </dd>
            </div>
            <div>
              <dt>VISIBLE TO</dt>
              <dd>
                {canAdmin
                  ? "Administrators can see all incidents"
                  : "Assigned viewers only"}
                {selected.visibleTo?.length
                  ? ` - ${selected.visibleTo.map((id) => reportUsers.find((x) => x.id === id)?.name || id).join(", ")}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>INCIDENT TIME</dt>
              <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
          <label>
            Response status
            <select
              value={
                ["In Progress", "Resolved"].includes(selected.status)
                  ? selected.status
                  : "In Progress"
              }
              onChange={(e) => updateStatus(e.target.value)}
            >
              {["In Progress", "Resolved"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <button
            className="primary wide"
            onClick={() =>
              mapRef.current.flyTo([selected.lat, selected.lng], 17)
            }
          >
            Center on incident
          </button>
          <button
            className="ghost wide"
            onClick={() => toggleReportOnMap(selected)}
          >
            {hiddenReportIds.includes(selected.id)
              ? "Show incident on my map"
              : "Hide incident from my map"}
          </button>
          <div className="detail-tool-row">
            <button
              onClick={() =>
                startToolFromPoint("measure", {
                  lat: selected.lat,
                  lng: selected.lng,
                  label: selected.title,
                })
              }
            >
              Measure from incident
            </button>
            <button
              onClick={() =>
                startToolFromPoint("route", {
                  lat: selected.lat,
                  lng: selected.lng,
                  label: selected.title,
                })
              }
            >
              Route from incident
            </button>
          </div>
          <button
            className="share-map-tool wide"
            onClick={() =>
              shareMap({
                filePrefix: "election-monitor-incident",
                title: `Incident: ${selected.title}`,
                text: `${selected.title} - ${selected.reportType || "Incident"} - ${selected.severity} - ${selected.status}\nLocation: ${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}\n${selected.description || ""}`,
              })
            }
          >
            Share incident
          </button>
          <button
            className="primary wide"
            onClick={() => openIncidentChat(selected)}
          >
            Open incident chat
          </button>
          {(canAdmin || isSupervisor) && selected.reportType !== POLLING_RESULT_TYPE && (
            <button className="assignment-action wide" onClick={() => setAssignIncident(selected)}>
              Assign & notify field personnel
            </button>
          )}
          {canAdmin && (
            <button className="delete-incident wide" onClick={deleteIncident}>
              Delete incident
            </button>
          )}
        </section>
      )}
      {resultsOpen && <ResultsCenter incidents={incidents} parties={parties} officers={officers} personnel={users} mapLayers={mapLayers} selected={selected} onClose={() => setResultsOpen(false)} authToken={session.token} canAdmin={canAdmin} initialFocusParty={partyMapAnalysis?.party || ""} onPartyMapChange={setPartyMapAnalysis} onShowHistoricalMap={showHistoricalMap} onFocusLocation={(point) => { setResultsOpen(false); mapRef.current?.flyTo([point.lat, point.lng], 15); }} onTool={runAnalyticTool} onCsv={importCsvPoints} onClear={clearMapTools} />}
      {activeEmergency && (
        <div className="emergency-alert-card">
          <b>Emergency from {activeEmergency.name}</b>
          <span>
            {activeEmergency.type || "Emergency"}
            {activeEmergency.text ? ` - ${activeEmergency.text}` : ""}
          </span>
          <small>
            {activeEmergency.lat.toFixed(5)}, {activeEmergency.lng.toFixed(5)}
          </small>
          <div>
            <button
              onClick={() =>
                mapRef.current?.flyTo(
                  [activeEmergency.lat, activeEmergency.lng],
                  17,
                )
              }
            >
              Show location
            </button>
            <button onClick={dismissEmergency}>Dismiss</button>
            <button onClick={() => deleteEmergency(activeEmergency)}>
              Delete SOS
            </button>
          </div>
        </div>
      )}
      {newPoint && (
        <Suspense fallback={<div className="modal-backdrop"><div className="modal">Loading report form…</div></div>}>
          <IncidentForm
            point={newPoint}
            users={reportUsers}
            onClose={() => setNewPoint(null)}
            onSave={save}
            isAdmin={canCreateCustomReportType}
            currentUser={session.user}
          />
        </Suspense>
      )}
      {pendingAreaAction && (
        <div className="modal-backdrop">
          <section className="modal area-action-modal">
            <div className="panel-title">
              <div><span className="eyebrow">BUFFER / FREEHAND</span><h2>Choose an action</h2></div>
              <button className="icon-btn" onClick={() => setPendingAreaAction(null)}><FaTimes /></button>
            </div>
            <p className="muted">Search and aggregate everything inside this area, or use the area for a new incident report.</p>
            <div className="area-action-grid">
              <button className="primary" onClick={searchPendingArea}><FaSearch /> Search area</button>
              <button className="ghost" onClick={reportPendingArea}><ReportIcon iconKey="IP" size={15} /> Report incident</button>
            </div>
          </section>
        </div>
      )}
      {areaSearchResult && (
        <div className="modal-backdrop">
          <section className="modal area-search-result-modal">
            <div className="panel-title">
              <div><span className="eyebrow">AREA SEARCH RESULT</span><h2>Search summary</h2></div>
              <button className="icon-btn" onClick={() => setAreaSearchResult(null)}><FaTimes /></button>
            </div>
            <div className="area-search-kpis">
              <div><strong>{areaSearchResult.agents.length}</strong><span>Agents</span></div>
              <div><strong>{areaSearchResult.pollingUnits.length}</strong><span>Polling units</span></div>
              <div><strong>{areaSearchResult.incidents.length}</strong><span>Incidents</span></div>
              <div><strong>{areaSearchResult.mapLayerCount}</strong><span>Map layers</span></div>
            </div>
            {(areaSearchResult.radius || areaSearchResult.pollingUnits.length > 0) && (
              <div className="area-search-detail">
                {areaSearchResult.radius && <p>Radius: <b>{formatDistance(areaSearchResult.radius)}</b> · Diameter: <b>{formatDistance(areaSearchResult.diameter)}</b></p>}
                {areaSearchResult.pollingUnits.length > 0 && <p>Polling units: <b>{areaSearchResult.pollingUnits.join(", ")}</b></p>}
              </div>
            )}
            <div className="actions">
              <button className="ghost" onClick={() => saveAreaSearch(areaSearchResult)}>Save search</button>
              <button className="primary" onClick={() => shareAreaSearch(areaSearchResult)}><FaShareAlt /> Share</button>
            </div>
          </section>
        </div>
      )}
      {newResultPoint && <Suspense fallback={<div className="modal-backdrop"><div className="modal">Loading result form…</div></div>}><PollingResultForm user={session.user} point={newResultPoint} parties={parties} onClose={() => setNewResultPoint(null)} onSave={savePollingResult} /></Suspense>}
      {assignIncident && <AssignIncidentModal incident={assignIncident} users={users} currentUser={session.user} onClose={() => setAssignIncident(null)} onAssign={assignIncidentToField} />}
      {supervisorIncidentsOpen && isSupervisor && <SupervisorIncidentListModal incidents={incidents} currentUser={session.user} users={users} onClose={() => setSupervisorIncidentsOpen(false)} onAssign={assignIncidentToField} onClaim={claimIncident} />}
      {notificationDetail && <IncidentNotificationModal notification={notificationDetail.notification} incident={notificationDetail.incident} users={users} onClose={() => setNotificationDetail(null)} onOpenChat={async (incident) => { setNotificationDetail(null); await openIncidentChat(incident); }} onResolve={resolveNotificationIncident} />}
      {profileOpen && <ProfileModal session={session} onClose={() => setProfileOpen(false)} onSave={saveProfile} />}
      {ipLogOpen && canAdmin && (
        <div className="modal-backdrop" onClick={() => setIpLogOpen(false)}>
          <div className="modal ip-log-modal" onClick={e => e.stopPropagation()}>
            <div className="panel-title">
              <div>
                <span className="eyebrow">ADMIN TOOL</span>
                <h2>IP Address Log</h2>
              </div>
              <button className="icon-btn" onClick={() => setIpLogOpen(false)}><FaTimes /></button>
            </div>
            <p className="muted">Source IP addresses for all incident reports and SOS alerts.</p>
            <div className="ip-log-filters">
              {["all","incident","SOS","result"].map(f => (
                <button key={f} className={ipLogFilter === f ? "active" : ""} onClick={() => setIpLogFilter(f)}>
                  {f === "all" ? "All" : f === "SOS" ? "SOS" : f === "result" ? "Results" : "Incidents"}
                </button>
              ))}
              <button className="ip-log-refresh" onClick={fetchIpLog} title="Refresh">
                <FaSyncAlt />
              </button>
            </div>
            {ipLogLoading ? (
              <div className="ip-log-empty">Loading…</div>
            ) : ipLogData.filter(e => ipLogFilter === "all" || e.type === ipLogFilter).length === 0 ? (
              <div className="ip-log-empty">No entries yet.</div>
            ) : (
              <div className="ip-log-table-wrap">
                <table className="ip-log-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Type</th>
                      <th>User</th>
                      <th>Role</th>
                      <th>IP Address</th>
                      <th>Incident ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ipLogData
                      .filter(e => ipLogFilter === "all" || e.type === ipLogFilter)
                      .map((e, i) => (
                        <tr key={i} className={e.type === "SOS" ? "ip-log-sos" : e.type === "result" ? "ip-log-result" : ""}>
                          <td>{new Date(e.timestamp).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</td>
                          <td><span className={`ip-type-chip ip-type-${e.type}`}>{e.type}</span></td>
                          <td>{e.userName}</td>
                          <td>{e.userRole}</td>
                          <td><code>{e.ip}</code></td>
                          <td><code>{e.incidentId}</code></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {gpsRequiredBlocked && isAgent && <div className="modal-backdrop gps-required-gate"><div className="modal"><span className="eyebrow">LOCATION REQUIRED</span><h2>Allow Location</h2><p>Location sharing is mandatory for Agent accounts. The app will remain locked until you allow access and a valid location is received.</p><button className="primary wide" onClick={toggleGps} disabled={sharingGps}><LuLocateFixed /> {sharingGps ? "Waiting for Location…" : "Allow Location"}</button></div></div>}
      {partyManagerOpen && canAdmin && <Suspense fallback={<div className="modal-backdrop"><div className="modal">Loading party manager…</div></div>}><PartyManager parties={parties} onClose={() => setPartyManagerOpen(false)} onSave={saveParties} /></Suspense>}
      {emergencyOpen && (
        <DashboardEmergencyPanel
          onClose={() => setEmergencyOpen(false)}
          onSend={sendEmergency}
        />
      )}
      {manageOfficers && (
        <Suspense fallback={<div className="modal-backdrop"><div className="modal">Loading personnel manager…</div></div>}>
          <OfficerManager
            users={users}
            currentUser={session.user}
            onClose={() => setManageOfficers(false)}
            onCreate={createOfficer}
            onUpdate={updateOfficer}
            onDelete={deleteOfficer}
            onPassword={updateUserPassword}
            onRoleChange={changeUserRole}
          />
        </Suspense>
      )}
      {cameraPanel && (
        <Suspense fallback={<div className="modal-backdrop"><div className="modal">Loading camera panel…</div></div>}>
          <DashboardCameraPanel
            cameras={cameras}
            phoneShares={phoneShares}
            remoteStreams={remoteStreams}
            turnStatus={turnStatus}
            isAdmin={canAdmin}
            onClose={() => setCameraPanel(false)}
            onCreate={createCamera}
            onDelete={deleteCamera}
            onView={viewPhoneCamera}
            onShowMap={showCameraOnMap}
          />
        </Suspense>
      )}
      {mapDataPanel && (
        <DashboardMapDataPanel
          layers={mapLayers}
          isSuperAdmin={session.user.role === "Super Admin"}
          onClose={() => setMapDataPanel(false)}
          onCreate={createMapLayer}
          onUpdate={updateMapLayer}
          onDelete={deleteMapLayer}
        />
      )}
      {chatPanel && (
        <DashboardChatPanel
          rooms={chatRooms}
          activeRoom={activeRoom}
          messages={chatMessages}
          users={users}
          currentUser={session.user}
          isAdmin={canManagePersonnel}
          onClose={() => setChatPanel(false)}
          onCreateRoom={createChatRoom}
          onSelectRoom={selectChatRoom}
          onSend={sendChatMessage}
          onAddMember={addChatMember}
          onDeleteRoom={deleteChatRoom}
        />
      )}
      {notice && <Toast message={notice} />}
    </main>
  );
}

export default Dashboard;

