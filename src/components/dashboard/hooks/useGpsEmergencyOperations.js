import { useEffect } from "react";

export function useGpsEmergencyOperations(context) {
  const {
    body,
    coords,
    filter,
    gpsBestRef,
    gpsPositions,
    gpsWatchRef,
    incidents,
    isAgent,
    jump,
    L,
    mapRef,
    notice,
    OYO_CENTER,
    request,
    session,
    setActiveEmergency,
    setCoords,
    setEmergencyAlerts,
    setEmergencyOpen,
    setGpsPositions,
    setGpsRequiredBlocked,
    setIncidents,
    setNotice,
    setSharingGps,
    setSosHolding,
    sharingGps,
    socketRef,
    sosHoldTimerRef,
    sosLongTriggeredRef,
    stopEmergencyRing,
    title,
    users,
  } = context;

  const toggleGps = () => {
    if (sharingGps) {
      if (isAgent) {
        setNotice("GPS tracking is required for Agent accounts and cannot be turned off");
        return;
      }
      if (gpsWatchRef.current != null)
        navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
      gpsBestRef.current = null;
      socketRef.current?.emit("gps:stop", { userId: session.user.id });
      setSharingGps(false);
      setNotice("Location sharing stopped");
      return;
    }
    if (!navigator.geolocation) {
      setNotice("GPS is not available in this browser");
      return;
    }
    setSharingGps(true);
    if (isAgent) setGpsRequiredBlocked(false);
    setNotice("Acquiring GPS fix...");
    gpsBestRef.current = null;

    // Accuracy thresholds — only accept fixes within these bounds
    const ACCURACY_GOOD = 25;
    const ACCURACY_MAX = 150;
    const BROADCAST_INTERVAL = 4000;
    let lastBroadcast = 0;
    let warmUpCount = 0;

    const onPosition = (position) => {
      const { latitude, longitude, accuracy, speed, heading } = position.coords;

      const fixAge = Date.now() - Number(position.timestamp || Date.now());
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy)) return;
      if (accuracy > ACCURACY_MAX || fixAge > 15000) {
        setNotice(`Waiting for accurate GPS… current accuracy ±${Math.round(accuracy || 0)} m`);
        return;
      }

      const prev = gpsBestRef.current;
      const now = Date.now();
      let lat = latitude;
      let lng = longitude;
      if (prev) {
        const elapsedSeconds = Math.max(1, (now - new Date(prev.timestamp).getTime()) / 1000);
        const distance = L.latLng(prev.lat, prev.lng).distanceTo([latitude, longitude]);
        const impliedSpeed = distance / elapsedSeconds;
        const jumpAllowance = Math.max(80, accuracy * 3, Number(prev.accuracy || 0) * 3);
        if (distance > jumpAllowance && impliedSpeed > 75 && accuracy >= Number(prev.accuracy || accuracy)) {
          setNotice("Ignoring an inaccurate GPS jump; checking again…");
          return;
        }
        if (distance <= jumpAllowance) {
          const currentWeight = Math.min(0.85, Math.max(0.55, Number(prev.accuracy || accuracy) / (Number(prev.accuracy || accuracy) + accuracy)));
          lat = prev.lat * (1 - currentWeight) + latitude * currentWeight;
          lng = prev.lng * (1 - currentWeight) + longitude * currentWeight;
        }
      }
      gpsBestRef.current = {
        userId: session.user.id,
        lat,
        lng,
        accuracy,
        speed: speed ?? 0,
        heading: heading ?? 0,
        timestamp: new Date(now).toISOString(),
      };
      // Agent accounts remain locked until a fresh, acceptably accurate fix exists.
      if (isAgent) setGpsRequiredBlocked(false);

      warmUpCount++;

      // During warm-up (first 3 fixes) only show notice, don't broadcast yet
      // unless the fix is already very good
      const isGood = accuracy <= ACCURACY_GOOD;
      if (warmUpCount < 3 && !isGood) {
        setNotice(`GPS warming up… accuracy ±${Math.round(accuracy)} m`);
        return;
      }

      const best = gpsBestRef.current;
      // Throttle broadcasts — don't flood the server
      if (now - lastBroadcast < BROADCAST_INTERVAL && !isGood) return;
      lastBroadcast = now;

      const point = {
        userId: session.user.id,
        lat: best.lat,
        lng: best.lng,
        accuracy: best.accuracy,
        speed: best.speed,
        heading: best.heading,
        timestamp: new Date().toISOString(),
      };

      socketRef.current?.emit("gps:update", point);
      setGpsPositions((old) => ({
        ...old,
        [session.user.id]: { ...point, offline: false },
      }));

      const accuracyLabel = best.accuracy <= ACCURACY_GOOD
        ? `±${Math.round(best.accuracy)} m (good)`
        : `±${Math.round(best.accuracy)} m`;
      setNotice(`GPS live — ${accuracyLabel}`);
      setTimeout(() => setNotice(""), 4000);
    };

    const onError = (error) => {
      if (gpsWatchRef.current != null)
        navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
      gpsBestRef.current = null;
      setSharingGps(false);
      if (isAgent) setGpsRequiredBlocked(true);
      setNotice(error.code === 1
        ? "Location permission was denied — enable location in your browser settings and try again"
        : "A valid location could not be obtained — check GPS and try again");
    };

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      onPosition,
      onError,
      {
        enableHighAccuracy: true,
        maximumAge: 0,        // never use a cached position
        timeout: 20000,       // allow longer to get a proper fix
      },
    );
  };
  useEffect(() => {
    if (isAgent && !sharingGps) toggleGps();
  }, []);
  useEffect(() => () => clearTimeout(sosHoldTimerRef.current), []);
  const locateMe = () => {
    const flyToPoint = (point, message = "Centered on your location") => {
      if (!point) return;
      mapRef.current?.flyTo([Number(point.lat), Number(point.lng)], 17);
      setCoords(`${Number(point.lat).toFixed(6)}, ${Number(point.lng).toFixed(6)}`);
      setNotice(message);
      setTimeout(() => setNotice(""), 2500);
    };
    // Use the best GPS fix we already have if it's recent (< 10 s old)
    const best = gpsBestRef.current;
    if (best && (Date.now() - new Date(best.timestamp).getTime()) < 10000) {
      flyToPoint(best, `Centered on your location ±${Math.round(best.accuracy)} m`);
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          flyToPoint({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }, `Centered on your location ±${Math.round(position.coords.accuracy)} m`),
        () =>
          flyToPoint(
            gpsPositions[session.user.id] || session.user,
            "Centered on last known location",
          ),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      );
      return;
    }
    flyToPoint(gpsPositions[session.user.id] || session.user, "Centered on last known location");
  };
  const sendEmergency = async (details) => {
    const verified = gpsBestRef.current;
    const verifiedFresh = verified && Date.now() - new Date(verified.timestamp).getTime() < 30000;
    const fallback = (verifiedFresh ? verified : null) || gpsPositions[session.user.id] || session.user;
    const dispatch = async (point) => {
      const alert = {
        id: `em-${Date.now()}`,
        userId: session.user.id,
        name: session.user.name,
        role: session.user.role,
        rank: session.user.rank,
        unit: session.user.unit,
        unitType: session.user.unitType,
        command: session.user.command,
        division: session.user.division,
        station: session.user.station,
        type: details.type || "Emergency",
        text: details.text || "",
        lat: Number(point.lat),
        lng: Number(point.lng),
        timestamp: new Date().toISOString(),
      };
      try {
        const saved = await request("/incidents", session.token, {
          method: "POST",
          body: JSON.stringify({
            title: `SOS - ${alert.type}`,
            description: `${alert.name}${alert.text ? `: ${alert.text}` : ""}`,
            reportType: "SOS-Emergency",
            severity: "Critical",
            status: "Open",
            lat: alert.lat,
            lng: alert.lng,
            assignedTo: "",
            visibleTo: [],
            media: [],
            style: {
              source: "sos",
              icon: "SOS",
              color: "#dc2626",
              fillColor: "#ef4444",
              opacity: 0.95,
            },
          }),
        });
        alert.incidentId = saved.id;
        setIncidents((old) =>
          old.some((item) => item.id === saved.id) ? old : [saved, ...old],
        );
      } catch (error) {
        setNotice(error.message || "SOS sent, but could not store incident");
      }
      socketRef.current?.emit("emergency:send", alert);
      setEmergencyOpen(false);
      setEmergencyAlerts((old) => [alert, ...old].slice(0, 12));
      setNotice("Emergency alert sent to app users");
      mapRef.current?.flyTo([alert.lat, alert.lng], 17);
    };
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        (p) => dispatch(
          p.coords.accuracy <= 100
            ? { lat: p.coords.latitude, lng: p.coords.longitude }
            : { lat: fallback.lat || OYO_CENTER[0], lng: fallback.lng || OYO_CENTER[1] },
        ),
        () =>
          dispatch({
            lat: fallback.lat || OYO_CENTER[0],
            lng: fallback.lng || OYO_CENTER[1],
          }),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
      );
    else
      dispatch({
        lat: fallback.lat || OYO_CENTER[0],
        lng: fallback.lng || OYO_CENTER[1],
      });
  };
  const startSosHold = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearTimeout(sosHoldTimerRef.current);
    sosLongTriggeredRef.current = false;
    setSosHolding(true);
    sosHoldTimerRef.current = setTimeout(() => {
      sosLongTriggeredRef.current = true;
      setSosHolding(false);
      sendEmergency({ type: "Emergency", text: "" });
    }, 5000);
  };
  const cancelSosHold = () => {
    clearTimeout(sosHoldTimerRef.current);
    sosHoldTimerRef.current = null;
    setSosHolding(false);
  };
  const openSosNormally = (event) => {
    if (sosLongTriggeredRef.current) {
      event.preventDefault();
      sosLongTriggeredRef.current = false;
      return;
    }
    setEmergencyOpen(true);
  };
  const sosHoldProps = {
    onPointerDown: startSosHold,
    onPointerUp: cancelSosHold,
    onPointerCancel: cancelSosHold,
    onPointerLeave: cancelSosHold,
    onContextMenu: (event) => event.preventDefault(),
    onClick: openSosNormally,
  };
  const dismissEmergency = () => {
    stopEmergencyRing();
    setActiveEmergency(null);
  };
  const deleteEmergency = (alert) => {
    stopEmergencyRing();
    setEmergencyAlerts((old) => old.filter((item) => item.id !== alert.id));
    setActiveEmergency((old) => (old?.id === alert.id ? null : old));
    setNotice("SOS removed from this map");
    setTimeout(() => setNotice(""), 2200);
  };

  return {
    deleteEmergency,
    dismissEmergency,
    locateMe,
    sendEmergency,
    sosHoldProps,
    toggleGps,
  };
}
