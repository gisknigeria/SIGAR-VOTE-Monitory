import { MdPoll } from "react-icons/md";

export default function DashboardSidebar({ controller }) {
  const {
    areas,
    cameras,
    canAdmin,
    canCreateCustomReportType,
    canManagePersonnel,
    chatRooms,
    clearAreas,
    clearMapTools,
    DashboardToolsPanel,
    drawMode,
    FaBullseye,
    FaClipboardList,
    FaKey,
    FaLocationArrow,
    FaSignOutAlt,
    FaTimes,
    FaTools,
    FaUserCog,
    FaVideo,
    filter,
    focusedOfficerId,
    focusOfficerOnMap,
    geocode,
    hasMapTools,
    isAgent,
    isSupervisor,
    liveIncidentCount,
    liveIncidentsOpen,
    mapLayers,
    officers,
    onLogout,
    openIncidentPointForm,
    openPollingUnitResultForm,
    operationsOpen,
    phoneShares,
    refreshApp,
    ReportIcon,
    reportStyle,
    ReportTypeIcon,
    resizeSidebar,
    search,
    selected,
    session,
    setAuditLogOpen,
    setCameraPanel,
    setChatPanel,
    setFilter,
    setLiveIncidentsOpen,
    setManageOfficers,
    setMapDataPanel,
    setMapDrawTool,
    setOperationsOpen,
    setPartyManagerOpen,
    setProfileOpen,
    setSearch,
    setSurveyOpen,
    setSelected,
    setSituationalOpen,
    setSupervisorIncidentsOpen,
    setToolsOpen,
    shareAreas,
    shareMap,
    sharingCamera,
    sharingGps,
    sidebarWidth,
    situationalOpen,
    sosHolding,
    sosHoldProps,
    toggleCamera,
    toggleGps,
    toolsOpen,
    updateReady,
    visible,
  } = controller;

  return (
    <>
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
                    onAuditLog={() => setAuditLogOpen(true)}
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
                {canAdmin && (
                  <button onClick={() => { setSurveyOpen(true); setOperationsOpen(false); }}>
                    <MdPoll /> Voter Survey
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
    </>
  );
}

