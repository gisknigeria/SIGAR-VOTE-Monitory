import { useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { lazy, Suspense } from "react";
import L from "leaflet";
import { io } from "socket.io-client";
import { API_BASE_URL } from "../../config.js";
import { apiRequest as request } from "../../api/client.js";
import { useDashboardQueries } from "../../queries/dashboard.js";
import {
  FaBullseye,
  FaCamera,
  FaChartBar,
  FaCircle,
  FaClipboardList,
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
  MdHexagon,
  MdAssessment,
  MdHowToVote,
} from "react-icons/md";
import ProfileModal from "./ProfileModal.jsx";
import DashboardChatPanel from "./ChatPanel.jsx";
import DashboardEmergencyPanel from "./EmergencyPanel.jsx";
import DashboardMapDataPanel from "./MapDataPanel.jsx";
import DashboardToolsPanel from "./ToolsPanel.jsx";
import Toast from "../ui/Toast.jsx";
import NotificationCenter from "./NotificationCenter.jsx";
import IncidentNotificationModal from "./IncidentNotificationModal.jsx";
import StreamVideo from "./StreamVideo.jsx";
import MapView from "./MapView.jsx";
import "../../notification-styles.css";

const loadFieldModals = () => import("./FieldModals.jsx");
const DashboardCameraPanel = lazy(() => import("./CameraPanel.jsx"));
const AssignIncidentModal = lazy(() => import("./AssignIncidentModal.jsx"));
const SupervisorIncidentListModal = lazy(() => import("./SupervisorIncidentListModal.jsx"));
const ResultsCenter = lazy(() => import("./ResultsCenter.jsx"));
const IncidentForm = lazy(() => loadFieldModals().then((module) => ({ default: module.IncidentForm })));
const OfficerManager = lazy(() => loadFieldModals().then((module) => ({ default: module.OfficerManager })));
const PartyManager = lazy(() => loadFieldModals().then((module) => ({ default: module.PartyManager })));
const PollingResultForm = lazy(() => loadFieldModals().then((module) => ({ default: module.PollingResultForm })));

const OYO_CENTER = [7.3775, 3.947];
const OYO_BOUNDS = [
  [6.73, 2.67],
  [8.38, 4.6],
];
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
const POLLING_RESULT_TYPE = "Polling Unit Result";
const RESULT_SOURCES = ["Agent", "Supervisor", "INEC IReV"];
const COMMAND_PARTY = "Party";

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

const playFieldNotification = (notification = {}) => {
  navigator.vibrate?.([180, 90, 180]);
  const title = notification.incidentType || "New field alert";
  const body = notification.message || "Open the app to read this alert.";
  if ("Notification" in window && Notification.permission === "granted") {
    navigator.serviceWorker?.ready
      .then((reg) => reg.showNotification(title, {
        body,
        tag: notification.id || "field-notification",
        renotify: true,
        icon: "/bsa-logo.png",
      }))
      .catch(() => new Notification(title, { body }));
  } else if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
};

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

const MAP_VIEW_HELPERS = {
  formatDistance,
  formatDuration,
  hexToRgba,
  LINE_STYLES,
  OYO_CENTER,
  pointArray,
  pointIconSvg,
  REPORT_TYPE_STYLES,
  reportCenter,
  reportIconSvg,
  reportStyle,
  totalDistance,
};

const RESULTS_HELPERS = {
  COMMAND_PARTY,
  parseResultEntries,
  POLLING_RESULT_TYPE,
  REPORT_TYPE_STYLES,
  ReportTypeIcon,
  RESULT_SOURCES,
};

import DashboardView from "./DashboardView.jsx";

function DashboardRuntime({ session, onLogout, onSessionUpdate }) {
  const dashboardQueries = useDashboardQueries(session);
  const incidentsData = dashboardQueries.incidents.data;
  const usersData = dashboardQueries.users.data;
  const reportViewersData = dashboardQueries.reportViewers.data;
  const camerasData = dashboardQueries.cameras.data;
  const mapLayersData = dashboardQueries.mapLayers.data;
  const chatRoomsData = dashboardQueries.chatRooms.data;
  const partiesData = dashboardQueries.parties.data;
  const startupError = Object.values(dashboardQueries).find((query) => query.error)?.error;
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
  const [focusedOfficerId, setFocusedOfficerId] = useState("");
  const [resultsOpen, setResultsOpen] = useState(false);
  const [resultsInitialView, setResultsInitialView] = useState("pulse");
  const [partyMapAnalysis, setPartyMapAnalysis] = useState(null);
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
  const [showBoundaryNames, setShowBoundaryNames] = useState(true);
  const [selectedBoundaryState, setSelectedBoundaryState] = useState("");
  const [selectedBoundaryLabel, setSelectedBoundaryLabel] = useState("");
  const [drawMode, setDrawMode] = useState("");
  const [areas, setAreas] = useState(() =>
    JSON.parse(localStorage.getItem("command-areas") || "[]"),
  );

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
  const [supervisorMapOpen, setSupervisorMapOpen] = useState(false);
  const [chatPanel, setChatPanel] = useState(false);
  const [chatRooms, setChatRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [assignIncidentOpen, setAssignIncidentOpen] = useState(false);
  const [incidentToAssign, setIncidentToAssign] = useState(null);
  const [supervisorIncidentsOpen, setSupervisorIncidentsOpen] = useState(false);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
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
          const hasLiveLocation = Number.isFinite(Number(live?.lat)) && Number.isFinite(Number(live?.lng));
          const hasStoredLocation = Number.isFinite(Number(u.lat)) && Number.isFinite(Number(u.lng));
          return {
            ...u,
            lat:
              (hasLiveLocation ? Number(live.lat) : null) ??
              (hasStoredLocation ? Number(u.lat) :
                FIELD_TEAM_POSITIONS[index % FIELD_TEAM_POSITIONS.length][0]),
            lng:
              (hasLiveLocation ? Number(live.lng) : null) ??
              (hasStoredLocation ? Number(u.lng) :
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
            hasLiveLocation,
            hasLastKnownLocation: hasLiveLocation || hasStoredLocation,
            locationName:
              u.pollingUnit ||
              [u.ward, u.lga, u.state].filter(Boolean).join(", ") ||
              u.unit ||
              "Last known location",
          };
        }),
    [users, gpsPositions],
  );
  const focusOfficerOnMap = (officer) => {
    if (focusedOfficerId === officer?.id) {
      setFocusedOfficerId("");
      return;
    }
    if (!officer?.hasLastKnownLocation) {
      setNotice(`No last seen location is available for ${officer?.name || "this user"}`);
      setTimeout(() => setNotice(""), 2500);
      return;
    }
    const lat = Number(officer.lat);
    const lng = Number(officer.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setFocusedOfficerId(officer.id);
    setSelected(null);
    setCoords(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    mapRef.current?.flyTo([lat, lng], 17);
    setNotice(`${officer.name} — ${officer.locationName}`);
    setTimeout(() => setNotice(""), 2500);
  };
  const canAdmin = ["Admin", "Super Admin"].includes(session.user.role);
  const isAgent = session.user.role === "Agent";
  const isSupervisor = session.user.role === "Supervisor";
  const isFieldRole = isAgent || isSupervisor;
  const formatWardList = (value) =>
    String(value || "")
      .split(",")
      .map((ward) => ward.trim())
      .filter(Boolean);
  const canCreateCustomReportType = ["Admin", "Super Admin"].includes(
    session.user.role,
  );
  const canManagePersonnel =
    ["Super Admin", "Admin"].includes(session.user.role);
  const parseWardList = (value) =>
    String(value || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  const wardInScope = (itemWard, viewerWard) => {
    const viewerWards = new Set(parseWardList(viewerWard));
    return parseWardList(itemWard).some((ward) => viewerWards.has(ward));
  };
  const isSupervisorWardRelevant = (item) => {
    if (!isSupervisor || !session.user.lga || !session.user.ward) return false;
    if (!item) return false;
    const sameLga = String(item.lga || "").trim().toLowerCase() === String(session.user.lga || "").trim().toLowerCase();
    const sameWard = wardInScope(item.ward, session.user.ward);
    const isSos = item.reportType === "SOS-Emergency" || item.style?.source === "sos";
    return sameLga && (sameWard || isSos);
  };
  const canSeeReport = (item) =>
    canAdmin ||
    (isSupervisor && (item.assignedTo === session.user.id || isSupervisorWardRelevant(item))) ||
    item.assignedTo === session.user.id ||
    item.createdBy === session.user.id ||
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
    if (Array.isArray(incidentsData)) setIncidents(incidentsData);
    if (Array.isArray(usersData)) setUsers(usersData);
    if (Array.isArray(reportViewersData)) {
      setReportUsers(reportViewersData.filter((user) => user.role !== "Super Admin"));
    }
    if (Array.isArray(camerasData)) setCameras(camerasData);
    if (Array.isArray(mapLayersData)) setMapLayers(mapLayersData);
    if (Array.isArray(chatRoomsData)) setChatRooms(chatRoomsData);
    if (Array.isArray(partiesData)) setParties(partiesData);
  }, [incidentsData, usersData, reportViewersData, camerasData, mapLayersData, chatRoomsData, partiesData]);
  useEffect(() => {
    if (!startupError) return;
    setNotice(
      startupError.status === 401
        ? "Unable to verify your session right now. Your login has been kept; please try again shortly."
        : startupError.message,
    );
  }, [startupError]);
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
    const socket = io(API_BASE_URL || undefined, {
      transports: ["websocket", "polling"],
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
        setTurnStatus({ provider, region, route: ["metered", "cloudflare", "expressturn"].includes(provider) ? "ready" : "fallback" });
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
      if (session.user.role === "Supervisor" && !(x.role === "Agent" && String(x.lga || "").trim().toLowerCase() === String(session.user.lga || "").trim().toLowerCase() && String(x.ward || "").trim().toLowerCase() === String(session.user.ward || "").trim().toLowerCase())) return;
      if (session.user.role === "Agent") return;
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
    socket.on("notification:new", (notification) => {
      setNotifications((old) => [notification, ...old.filter((item) => item.id !== notification.id)]);
      if (isFieldRole) playFieldNotification(notification);
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
  const unreadCount = notifications.filter((item) => !item.read).length;
  const fetchNotifications = async () => {
    try {
      const data = await request("/notifications", session.token);
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn("Unable to load notifications", error);
    }
  };
  const handleAssignIncident = async ({ incidentId, assignedUserId, message }) => {
    const result = await request(`/incidents/${incidentId}/assign`, session.token, {
      method: "POST",
      body: JSON.stringify({ assignedUserId, message }),
    });
    setIncidents((old) =>
      old.map((item) => (item.id === incidentId ? { ...item, assignedTo: assignedUserId, status: "In Progress" } : item)),
    );
    setSelected((old) =>
      old && old.id === incidentId ? { ...old, assignedTo: assignedUserId, status: "In Progress" } : old,
    );
    if (result?.notification?.userId === session.user.id) {
      setNotifications((old) => [result.notification, ...old.filter((item) => item.id !== result.notification.id)]);
    }
    return result;
  };
  const handleClaimIncident = async (incidentId) => {
    const message = `I am claiming this incident for myself.`;
    return handleAssignIncident({
      incidentId,
      assignedUserId: session.user.id,
      message,
    });
  };
  const handleNotificationClick = async (notification) => {
    const markRead = () => {
      if (notification.read) return Promise.resolve(notification);
      return request(`/notifications/${notification.id}/read`, session.token, { method: "PUT" })
        .then((updated) => {
          setNotifications((old) => old.map((item) => (item.id === updated.id ? updated : item)));
          return updated;
        })
        .catch(() => notification);
    };
    if (notification.roomId) {
      await markRead();
      let room = chatRooms.find((item) => item.id === notification.roomId);
      if (!room) {
        const rooms = await request("/chat/rooms", session.token);
        setChatRooms(rooms);
        room = rooms.find((item) => item.id === notification.roomId);
      }
      if (room) await selectChatRoom(room);
      else setNotice("This admin chat is no longer available");
      return;
    }
    let incident = incidents.find((item) => item.id === notification.incidentId)
      || (selectedIncident?.id === notification.incidentId ? selectedIncident : null);
    if (!incident && notification.incidentId) {
      try {
        incident = await request(`/incidents/${notification.incidentId}`, session.token);
        setIncidents((old) => old.some((item) => item.id === incident.id)
          ? old.map((item) => item.id === incident.id ? incident : item)
          : [incident, ...old]);
      } catch {
        incident = null;
      }
    }
    setSelectedIncident(incident || null);
    setSelectedNotification(notification);
    setNotificationModalOpen(true);
    if (incident && Number.isFinite(Number(incident.lat)) && Number.isFinite(Number(incident.lng))) {
      request(`/location/reverse?lat=${encodeURIComponent(incident.lat)}&lng=${encodeURIComponent(incident.lng)}`, session.token)
        .then((location) => setSelectedIncident((current) => current?.id === incident.id ? { ...current, location } : current))
        .catch(() => {});
    }
    markRead();
  };
  const handleNotificationDone = async (incidentId) => {
    if (!selectedNotification) return;
    const updated = await request(`/notifications/${selectedNotification.id}/read`, session.token, {
      method: "PUT",
    });
    setNotifications((old) => old.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedIncident((old) => (old && old.id === incidentId ? { ...old, status: "Resolved" } : old));
    setIncidents((old) => old.map((item) => (item.id === incidentId ? { ...item, status: "Resolved" } : item)));
    if (incidentId) {
      await request(`/incidents/${incidentId}`, session.token, {
        method: "PUT",
        body: JSON.stringify({ status: "Resolved" }),
      }).catch(() => {});
    }
    setNotificationModalOpen(false);
    setSelectedNotification(null);
    setSelectedIncident(null);
  };
  const handleOpenNotificationChat = async (incidentId) => {
    if (!incidentId) throw new Error("Incident details are still loading. Please close this alert and try again.");
    let incident = incidents.find((item) => item.id === incidentId)
      || (selectedIncident?.id === incidentId ? selectedIncident : null);
    if (!incident) {
      incident = await request(`/incidents/${incidentId}`, session.token);
      setIncidents((old) => old.some((item) => item.id === incident.id) ? old : [incident, ...old]);
    }
    if (!incident) throw new Error("Incident not found");
    setNotificationModalOpen(false);
    await openIncidentChat(incident);
  };
  useEffect(() => {
    fetchNotifications();
  }, [session.token]);
  const visible = incidents.filter((i) => {
    if (i.reportType === POLLING_RESULT_TYPE) return false;
    if (isSupervisor) {
      const isRelevant =
        i.assignedTo === session.user.id ||
        isSupervisorWardRelevant(i) ||
        (i.visibleTo || []).includes(session.user.id);
      if (!isRelevant) return false;
    }
    return filter === "All" || i.severity === filter || i.status === filter;
  });
  const liveIncidentCount = incidents.filter((item) => item.reportType !== POLLING_RESULT_TYPE).length;
  const mapVisibleIncidents = showReports
    ? incidents.filter((i) => {
        if (isSupervisor && !canSeeReport(i)) return false;
        if (hiddenReportIds.includes(i.id)) return false;
        return showSosIncidents || (i.reportType !== "SOS-Emergency" && i.style?.source !== "sos");
      })
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
    const body = typeof payload === "string" ? payload : payload?.body || "";
    const attachments = Array.isArray(payload?.attachments) ? payload.attachments : [];
    const message = await request(
      `/chat/rooms/${activeRoom.id}/messages`,
      session.token,
      { method: "POST", body: JSON.stringify({ body, attachments }) },
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
      if (isAgent) {
        setNotice("GPS tracking is required for Agent accounts and cannot be turned off");
        return;
      }
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
    if (isAgent) setGpsRequiredBlocked(false);
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
  const controller = {
    activeEmergency,
    activeRoom,
    addArea,
    addChatMember,
    addToolPoint,
    analysisLayers,
    areas,
    areaSearchResult,
    AssignIncidentModal,
    assignIncidentOpen,
    cameraFacingMode,
    cameraLocation,
    cameraMicMuted,
    cameraPanel,
    cameras,
    canAdmin,
    canCreateCustomReportType,
    canManagePersonnel,
    changeUserRole,
    chatMessages,
    chatPanel,
    chatRooms,
    clearAreas,
    clearBoundarySelection,
    clearMapTools,
    COMMAND_PARTY,
    coords,
    createCamera,
    createChatRoom,
    createMapLayer,
    createOfficer,
    DashboardCameraPanel,
    DashboardChatPanel,
    DashboardEmergencyPanel,
    DashboardMapDataPanel,
    DashboardToolsPanel,
    deleteCamera,
    deleteChatRoom,
    deleteEmergency,
    deleteIncident,
    deleteMapLayer,
    deleteOfficer,
    dismissEmergency,
    drawMode,
    emergencyAlerts,
    emergencyOpen,
    FaBullseye,
    FaCamera,
    FaChartBar,
    FaCircle,
    FaClipboardList,
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
    fetchIpLog,
    filter,
    focusDefaultExtent,
    focusedOfficerId,
    focusOfficerOnMap,
    formatDistance,
    formatWardList,
    geocode,
    gpsBestRef,
    gpsPositions,
    gpsRequiredBlocked,
    handleAssignIncident,
    handleClaimIncident,
    handleNotificationClick,
    handleNotificationDone,
    handleOpenNotificationChat,
    hasMapTools,
    hiddenReportIds,
    importCsvPoints,
    IncidentForm,
    IncidentNotificationModal,
    incidents,
    incidentToAssign,
    ipLogData,
    ipLogFilter,
    ipLogLoading,
    ipLogOpen,
    isAgent,
    isFieldRole,
    isSupervisor,
    jump,
    layer,
    liveIncidentCount,
    liveIncidentsOpen,
    localCameraStreamRef,
    locateMe,
    LuLocateFixed,
    manageOfficers,
    MAP_LAYERS,
    MAP_VIEW_HELPERS,
    mapCameras,
    mapDataPanel,
    mapLayers,
    mapMenu,
    mapRef,
    MapView,
    mapVisibleIncidents,
    MdAssessment,
    MdHowToVote,
    measurePoints,
    newPoint,
    newResultPoint,
    notice,
    NotificationCenter,
    notificationModalOpen,
    notifications,
    OfficerManager,
    officers,
    onLogout,
    openIncidentChat,
    openIncidentPointForm,
    openPollingUnitResultForm,
    openStreetPhotos,
    operationsOpen,
    parties,
    PartyManager,
    partyManagerOpen,
    partyMapAnalysis,
    pendingAreaAction,
    phoneShares,
    pickIncidentPoint,
    POLLING_RESULT_TYPE,
    PollingResultForm,
    profileMenuOpen,
    ProfileModal,
    profileOpen,
    refreshApp,
    remoteStreams,
    ReportIcon,
    reportPendingArea,
    reportStyle,
    ReportTypeIcon,
    reportUsers,
    resizeSidebar,
    RESULTS_HELPERS,
    ResultsCenter,
    resultsInitialView,
    resultsOpen,
    routePoints,
    routeResult,
    routeUserPoint,
    runAnalyticTool,
    save,
    saveAreaSearch,
    saveParties,
    savePollingResult,
    saveProfile,
    search,
    searchPendingArea,
    selectChatRoom,
    selected,
    selectedBoundaryLabel,
    selectedBoundaryState,
    selectedIncident,
    selectedNotification,
    selfCameraPreview,
    sendChatMessage,
    sendEmergency,
    session,
    setAreaSearchResult,
    setAssignIncidentOpen,
    setCameraPanel,
    setCameraPreviewMode,
    setChatPanel,
    setCoords,
    setEmergencyOpen,
    setFilter,
    setFocusedOfficerId,
    setIncidentToAssign,
    setIpLogFilter,
    setIpLogOpen,
    setLayer,
    setLiveIncidentsOpen,
    setManageOfficers,
    setMapDataPanel,
    setMapDrawTool,
    setMapMenu,
    setNewPoint,
    setNewResultPoint,
    setNotificationModalOpen,
    setOperationsOpen,
    setPartyManagerOpen,
    setPartyMapAnalysis,
    setPendingAreaAction,
    setProfileMenuOpen,
    setProfileOpen,
    setResultsInitialView,
    setResultsOpen,
    setSearch,
    setSelected,
    setSelectedBoundaryLabel,
    setSelectedBoundaryState,
    setSelectedIncident,
    setSelectedNotification,
    setSelfCameraPreview,
    setShowBoundaryNames,
    setShowLgaBorders,
    setShowReports,
    setShowSosIncidents,
    setShowStateBorders,
    setSituationalOpen,
    setSupervisorIncidentsOpen,
    setSupervisorMapOpen,
    setToolsOpen,
    shareAreas,
    shareAreaSearch,
    shareMap,
    sharingCamera,
    sharingGps,
    showBoundaryLayer,
    showBoundaryNames,
    showCameraOnMap,
    showLgaBorders,
    showReports,
    showSosIncidents,
    showStateBorders,
    sidebarWidth,
    situationalOpen,
    sosHolding,
    sosHoldProps,
    startIncidentArea,
    startToolFromPoint,
    StreamVideo,
    SupervisorIncidentListModal,
    supervisorIncidentsOpen,
    supervisorMapOpen,
    Suspense,
    switchCamera,
    Toast,
    toggleCamera,
    toggleCameraMicrophone,
    toggleGps,
    toggleMapLayer,
    toolsOpen,
    turnStatus,
    unreadCount,
    updateLayerOpacity,
    updateMapLayer,
    updateOfficer,
    updateReady,
    updateUserPassword,
    users,
    viewPhoneCamera,
    visible,
  };

  return <DashboardView controller={controller} />;
}

export default DashboardRuntime;
