import {
  FaBullseye,
  FaCamera,
  FaChartBar,
  FaCircle,
  FaComments,
  FaDrawPolygon,
  FaKey,
  FaMapMarkedAlt,
  FaRoute,
  FaRulerCombined,
  FaSyncAlt,
  FaTimes,
  FaTools,
  FaUserCog,
  FaVideo,
} from "react-icons/fa";

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
  "Measure Distance": "Click points on the map to measure real distance along a road or path.",
  "Aggregate Points": "Counts incidents by category and places summary bubbles on the map.",
  "Calculate Density": "Draws larger orange rings where incidents are close together within 3 km.",
  "Create Buffers": "Draws 500 m blue safety buffers around incident points.",
  "Measure Buffer": "Lets you draw a circle area, then opens the incident form for that buffer.",
  "Create Drive-Time Areas": "Starts route mode so you can click a start and destination for road distance and time.",
  "Extract Data": "Downloads incident data as a CSV spreadsheet.",
  "Find Hot Spots": "Highlights clusters where multiple incidents are near each other.",
  "Find Nearest": "Draws a green line from the selected incident or map center to the nearest field responder.",
  "Summarize Nearby": "Counts incidents within 5 km of the selected incident or map center.",
  "Geo-Lookup": "Looks up the address/name for the current map center.",
};

export default function ToolsPanel({
  onClose,
  canAdmin,
  canCreateIncidentAreas,
  canManagePersonnel,
  isSuperAdmin,
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
    <div className="sidebar-tools-dropdown">
      <div className="sidebar-tools-grid">
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
              <FaCircle /> Buffer
            </b>
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
          </button>
        )}
        {canAdmin && (
          <button
            title={isSuperAdmin ? `${mapLayerCount} layers - upload/edit` : `${mapLayerCount} layers - edit styles`}
            onClick={() => {
              onClose();
              onMapData();
            }}
          >
            <b>
              <FaMapMarkedAlt /> Map Data
            </b>
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
          </button>
        )}
        <button onClick={onGps} title="Share your live field location">
          <b>
            <FaBullseye /> {sharingGps ? "Stop GPS" : "Share GPS"}
          </b>
        </button>
        <button onClick={onCameraShare} title="Share your phone camera feed">
          <b>
            <FaVideo /> {sharingCamera ? "Stop Camera" : "Share Camera"}
          </b>
        </button>
        <button
          title={`${cameraCount} feeds available`}
          onClick={() => {
            onClose();
            onCameras();
          }}
        >
          <b>
            <FaCamera /> Cameras Available
          </b>
        </button>
        <button
          title={`${chatCount} chat rooms`}
          onClick={() => {
            onClose();
            onChat();
          }}
        >
          <b>
            <FaComments /> Chat
          </b>
        </button>
        <button onClick={onRefresh}>
          <b>
            <FaSyncAlt /> {updateReady ? "Update Ready" : "Update App"}
          </b>
        </button>
        <button onClick={onPassword}>
          <b>
            <FaKey /> Change Password
          </b>
        </button>
      </div>
    </div>
  );
}

export { ANALYTIC_TOOLS, ANALYTIC_HELP };
