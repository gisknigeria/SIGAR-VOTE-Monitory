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
              <FaCamera /> Cameras Available
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

export { ANALYTIC_TOOLS, ANALYTIC_HELP };
