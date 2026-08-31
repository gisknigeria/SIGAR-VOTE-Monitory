export default function DashboardView({ controller }) {
  const {
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
  } = controller;

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
              {(() => {
                const roleLabel = session.user.role === "Admin"
                  ? "Admin"
                  : session.user.role === "Super Admin"
                    ? "System Administrator"
                    : session.user.role === "Supervisor"
                      ? "Ward Supervisor"
                      : session.user.role;
                return roleLabel !== session.user.name ? <small>{roleLabel}</small> : null;
              })()}
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
                <button onClick={openPollingUnitResultForm}>
                  <ReportIcon iconKey="POI" size={15} /> Polling Result
                </button>
                <button onClick={openIncidentPointForm}>
                  <ReportIcon iconKey="IP" size={15} /> Report Incident
                </button>
                <button onClick={() => setSupervisorIncidentsOpen(true)}>
                  <FaClipboardList /> View Ward Incidents
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
                      <button
                        type="button"
                        className={`officer-row ${focusedOfficerId === o.id ? "focused" : ""}`}
                        key={o.id}
                        onClick={() => focusOfficerOnMap(o)}
                        title={o.hasLastKnownLocation ? `Show ${o.name} at ${o.locationName}` : `No last seen location for ${o.name}`}
                      >
                        <i className={o.status.toLowerCase()}></i>
                        <div>
                          <b>{o.rank ? `${o.rank} ${o.name}` : o.name}</b>
                          <small>{o.locationName}</small>
                        </div>
                        <span>{o.status}</span>
                      </button>
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
                  <h2>Live Incidence <em>{liveIncidentCount}</em></h2>
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
      {resultsOpen && <Suspense fallback={<div className="modal-backdrop"><div className="modal">Loading results…</div></div>}><ResultsCenter helpers={RESULTS_HELPERS} incidents={incidents} parties={parties} officers={officers} personnel={users} mapLayers={mapLayers} selected={selected} onClose={() => setResultsOpen(false)} authToken={session.token} canAdmin={canAdmin} initialFocusParty={partyMapAnalysis?.party || ""} initialView={resultsInitialView} onPartyMapChange={setPartyMapAnalysis} onFocusLocation={(item) => { setResultsOpen(false); setSelected(null); setCoords(`${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}`); mapRef.current?.flyTo([item.lat, item.lng], 15); }} onTool={runAnalyticTool} onCsv={importCsvPoints} onClear={clearMapTools} /></Suspense>}
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
      {gpsRequiredBlocked && isAgent && !sharingGps && <div className="modal-backdrop gps-required-gate"><div className="modal"><span className="eyebrow">LOCATION REQUIRED</span><h2>Allow Location</h2><p>Location sharing is mandatory for Agent accounts. The app will remain locked until you allow access and a valid location is received.</p><button className="primary wide" onClick={toggleGps} disabled={sharingGps}><LuLocateFixed /> {sharingGps ? "Waiting for Location…" : "Allow Location"}</button></div></div>}
      {partyManagerOpen && canAdmin && <Suspense fallback={<div className="modal-backdrop"><div className="modal">Loading party manager…</div></div>}><PartyManager parties={parties} onClose={() => setPartyManagerOpen(false)} onSave={saveParties} /></Suspense>}
      {emergencyOpen && (
        <DashboardEmergencyPanel
          onClose={() => setEmergencyOpen(false)}
          onSend={sendEmergency}
        />
      )}
      {manageOfficers && canManagePersonnel && (
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
          users={users}
          isAdmin={canManagePersonnel}
          onClose={() => setChatPanel(false)}
          onCreateRoom={createChatRoom}
          onSelectRoom={selectChatRoom}
          onSend={sendChatMessage}
          onAddMember={addChatMember}
          onDeleteRoom={deleteChatRoom}
        />
      )}
      {assignIncidentOpen && incidentToAssign && (
        <Suspense fallback={<div className="modal-backdrop"><div className="modal">Loading assignment…</div></div>}>
          <AssignIncidentModal
            incident={incidentToAssign}
            users={users}
            onClose={() => {
              setAssignIncidentOpen(false);
              setIncidentToAssign(null);
            }}
            onAssign={handleAssignIncident}
          />
        </Suspense>
      )}
      {supervisorIncidentsOpen && isSupervisor && (
        <Suspense fallback={<div className="modal-backdrop"><div className="modal">Loading incidents…</div></div>}>
          <SupervisorIncidentListModal
            incidents={incidents}
            currentUser={session.user}
            users={users}
            onClose={() => setSupervisorIncidentsOpen(false)}
            onAssign={handleAssignIncident}
            onClaim={handleClaimIncident}
          />
        </Suspense>
      )}
      {notificationModalOpen && selectedNotification && (
        <IncidentNotificationModal
          notification={selectedNotification}
          incident={selectedIncident || incidents.find((item) => item.id === selectedNotification.incidentId) || null}
          currentUser={session.user}
          onClose={() => {
            setNotificationModalOpen(false);
            setSelectedNotification(null);
            setSelectedIncident(null);
          }}
          onMarkDone={handleNotificationDone}
          onOpenChat={handleOpenNotificationChat}
        />
      )}
      {notice && <Toast message={notice} />}
    </main>
  );
}
