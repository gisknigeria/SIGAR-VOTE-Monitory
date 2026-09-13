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
import AuditLogViewer from "./AuditLogViewer.jsx";
import DashboardToolsPanel from "./ToolsPanel.jsx";
import Toast from "../ui/Toast.jsx";
import NotificationCenter from "./NotificationCenter.jsx";
import IncidentNotificationModal from "./IncidentNotificationModal.jsx";
import StreamVideo from "./StreamVideo.jsx";
import MapView from "./MapView.jsx";
import "../../notification-styles.css";

let fieldModalsPromise = null;
const loadFieldModals = () => (fieldModalsPromise ||= import("./FieldModals.jsx"));
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
import { useAdminChatOperations } from "./hooks/useAdminChatOperations.js";
import { useAnalyticsOperations } from "./hooks/useAnalyticsOperations.js";
import { useGpsEmergencyOperations } from "./hooks/useGpsEmergencyOperations.js";
import { useMapOperations } from "./hooks/useMapOperations.js";

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
  const incidentsHydratedRef = useRef(false);
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
  const [dataLayer, setDataLayer] = useState("none");
  const [coords, setCoords] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [manageOfficers, setManageOfficers] = useState(false);
  const [mapDataPanel, setMapDataPanel] = useState(false);
  const [auditLogOpen, setAuditLogOpen] = useState(false);
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
  const [viewerConnectFailed, setViewerConnectFailed] = useState({});
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
  const archiveRecorderRef = useRef(null);
  const archiveChunksRef = useRef([]);
  const archiveSegmentTimerRef = useRef(null);
  const archiveRunningRef = useRef(false);
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
  /**
   * Auto-saves every camera-share session to the evidence library, regardless
   * of whether anyone is watching live. Runs in ~45s segments (independent of
   * the offline-fallback recorder above) so a long session never produces one
   * blob larger than the server's per-recording byte cap.
   */
  const startArchiveRecording = () => {
    const stream = localCameraStreamRef.current;
    if (!stream || archiveRecorderRef.current || typeof MediaRecorder === "undefined") return;
    archiveRunningRef.current = true;
    const mimeType = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(type => MediaRecorder.isTypeSupported(type)) || "";
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 400000,
      audioBitsPerSecond: 32000,
    });
    const segmentStartedAt = new Date().toISOString();
    archiveChunksRef.current = [];
    archiveRecorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data?.size) archiveChunksRef.current.push(event.data);
    };
    recorder.onstop = async () => {
      clearTimeout(archiveSegmentTimerRef.current);
      archiveRecorderRef.current = null;
      const blob = new Blob(archiveChunksRef.current, { type: recorder.mimeType || mimeType || "video/webm" });
      archiveChunksRef.current = [];
      if (blob.size) {
        try {
          const dataUrl = await blobToDataUrl(blob);
          await request("/camera/recordings", session.token, {
            method: "POST",
            body: JSON.stringify({ dataUrl, startedAt: segmentStartedAt }),
          });
        } catch (error) {
          // Best-effort archive; a failed segment upload never interrupts the live share,
          // but it must not vanish silently either -- a rejected segment is the difference
          // between "recording" and an empty evidence library.
          console.warn("[camera] archive segment upload failed:", error.message);
        }
      }
      if (archiveRunningRef.current && sharingCameraRef.current) startArchiveRecording();
    };
    recorder.start(5000);
    archiveSegmentTimerRef.current = setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, 45000);
  };
  const stopArchiveRecording = () => {
    archiveRunningRef.current = false;
    clearTimeout(archiveSegmentTimerRef.current);
    if (archiveRecorderRef.current?.state !== "inactive")
      archiveRecorderRef.current?.stop();
  };
  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);
  useEffect(() => {
    if (Array.isArray(incidentsData)) {
      setIncidents((current) => {
        if (incidentsHydratedRef.current) return incidentsData;
        incidentsHydratedRef.current = true;
        const serverIds = new Set(incidentsData.map((incident) => incident.id));
        return [...incidentsData, ...current.filter((incident) => !serverIds.has(incident.id))];
      });
    }
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
    const clearViewerConnectFailed = (userId) =>
      setViewerConnectFailed((old) => {
        if (!(userId in old)) return old;
        const next = { ...old };
        delete next[userId];
        return next;
      });
    const CONNECT_FAILED_MESSAGE =
      "Unable to connect — likely a network issue on the agent's device. This session is still being recorded and will be available in Recordings shortly.";
    const CONNECT_INTERRUPTED_MESSAGE =
      "Live video connection interrupted. Recording continues in the background.";
    const makePeer = async (key, remoteUserId) => {
      const iceConfiguration = await iceConfigurationPromise;
      const pc = new RTCPeerConnection({
        iceServers: iceConfiguration.iceServers,
      });
      if (remoteUserId) clearViewerConnectFailed(remoteUserId);
      const connectionTimer = setTimeout(() => {
        if (pc.connectionState !== "connected") {
          if (localCameraStreamRef.current)
            startOfflineVideoRecording("Live video could not connect");
          if (remoteUserId)
            setViewerConnectFailed((old) => ({ ...old, [remoteUserId]: CONNECT_FAILED_MESSAGE }));
        }
      }, 15000);
      pc.onconnectionstatechange = async () => {
        if (pc.connectionState === "connected") {
          clearTimeout(connectionTimer);
          stopOfflineVideoRecording();
          if (remoteUserId) clearViewerConnectFailed(remoteUserId);
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
          if (remoteUserId)
            setViewerConnectFailed((old) => ({
              ...old,
              [remoteUserId]: pc.connectionState === "failed" ? CONNECT_FAILED_MESSAGE : CONNECT_INTERRUPTED_MESSAGE,
            }));
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
      clearViewerConnectFailed(userId);
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
    const pendingCandidates = new Map();
    const signalQueues = new Map();
    const handleCameraSignal = async ({ from, fromUserId, data }) => {
      let pc = rtcPeersRef.current[from];
      if (data.candidate) {
        if (!pc?.remoteDescription) {
          const candidates = pendingCandidates.get(from) || [];
          candidates.push(data.candidate);
          pendingCandidates.set(from, candidates);
        } else await pc.addIceCandidate(data.candidate);
        return;
      }
      if (data.sdp?.type === "offer") {
        if (pc && ["failed", "closed", "disconnected"].includes(pc.connectionState)) {
          pc.close();
          delete rtcPeersRef.current[from];
          pc = null;
        }
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
      if (pc?.remoteDescription) {
        const candidates = pendingCandidates.get(from) || [];
        pendingCandidates.delete(from);
        for (const candidate of candidates) await pc.addIceCandidate(candidate);
      }
    };
    socket.on("camera:signal", (signal) => {
      const previous = signalQueues.get(signal.from) || Promise.resolve();
      const next = previous.then(() => handleCameraSignal(signal)).catch((error) => {
        console.error("[camera] Video handshake failed", error);
        if (signal.fromUserId)
          setViewerConnectFailed((old) => ({ ...old, [signal.fromUserId]: CONNECT_FAILED_MESSAGE }));
      });
      signalQueues.set(signal.from, next);
      next.then(() => {
        if (signalQueues.get(signal.from) === next) signalQueues.delete(signal.from);
      });
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
  const operationContext = {};
  Object.assign(operationContext, {
    activeRoom,
    analysisLayers,
    areas,
    canAdmin,
    coords,
    drawMode,
    filter,
    formatDistance,
    formatDuration,
    gpsBestRef,
    gpsPositions,
    gpsWatchRef,
    incidents,
    isAgent,
    jump,
    L,
    layer,
    mapLayers,
    mapRef,
    measurePoints,
    notice,
    officers,
    onSessionUpdate,
    OYO_BOUNDS,
    OYO_CENTER,
    parties,
    pendingAreaAction,
    REPORT_TYPE_STYLES,
    reportCenter,
    request,
    routeEndInput,
    routePoints,
    routeResult,
    routeStartInput,
    search,
    selected,
    session,
    setActiveEmergency,
    setActiveRoom,
    setAnalysisLayers,
    setAreas,
    setAreaSearchResult,
    setChatMessages,
    setChatPanel,
    setChatRooms,
    setCoords,
    setDrawMode,
    setEmergencyAlerts,
    setEmergencyOpen,
    setGpsPositions,
    setGpsRequiredBlocked,
    setIncidents,
    setMapLayers,
    setMapMenu,
    setMeasurePoints,
    setNewPoint,
    setNewResultPoint,
    setNotice,
    setParties,
    setPartyManagerOpen,
    setPendingAreaAction,
    setProfileMenuOpen,
    setProfileOpen,
    setRoutePoints,
    setRouteResult,
    setRouteStartInput,
    setSharingGps,
    setSosHolding,
    setUsers,
    sharingGps,
    socketRef,
    sosHoldTimerRef,
    sosLongTriggeredRef,
    stopEmergencyRing,
    totalDistance,
    updateReady,
    users,
    visible,
  });
  const mapOperations = useMapOperations(operationContext);
  Object.assign(operationContext, mapOperations);
  const {
    addToolPoint,
    clearMapTools,
    focusDefaultExtent,
    hasMapTools,
    openIncidentPointForm,
    openPollingUnitResultForm,
    pickIncidentPoint,
    routeUserPoint,
    saveParties,
    savePollingResult,
    setMapDrawTool,
    startIncidentArea,
    startToolFromPoint,
  } = mapOperations;
  const adminOperations = useAdminChatOperations(operationContext);
  Object.assign(operationContext, adminOperations);
  const {
    addArea,
    addChatMember,
    changeUserRole,
    clearAreas,
    createChatRoom,
    createOfficer,
    deleteChatRoom,
    deleteOfficer,
    openIncidentChat,
    refreshApp,
    reportPendingArea,
    saveAreaSearch,
    saveProfile,
    searchPendingArea,
    selectChatRoom,
    sendChatMessage,
    shareAreaSearch,
    updateOfficer,
    updateUserPassword,
  } = adminOperations;
  const gpsOperations = useGpsEmergencyOperations(operationContext);
  Object.assign(operationContext, gpsOperations);
  const {
    deleteEmergency,
    dismissEmergency,
    locateMe,
    sendEmergency,
    sosHoldProps,
    toggleGps,
  } = gpsOperations;
  const analyticsOperations = useAnalyticsOperations(operationContext);
  Object.assign(operationContext, analyticsOperations);
  const {
    importCsvPoints,
    openStreetPhotos,
    runAnalyticTool,
    shareAreas,
    shareMap,
  } = analyticsOperations;
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
      stopArchiveRecording();
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
      startArchiveRecording();
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (localCameraStreamRef.current !== stream) return;
        sharingCameraRef.current = false;
        stopOfflineVideoRecording();
        stopArchiveRecording();
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
    setViewerConnectFailed((old) => {
      if (!(officerId in old)) return old;
      const next = { ...old };
      delete next[officerId];
      return next;
    });
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
    AuditLogViewer,
    auditLogOpen,
    setAuditLogOpen,
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
    createChatRoom,
    createMapLayer,
    createOfficer,
    DashboardCameraPanel,
    DashboardChatPanel,
    DashboardEmergencyPanel,
    DashboardMapDataPanel,
    DashboardToolsPanel,
    dataLayer,
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
    setDataLayer,
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
    viewerConnectFailed,
    viewPhoneCamera,
    visible,
  };

  return <DashboardView controller={controller} />;
}

export default DashboardRuntime;
