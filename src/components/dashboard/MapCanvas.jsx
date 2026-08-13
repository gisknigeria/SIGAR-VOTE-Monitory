import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { FaMapMarkedAlt, FaTimes } from "react-icons/fa";
import { MdAdjust, MdFilterHdr, MdHexagon, MdImage, MdLocationPin, MdPolyline } from "react-icons/md";

const API = "/api";
const OYO_CENTER = [7.3775, 3.947];

const CATEGORY_ICON_COMPONENTS = {
  Point: MdLocationPin,
  Line: MdPolyline,
  Polygon: MdHexagon,
  Raster: MdImage,
};

const CATEGORY_COLORS = {
  Point: "#fb923c",
  Line: "#facc15",
  Polygon: "#38bdf8",
  Raster: "#818cf8",
};

const CategoryIcon = ({ cat, ...props }) => {
  const Icon = CATEGORY_ICON_COMPONENTS[cat] || MdFilterHdr;
  return <Icon {...props} />;
};

const LEGACY_CATEGORY_GEOMETRY = {
  Roads: "Line",
  Boundary: "Polygon",
  Water: "Polygon",
  Vegetation: "Polygon",
  "No-Go Zone": "Polygon",
  Settlement: "Point",
  Custom: "Point",
};

const LAYER_CATEGORIES = ["Point", "Line", "Polygon", "Raster"];

const layerGeometry = (layer) =>
  LAYER_CATEGORIES.includes(layer?.category)
    ? layer.category
    : layer?.type === "raster"
      ? "Raster"
      : LEGACY_CATEGORY_GEOMETRY[layer?.category] || "Point";

