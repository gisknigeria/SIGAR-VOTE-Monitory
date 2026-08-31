export function useMapOperations(context) {
  const {
    analysisLayers,
    b,
    body,
    canAdmin,
    drawMode,
    entry,
    filter,
    formatDistance,
    formatDuration,
    gpsBestRef,
    gpsPositions,
    incidents,
    L,
    mapRef,
    measurePoints,
    OYO_BOUNDS,
    OYO_CENTER,
    parties,
    r,
    request,
    routeEndInput,
    routePoints,
    routeResult,
    routeStartInput,
    search,
    selected,
    session,
    setAnalysisLayers,
    setCoords,
    setDrawMode,
    setIncidents,
    setMapMenu,
    setMeasurePoints,
    setNewPoint,
    setNewResultPoint,
    setNotice,
    setParties,
    setPartyManagerOpen,
    setRoutePoints,
    setRouteResult,
    setRouteStartInput,
    totalDistance,
    users,
    value,
  } = context;

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

  return {
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
  };
}
