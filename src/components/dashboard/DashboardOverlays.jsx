import { EvidenceMedia } from "./EvidenceMedia.jsx";

export default function DashboardOverlays({ controller }) {
  const {
    activeEmergency,
    cameraFacingMode,
    cameraLocation,
    cameraMicMuted,
    canAdmin,
    COMMAND_PARTY,
    deleteEmergency,
    deleteIncident,
    dismissEmergency,
    FaCamera,
    FaCircle,
    FaEye,
    FaEyeSlash,
    FaMicrophone,
    FaMicrophoneSlash,
    FaTimes,
    gpsBestRef,
    gpsPositions,
    hiddenReportIds,
    incidents,
    localCameraStreamRef,
    mapRef,
    openIncidentChat,
    POLLING_RESULT_TYPE,
    reportStyle,
    ReportTypeIcon,
    reportUsers,
    selected,
    selfCameraPreview,
    session,
    setAssignIncidentOpen,
    setCameraPreviewMode,
    setIncidentToAssign,
    setCameraPanel,
    setSelected,
    setSelfCameraPreview,
    sharingCamera,
    StreamVideo,
    switchCamera,
    toggleCamera,
    toggleCameraMicrophone,
    viewPhoneCamera,
  } = controller;

  return (
    <>
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
                item.type === "livestream" ? (
                  <div className="report-livestream-attachment" key={index}>
                    <button
                      type="button"
                      onClick={() => {
                        setCameraPanel(true);
                        viewPhoneCamera(item.userId);
                      }}
                    >
                      View live stream
                    </button>
                  </div>
                ) : (
                  <EvidenceMedia key={item.id || index} item={item} index={index} token={session.token} />
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
          <button
            className="primary wide"
            onClick={() =>
              mapRef.current.flyTo([selected.lat, selected.lng], 17)
            }
          >
            Center on incident
          </button>
          <button
            className="primary wide"
            onClick={() => openIncidentChat(selected)}
          >
            Open incident chat
          </button>
          {canAdmin && (
            <button
              className="primary wide"
              onClick={() => {
                setIncidentToAssign(selected);
                setAssignIncidentOpen(true);
              }}
            >
              Assign
            </button>
          )}
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
    </>
  );
}

