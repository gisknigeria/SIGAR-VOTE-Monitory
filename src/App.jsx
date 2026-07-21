import { useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import { io } from "socket.io-client";
import Hls from "hls.js";
import shp from "shpjs";
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
  FaRoute,
  FaRulerCombined,
  FaSignOutAlt,
  FaStreetView,
  FaSyncAlt,
  FaTimes,
  FaTools,
  FaUserCog,
  FaVideo,
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
  MdLocalPolice,
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
import { GiPoliceBadge } from "react-icons/gi";
import {
  OYO_COMMANDS,
  UNIT_TYPES,
  divisionsForCommand,
  normalizeCommand,
} from "../shared/policeData.js";

const API = "/api";
const OYO_CENTER = [7.3775, 3.947];
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
const OFFICER_POSITIONS = [
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
  "Police Zone": "Polygon",
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
  { key: "police", label: "Police", Component: MdLocalPolice },
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
  "Patrol Route",
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
const REPORT_TYPES = INCIDENT_TYPES;
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
  "STN-Station": {
    icon: "STN",
    color: "#16a34a",
    fillColor: "#4ade80",
    opacity: 0.8,
    fillOpacity: 0.14,
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
  "STN-Station": MdLocalPolice,
  "IP-Incident Point": MdLocationPin,
  "SOS-Emergency": MdWarning,
  BS: FaBullseye,
  KP: FaKey,
  VP: MdWarning,
  POI: MdPlace,
  STN: MdLocalPolice,
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
    "Draws a green line from the selected incident or map center to the nearest officer.",
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
  const title = `Emergency from ${alert.name || "officer"}`;
  const body = `${alert.type || "Emergency"}${alert.text ? ` - ${alert.text}` : ""}`;
  if ("Notification" in window && Notification.permission === "granted") {
    navigator.serviceWorker?.ready
      .then((reg) =>
        reg.showNotification(title, {
          body,
          tag: alert.id || "election-monitor-emergency",
          renotify: true,
          requireInteraction: true,
          icon: "/icons/icon.svg",
        }),
      )
      .catch(() => new Notification(title, { body, requireInteraction: true }));
  } else if ("Notification" in window && Notification.permission === "default")
    Notification.requestPermission().catch(() => {});
};

async function request(path, token, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.message || "Request failed");
  return body;
}

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
                        {layer.type === "raster" ? "Raster" : "GIS"} -{" "}
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

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  useEffect(() => {
    const beforeInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", beforeInstall);
  }, []);
  const installApp = async () => {
    if (!installPrompt) {
      setError(
        "Use your browser menu and choose Install app / Add to Home screen.",
      );
      return;
    }
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => {});
    setInstallPrompt(null);
  };
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      onLogin(
        await request("/auth/login", "", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }),
        rememberMe,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="login-shell">
      <section className="login-brand">
        <img className="campaign-logo" src="/bsa-logo.png" alt="BSA Oyo Ahead" />
        <p className="command-kicker">Election intelligence platform</p>
        <h1 className="command-title">Election Monitoring Command Center</h1>
        <p className="command-copy">
          Real-time monitoring, coordinated field operations and location-based election intelligence.
        </p>
        <div className="security-line">
          <MdLocationPin style={{ verticalAlign: "-2px" }} />{" "}
          Live field network • Oyo State
        </div>
      </section>
      <form className="login-card" onSubmit={submit}>
        <img className="login-card-logo" src="/bsa-logo.png" alt="BSA Oyo Ahead" />
        <div className="eyebrow">SECURE COMMAND ACCESS</div>
        <h2>Welcome back</h2>
        <p className="muted">Sign in with your authorized election operations credentials.</p>
        <label>
          Email address
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />
        </label>
        <label>
          Password
          <div className="password-wrap">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
            </button>
          </div>
        </label>
        <div className="remember-row">
          <label className="remember-label">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>Remember me</span>
          </label>
        </div>
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={loading}>
          {loading ? "Authenticating..." : "Enter command center →"}
        </button>
        <button type="button" className="install-login" onClick={installApp}>
          Install command center app
        </button>
        <p className="powered-by">Election Monitoring Command Center</p>
      </form>
    </main>
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
}) {
  const el = useRef(null);
  const leaflet = useRef(null);
  const overlays = useRef([]);
  const areaLayers = useRef([]);
  const customLayers = useRef([]);
  const toolLayers = useRef([]);
  const tile = useRef(null);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
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
                  `<div class="gis-popup"><strong>${label || layerItem.name}</strong><small>${layerItem.operationalUse || layerItem.category || "GIS layer"}</small>${rows}</div>`,
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
      if (drawMode !== "circle") return onMapClick(e.latlng);
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
    map.on("click", click);
    map.on("contextmenu", context);
    map.on("mousedown", down);
    map.on("mousemove", move);
    map.on("mouseup", up);
    map.getContainer().style.cursor = drawMode ? "crosshair" : "";
    return () => {
      map.off("click", click);
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

function IncidentForm({ point, users, onClose, onSave, isAdmin }) {
  const initialType = INCIDENT_TYPES[0];
  const initialStyle = {
    ...REPORT_TYPE_STYLES[initialType],
    ...(point.style || {}),
  };
  const center = reportCenter(point.geometry) || point;
  const [customTypes, setCustomTypes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("report-custom-types") || "[]");
    } catch {
      return [];
    }
  });
  const [customTypeName, setCustomTypeName] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    reportType: initialType,
    severity: "High",
    status: "Open",
    assignedTo: "",
    visibleTo: [],
    media: [],
    geometry: point.geometry || null,
    style: initialStyle,
    lat: center.lat,
    lng: center.lng,
  });
  const [mediaError, setMediaError] = useState("");
  const officerOptions = users.filter((user) =>
    ["Response Team", "Agent"].includes(user.role),
  );
  const reportTypeOptions = useMemo(() => {
    return REPORT_TYPES;
  }, [customTypes, isAdmin]);
  const named = (user) => (user.rank ? `${user.rank} ${user.name}` : user.name);
  const addMedia = (files) => {
    setMediaError("");
    [...files].slice(0, 6 - form.media.length).forEach((file) => {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/"))
        return;
      if (file.size > 8 * 1024 * 1024) {
        setMediaError("Each photo or video must be 8MB or smaller.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () =>
        setForm((old) => ({
          ...old,
          media: [
            ...old.media,
            {
              name: file.name,
              type: file.type.startsWith("video/") ? "video" : "image",
              data: reader.result,
            },
          ].slice(0, 6),
        }));
      reader.readAsDataURL(file);
    });
  };
  const removeMedia = (index) =>
    setForm((old) => ({
      ...old,
      media: old.media.filter((_, i) => i !== index),
    }));
  const updateVisible = (event) =>
    setForm({
      ...form,
      visibleTo: [...event.target.selectedOptions].map(
        (option) => option.value,
      ),
    });
  const updateType = (type) => {
    setForm((old) => ({
      ...old,
      reportType: type,
      style: { ...old.style, ...(REPORT_TYPE_STYLES[type] || REPORT_TYPE_STYLES.Custom) },
    }));
    if (type !== "Custom") setCustomTypeName("");
  };
  const updateStyle = (changes) =>
    setForm((old) => ({ ...old, style: { ...old.style, ...changes } }));
  return (
    <div className="modal-backdrop">
      <form
        className="modal report-modal"
        onSubmit={(e) => {
          e.preventDefault();
          const nextType =
            form.reportType === "Custom" && customTypeName.trim()
              ? customTypeName.trim()
              : form.reportType;
          if (form.reportType === "Custom" && customTypeName.trim()) {
            const nextCustomTypes = [...new Set([customTypeName.trim(), ...customTypes])];
            localStorage.setItem("report-custom-types", JSON.stringify(nextCustomTypes));
            setCustomTypes(nextCustomTypes);
          }
          onSave({ ...form, reportType: nextType });
        }}
      >
        <div className="panel-title">
          <div>
            <span className="eyebrow">NEW FIELD INCIDENT</span>
            <h2>Create incident</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <div className="two-col">
          <label>
            Incident category
            <span className="report-category-select">
              <ReportTypeIcon
                type={form.reportType}
                size={17}
                color={form.style.color}
              />
              <select
                value={form.reportType}
                onChange={(e) => updateType(e.target.value)}
              >
                {reportTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label>
            Severity
            <select
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
            >
              {Object.keys(severityColor).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Incident title
          <input
            required
            autoFocus
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="What is happening or what is this point?"
          />
        </label>
        <label>
          Notes
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Write statement, observation, instructions or evidence notes..."
          />
        </label>
        <div className="report-style-box">
          <div
            className="report-style-preview"
            style={{
              "--pin": form.style.color,
              "--fill": form.style.fillColor,
              opacity: form.style.opacity,
            }}
          >
            <span>
              <ReportIcon
                iconKey={form.style.icon || "IP"}
                size={16}
                color="#fff"
              />
            </span>
          </div>
          <label>
            Icon
            <select
              value={form.style.icon || "IP"}
              onChange={(e) => updateStyle({ icon: e.target.value })}
            >
              {[
                "BS",
                "KP",
                "VP",
                "POI",
                "STN",
                "IP",
                ...POINT_ICONS.map((icon) => icon.key),
              ].map((icon) => {
                const label = POINT_ICONS.find((p) => p.key === icon)?.label || icon;
                return (
                  <option key={icon} value={icon}>
                    {label}
                  </option>
                );
              })}
            </select>
          </label>
          {form.reportType === "Custom" && (
            <label>
              Describe this custom incident type
              <input
                required
                value={customTypeName}
                onChange={(e) => setCustomTypeName(e.target.value)}
                placeholder="e.g. Roadblock, Flooding, Security sweep"
              />
            </label>
          )}
          <label>
            Border color
            <input
              type="color"
              value={form.style.color}
              onChange={(e) => updateStyle({ color: e.target.value })}
            />
          </label>
          <label>
            Fill color
            <input
              type="color"
              value={form.style.fillColor || form.style.color}
              onChange={(e) => updateStyle({ fillColor: e.target.value })}
            />
          </label>
          <label>
            Transparency
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={form.style.opacity ?? 0.8}
              onChange={(e) =>
                updateStyle({
                  opacity: Number(e.target.value),
                  fillOpacity: Math.max(0.05, Number(e.target.value) * 0.35),
                })
              }
            />
          </label>
        </div>
        <div className="two-col">
          <label>
            Assign responder
            <select
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
            >
              <option value="">Unassigned</option>
              {officerOptions.map((x) => (
                <option value={x.id} key={x.id}>
                  {named(x)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Who can see this incident
            <select
              className="report-viewer-select"
              multiple
              size={6}
              value={form.visibleTo}
              onChange={updateVisible}
            >
              {users
                .filter((x) => x.role !== "Super Admin")
                .map((x) => (
                  <option value={x.id} key={x.id}>
                    {named(x)}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="report-capture-row">
          <label className="capture-btn">
            Snap photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => addMedia(e.target.files || [])}
            />
          </label>
          <label className="capture-btn">
            Record video
            <input
              type="file"
              accept="video/*"
              capture="environment"
              onChange={(e) => addMedia(e.target.files || [])}
            />
          </label>
          <label className="capture-btn">
            Attach media
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(e) => addMedia(e.target.files || [])}
            />
          </label>
        </div>
        {mediaError && <div className="error">{mediaError}</div>}
        {form.media.length > 0 && (
          <div className="report-media-list">
            {form.media.map((item, index) => (
              <button
                type="button"
                key={`${item.name}-${index}`}
                onClick={() => removeMedia(index)}
                title="Remove attachment"
              >
                {item.type === "video" ? "VIDEO" : "PHOTO"} {index + 1}
              </button>
            ))}
          </div>
        )}
        <div className="coordinates">
          <b>
            {form.geometry
              ? `${form.geometry.type} incident area`
              : "Pinned location"}
          </b>
          <span>
            {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
          </span>
        </div>
        <div className="actions">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="primary">Submit incident</button>
        </div>
      </form>
    </div>
  );
}

function OfficerManager({
  users,
  currentUser,
  onClose,
  onCreate,
  onDelete,
  onPassword,
}) {
  const manageableRoles = currentUser.role === "Super Admin"
    ? ["Admin", "Response Team", "Agent"]
    : ["Response Team", "Agent"];
  const defaultRole = manageableRoles[manageableRoles.length - 1];
  const defaultCommand = OYO_COMMANDS[0] || "";
  const defaultDivision = divisionsForCommand(defaultCommand)[0];
  const emptyForm = {
    name: "",
    email: "",
    password: "",
    rank: defaultRole,
    unit: defaultDivision?.name || "",
    unitType: "Division",
    command: defaultCommand,
    division: defaultDivision?.name || "",
    station: "",
    lga: defaultDivision?.lga || "",
    lat: "7.3775",
    lng: "3.9470",
    role: defaultRole,
  };
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const commandDivisions = divisionsForCommand(form.command);
  const pickCommand = (command) => {
    const first = divisionsForCommand(command)[0];
    setForm({
      ...form,
      command,
      division: first?.name || "",
      lga: first?.lga || "",
      unit: first?.name || command,
    });
  };
  const pickDivision = (name) => {
    const found = commandDivisions.find((item) => item.name === name);
    setForm({ ...form, division: name, lga: found?.lga || "", unit: name });
  };
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await onCreate(form);
      setForm(emptyForm);
    } catch (err) {
      setError(err.message);
    }
  };
  const resetPassword = async (user) => {
    const password = window.prompt(`Enter new password for ${user.name}`);
    if (!password) return;
    try {
      await onPassword(user, password);
    } catch (err) {
      setError(err.message);
    }
  };
  const canManageRoles = ["Super Admin", "Admin"].includes(currentUser.role);
  return (
    <div className="modal-backdrop">
      <section className="modal officer-modal">
        <div className="panel-title">
          <div>
            <span className="eyebrow">ONBOARDING</span>
            <h2>Manage personnel</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <div className="manager-grid">
          <div className="manage-list">
            <h3>Visible personnel</h3>
            {users
              .filter((o) => o.role !== "Super Admin")
              .map((o) => (
              <div className="manage-row" key={o.id}>
                <div className="avatar">
                  {o.name
                    .split(" ")
                    .map((x) => x[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div>
                  <b>{o.rank ? `${o.rank} ${o.name}` : o.name}</b>
                  <small>
                    {o.role === "Admin"
                      ? "Admin"
                      : o.role === "Super Admin"
                        ? "System Administrator"
                        : o.role} -{" "}
                    {o.email} - {o.unitType || "Division"} -{" "}
                    {o.command || "No command"} -{" "}
                    {o.station || o.division || o.unit}
                  </small>
                </div>
                <button
                  className="unit-action-btn"
                  onClick={() => resetPassword(o)}
                >
                  Password
                </button>
                <button className="delete-btn" onClick={() => onDelete(o)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={submit}>
            <h3>Create personnel account</h3>
            <label>
              Full name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@command.local"
              />
            </label>
            {canManageRoles && (
              <label>
                System role
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value, rank: e.target.value })
                  }
                >
                  {manageableRoles.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="two-col">
              <label>
                Unit type
                <select
                  required
                  value={form.unitType}
                  onChange={(e) =>
                    setForm({ ...form, unitType: e.target.value })
                  }
                >
                  {UNIT_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Area command
                <select
                  required
                  value={form.command}
                  onChange={(e) => pickCommand(e.target.value)}
                >
                  {OYO_COMMANDS.map((command) => (
                    <option key={command}>{command}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="two-col">
              <label>
                Division
                <select
                  required
                  value={form.division}
                  onChange={(e) => pickDivision(e.target.value)}
                >
                  {commandDivisions.map((item) => (
                    <option key={item.name}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Station / unit name
                <input
                  value={form.station}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      station: e.target.value,
                      unit: e.target.value || form.division,
                    })
                  }
                  placeholder="HQTS, station or special unit"
                />
              </label>
            </div>
            <div className="two-col">
              <label>
                LGA
                <input
                  required
                  value={form.lga}
                  onChange={(e) => setForm({ ...form, lga: e.target.value })}
                />
              </label>
              <label>
                Unit / call sign
                <input
                  required
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="Patrol 04"
                />
              </label>
            </div>
            <div className="two-col">
              <label>
                Password
                <input
                  required
                  minLength="6"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </label>
              <label>
                Initial latitude
                <input
                  required
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: e.target.value })}
                />
              </label>
            </div>
            <label>
              Initial longitude
              <input
                required
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
              />
            </label>
            {error && <div className="error">{error}</div>}
            <button className="primary wide" disabled={!manageableRanks.length}>
              Create account
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function StreamVideo({ src, stream, muted = false }) {
  const ref = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
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
    if (src.includes(".m3u8") && Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else video.src = src;
    return () => {
      hls?.destroy();
      video.removeAttribute("src");
    };
  }, [src, stream]);
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
      <video ref={ref} controls autoPlay playsInline muted={muted} />
      <button
        className={recording ? "record-stop" : ""}
        onClick={toggleRecording}
      >
        {recording ? "Stop & save" : "Record"}
      </button>
    </div>
  );
}

function CameraPanel({
  cameras,
  phoneShares,
  remoteStreams,
  isAdmin,
  onClose,
  onCreate,
  onDelete,
  onView,
  onShowMap,
}) {
  const [form, setForm] = useState({
    name: "",
    type: "CCTV",
    url: "",
    lat: "7.3775",
    lng: "3.9470",
  });
  const [view, setView] = useState("All");
  const submit = async (e) => {
    e.preventDefault();
    await onCreate(form);
    setForm({ name: "", type: "CCTV", url: "", lat: "7.3775", lng: "3.9470" });
  };
  const phoneFeeds = phoneShares.map((feed) => ({
    ...feed,
    id: `phone-${feed.userId}`,
    feedType: "Phone",
  }));
  const cameraFeeds = cameras.map((camera) => ({
    ...camera,
    feedType: camera.type || "CCTV",
  }));
  const feeds = [...phoneFeeds, ...cameraFeeds].filter(
    (feed) => view === "All" || feed.feedType === view,
  );
  const counts = {
    All: phoneFeeds.length + cameraFeeds.length,
    Phone: phoneFeeds.length,
    CCTV: cameraFeeds.filter((x) => x.feedType === "CCTV").length,
    Drone: cameraFeeds.filter((x) => x.feedType === "Drone").length,
  };
  return (
    <section className="camera-panel">
      <div className="camera-head">
        <div>
          <span className="eyebrow">LIVE VISUAL INTELLIGENCE</span>
          <h2>{view === "Drone" ? "Drone view" : "Camera feeds"}</h2>
        </div>
        <button className="icon-btn" onClick={onClose}>
          <FaTimes />
        </button>
      </div>
      <div className="camera-tabs">
        {["All", "Phone", "CCTV", "Drone"].map((tab) => (
          <button
            key={tab}
            className={view === tab ? "active" : ""}
            onClick={() => setView(tab)}
          >
            {tab} <i>{counts[tab]}</i>
          </button>
        ))}
      </div>
      <div className="camera-grid compact">
        {feeds.map((feed) =>
          feed.feedType === "Phone" ? (
            <article className="camera-card" key={feed.id}>
              <div className="video-shell">
                {remoteStreams[feed.userId] ? (
                  <StreamVideo stream={remoteStreams[feed.userId]} />
                ) : (
                  <button
                    className="connect-feed"
                    onClick={() => onView(feed.userId)}
                  >
                    Play Connect
                  </button>
                )}
              </div>
              <div className="camera-meta">
                <div>
                  <b>{feed.name}</b>
                  <small>PHONE / WEBRTC</small>
                </div>
                <span className="live-badge">
                  <FaCircle size={8} style={{ marginRight: 3 }} />
                  LIVE
                </span>
              </div>
              <div className="camera-actions">
                {feed.lat && (
                  <button onClick={() => onShowMap(feed)}>Show on map</button>
                )}
              </div>
            </article>
          ) : (
            <article className="camera-card" key={feed.id}>
              <div className="video-shell">
                <StreamVideo src={feed.url} muted />
              </div>
              <div className="camera-meta">
                <div>
                  <b>{feed.name}</b>
                  <small>
                    {feed.feedType} / {feed.lat.toFixed(4)},{" "}
                    {feed.lng.toFixed(4)}
                  </small>
                </div>
                <span
                  className={
                    feed.feedType === "Drone" ? "live-badge" : "online-badge"
                  }
                >
                  {feed.feedType === "Drone" ? "DRONE" : "ONLINE"}
                </span>
                {isAdmin && (
                  <button
                    className="camera-delete"
                    onClick={() => onDelete(feed)}
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="camera-actions">
                <button onClick={() => onShowMap(feed)}>Show on map</button>
              </div>
            </article>
          ),
        )}
        {!feeds.length && (
          <div className="empty-cameras">
            <b>
              No {view === "All" ? "" : view.toLowerCase()} feeds registered
            </b>
            <span>
              Add an HLS stream or ask an officer to share their phone camera.
            </span>
          </div>
        )}
      </div>
      {isAdmin && (
        <form className="camera-form" onSubmit={submit}>
          <h3>Add CCTV / drone stream</h3>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Camera name"
          />
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option>CCTV</option>
            <option>Drone</option>
            <option>Vehicle</option>
            <option>Other</option>
          </select>
          <input
            required
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="HLS URL ending in .m3u8 or video URL"
          />
          <input
            value={form.lat}
            onChange={(e) => setForm({ ...form, lat: e.target.value })}
            placeholder="Latitude"
          />
          <input
            value={form.lng}
            onChange={(e) => setForm({ ...form, lng: e.target.value })}
            placeholder="Longitude"
          />
          <button className="primary">Add feed</button>
        </form>
      )}
    </section>
  );
}

function LayerStyleEditor({ layer, canDelete, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false);
  const makeDraft = (item) => ({
    name: item.name || "",
    category: layerGeometry(item),
    operationalUse: item.operationalUse || "Reference",
    color: item.color || "#38bdf8",
    fillColor: item.fillColor || item.color || "#38bdf8",
    opacity: item.opacity ?? 0.65,
    fillOpacity: item.fillOpacity ?? 0.18,
    lineWeight: item.lineWeight || 2,
    lineStyle: item.lineStyle || "solid",
    pointIcon: item.pointIcon || "pin",
    pointIconColor: item.pointIconColor || "#ffffff",
    pointSize: item.pointSize || 24,
    showLabels: item.showLabels !== false,
    labelField: item.labelField || "name",
    popupFields: item.popupFields || "",
  });
  const [draft, setDraft] = useState(() => makeDraft(layer));
  useEffect(() => setDraft(makeDraft(layer)), [layer]);
  const isPoint = draft.category === "Point";
  const isLine = draft.category === "Line";
  const isPolygon = draft.category === "Polygon";
  const isRaster = draft.category === "Raster" || layer.type === "raster";
  const save = () =>
    onUpdate(layer.id, {
      ...draft,
      opacity: Number(draft.opacity),
      fillOpacity: Number(draft.fillOpacity),
      lineWeight: Number(draft.lineWeight),
      pointSize: Number(draft.pointSize),
    });
  return (
    <div className="manage-row mdp-manage-row">
      <div
        className="avatar"
        style={{
          background: draft.color || "#163d68",
          color: draft.pointIconColor || "#fff",
          display: "grid",
          placeItems: "center",
        }}
      >
        {isRaster ? (
          <MdImage size={16} />
        ) : isPoint ? (
          <PointIconComponent
            iconKey={draft.pointIcon}
            size={16}
            color={draft.pointIconColor || "#fff"}
          />
        ) : (
          <CategoryIcon cat={draft.category} size={16} />
        )}
      </div>
      <div className="mdp-layer-summary">
        <b>{layer.name}</b>
        <small>
          {layer.type} - {layerGeometry(layer)} -{" "}
          {layer.operationalUse || "Reference"} / opacity{" "}
          {Math.round((layer.opacity ?? 0.65) * 100)}%
          {layer.showLabels ? " / labels on" : ""}
        </small>
      </div>
      <button
        className={`lcp-toggle ${layer.visible !== false ? "on" : "off"}`}
        onClick={() => onUpdate(layer.id, { visible: layer.visible === false })}
        title={layer.visible !== false ? "Hide" : "Show"}
      >
        {layer.visible !== false ? (
          <MdVideocam size={14} />
        ) : (
          <MdVideocam size={14} style={{ opacity: 0.3 }} />
        )}
      </button>
      <button className="unit-action-btn" onClick={() => setOpen((x) => !x)}>
        {open ? "Close" : "Edit"}
      </button>
      {canDelete && (
        <button className="delete-btn" onClick={() => onDelete(layer)}>
          Delete
        </button>
      )}
      {open && (
        <div className="mdp-editor">
          <div className="mdp-row">
            <label className="mdp-label">
              Layer name
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label className="mdp-label">
              Geometry category
              <select
                value={draft.category}
                onChange={(e) => {
                  const color = CATEGORY_COLORS[e.target.value] || draft.color;
                  setDraft({
                    ...draft,
                    category: e.target.value,
                    color,
                    fillColor: color,
                  });
                }}
              >
                {LAYER_CATEGORIES.map((cat) => (
                  <option key={cat}>{cat}</option>
                ))}
              </select>
            </label>
            <label className="mdp-label">
              Operational use
              <select
                value={draft.operationalUse}
                onChange={(e) =>
                  setDraft({ ...draft, operationalUse: e.target.value })
                }
              >
                {OPERATIONAL_USES.map((use) => (
                  <option key={use}>{use}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mdp-row">
            <label className="mdp-label">
              Layer opacity
              <div className="mdp-opacity-row">
                <input
                  type="range"
                  min="0.05"
                  max="1"
                  step="0.05"
                  value={draft.opacity}
                  onChange={(e) =>
                    setDraft({ ...draft, opacity: e.target.value })
                  }
                />
                <span>{Math.round(Number(draft.opacity) * 100)}%</span>
              </div>
            </label>
            {!isPoint && !isRaster && (
              <label className="mdp-label">
                Line width
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={draft.lineWeight}
                  onChange={(e) =>
                    setDraft({ ...draft, lineWeight: e.target.value })
                  }
                />
              </label>
            )}
            {!isPoint && !isRaster && (
              <label className="mdp-label">
                Line style
                <select
                  value={draft.lineStyle}
                  onChange={(e) =>
                    setDraft({ ...draft, lineStyle: e.target.value })
                  }
                >
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </label>
            )}
          </div>
          {isPoint && (
            <div className="mdp-row">
              <label className="mdp-label">
                Point icon
                <div className="mdp-icon-grid">
                  {POINT_ICONS.map((p) => (
                    <button
                      type="button"
                      key={p.key}
                      className={`mdp-icon-btn ${draft.pointIcon === p.key ? "selected" : ""}`}
                      title={p.label}
                      onClick={() => setDraft({ ...draft, pointIcon: p.key })}
                    >
                      <p.Component size={18} />
                    </button>
                  ))}
                </div>
              </label>
              <label className="mdp-label">
                Point size
                <input
                  type="number"
                  min="14"
                  max="44"
                  value={draft.pointSize}
                  onChange={(e) =>
                    setDraft({ ...draft, pointSize: e.target.value })
                  }
                />
              </label>
              <label className="mdp-label mdp-color-label">
                Marker color
                <input
                  type="color"
                  value={draft.color}
                  onChange={(e) =>
                    setDraft({ ...draft, color: e.target.value })
                  }
                />
              </label>
              <label className="mdp-label mdp-color-label">
                Icon color
                <input
                  type="color"
                  value={draft.pointIconColor}
                  onChange={(e) =>
                    setDraft({ ...draft, pointIconColor: e.target.value })
                  }
                />
              </label>
            </div>
          )}
          {(isLine || isPolygon) && (
            <div className="mdp-row mdp-style-row">
              <label className="mdp-label mdp-color-label">
                Line color
                <div className="mdp-color-row">
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(e) =>
                      setDraft({ ...draft, color: e.target.value })
                    }
                  />
                  <div className="mdp-presets">
                    {LAYER_COLORS_PRESET.map((color) => (
                      <button
                        type="button"
                        key={color}
                        className={`mdp-preset-dot ${draft.color === color ? "selected" : ""}`}
                        style={{ background: color }}
                        onClick={() => setDraft({ ...draft, color })}
                      />
                    ))}
                  </div>
                </div>
              </label>
              {isPolygon && (
                <label className="mdp-label mdp-color-label">
                  Fill color
                  <input
                    type="color"
                    value={draft.fillColor}
                    onChange={(e) =>
                      setDraft({ ...draft, fillColor: e.target.value })
                    }
                  />
                </label>
              )}
              {isPolygon && (
                <label className="mdp-label">
                  Area fill opacity
                  <div className="mdp-opacity-row">
                    <input
                      type="range"
                      min="0"
                      max="0.8"
                      step="0.05"
                      value={draft.fillOpacity}
                      onChange={(e) =>
                        setDraft({ ...draft, fillOpacity: e.target.value })
                      }
                    />
                    <span>{Math.round(Number(draft.fillOpacity) * 100)}%</span>
                  </div>
                </label>
              )}
            </div>
          )}
          <div className="mdp-row">
            <label className="mdp-label mdp-check-label">
              <input
                type="checkbox"
                checked={draft.showLabels}
                onChange={(e) =>
                  setDraft({ ...draft, showLabels: e.target.checked })
                }
              />
              Show labels
            </label>
            <label className="mdp-label">
              Label field
              <input
                value={draft.labelField}
                onChange={(e) =>
                  setDraft({ ...draft, labelField: e.target.value })
                }
              />
            </label>
            <label className="mdp-label mdp-wide">
              Popup fields
              <input
                value={draft.popupFields}
                onChange={(e) =>
                  setDraft({ ...draft, popupFields: e.target.value })
                }
              />
            </label>
          </div>
          <button className="primary mdp-save-style" onClick={save}>
            Save layer style
          </button>
        </div>
      )}
    </div>
  );
}

function MapDataPanel({
  layers,
  isSuperAdmin,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}) {
  const [mode, setMode] = useState("geojson");
  const [form, setForm] = useState({
    name: "",
    url: "",
    bounds: "7.55,3.70,7.20,4.15",
    opacity: "0.65",
    fillOpacity: "0.18",
    category: "Point",
    operationalUse: "Reference",
    color: "#38bdf8",
    fillColor: "#38bdf8",
    lineWeight: "2",
    lineStyle: "solid",
    pointIcon: "pin",
    pointIconColor: "#ffffff",
    pointSize: "24",
    showLabels: true,
    labelField: "name",
    popupFields: "name,type,status",
  });
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(isSuperAdmin ? "upload" : "manage");
  const readFile = (selected) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.onload = () => resolve(reader.result);
      if (selected.name.toLowerCase().endsWith(".zip"))
        reader.readAsArrayBuffer(selected);
      else reader.readAsText(selected);
    });
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "raster") {
        const nums = form.bounds.split(",").map((x) => Number(x.trim()));
        if (nums.length !== 4 || nums.some((x) => !Number.isFinite(x)))
          throw new Error("Bounds must be north,west,south,east (4 numbers)");
        await onCreate({
          name: form.name,
          type: "raster",
          url: form.url,
          bounds: [
            [nums[0], nums[1]],
            [nums[2], nums[3]],
          ],
          opacity: Number(form.opacity) || 0.65,
          category: "Raster",
          operationalUse: form.operationalUse,
          color: form.color,
          visible: true,
        });
      } else {
        if (!file)
          throw new Error("Choose a GeoJSON or zipped shapefile (.zip)");
        const raw = await readFile(file);
        const data = file.name.toLowerCase().endsWith(".zip")
          ? await shp(raw)
          : JSON.parse(raw);
        await onCreate({
          name: form.name || file.name,
          type: "geojson",
          data,
          opacity: Number(form.opacity) || 0.65,
          fillOpacity: Number(form.fillOpacity),
          category: form.category,
          operationalUse: form.operationalUse,
          color: form.color,
          fillColor: form.fillColor,
          lineWeight: Number(form.lineWeight),
          lineStyle: form.lineStyle,
          pointIcon: form.pointIcon,
          pointIconColor: form.pointIconColor,
          pointSize: Number(form.pointSize),
          showLabels: form.showLabels,
          labelField: form.labelField,
          popupFields: form.popupFields,
          visible: true,
        });
      }
      setForm((f) => ({ ...f, name: "", url: "" }));
      setFile(null);
      setTab("manage");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const grouped = layers.reduce((acc, layer) => {
    const cat = layerGeometry(layer);
    (acc[cat] ||= []).push(layer);
    return acc;
  }, {});
  const uploadPoint = mode === "geojson" && form.category === "Point";
  const uploadLine = mode === "geojson" && form.category === "Line";
  const uploadPolygon = mode === "geojson" && form.category === "Polygon";
  return (
    <section className="camera-panel map-data-panel">
      <div className="camera-head">
        <div>
          <span className="eyebrow">
            {isSuperAdmin ? "SYSTEM ADMIN GIS" : "ADMIN GIS"}
          </span>
          <h2>Custom Map Builder</h2>
        </div>
        <button className="icon-btn" onClick={onClose}>
          <FaTimes />
        </button>
      </div>
      <div className="camera-tabs">
        {isSuperAdmin && (
          <button
            className={tab === "upload" ? "active" : ""}
            onClick={() => setTab("upload")}
          >
            Upload Layer
          </button>
        )}
        <button
          className={tab === "manage" ? "active" : ""}
          onClick={() => setTab("manage")}
        >
          Manage Layers <i>{layers.length}</i>
        </button>
      </div>
      {tab === "upload" && isSuperAdmin && (
        <>
          <div className="camera-tabs mdp-mode-tabs">
            <button
              className={mode === "geojson" ? "active" : ""}
              onClick={() => setMode("geojson")}
            >
              GeoJSON / Shapefile
            </button>
            <button
              className={mode === "raster" ? "active" : ""}
              onClick={() => setMode("raster")}
            >
              Raster / Image Overlay
            </button>
          </div>
          <form className="mdp-form" onSubmit={submit}>
            <div className="mdp-row">
              <label className="mdp-label">
                Layer name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Oyo LGA Boundaries"
                />
              </label>
              {mode === "geojson" && (
                <label className="mdp-label">
                  Geometry category
                  <select
                    value={form.category}
                    onChange={(e) => {
                      const color =
                        CATEGORY_COLORS[e.target.value] || "#38bdf8";
                      setForm({
                        ...form,
                        category: e.target.value,
                        color,
                        fillColor: color,
                      });
                    }}
                  >
                    {["Point", "Line", "Polygon"].map((cat) => (
                      <option key={cat}>{cat}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="mdp-label">
                Operational use
                <select
                  value={form.operationalUse}
                  onChange={(e) =>
                    setForm({ ...form, operationalUse: e.target.value })
                  }
                >
                  {OPERATIONAL_USES.map((use) => (
                    <option key={use}>{use}</option>
                  ))}
                </select>
              </label>
            </div>
            {mode === "raster" ? (
              <div className="mdp-row">
                <label className="mdp-label mdp-wide">
                  Image URL (.png / .jpg / .tif)
                  <input
                    required
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="https://example.com/oyo-map.png"
                  />
                </label>
                <label className="mdp-label">
                  Bounds (N,W,S,E)
                  <input
                    required
                    value={form.bounds}
                    onChange={(e) =>
                      setForm({ ...form, bounds: e.target.value })
                    }
                    placeholder="7.55,3.70,7.20,4.15"
                  />
                </label>
              </div>
            ) : (
              <label className="mdp-label">
                Shapefile (.zip) or GeoJSON (.geojson / .json)
                <input
                  type="file"
                  accept=".geojson,.json,.zip"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {file && <span className="mdp-file-name">{file.name}</span>}
              </label>
            )}
            <div className="mdp-row mdp-style-row">
              {(mode === "raster" ||
                uploadPoint ||
                uploadLine ||
                uploadPolygon) && (
                <label className="mdp-label mdp-color-label">
                  {uploadPoint ? "Marker color" : "Line / border color"}
                  <div className="mdp-color-row">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) =>
                        setForm({ ...form, color: e.target.value })
                      }
                    />
                    <div className="mdp-presets">
                      {LAYER_COLORS_PRESET.map((color) => (
                        <button
                          type="button"
                          key={color}
                          className={`mdp-preset-dot ${form.color === color ? "selected" : ""}`}
                          style={{ background: color }}
                          onClick={() =>
                            setForm({ ...form, color, fillColor: color })
                          }
                        />
                      ))}
                    </div>
                  </div>
                </label>
              )}
              {uploadPolygon && (
                <label className="mdp-label mdp-color-label">
                  Fill color
                  <div className="mdp-color-row">
                    <input
                      type="color"
                      value={form.fillColor}
                      onChange={(e) =>
                        setForm({ ...form, fillColor: e.target.value })
                      }
                    />
                  </div>
                </label>
              )}
              <label className="mdp-label">
                Opacity
                <div className="mdp-opacity-row">
                  <input
                    type="range"
                    min="0.05"
                    max="1"
                    step="0.05"
                    value={form.opacity}
                    onChange={(e) =>
                      setForm({ ...form, opacity: e.target.value })
                    }
                  />
                  <span>{Math.round(Number(form.opacity) * 100)}%</span>
                </div>
              </label>
            </div>
            {mode === "geojson" && (
              <>
                {(uploadLine || uploadPolygon) && (
                  <div className="mdp-row">
                    <label className="mdp-label">
                      Line style
                      <select
                        value={form.lineStyle}
                        onChange={(e) =>
                          setForm({ ...form, lineStyle: e.target.value })
                        }
                      >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                      </select>
                    </label>
                    <label className="mdp-label">
                      Line width
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={form.lineWeight}
                        onChange={(e) =>
                          setForm({ ...form, lineWeight: e.target.value })
                        }
                      />
                    </label>
                    {uploadPolygon && (
                      <label className="mdp-label">
                        Area fill opacity
                        <div className="mdp-opacity-row">
                          <input
                            type="range"
                            min="0"
                            max="0.8"
                            step="0.05"
                            value={form.fillOpacity}
                            onChange={(e) =>
                              setForm({ ...form, fillOpacity: e.target.value })
                            }
                          />
                          <span>
                            {Math.round(Number(form.fillOpacity) * 100)}%
                          </span>
                        </div>
                      </label>
                    )}
                  </div>
                )}
                {uploadPoint && (
                  <div className="mdp-row">
                    <label className="mdp-label">
                      Point icon
                      <div className="mdp-icon-grid">
                        {POINT_ICONS.map((p) => (
                          <button
                            type="button"
                            key={p.key}
                            className={`mdp-icon-btn ${form.pointIcon === p.key ? "selected" : ""}`}
                            title={p.label}
                            onClick={() =>
                              setForm({ ...form, pointIcon: p.key })
                            }
                          >
                            <p.Component size={18} />
                          </button>
                        ))}
                      </div>
                    </label>
                    <label className="mdp-label">
                      Point size
                      <input
                        type="number"
                        min="14"
                        max="44"
                        value={form.pointSize}
                        onChange={(e) =>
                          setForm({ ...form, pointSize: e.target.value })
                        }
                      />
                    </label>
                    <label className="mdp-label mdp-color-label">
                      Icon color
                      <input
                        type="color"
                        value={form.pointIconColor}
                        onChange={(e) =>
                          setForm({ ...form, pointIconColor: e.target.value })
                        }
                      />
                    </label>
                  </div>
                )}
                <div className="mdp-row">
                  <label className="mdp-label mdp-check-label">
                    <input
                      type="checkbox"
                      checked={form.showLabels}
                      onChange={(e) =>
                        setForm({ ...form, showLabels: e.target.checked })
                      }
                    />
                    Show feature labels on map
                  </label>
                  {form.showLabels && (
                    <label className="mdp-label">
                      Label field
                      <input
                        value={form.labelField}
                        onChange={(e) =>
                          setForm({ ...form, labelField: e.target.value })
                        }
                        placeholder={
                          uploadLine
                            ? "road_name, name"
                            : "name, NAME, ADM2_EN, lga_name"
                        }
                      />
                    </label>
                  )}
                  <label className="mdp-label mdp-wide">
                    Popup fields
                    <input
                      value={form.popupFields}
                      onChange={(e) =>
                        setForm({ ...form, popupFields: e.target.value })
                      }
                      placeholder="name,type,status,ward,lga"
                    />
                  </label>
                </div>
              </>
            )}
            {error && <div className="error">{error}</div>}
            <button className="primary mdp-submit" disabled={loading}>
              {loading ? "Processing shapefile..." : "+ Add layer to map"}
            </button>
            <div className="mdp-sources">
              <b>Free Nigeria shapefile sources:</b>
              <a
                href="https://gadm.org/download_country.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                GADM
              </a>
              <span>-</span>
              <a
                href="https://data.humdata.org/dataset/cod-ab-nga"
                target="_blank"
                rel="noopener noreferrer"
              >
                HDX
              </a>
              <span>-</span>
              <a
                href="https://diva-gis.org/gdata"
                target="_blank"
                rel="noopener noreferrer"
              >
                DIVA-GIS
              </a>
              <span>-</span>
              <a
                href="https://download.geofabrik.de/africa/nigeria.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                GeoFabrik
              </a>
            </div>
          </form>
        </>
      )}
      {tab === "manage" && (
        <div className="mdp-manage">
          {!layers.length && (
            <div className="empty-cameras">
              <b>No layers uploaded yet</b>
              <span>
                {isSuperAdmin
                  ? "Switch to the Upload tab and add your first shapefile."
                  : "Ask a system administrator to upload GIS layers first."}
              </span>
            </div>
          )}
          {Object.entries(grouped).map(([cat, catLayers]) => (
            <div key={cat} className="mdp-cat-group">
              <div className="mdp-cat-header">
                <span style={{ color: CATEGORY_COLORS[cat] || "#e2e8f0" }}>
                  <CategoryIcon cat={cat} size={14} />
                </span>
                <b>{cat}</b>
                <span className="mdp-cat-count-badge">{catLayers.length}</span>
              </div>
              {catLayers.map((layer) => (
                <LayerStyleEditor
                  key={layer.id}
                  layer={layer}
                  canDelete={isSuperAdmin}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ChatPanel({
  rooms,
  activeRoom,
  messages,
  users,
  currentUser,
  isAdmin,
  onClose,
  onCreateRoom,
  onSelectRoom,
  onSend,
  onAddMember,
  onDeleteRoom,
}) {
  const [newRoom, setNewRoom] = useState({ name: "", userId: "" });
  const [memberId, setMemberId] = useState("");
  const [text, setText] = useState("");
  const names = useMemo(
    () =>
      Object.fromEntries(
        users.map((user) => [
          user.id,
          user.rank ? `${user.rank} ${user.name}` : user.name,
        ]),
      ),
    [users],
  );
  const officers = users.filter((user) =>
    ["Response Team", "Agent"].includes(user.role),
  );
  const submitRoom = async (e) => {
    e.preventDefault();
    if (!newRoom.name.trim()) return;
    await onCreateRoom(newRoom);
    setNewRoom({ name: "", userId: "" });
  };
  const submitMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() || !activeRoom) return;
    await onSend(text);
    setText("");
  };
  const addMember = async () => {
    if (!memberId || !activeRoom) return;
    await onAddMember(activeRoom, memberId);
    setMemberId("");
  };
  return (
    <section className="chat-panel">
      <div className="camera-head">
        <div>
          <span className="eyebrow">IN-HOUSE CHAT</span>
          <h2>Command messages</h2>
        </div>
        <button className="icon-btn" onClick={onClose}>
          <FaTimes />
        </button>
      </div>
      <div className="chat-layout">
        <aside className="chat-rooms">
          {rooms.map((room) => (
            <button
              key={room.id}
              className={activeRoom?.id === room.id ? "active" : ""}
              onClick={() => onSelectRoom(room)}
            >
              <b>{room.name}</b>
              <span>
                {room.type === "incident"
                  ? "Incident chat"
                  : `${room.members?.length || 0} members`}
              </span>
            </button>
          ))}
          {!rooms.length && (
            <div className="empty-cameras">
              <b>No chat rooms yet</b>
              <span>
                {isAdmin
                  ? "Create one and add officers."
                  : "Command will add you to a room."}
              </span>
            </div>
          )}
          {isAdmin && (
            <form className="chat-create" onSubmit={submitRoom}>
              <h3>Create room</h3>
              <input
                value={newRoom.name}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, name: e.target.value })
                }
                placeholder="Room name"
              />
              <select
                value={newRoom.userId}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, userId: e.target.value })
                }
              >
                <option value="">Add officer now</option>
                {officers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {names[user.id]}
                  </option>
                ))}
              </select>
              <button className="primary">Create chat</button>
            </form>
          )}
        </aside>
        <div className="chat-main">
          {activeRoom ? (
            <>
              <div className="chat-room-head">
                <div>
                  <b>{activeRoom.name}</b>
                  <small>
                    {(activeRoom.members || [])
                      .map((id) => names[id] || id)
                      .join(", ")}
                  </small>
                </div>
                {isAdmin && (
                  <button
                    className="delete-btn"
                    onClick={() => onDeleteRoom(activeRoom)}
                  >
                    Delete chat
                  </button>
                )}
                {isAdmin && (
                  <div className="chat-add">
                    <select
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
                    >
                      <option value="">Add officer</option>
                      {officers
                        .filter(
                          (user) =>
                            !(activeRoom.members || []).includes(user.id),
                        )
                        .map((user) => (
                          <option key={user.id} value={user.id}>
                            {names[user.id]}
                          </option>
                        ))}
                    </select>
                    <button onClick={addMember}>Add</button>
                  </div>
                )}
              </div>
              <div className="chat-messages">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`chat-message ${message.senderId === currentUser.id ? "mine" : ""}`}
                  >
                    <b>
                      {names[message.senderId] ||
                        (message.senderId === currentUser.id ? "You" : "User")}
                    </b>
                    <p>{message.body}</p>
                    <time>
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                ))}
                {!messages.length && (
                  <div className="empty-cameras">
                    <b>No messages yet</b>
                    <span>Send the first update.</span>
                  </div>
                )}
              </div>
              <form className="chat-send" onSubmit={submitMessage}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message"
                />
                <button className="primary">Send</button>
              </form>
            </>
          ) : (
            <div className="empty-cameras">
              <b>Select a room</b>
              <span>Use incident chat for case-specific communication.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ToolsPanel({
  onClose,
  canAdmin,
  canCreateIncidentAreas,
  canManagePersonnel,
  isSuperAdmin,
  isOfficer,
  sharingGps,
  sharingCamera,
  chatCount,
  cameraCount,
  mapLayerCount,
  updateReady,
  drawMode,
  hasMapTools,
  hasAreas,
  onMeasure,
  onRoute,
  onCircleReport,
  onFreehandReport,
  onClearMapTools,
  onShareAreas,
  onClearAreas,
  onManageOfficers,
  onMapData,
  onGps,
  onCameraShare,
  onCameras,
  onChat,
  onRefresh,
  onPassword,
}) {
  return (
    <div className="modal-backdrop">
      <section className="modal tools-modal">
        <div className="panel-title">
          <div>
            <span className="eyebrow">COMMAND TOOLS</span>
            <h2>Actions</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <div className="tools-grid">
          <button
            className={drawMode === "measure" ? "active" : ""}
            onClick={() => {
              onMeasure();
              onClose();
            }}
          >
            <b>
              <FaRulerCombined /> Measure
            </b>
            <span>Measure distance on the map</span>
          </button>
          <button
            className={drawMode === "route" ? "active" : ""}
            onClick={() => {
              onRoute();
              onClose();
            }}
          >
            <b>
              <FaRoute /> Route
            </b>
            <span>Pick a start and destination</span>
          </button>
          {canCreateIncidentAreas && (
            <button
              className={drawMode === "circle" ? "active" : ""}
              onClick={() => {
                onCircleReport();
                onClose();
              }}
            >
              <b>
                <FaCircle /> Circle Incident
              </b>
              <span>Create incident from a radius</span>
            </button>
          )}
          {canCreateIncidentAreas && (
            <button
              className={drawMode === "freehand" ? "active" : ""}
              onClick={() => {
                onFreehandReport();
                onClose();
              }}
            >
              <b>
                <FaDrawPolygon /> Freehand Incident
              </b>
              <span>Draw an incident area by hand</span>
            </button>
          )}
          {hasMapTools && (
            <button
              className="danger-tool"
              onClick={() => {
                onClearMapTools();
                onClose();
              }}
            >
              <b>
                <FaTools /> Clear Tools
              </b>
              <span>Remove active map tool overlays</span>
            </button>
          )}
          {hasAreas && (
            <button
              onClick={() => {
                onShareAreas();
                onClose();
              }}
            >
              <b>
                <FaMapMarkedAlt /> Share Area
              </b>
              <span>Share the latest drawn area</span>
            </button>
          )}
          {hasAreas && (
            <button
              className="danger-tool"
              onClick={() => {
                onClearAreas();
                onClose();
              }}
            >
              <b>
                <FaTools /> Clear Areas
              </b>
              <span>Remove drawn operational areas</span>
            </button>
          )}
          {canAdmin && (
            <button
              onClick={() => {
                onClose();
                onMapData();
              }}
            >
              <b>
                <FaMapMarkedAlt /> Map Data
              </b>
              <span>
                {isSuperAdmin
                  ? `${mapLayerCount} layers - upload/edit`
                  : `${mapLayerCount} layers - edit styles`}
              </span>
            </button>
          )}
          {canManagePersonnel && (
            <button
              onClick={() => {
                onClose();
                onManageOfficers();
              }}
            >
              <b>
                <FaUserCog /> Manage Users
              </b>
              <span>Create lower-rank accounts</span>
            </button>
          )}
          <button onClick={onGps}>
            <b>
              <FaBullseye /> {sharingGps ? "Stop GPS" : "Share GPS"}
            </b>
            <span>Live field location</span>
          </button>
          <button onClick={onCameraShare}>
            <b>
              <FaVideo /> {sharingCamera ? "Stop Camera" : "Share Camera"}
            </b>
            <span>Phone camera feed</span>
          </button>
          <button
            onClick={() => {
              onClose();
              onCameras();
            }}
          >
            <b>
              <FaVideo /> Cameras Available
            </b>
            <span>{cameraCount} feeds</span>
          </button>
          <button
            onClick={() => {
              onClose();
              onChat();
            }}
          >
            <b>
              <FaComments /> Chat
            </b>
            <span>{chatCount} rooms</span>
          </button>
          <button onClick={onRefresh}>
            <b>
              <FaSyncAlt /> {updateReady ? "Update Ready" : "Update App"}
            </b>
            <span>Refresh latest version</span>
          </button>
          <button onClick={onPassword}>
            <b>
              <FaKey /> Change Password
            </b>
            <span>Your own account</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function EmergencyPanel({ onClose, onSend }) {
  const [type, setType] = useState(EMERGENCY_TYPES[0]);
  const [custom, setCustom] = useState("");
  const submit = (e) => {
    e.preventDefault();
    onSend({
      type,
      text: custom,
    });
  };
  return (
    <div className="modal-backdrop">
      <form className="modal emergency-send-modal" onSubmit={submit}>
        <div className="panel-title">
          <div>
            <span className="eyebrow">OFFICER EMERGENCY</span>
            <h2>Send SOS alert</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <label>
          Emergency type
          <select required value={type} onChange={(e) => setType(e.target.value)}>
            {EMERGENCY_TYPES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Optional message
          <textarea
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Add any detail, or leave blank"
          />
        </label>
        <button className="emergency-submit">Send emergency now</button>
      </form>
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
}) {
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
  const run = async (tool) => setResult(await onTool(tool));
  return (
    <section className="analytics-panel">
      <div className="camera-head">
        <div>
          <span className="eyebrow">ANALYTIC TOOLS</span>
          <h2>Map analysis</h2>
        </div>
        <button className="icon-btn" onClick={onClose}>
          <FaTimes />
        </button>
      </div>
      <div className="analytics-hero">
        <div className="analytics-hero-top">
          <div>
            <b>Live intelligence pulse</b>
            <span>
              Operational pressure and incident distribution at a glance.
            </span>
          </div>
          <div className="analytics-pulse">Live</div>
        </div>
        <div className="analytics-kpis">
          <div className="analytics-kpi danger">
            <strong>{incidents.length}</strong>
            <span>Incidents</span>
          </div>
          <div className="analytics-kpi warn">
            <strong>{highRiskCount}</strong>
            <span>High risk</span>
          </div>
          <div className="analytics-kpi info">
            <strong>{officers.length}</strong>
            <span>Units</span>
          </div>
          <div className="analytics-kpi accent">
            <strong>{pointLayers.length}</strong>
            <span>Point layers</span>
          </div>
        </div>
        <div className="analytics-chart-card">
          <div className="analytics-chart-head">
            <b>Severity pressure</b>
            <span>Current incident intensity</span>
          </div>
          <svg
            viewBox="0 0 220 120"
            className="analytics-svg"
            role="img"
            aria-label="Severity chart"
          >
            {severityBreakdown.map(([level, count], index) => {
              const barHeight = Math.max(12, (count / maxSeverity) * 80);
              const x = 24 + index * 48;
              const y = 92 - barHeight;
              const color =
                level === "Critical"
                  ? "#ef4444"
                  : level === "High"
                    ? "#fb923c"
                    : level === "Medium"
                      ? "#facc15"
                      : "#38bdf8";
              return (
                <g key={level}>
                  <rect
                    x={x}
                    y={y}
                    width="24"
                    height={barHeight}
                    rx="6"
                    fill={color}
                  />
                  <text
                    x={x + 12}
                    y="108"
                    textAnchor="middle"
                    className="analytics-bar-label"
                  >
                    {level}
                  </text>
                  <text
                    x={x + 12}
                    y={y - 6}
                    textAnchor="middle"
                    className="analytics-bar-value"
                  >
                    {count}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="analytics-insight-list">
          {reportTypeBreakdown.map(([type, count]) => (
            <div className="analytics-insight" key={type}>
              <div className="analytics-insight-label">
                <span>
                  <ReportTypeIcon
                    type={type}
                    size={13}
                    color={REPORT_TYPE_STYLES[type]?.color || "#38bdf8"}
                  />
                  {type}
                </span>
                <strong>{count}</strong>
              </div>
              <div className="analytics-insight-bar">
                <div style={{ width: `${(count / maxType) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="analytics-result">
          <b>Current result</b>
          <span>{result}</span>
          <button
            type="button"
            className="analytics-clear"
            onClick={() => {
              onClear();
              setResult("Analysis overlays cleared");
            }}
          >
            Clear analysis
          </button>
        </div>
      </div>
      <div className="analytics-grid">
        {ANALYTIC_TOOLS.map((tool) => (
          <button key={tool} onClick={() => run(tool)}>
            <b>{tool}</b>
            <small>{ANALYTIC_HELP[tool]}</small>
          </button>
        ))}
      </div>
      <div className="analytics-summary">
        <span>Incidents: {incidents.length}</span>
        <span>Field personnel: {officers.length}</span>
        <span>Point layers: {pointLayers.length}</span>
        <span>Selected: {selected?.title || "None"}</span>
      </div>
      <label className="csv-drop">
        Browse to or drag a spreadsheet here to visualize, and append map data
        to it.<small>Only plot point CSV in Lat/Lon projection</small>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onCsv(e.target.files?.[0], setResult)}
        />
      </label>
    </section>
  );
}

function Dashboard({ session, onLogout }) {
  const [incidents, setIncidents] = useState([]);
  const [users, setUsers] = useState([]);
  const [reportUsers, setReportUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [newPoint, setNewPoint] = useState(null);
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
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analysisLayers, setAnalysisLayers] = useState([]);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);
  const [activeEmergency, setActiveEmergency] = useState(null);
  const [mapLayers, setMapLayers] = useState([]);
  const [drawMode, setDrawMode] = useState("");
  const [areas, setAreas] = useState(() =>
    JSON.parse(localStorage.getItem("command-areas") || "[]"),
  );
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
  const [sharingCamera, setSharingCamera] = useState(false);
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [chatPanel, setChatPanel] = useState(false);
  const [chatRooms, setChatRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [mapMenu, setMapMenu] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(
    () => Number(localStorage.getItem("sidebar-width")) || 340,
  );
  const mapRef = useRef(null);
  const socketRef = useRef(null);
  const gpsWatchRef = useRef(null);
  const gpsBestRef = useRef(null);
  const localCameraStreamRef = useRef(null);
  const rtcPeersRef = useRef({});
  const activeRoomRef = useRef(null);
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
                OFFICER_POSITIONS[index % OFFICER_POSITIONS.length][0]),
            lng:
              live?.lng ??
              (Number(u.lng) ||
                OFFICER_POSITIONS[index % OFFICER_POSITIONS.length][1]),
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
  const canCreateCustomReportType = ["Admin", "Super Admin"].includes(
    session.user.role,
  );
  const canManagePersonnel =
    ["Super Admin", "Admin"].includes(session.user.role);
  const canSeeReport = (item) =>
    canAdmin ||
    item.createdBy === session.user.id ||
    item.assignedTo === session.user.id ||
    (item.visibleTo || []).includes(session.user.id);
  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);
  useEffect(() => {
    const beforeInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
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
    return () =>
      window.removeEventListener("beforeinstallprompt", beforeInstall);
  }, []);
  useEffect(() => {
    Promise.all([
      request("/incidents", session.token),
      request("/users", session.token),
      request("/report-viewers", session.token),
      request("/cameras", session.token),
      request("/map-layers", session.token),
      request("/chat/rooms", session.token),
    ])
      .then(([a, b, viewers, c, d, e]) => {
        setIncidents(a);
        setUsers(b);
        setReportUsers(viewers.filter((user) => user.role !== "Super Admin"));
        setCameras(c);
        setMapLayers(d);
        setChatRooms(e);
      })
      .catch((err) => {
        if (err.message.includes("Session expired")) onLogout();
        else setNotice(err.message);
      });
    const socket = io({
      transports: ["polling", "websocket"],
      reconnectionAttempts: 10,
      timeout: 15000,
    });
    socketRef.current = socket;
    socket.on("connect_error", () =>
      setNotice("Realtime connection is reconnecting..."),
    );
    const announceCameraShare = () =>
      socket.emit("camera:share:start", {
        userId: session.user.id,
        name: session.user.name,
        type: "Phone",
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
    };
    socket.on("connect", registerCameraUser);
    if (socket.connected) registerCameraUser();
    const makePeer = (key, remoteUserId) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
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
        old.some((x) => x.userId === feed.userId) ? old : [...old, feed],
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
      const pc = makePeer(viewerSocketId);
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
        pc ||= makePeer(from, fromUserId);
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
    return () => {
      if (gpsWatchRef.current != null)
        navigator.geolocation?.clearWatch(gpsWatchRef.current);
      localCameraStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());
      Object.values(rtcPeersRef.current).forEach((pc) => pc.close());
      socket.close();
      socketRef.current = null;
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
      body: JSON.stringify(form),
    });
    setIncidents((old) =>
      old.some((i) => i.id === item.id) ? old : [item, ...old],
    );
    setNewPoint(null);
    setSelected(item);
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
      unitType.includes("hqt") ||
      normalizeCommand(user.command) === "Oyo State Command";
    if (isHeadquarters) {
      mapRef.current?.fitBounds(OYO_BOUNDS);
      return;
    }
    const userCommand = normalizeCommand(user.command || user.unit);
    const unitNames = new Set(
      divisionsForCommand(userCommand).map((unit) => unit.name.toLowerCase()),
    );
    const sameCommandUsers = users.filter(
      (item) =>
        normalizeCommand(item.command) === userCommand ||
        unitNames.has(String(item.unit || item.division || "").toLowerCase()),
    );
    const sameDivisionUsers = users.filter(
      (item) =>
        String(item.division || item.unit || "").toLowerCase() ===
        String(user.division || user.unit || "").toLowerCase(),
    );
    const sameStationUsers = users.filter(
      (item) =>
        String(item.station || item.unit || "").toLowerCase() ===
        String(user.station || user.unit || "").toLowerCase(),
    );
    const localUsers = unitType.includes("station")
      ? sameStationUsers
      : unitType.includes("division")
        ? sameDivisionUsers
        : sameCommandUsers;
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
  const updateUserPassword = async (user, password) => {
    await request(`/users/${user.id}/password`, session.token, {
      method: "PUT",
      body: JSON.stringify({ password }),
    });
    setNotice(`Password updated for ${user.name}`);
    setTimeout(() => setNotice(""), 2500);
  };
  const changeOwnPassword = async () => {
    const password = window.prompt("Enter your new password");
    if (!password) return;
    await updateUserPassword(session.user, password);
  };
  const installApp = async () => {
    if (!installPrompt) {
      setNotice(
        "If Install is not available yet, use your browser menu: Add to Home screen / Install app.",
      );
      setTimeout(() => setNotice(""), 3500);
      return;
    }
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => {});
    setInstallPrompt(null);
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
  const sendChatMessage = async (body) => {
    if (!activeRoom) return;
    const message = await request(
      `/chat/rooms/${activeRoom.id}/messages`,
      session.token,
      { method: "POST", body: JSON.stringify({ body }) },
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
    setNewPoint({
      ...(center || { lat: OYO_CENTER[0], lng: OYO_CENTER[1] }),
      geometry: area,
    });
    setDrawMode("");
    setNotice("Incident area captured. Complete the incident form.");
    setTimeout(() => setNotice(""), 2500);
  };
  const clearAreas = () => {
    if (!areas.length || !window.confirm("Remove all drawn operational areas?"))
      return;
    setAreas([]);
    localStorage.removeItem("command-areas");
  };
  const toggleGps = () => {
    if (sharingGps) {
      if (gpsWatchRef.current != null)
        navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
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
    setNotice("Waiting for GPS permission...");
    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point = {
          userId: session.user.id,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speed: position.coords.speed || 0,
          heading: position.coords.heading || 0,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString(),
        };
        socketRef.current?.emit("gps:update", point);
        setGpsPositions((old) => ({
          ...old,
          [session.user.id]: { ...point, offline: false },
        }));
        setNotice("Live GPS is being shared");
      },
      (error) => {
        setSharingGps(false);
        gpsWatchRef.current = null;
        setNotice(
          error.code === 1
            ? "Location permission was denied"
            : "Unable to read this device location",
        );
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    );
  };
  const locateMe = () => {
    const flyToPoint = (point, message = "Centered on your location") => {
      if (!point) return;
      mapRef.current?.flyTo([Number(point.lat), Number(point.lng)], 17);
      setCoords(`${Number(point.lat).toFixed(6)}, ${Number(point.lng).toFixed(6)}`);
      setNotice(message);
      setTimeout(() => setNotice(""), 2500);
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          flyToPoint({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }),
        () =>
          flyToPoint(
            gpsPositions[session.user.id] || session.user,
            "Centered on last known location",
          ),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
      );
      return;
    }
    flyToPoint(gpsPositions[session.user.id] || session.user, "Centered on last known location");
  };
  const sendEmergency = async (details) => {
    const fallback = gpsPositions[session.user.id] || session.user;
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
        (p) => dispatch({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () =>
          dispatch({
            lat: fallback.lat || OYO_CENTER[0],
            lng: fallback.lng || OYO_CENTER[1],
          }),
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 1500 },
      );
    else
      dispatch({
        lat: fallback.lat || OYO_CENTER[0],
        lng: fallback.lng || OYO_CENTER[1],
      });
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
        ? `Nearest officer: ${nearest.name} - ${formatDistance(nearest.distance)}. Green line drawn.`
        : "No officers available";
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
  const toggleCamera = async () => {
    if (sharingCamera) {
      localCameraStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());
      localCameraStreamRef.current = null;
      Object.values(rtcPeersRef.current).forEach((pc) => pc.close());
      rtcPeersRef.current = {};
      socketRef.current?.emit("camera:share:stop", { userId: session.user.id });
      setSharingCamera(false);
      setNotice("Camera sharing stopped");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });
      localCameraStreamRef.current = stream;
      setSharingCamera(true);
      socketRef.current?.emit("camera:share:start", {
        userId: session.user.id,
        name: session.user.name,
        type: "Phone",
      });
      setNotice("Phone camera is live to command");
    } catch (error) {
      setNotice(
        error.name === "NotAllowedError"
          ? "Camera permission was denied"
          : "Unable to start this camera",
      );
    }
    setTimeout(() => setNotice(""), 3000);
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
  const viewPhoneCamera = (officerId) =>
    socketRef.current?.emit("camera:view:request", { officerId });
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
    <main className="app-shell">
      {operationsOpen && (
        <button
          className="operations-backdrop"
          onClick={() => setOperationsOpen(false)}
          aria-label="Close sidebar"
        ></button>
      )}
      <aside
        className={`command-sidebar ${operationsOpen ? "open" : ""}`}
        style={{ "--sidebar-width": `${sidebarWidth}px` }}
      >
        <div className="sidebar-brand">
          <div className="brand-small">
            <img className="sidebar-logo" src="/bsa-logo.png" alt="BSA Oyo Ahead" />
            <div>
              <b>Election Monitor</b>
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
        {analyticsOpen && canAdmin ? (
          <div className="sidebar-panel-view">
            <div className="sidebar-panel-head">
              <div>
                <span className="eyebrow">ANALYTIC TOOLS</span>
                <h2>Map analysis</h2>
              </div>
              <button
                className="icon-btn"
                onClick={() => setAnalyticsOpen(false)}
              >
                <FaTimes />
              </button>
            </div>
            <AnalyticsPanel
              incidents={incidents}
              officers={officers}
              mapLayers={mapLayers}
              selected={selected}
              onClose={() => setAnalyticsOpen(false)}
              onTool={runAnalyticTool}
              onCsv={importCsvPoints}
              onClear={clearMapTools}
              sidebar
            />
          </div>
        ) : (
          <>
            <div className="sidebar-actions compact">
              <button
                onClick={() => {
                  setToolsOpen((value) => !value);
                  setAnalyticsOpen(false);
                }}
                className={toolsOpen ? "active" : ""}
              >
                <FaTools /> Tools
              </button>
              {toolsOpen && (
                <div className="tools-grid sidebar-tools-grid sidebar-tools-dropdown">
                  <button
                    className={drawMode === "measure" ? "active" : ""}
                    onClick={() => setMapDrawTool("measure")}
                  >
                    <b>
                      <FaRulerCombined /> Measure
                    </b>
                    <span>Distance on map</span>
                  </button>
                  <button
                    className={drawMode === "route" ? "active" : ""}
                    onClick={() => setMapDrawTool("route")}
                  >
                    <b>
                      <FaRoute /> Route
                    </b>
                    <span>Start and destination</span>
                  </button>
                  <form className="route-input-tool" onSubmit={routeFromInputs}>
                    <input
                      value={routeStartInput}
                      onChange={(e) => setRouteStartInput(e.target.value)}
                      placeholder="Start place or my location"
                    />
                    <input
                      value={routeEndInput}
                      onChange={(e) => setRouteEndInput(e.target.value)}
                      placeholder="Destination"
                    />
                    {routeGuide && <small>{routeGuide}</small>}
                    <div>
                      <button type="submit">
                        <FaRoute /> Use Route
                      </button>
                      <button type="button" onClick={rerouteFromHere}>
                        Reroute
                      </button>
                    </div>
                  </form>
                  {canCreateCustomReportType && (
                    <button
                      className={drawMode === "circle" ? "active" : ""}
                      onClick={() => setMapDrawTool("circle")}
                    >
                      <b>
                        <FaCircle /> Circle Incident
                      </b>
                      <span>Radius incident</span>
                    </button>
                  )}
                  {canCreateCustomReportType && (
                    <button
                      className={drawMode === "freehand" ? "active" : ""}
                      onClick={() => setMapDrawTool("freehand")}
                    >
                      <b>
                        <FaDrawPolygon /> Freehand Incident
                      </b>
                      <span>Draw area</span>
                    </button>
                  )}
                  {hasMapTools && (
                    <button className="danger-tool" onClick={clearMapTools}>
                      <b>
                        <FaTools /> Clear Tools
                      </b>
                      <span>Remove overlays</span>
                    </button>
                  )}
                  {areas.length > 0 && (
                    <button onClick={shareAreas}>
                      <b>
                        <FaMapMarkedAlt /> Share Area
                      </b>
                      <span>Latest area</span>
                    </button>
                  )}
                  {areas.length > 0 && (
                    <button className="danger-tool" onClick={clearAreas}>
                      <b>
                        <FaTools /> Clear Areas
                      </b>
                      <span>Remove areas</span>
                    </button>
                  )}
                  {canAdmin && (
                    <button onClick={() => setMapDataPanel(true)}>
                      <b>
                        <FaMapMarkedAlt /> Map Data
                      </b>
                      <span>{mapLayers.length} layers</span>
                    </button>
                  )}
                  {canManagePersonnel && (
                    <button onClick={() => setManageOfficers(true)}>
                      <b>
                        <FaUserCog /> Manage Users
                      </b>
                      <span>Users</span>
                    </button>
                  )}
                  <button onClick={toggleGps}>
                    <b>
                      <FaBullseye /> {sharingGps ? "Stop GPS" : "Share GPS"}
                    </b>
                    <span>Location</span>
                  </button>
                  <button onClick={toggleCamera}>
                    <b>
                      <FaVideo /> {sharingCamera ? "Stop Camera" : "Share Camera"}
                    </b>
                    <span>Phone feed</span>
                  </button>
                  <button onClick={() => setCameraPanel(true)}>
                    <b>
                      <FaVideo /> Cameras
                    </b>
                    <span>{phoneShares.length + cameras.length} feeds</span>
                  </button>
                  <button onClick={() => setChatPanel(true)}>
                    <b>
                      <FaComments /> Chat
                    </b>
                    <span>{chatRooms.length} rooms</span>
                  </button>
                  <button onClick={refreshApp}>
                    <b>
                      <FaSyncAlt /> {updateReady ? "Update Ready" : "Update App"}
                    </b>
                    <span>Refresh</span>
                  </button>
                  <button onClick={changeOwnPassword}>
                    <b>
                      <FaKey /> Change Password
                    </b>
                    <span>Account</span>
                  </button>
                </div>
              )}
              <button onClick={() => setChatPanel(true)}>
                <FaComments /> Chat <i>{chatRooms.length}</i>
              </button>
              {canManagePersonnel && (
                <button onClick={() => setManageOfficers(true)}>
                  <FaUserCog /> Users
                </button>
              )}
              {canAdmin && (
                <button onClick={() => setMapDataPanel(true)}>
                  <FaMapMarkedAlt /> Map Data
                </button>
              )}
              <button onClick={refreshApp}>
                <FaSyncAlt /> {updateReady ? "Install update" : "Refresh"}
              </button>
              <button onClick={onLogout}>
                <FaSignOutAlt /> Logout
              </button>
            </div>
            <div className="side-heading">
              <div>
                <span className="eyebrow">LIVE INCIDENTS</span>
                <h2>
                  Incidents <em>{incidents.length}</em>
                </h2>
              </div>
            </div>
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
                    <span title={item.reportType || "Incident"}>
                        <ReportTypeIcon
                          type={item.reportType}
                          size={12}
                          color={reportStyle(item).color}
                        />
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
            <div className="officer-summary">
              <div className="side-heading">
                <h3>Field Ops</h3>
                <div className="unit-actions">
                  <span>
                    {officers.filter((x) => x.status === "Active").length}{" "}
                    active
                  </span>
                  {canManagePersonnel && (
                    <button onClick={() => setManageOfficers(true)}>
                      Manage
                    </button>
                  )}
                </div>
              </div>
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
          </>
        )}
        <button
          className="sidebar-resizer"
          onPointerDown={resizeSidebar}
          aria-label="Resize sidebar"
          title="Drag to resize sidebar"
        ></button>
      </aside>
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
            <div className={`map-home-menu ${mapMenu === "home" ? "open" : ""}`}>
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
              </div>
            </div>
            <div className={`map-home-menu incident-menu ${mapMenu === "incident" ? "open" : ""}`}>
              <button
                className="map-menu-trigger"
                type="button"
                title="New incident"
                onClick={() => {
                  if (!canCreateCustomReportType) {
                    openIncidentPointForm();
                    return;
                  }
                  setMapMenu((value) => (value === "incident" ? "" : "incident"));
                }}
              >
                <ReportIcon iconKey="IP" size={14} />
              </button>
              {canCreateCustomReportType && (
                <div className="map-home-dropdown">
                  <button
                    onClick={() => {
                      pickIncidentPoint();
                      setMapMenu("");
                    }}
                  >
                    <ReportIcon iconKey="IP" size={14} /> Point
                  </button>
                  <button
                    onClick={() => {
                      startIncidentArea("circle");
                      setMapMenu("");
                    }}
                  >
                    <FaCircle /> Circle
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
            </div>
            <div className={`map-home-menu map-layer-menu ${mapMenu === "layers" ? "open" : ""}`}>
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
            </div>
            <button
              className="map-action street-view-tool icon-only"
              onClick={openStreetPhotos}
              title="Street View"
            >
              <FaStreetView />
            </button>
            {hasMapTools && (
              <button
                className="map-action clear-tools-btn"
                onClick={() => {
                  clearMapTools();
                }}
                title="Clear tools"
              >
                <FaEraser />
              </button>
            )}
            <button
              className={`map-action ${sharingGps ? "active" : ""}`}
              onClick={toggleGps}
              title={sharingGps ? "Stop location sharing" : "Share location"}
            >
              <LuLocateFixed />
            </button>
            <button
              className={`map-action ${sharingCamera ? "active" : ""}`}
              onClick={toggleCamera}
              title={sharingCamera ? "Stop camera sharing" : "Share camera"}
            >
              <FaVideo />
            </button>
            {canAdmin && (
              <button
                className="map-action"
                onClick={() => {
                  setAnalyticsOpen(true);
                  setOperationsOpen(true);
                }}
                title="Analytics"
              >
                <FaChartBar />
              </button>
            )}
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
            <button
              className="map-action"
              onClick={() => shareMap()}
              title="Share map"
            >
              <FaLocationArrow />
            </button>
            <button
              className="map-action emergency-open"
              onClick={() => setEmergencyOpen(true)}
              title="SOS"
            >
              SOS
            </button>
          </div>
          <div className="map-top-right">
            <form className="coord-jump" onSubmit={jump}>
              <span>COORD</span>
              <input
                value={coords}
                onChange={(e) => setCoords(e.target.value)}
                placeholder="7.3775, 3.9470"
              />
              <button>GO</button>
            </form>
            <button
              className="map-action logout-btn"
              onClick={onLogout}
              title="Logout"
            >
              <FaSignOutAlt />
            </button>
          </div>
        </div>
        <MapView
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
        />
        <button
          className="my-location-target"
          onClick={locateMe}
          title="Locate me"
        >
          <LuLocateFixed />
        </button>
      </section>
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
            <span style={{ color: reportStyle(selected).color }}>
              <FaCircle size={10} /> {selected.severity.toUpperCase()}
            </span>
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
          {selected.media?.length > 0 && (
            <div className="report-media-grid">
              {selected.media.map((item, index) =>
                item.type === "video" ? (
                  <video key={index} src={item.data} controls playsInline />
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
                {reportUsers.find((x) => x.id === selected.assignedTo)?.name ||
                  officers.find((x) => x.id === selected.assignedTo)?.name ||
                  "Unassigned"}
              </dd>
            </div>
            <div>
              <dt>VISIBLE TO</dt>
              <dd>
                {canAdmin
                  ? "Admin and CP see all incidents"
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
          {canAdmin && (
            <button className="delete-incident wide" onClick={deleteIncident}>
              Delete incident
            </button>
          )}
        </section>
      )}
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
        <IncidentForm
          point={newPoint}
          users={reportUsers}
          onClose={() => setNewPoint(null)}
          onSave={save}
          isAdmin={canCreateCustomReportType}
        />
      )}
      {emergencyOpen && (
        <EmergencyPanel
          onClose={() => setEmergencyOpen(false)}
          onSend={sendEmergency}
        />
      )}
      {manageOfficers && (
        <OfficerManager
          users={users}
          currentUser={session.user}
          onClose={() => setManageOfficers(false)}
          onCreate={createOfficer}
          onDelete={deleteOfficer}
          onPassword={updateUserPassword}
        />
      )}
      {cameraPanel && (
        <CameraPanel
          cameras={cameras}
          phoneShares={phoneShares}
          remoteStreams={remoteStreams}
          isAdmin={canAdmin}
          onClose={() => setCameraPanel(false)}
          onCreate={createCamera}
          onDelete={deleteCamera}
          onView={viewPhoneCamera}
          onShowMap={showCameraOnMap}
        />
      )}
      {mapDataPanel && (
        <MapDataPanel
          layers={mapLayers}
          isSuperAdmin={session.user.role === "Super Admin"}
          onClose={() => setMapDataPanel(false)}
          onCreate={createMapLayer}
          onUpdate={updateMapLayer}
          onDelete={deleteMapLayer}
        />
      )}
      {chatPanel && (
        <ChatPanel
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
      {notice && <div className="toast">OK {notice}</div>}
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const stored = localStorage.getItem("command-session");
      if (stored) return JSON.parse(stored);
      const sessionStored = sessionStorage.getItem("command-session");
      return sessionStored ? JSON.parse(sessionStored) : null;
    } catch {
      return null;
    }
  });
  const login = (value, rememberMe = true) => {
    const sessionValue = JSON.stringify(value);
    if (rememberMe) {
      localStorage.setItem("command-session", sessionValue);
      sessionStorage.removeItem("command-session");
    } else {
      sessionStorage.setItem("command-session", sessionValue);
      localStorage.removeItem("command-session");
    }
    setSession(value);
  };
  const logout = () => {
    localStorage.removeItem("command-session");
    sessionStorage.removeItem("command-session");
    setSession(null);
  };
  return session ? (
    <Dashboard session={session} onLogout={logout} />
  ) : (
    <Login onLogin={login} />
  );
}
