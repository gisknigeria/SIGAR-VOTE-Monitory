export default function DashboardMapWorkspace({ controller }) {
  const {
    addArea,
    addToolPoint,
    analysisLayers,
    areas,
    cameras,
    canAdmin,
    canCreateCustomReportType,
    clearBoundarySelection,
    clearMapTools,
    coords,
    drawMode,
    emergencyAlerts,
    FaCamera,
    FaChartBar,
    FaCircle,
    FaDrawPolygon,
    FaEraser,
    FaHome,
    FaKey,
    FaLocationArrow,
    FaMapMarkedAlt,
    FaSignOutAlt,
    FaStreetView,
    FaTimes,
    FaUserCog,
    FaVideo,
    FaVolumeDown,
    filter,
    focusDefaultExtent,
    focusedOfficerId,
    formatWardList,
    handleNotificationClick,
    hasMapTools,
    incidents,
    isAgent,
    isFieldRole,
    isSupervisor,
    jump,
    layer,
    locateMe,
    LuLocateFixed,
    MAP_LAYERS,
    MAP_VIEW_HELPERS,
    mapCameras,
    mapLayers,
    mapMenu,
    mapRef,
    MapView,
    mapVisibleIncidents,
    MdAssessment,
    MdHowToVote,
    measurePoints,
    NotificationCenter,
    notifications,
    officers,
    onLogout,
    openIncidentPointForm,
    openPollingUnitResultForm,
    openStreetPhotos,
    partyMapAnalysis,
    phoneShares,
    pickIncidentPoint,
    profileMenuOpen,
    ReportIcon,
    resultsInitialView,
    resultsOpen,
    routePoints,
    routeResult,
    routeUserPoint,
    selected,
    selectedBoundaryLabel,
    selectedBoundaryState,
    session,
    setCameraPanel,
    setCoords,
    setEmergencyOpen,
    setFocusedOfficerId,
    setLayer,
    setLiveIncidentsOpen,
    setMapMenu,
    setNewPoint,
    setOperationsOpen,
    setProfileMenuOpen,
    setProfileOpen,
    setResultsInitialView,
    setResultsOpen,
    setSelected,
    setSelectedBoundaryLabel,
    setSelectedBoundaryState,
    setShowBoundaryNames,
    setShowLgaBorders,
    setShowReports,
    setShowSosIncidents,
    setShowStateBorders,
    setSituationalOpen,
    setSupervisorMapOpen,
    setToolsOpen,
    shareMap,
    sharingCamera,
    sharingGps,
    showBoundaryLayer,
    showBoundaryNames,
    showLgaBorders,
    showReports,
    showSosIncidents,
    showStateBorders,
    sosHolding,
    sosHoldProps,
    startIncidentArea,
    startToolFromPoint,
    supervisorMapOpen,
    toggleCamera,
    toggleGps,
    toggleMapLayer,
    unreadCount,
    updateLayerOpacity,
  } = controller;

  return (
    <>
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
            {!isAgent && (
              <button
                className={`map-action share-location-action ${sharingGps ? "active" : ""}`}
                onClick={toggleGps}
                title={sharingGps ? "Stop location sharing" : "Share location"}
              >
                <LuLocateFixed />
              </button>
            )}
            <button
              className={`map-action camera-share-action ${sharingCamera ? "active" : ""}`}
              onClick={toggleCamera}
              title={sharingCamera ? "Stop camera sharing" : "Share camera"}
            >
              <FaVideo />
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
              className={`map-action election-phase-action pre-election-action${resultsOpen && resultsInitialView === "pre" ? " active" : ""}`}
              onClick={() => { setResultsInitialView("pre"); setResultsOpen(true); }}
              title="Pre-Election analysis"
              aria-label="Open Pre-Election analysis"
            >
              <MdHowToVote />
            </button>
            <button
              className={`map-action result-center-open election-phase-action election-day-action${resultsOpen && resultsInitialView === "pulse" ? " active" : ""}`}
              onClick={() => { setResultsInitialView("pulse"); setResultsOpen(true); }}
              title="Election dashboard"
              aria-label="Open Election dashboard"
            >
              <FaChartBar />
            </button>
            <button
              className={`map-action election-phase-action post-election-action${resultsOpen && resultsInitialView === "post" ? " active" : ""}`}
              onClick={() => { setResultsInitialView("post"); setResultsOpen(true); }}
              title="Post-Election analysis"
              aria-label="Open Post-Election analysis"
            >
              <MdAssessment />
            </button>
            <button
              className={`map-action emergency-open ${sosHolding ? "sos-holding" : ""}`}
              {...sosHoldProps}
              title="Tap for SOS form or hold 5 seconds to send immediately"
            >
              SOS
            </button>
          </div>
          <div className="map-top-right">
            {!isFieldRole && <NotificationCenter notifications={notifications} unreadCount={unreadCount} onNotificationClick={handleNotificationClick} />}
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
          <div className="field-alerts-top">
            <NotificationCenter notifications={notifications} unreadCount={unreadCount} onNotificationClick={handleNotificationClick} />
          </div>
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
            <button className="agent-action-card incident" onClick={openIncidentPointForm}>
              <ReportIcon iconKey="IP" size={22} />
              <b>Report incident</b>
              <span>Log a field issue, hazard, or security concern</span>
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
        {isSupervisor && !supervisorMapOpen && <div className="agent-field-screen supervisor-field-screen">
          <div className="field-alerts-top">
            <NotificationCenter notifications={notifications} unreadCount={unreadCount} onNotificationClick={handleNotificationClick} />
            <button className="supervisor-alert-btn" onClick={() => setEmergencyOpen(true)} title="Alerts">
              <FaVolumeDown />
              {emergencyAlerts.length > 0 && <span>{Math.min(emergencyAlerts.length, 9)}</span>}
            </button>
          </div>
          <img className="agent-brand-logo" src="/bsa-logo.png" alt="BSA Oyo Ahead logo" />
          <span className="eyebrow">WARD SUPERVISOR</span>
          <h1>{session.user.lga || "Ward Supervisor"}</h1>
          <p>
            {[session.user.state, session.user.lga].filter(Boolean).join(" • ")}
            {formatWardList(session.user.ward).length > 0 && (
              <>
                <br />
                Wards supervised: {formatWardList(session.user.ward).join(" • ")}
              </>
            )}
          </p>
          <div className="agent-action-grid supervisor-action-grid">
            <button className="agent-action-card result" onClick={() => {
              setOperationsOpen(true);
              setLiveIncidentsOpen(true);
              setSituationalOpen(false);
              setToolsOpen(false);
            }}>
              <FaUserCog />
              <b>Assign</b>
              <span>See assigned incidents and ward emergencies</span>
            </button>
            <button className="agent-action-card result" onClick={openPollingUnitResultForm}>
              <ReportIcon iconKey="POI" size={22} />
              <b>Report result</b>
              <span>Submit the latest polling unit result</span>
            </button>
            <button className={`agent-action-card ${sharingCamera ? "active" : ""}`} onClick={toggleCamera}>
              <FaVideo />
              <b>{sharingCamera ? "Stop video" : "Share video"}</b>
              <span>Send a live video feed to command</span>
            </button>
            <button className="agent-action-card incident" onClick={openIncidentPointForm}>
              <ReportIcon iconKey="IP" size={22} />
              <b>Report incident</b>
              <span>Log a field incident or security issue</span>
            </button>
            <button className="agent-action-card map" onClick={() => setSupervisorMapOpen(true)}>
              <FaMapMarkedAlt />
              <b>Map</b>
              <span>Open the agent map and locations</span>
            </button>
            <button className={`agent-action-card sos ${sosHolding ? "sos-holding" : ""}`} {...sosHoldProps}>
              <strong>SOS</strong>
              <b>Send emergency alert</b>
              <span>Trigger an urgent field alert immediately</span>
            </button>
          </div>
          <button className="agent-logout" onClick={onLogout}><FaSignOutAlt /> Logout</button>
        </div>}
        {isSupervisor && supervisorMapOpen && (
          <div className="supervisor-map-page">
            <button className="supervisor-map-back" onClick={() => setSupervisorMapOpen(false)}>
              <FaTimes /> Back
            </button>
            <MapView
              helpers={MAP_VIEW_HELPERS}
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
              selectedBoundaryState={selectedBoundaryState}
              onBoundarySelect={(id, label) => {
                setSelectedBoundaryState(id);
                setSelectedBoundaryLabel(label);
              }}
              onBoundaryClear={clearBoundarySelection}
              focusedOfficerId={focusedOfficerId}
              onClearOfficerFocus={setFocusedOfficerId}
            />
          </div>
        )}
        {!isAgent && !isSupervisor && <MapView
          helpers={MAP_VIEW_HELPERS}
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
          selectedBoundaryState={selectedBoundaryState}
          onBoundarySelect={(id, label) => {
            setSelectedBoundaryState(id);
            setSelectedBoundaryLabel(label);
          }}
          onBoundaryClear={clearBoundarySelection}
          focusedOfficerId={focusedOfficerId}
          onClearOfficerFocus={setFocusedOfficerId}
        />}
        {!isAgent && <button
          className="my-location-target"
          onClick={locateMe}
          title="Locate me"
        >
          <LuLocateFixed />
        </button>}
      </section>
    </>
  );
}

