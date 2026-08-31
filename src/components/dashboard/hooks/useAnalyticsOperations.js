export function useAnalyticsOperations(context) {
  const {
    areas,
    filter,
    formatDistance,
    incidents,
    L,
    layer,
    mapLayers,
    mapRef,
    officers,
    OYO_CENTER,
    REPORT_TYPE_STYLES,
    selected,
    setAnalysisLayers,
    setDrawMode,
    setMapLayers,
    setMeasurePoints,
    setNotice,
    setRoutePoints,
    setRouteResult,
    visible,
  } = context;

  const runAnalyticTool = async (tool) => {
    const points = incidents.filter(
      (item) =>
        Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)),
    );
    const clearAnalysis = () => {
      setAnalysisLayers([]);
      setMeasurePoints([]);
      setRoutePoints([]);
      setRouteResult(null);
    };
    if (tool === "Measure Distance") {
      clearAnalysis();
      setDrawMode("measure");
      return "Click points on the map. The yellow line will show the real measured distance.";
    }
    if (tool === "Aggregate Points") {
      clearAnalysis();
      const counts = points.reduce(
        (acc, item) => ({
          ...acc,
          [item.reportType || "Incident"]:
            (acc[item.reportType || "Incident"] || 0) + 1,
        }),
        {},
      );
      setAnalysisLayers(
        Object.entries(counts).map(([key, value], index) => ({
          type: "marker",
          center: [OYO_CENTER[0] + index * 0.03, OYO_CENTER[1] + index * 0.03],
          radius: 7 + value,
          color: REPORT_TYPE_STYLES[key]?.color || "#38bdf8",
          fillColor: REPORT_TYPE_STYLES[key]?.fillColor || "#38bdf8",
          fillOpacity: 0.45,
          label: `${key}: ${value}`,
        })),
      );
      return (
        Object.entries(counts)
          .map(([key, value]) => `${key}: ${value}`)
          .join(" - ") || "No incident points to aggregate"
      );
    }
    if (tool === "Calculate Density") {
      clearAnalysis();
      setAnalysisLayers(
        points.slice(0, 60).map((item) => {
          const neighbors = points.filter(
            (other) =>
              L.latLng(item.lat, item.lng).distanceTo([other.lat, other.lng]) <=
              3000,
          ).length;
          return {
            type: "circle",
            center: [item.lat, item.lng],
            radius: 250 + neighbors * 120,
            color: "#f59e0b",
            fillColor: "#f59e0b",
            fillOpacity: Math.min(0.08 + neighbors * 0.025, 0.45),
            label: `${neighbors} incidents within 3 km`,
          };
        }),
      );
      return `Drew density rings for ${Math.min(points.length, 60)} incident points. Approx overall density: ${(points.length / 28000).toFixed(4)} points/km-`;
    }
    if (tool === "Create Buffers") {
      clearAnalysis();
      setAnalysisLayers(
        points
          .slice(0, 25)
          .map((item) => ({
            type: "circle",
            center: [item.lat, item.lng],
            radius: 500,
            color: "#38bdf8",
            fillColor: "#38bdf8",
            fillOpacity: 0.12,
            label: `500m buffer: ${item.title}`,
          })),
      );
      return `Drew 500m buffers for ${Math.min(points.length, 25)} incident points`;
    }
    if (tool === "Measure Buffer") {
      clearAnalysis();
      setDrawMode("circle");
      return "Click a center point, then click the buffer edge. It will open the incident form with that circle area.";
    }
    if (tool === "Create Drive-Time Areas") {
      clearAnalysis();
      setDrawMode("route");
      return "Click a start point and destination. The green road route and travel estimate will appear on the map.";
    }
    if (tool === "Extract Data") {
      const csv = [
        "title,type,severity,status,lat,lng",
        ...points.map((item) =>
          [
            item.title,
            item.reportType,
            item.severity,
            item.status,
            item.lat,
            item.lng,
          ]
            .map((value) => `"${String(value || "").replace(/"/g, '""')}"`)
            .join(","),
        ),
      ].join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `election-monitor-incident-export-${Date.now()}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return `Downloaded CSV with ${points.length} incidents. Field personnel: ${officers.length}. Map layers: ${mapLayers.length}.`;
    }
    if (tool === "Find Hot Spots") {
      clearAnalysis();
      const hot = points
        .map((item) => ({
          ...item,
          neighbors: points.filter(
            (other) =>
              L.latLng(item.lat, item.lng).distanceTo([other.lat, other.lng]) <=
              2500,
          ).length,
        }))
        .filter((item) => item.neighbors > 1)
        .sort((a, b) => b.neighbors - a.neighbors)
        .slice(0, 8);
      setAnalysisLayers(
        hot.map((item) => ({
          type: "circle",
          center: [item.lat, item.lng],
          radius: 650 + item.neighbors * 120,
          color: "#ef4444",
          fillColor: "#ef4444",
          fillOpacity: 0.22,
          label: `Hot spot: ${item.neighbors} nearby incidents`,
        })),
      );
      return hot.length
        ? `Drew ${hot.length} hot spot areas. Top has ${hot[0].neighbors} nearby incidents.`
        : "No hot spot found yet. Need incidents close together.";
    }
    if (tool === "Find Nearest") {
      clearAnalysis();
      const base = selected || mapRef.current?.getCenter();
      if (!base) return "Select an incident or center the map first";
      const nearest = officers
        .map((o) => ({
          ...o,
          distance: L.latLng(base.lat, base.lng).distanceTo([o.lat, o.lng]),
        }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (nearest)
        setAnalysisLayers([
          {
            type: "line",
            points: [
              [base.lat, base.lng],
              [nearest.lat, nearest.lng],
            ],
            color: "#22c55e",
            weight: 4,
            label: `Nearest: ${nearest.name} - ${formatDistance(nearest.distance)}`,
          },
          {
            type: "marker",
            center: [nearest.lat, nearest.lng],
            radius: 9,
            color: "#22c55e",
            fillColor: "#22c55e",
            label: nearest.name,
          },
        ]);
      return nearest
        ? `Nearest responder: ${nearest.name} - ${formatDistance(nearest.distance)}. Green line drawn.`
        : "No field responders available";
    }
    if (tool === "Summarize Nearby") {
      clearAnalysis();
      const center = selected || mapRef.current?.getCenter();
      if (!center) return "Select an incident or center the map first";
      const nearby = points.filter(
        (item) =>
          L.latLng(center.lat, center.lng).distanceTo([item.lat, item.lng]) <=
          5000,
      );
      setAnalysisLayers([
        {
          type: "circle",
          center: [center.lat, center.lng],
          radius: 5000,
          color: "#a855f7",
          fillColor: "#a855f7",
          fillOpacity: 0.12,
          label: `${nearby.length} incidents within 5 km`,
        },
      ]);
      return `${nearby.length} incidents within 5 km. Purple circle drawn.`;
    }
    if (tool === "Geo-Lookup") {
      clearAnalysis();
      const center = mapRef.current?.getCenter();
      if (!center) return "Map center not available";
      const data = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${center.lat}&lon=${center.lng}`,
      )
        .then((r) => r.json())
        .catch(() => null);
      setAnalysisLayers([
        {
          type: "marker",
          center: [center.lat, center.lng],
          radius: 10,
          color: "#38bdf8",
          fillColor: "#38bdf8",
          label:
            data?.display_name ||
            `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`,
        },
      ]);
      return (
        data?.display_name ||
        `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`
      );
    }
    setDrawMode("measure");
    return "Click points on the map to measure distance";
  };
  const importCsvPoints = (file, setResult) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result || "")
        .split(/\r?\n/)
        .filter(Boolean);
      const headers =
        lines
          .shift()
          ?.split(",")
          .map((x) => x.trim().toLowerCase()) || [];
      const latIndex = headers.findIndex((x) =>
        ["lat", "latitude", "y"].includes(x),
      );
      const lngIndex = headers.findIndex((x) =>
        ["lon", "lng", "longitude", "x"].includes(x),
      );
      if (latIndex < 0 || lngIndex < 0)
        return setResult("CSV needs latitude/longitude columns");
      const features = lines
        .map((line) => line.split(","))
        .map((cols) => ({
          lat: Number(cols[latIndex]),
          lng: Number(cols[lngIndex]),
          cols,
        }))
        .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng))
        .map((row, index) => ({
          type: "Feature",
          properties: { name: row.cols[0] || `CSV point ${index + 1}` },
          geometry: { type: "Point", coordinates: [row.lng, row.lat] },
        }));
      const layer = {
        id: `csv-${Date.now()}`,
        name: file.name.replace(/\.csv$/i, ""),
        type: "geojson",
        category: "Point",
        operationalUse: "CSV Plot Points",
        color: "#22c55e",
        pointIcon: "place",
        pointIconColor: "#ffffff",
        pointSize: 18,
        data: { type: "FeatureCollection", features },
        visible: true,
        opacity: 0.85,
      };
      setMapLayers((old) => [layer, ...old]);
      if (features.length)
        mapRef.current?.fitBounds(L.geoJSON(layer.data).getBounds().pad(0.12));
      setResult(`Plotted ${features.length} CSV points on the map`);
    };
    reader.readAsText(file);
  };
  const openStreetPhotos = () => {
    const center = mapRef.current?.getCenter();
    if (!center) return;
    window.open(
      `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${center.lat},${center.lng}`,
      "_blank",
      "noopener,noreferrer",
    );
  };
  const shareMap = async (custom = {}) => {
    try {
      setNotice("Creating map screenshot...");
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(mapRef.current.getContainer(), {
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#09131e",
        logging: false,
      });
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png", 0.95),
      );
      if (!blob) throw new Error("Screenshot could not be created");
      const file = new File(
        [blob],
        `${custom.filePrefix || "Election-Monitor"}-${selected?.id || Date.now()}.png`,
        { type: "image/png" },
      );
      const shareData = {
        title:
          custom.title ||
          (selected ? `Incident: ${selected.title}` : "Election monitoring map"),
        text:
          custom.text ||
          (selected
            ? `${selected.title} - ${selected.severity} - ${selected.status}`
            : "Election monitoring command map"),
        files: [file],
      };
      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare(shareData))
      ) {
        await navigator.share(shareData);
        setNotice("Map shared");
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setNotice(
          "Screenshot downloaded - attach it in WhatsApp, Facebook or other apps",
        );
      }
    } catch (error) {
      if (error.name !== "AbortError")
        setNotice(error.message || "Could not share this map");
    }
    setTimeout(() => setNotice(""), 3500);
  };
  const shareAreas = () => {
    const area = areas[areas.length - 1];
    if (!area) return setNotice("Draw an area first");
    shareMap({
      filePrefix: "election-monitor-area",
      title: area.title || "Election monitoring operational area",
      text: `${area.title || "Election monitoring operational area"}${area.note ? ` - ${area.note}` : ""}`,
    });
  };
  // Keep the device awake while camera is sharing

  return {
    importCsvPoints,
    openStreetPhotos,
    runAnalyticTool,
    shareAreas,
    shareMap,
  };
}