export default function MapCanvas({
  incidents = [],
  officers = [],
  cameras = [],
  mapLayers = [],
  emergencyAlerts = [],
  analysisLayers = [],
  selected = null,
  onSelect = () => {},
  onMapClick = () => {},
  mapRef,
  layer = "Street",
  drawMode = "",
  areas = [],
  measurePoints = [],
  routePoints = [],
  routeResult = null,
  routeUserPoint = null,
  onAreaCreated = () => {},
  onToolPoint = () => {},
  onMarkerTool = () => {},
  isAdmin = false,
  onLayerToggle = () => {},
  onLayerOpacity = () => {},
  showBoundaryLayer = true,
  showStateBorders = true,
  showLgaBorders = true,
  showBoundaryNames = true,
  partyMapAnalysis = null,
  selectedBoundaryState = "",
  onBoundarySelect = () => {},
  onBoundaryClear = () => {},
}) {
  const el = useRef(null);
  const leaflet = useRef(null);
  const overlays = useRef([]);
  const areaLayers = useRef([]);
  const customLayers = useRef([]);
  const toolLayers = useRef([]);
  const tile = useRef(null);
  const boundaryOverlay = useRef(null);
  const lgaOverlay = useRef(null);
  const nigeriaStateOverlay = useRef(null);
  const nigeriaLgaOverlay = useRef(null);
  const nigeriaStateLabels = useRef([]);
  const nigeriaLgaLabels = useRef([]);
  const hoverBoundaryLayer = useRef(null);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [oyoBoundaries, setOyoBoundaries] = useState({ state: null, lgas: null });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/boundaries/oyo`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Boundary service unavailable"))))
      .then((data) => setOyoBoundaries({ state: data.state || null, lgas: data.lgas || null }))
      .catch((error) => {
        if (error.name !== "AbortError") console.warn("Oyo boundaries could not be loaded:", error.message);
      });

    return () => controller.abort();
  }, []);

  const normalizeBoundaryKey = (value) =>
    String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

  const normalizeLgaMatch = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const partyLgaResults = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(partyMapAnalysis?.byLga || {}).map(([name, result]) => [normalizeLgaMatch(name), result]),
      ),
    [partyMapAnalysis],
  );

  const getStateKey = (feature) =>
    normalizeBoundaryKey(
      feature.properties?.STATE_NAME ||
        feature.properties?.ADM1_EN ||
        feature.properties?.state ||
        feature.properties?.STATE ||
        feature.properties?.state_name ||
        feature.properties?.admin1Name ||
        feature.properties?.NAME_1 ||
        feature.properties?.name ||
        feature.properties?.NAME ||
        "",
    );

  const getLgaKey = (feature) =>
    normalizeBoundaryKey(
      feature.properties?.ADM2_EN ||
        feature.properties?.lga_name ||
        feature.properties?.LGA ||
        feature.properties?.lga ||
        feature.properties?.LTNAME ||
        "",
    );

  const getBoundaryLabel = (feature) =>
    feature.properties?.STATE_NAME ||
    feature.properties?.state ||
    feature.properties?.NAME ||
    feature.properties?.name ||
    feature.properties?.ADM2_EN ||
    feature.properties?.lga_name ||
    feature.properties?.LGA ||
    feature.properties?.lga ||
    feature.properties?.shapeName ||
    "";

  const renderMap = () => {
    if (!leaflet.current || !el.current) return;

    const map = leaflet.current;
    overlays.current.forEach((x) => x.remove());
    overlays.current = [];

    incidents.forEach((item) => {
      const style = item.style || { color: "#38bdf8", fillColor: "#38bdf8", opacity: 0.8, fillOpacity: 0.2 };
      const marker = L.marker([item.lat, item.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="report-marker" style="--pin:${style.color};--fill:${style.fillColor || style.color};--alpha:${style.opacity ?? 0.8}"><span style="display:grid;place-items:center;font-size:11px;font-weight:800;font-family:Inter,Arial,sans-serif">${item.reportType || "IP"}</span></div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        }),
      });

      marker.addTo(map).on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        onSelect(item);
      });
      overlays.current.push(marker);
    });

    officers.forEach((item) => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="officer-marker ${item.status?.toLowerCase()}" style="padding:2px 8px;">${item.name?.split(" ")[1] || item.name?.[0] || "U"}</div>`,
        iconSize: [92, 28],
        iconAnchor: [12, 14],
      });
      const marker = L.marker([item.lat, item.lng], { icon }).addTo(map);
      marker.bindPopup(
        `<div class="marker-popup"><b>${item.name}</b><br>${item.unit}<br>Status: ${item.status}</div>`,
      );
      overlays.current.push(marker);
    });
  };

  useEffect(() => {
    if (leaflet.current || !el.current) return;
    const map = L.map(el.current, { zoomControl: false, doubleClickZoom: false }).setView(OYO_CENTER, 9);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    leaflet.current = map;
    mapRef.current = map;

    return () => {
      overlays.current.forEach((x) => x.remove());
      areaLayers.current.forEach((x) => x.remove());
      toolLayers.current.forEach((x) => x.remove());
      overlays.current = [];
      areaLayers.current = [];
      toolLayers.current = [];
      map.remove();
      leaflet.current = null;
      mapRef.current = null;
    };
  }, [mapRef]);

  useEffect(() => {
    if (!leaflet.current) return;
    tile.current?.remove();

    const osm = () =>
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        crossOrigin: true,
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      });

    const esri = (service) =>
      L.tileLayer(
        `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`,
        { crossOrigin: true, maxZoom: 19, attribution: "Tiles &copy; Esri" },
      );

    const imagery = () => esri("World_Imagery");
    const topo = () => esri("World_Topo_Map");
    const esriStreet = () => esri("World_Street_Map");
    const terrain = () =>
      L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
        crossOrigin: true,
        maxZoom: 17,
        attribution: "&copy; OpenTopoMap contributors",
      });

    let layers;
    if (layer === "Terrain") layers = [terrain()];
    else if (layer === "Topo") layers = [topo()];
    else if (layer === "EsriStreet") layers = [esriStreet()];
    else if (layer === "Satellite") layers = [imagery()];
    else layers = [osm()];

    tile.current = L.layerGroup(layers).addTo(leaflet.current);
    tile.current.eachLayer((x) => x.bringToBack());
  }, [layer]);

  useEffect(() => {
    renderMap();
  }, [incidents, officers, cameras, selected, layer, drawMode, areas, measurePoints, routePoints, routeResult, routeUserPoint]);

  const grouped = useMemo(() => {
    const groups = {};
    mapLayers.forEach((layerItem) => {
      const key = layerGeometry(layerItem);
      groups[key] = groups[key] || [];
      groups[key].push(layerItem);
    });
    return groups;
  }, [mapLayers]);

  return (
    <div className="map-shell">
      <div ref={el} className="map-view" />
      <div className="map-layer-panel">
        <button className="map-action" onClick={() => setLayerPanelOpen((v) => !v)}>
          <FaMapMarkedAlt /> Layers
        </button>
        {layerPanelOpen && (
          <div className="layer-panel-body">
            {Object.entries(grouped).map(([cat, catLayers]) => (
              <div className="lcp-group" key={cat}>
                <button className="lcp-cat-row" onClick={() => {}}>
                  <span className="lcp-cat-icon" style={{ color: CATEGORY_COLORS[cat] || "#e2e8f0" }}>
                    <CategoryIcon cat={cat} size={14} />
                  </span>
                  <span className="lcp-cat-name">{cat}</span>
                  <span className="lcp-cat-count">{catLayers.length}</span>
                  <span className="lcp-cat-arrow"><MdAdjust size={10} /></span>
                </button>
                {catLayers.map((layerItem) => (
                  <div className="lcp-layer-row" key={layerItem.id}>
                    <span
                      className="lcp-swatch"
                      style={{
                        background: layerItem.color || CATEGORY_COLORS[layerGeometry(layerItem)] || "#38bdf8",
                      }}
                    />
                    <div className="lcp-layer-info">
                      <span className="lcp-layer-name">{layerItem.name}</span>
                      <span className="lcp-layer-type">{layerItem.type === "raster" ? "Raster" : "Map layer"} - {layerGeometry(layerItem)}</span>
                    </div>
                    {isAdmin && (
                      <input
                        className="lcp-opacity"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={layerItem.opacity ?? 0.65}
                        title={`Opacity: ${Math.round((layerItem.opacity ?? 0.65) * 100)}%`}
                        onChange={(e) => onLayerOpacity(layerItem.id, Number(e.target.value))}
                      />
                    )}
                    <button
                      className={`lcp-toggle ${layerItem.visible !== false ? "on" : "off"}`}
                      onClick={() => onLayerToggle(layerItem.id, layerItem.visible === false)}
                      title={layerItem.visible !== false ? "Hide layer" : "Show layer"}
                    >
                      {layerItem.visible !== false ? <MdImage size={14} /> : <MdImage size={14} style={{ opacity: 0.3 }} />}
                    </button>
                  </div>
                ))}
              </div>
            ))}
            {!mapLayers.length && (
              <div className="lcp-empty">
                No custom layers uploaded yet.
                {isAdmin && " Upload shapefiles via System Administrator -> Map Data."}
              </div>
            )}
          </div>
        )}
      </div>
      {selectedBoundaryState && showBoundaryLayer && (
        <div className="boundary-info-card">
          <strong>Selected</strong>
          <span>{selectedBoundaryState}</span>
        </div>
      )}
      {emergencyAlerts.length > 0 && (
        <div className="emergency-alert-card">
          <b>Emergency from {emergencyAlerts[0].name}</b>
          <span>{emergencyAlerts[0].type || "Emergency"}</span>
          <button type="button" className="icon-btn" onClick={() => onBoundaryClear()}>
            <FaTimes />
          </button>
        </div>
      )}
    </div>
  );
}
