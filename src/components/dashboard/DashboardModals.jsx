export default function DashboardModals({ controller }) {
  const {
    activeRoom,
    addChatMember,
    areaSearchResult,
    AssignIncidentModal,
    assignIncidentOpen,
    AuditLogViewer,
    auditLogOpen,
    setAuditLogOpen,
    cameraPanel,
    cameras,
    canAdmin,
    canCreateCustomReportType,
    canManagePersonnel,
    changeUserRole,
    chatMessages,
    chatPanel,
    chatRooms,
    clearMapTools,
    createChatRoom,
    createMapLayer,
    createOfficer,
    DashboardCameraPanel,
    DashboardChatPanel,
    DashboardEmergencyPanel,
    DashboardMapDataPanel,
    ManageDataPanel,
    deleteCamera,
    deleteChatRoom,
    deleteMapLayer,
    deleteOfficer,
    emergencyOpen,
    FaSearch,
    FaShareAlt,
    FaSyncAlt,
    FaTimes,
    fetchIpLog,
    filter,
    formatDistance,
    gpsRequiredBlocked,
    handleAssignIncident,
    handleClaimIncident,
    handleNotificationDone,
    handleOpenNotificationChat,
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
    isSupervisor,
    LuLocateFixed,
    manageOfficers,
    mapDataPanel,
    manageDataOpen,
    mapLayers,
    mapRef,
    newPoint,
    newResultPoint,
    notice,
    notificationModalOpen,
    OfficerManager,
    officers,
    parties,
    PartyManager,
    partyManagerOpen,
    partyMapAnalysis,
    pendingAreaAction,
    phoneShares,
    PollingResultForm,
    ProfileModal,
    profileOpen,
    remoteStreams,
    ReportIcon,
    reportPendingArea,
    reportUsers,
    RESULTS_HELPERS,
    ResultsCenter,
    resultsInitialView,
    resultsOpen,
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
    selectedIncident,
    selectedNotification,
    sendChatMessage,
    sendEmergency,
    session,
    sharingCamera,
    setAreaSearchResult,
    setAssignIncidentOpen,
    setCameraPanel,
    setChatPanel,
    setCoords,
    setEmergencyOpen,
    setIncidentToAssign,
    setIpLogFilter,
    setIpLogOpen,
    setManageOfficers,
    setMapDataPanel,
    setManageDataOpen,
    setNewPoint,
    setNewResultPoint,
    setNotificationModalOpen,
    setPartyManagerOpen,
    setPartyMapAnalysis,
    setPendingAreaAction,
    setProfileOpen,
    setResultsOpen,
    setSelected,
    setSelectedIncident,
    setSelectedNotification,
    setSupervisorIncidentsOpen,
    shareAreaSearch,
    sharingGps,
    showCameraOnMap,
    SupervisorIncidentListModal,
    supervisorIncidentsOpen,
    Suspense,
    Toast,
    toggleGps,
    turnStatus,
    updateMapLayer,
    updateOfficer,
    updateUserPassword,
    users,
    viewerConnectFailed,
    viewPhoneCamera,
  } = controller;

  return (
    <>
      {newPoint && (
        <Suspense fallback={<div className="modal-backdrop"><div className="modal">Loading report form…</div></div>}>
          <IncidentForm
            point={newPoint}
            users={reportUsers}
            onClose={() => setNewPoint(null)}
            onSave={save}
            isAdmin={canCreateCustomReportType}
            currentUser={session.user}
            sharingCamera={sharingCamera}
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
            viewerConnectFailed={viewerConnectFailed}
            turnStatus={turnStatus}
            isAdmin={canAdmin}
            authToken={session.token}
            onClose={() => setCameraPanel(false)}
            onDelete={deleteCamera}
            onView={viewPhoneCamera}
            onShowMap={showCameraOnMap}
          />
        </Suspense>
      )}
      {auditLogOpen && (
        <AuditLogViewer authToken={session.token} onClose={() => setAuditLogOpen(false)} />
      )}
      {manageDataOpen && (
        <Suspense fallback={<div className="modal-backdrop"><div className="modal">Loading data manager…</div></div>}>
          <ManageDataPanel authToken={session.token} onClose={() => setManageDataOpen(false)} />
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
    </>
  );
}
