export function useAdminChatOperations(context) {
  const {
    activeRoom,
    areas,
    body,
    canAdmin,
    filter,
    formatDistance,
    incidents,
    L,
    mapLayers,
    officers,
    onSessionUpdate,
    OYO_CENTER,
    pendingAreaAction,
    reportCenter,
    request,
    search,
    selected,
    session,
    setActiveRoom,
    setAreas,
    setAreaSearchResult,
    setChatMessages,
    setChatPanel,
    setChatRooms,
    setDrawMode,
    setNewPoint,
    setNotice,
    setPendingAreaAction,
    setProfileMenuOpen,
    setProfileOpen,
    setUsers,
    title,
    updateReady,
    users,
  } = context;

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

  return {
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
  };
}
