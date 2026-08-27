import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { MdFilterHdr, MdHexagon, MdImage, MdLocationPin, MdPolyline, MdVideocam } from "react-icons/md";

const LAYER_CATEGORIES = ["Point", "Line", "Polygon", "Raster"];
const LAYER_COLORS_PRESET = [
  "#38bdf8",
  "#facc15",
  "#4ade80",
  "#f87171",
  "#818cf8",
  "#fb923c",
  "#60a5fa",
  "#e2e8f0",
];

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

const LEGACY_CATEGORY_GEOMETRY = {
  Roads: "Line",
  Boundary: "Polygon",
  Water: "Polygon",
  Vegetation: "Polygon",
  "No-Go Zone": "Polygon",
  Settlement: "Point",
  Custom: "Point",
};

const OPERATIONAL_USES = [
  "Reference",
  "Field Route",
  "Checkpoint",
  "Hotspot",
  "No-Go Zone",
  "Response Asset",
  "Camera Coverage",
  "Emergency Service",
  "Community Place",
];

const POINT_ICONS = [
  { key: "pin", label: "Pin", Component: MdLocationPin },
  { key: "place", label: "Place", Component: MdLocationPin },
  { key: "pushpin", label: "Push Pin", Component: MdHexagon },
  { key: "home", label: "Home", Component: MdLocationPin },
  { key: "business", label: "Building", Component: MdLocationPin },
  { key: "school", label: "School", Component: MdLocationPin },
  { key: "hospital", label: "Hospital", Component: MdLocationPin },
  { key: "bank", label: "Bank", Component: MdLocationPin },
  { key: "factory", label: "Factory", Component: MdLocationPin },
  { key: "store", label: "Store", Component: MdLocationPin },
  { key: "mosque", label: "Mosque", Component: MdLocationPin },
  { key: "church", label: "Church", Component: MdLocationPin },
  { key: "fuel", label: "Fuel", Component: MdLocationPin },
  { key: "busstop", label: "Bus Stop", Component: MdLocationPin },
  { key: "train", label: "Train", Component: MdLocationPin },
  { key: "airport", label: "Airport", Component: MdLocationPin },
  { key: "anchor", label: "Anchor", Component: MdLocationPin },
  { key: "truck", label: "Truck", Component: MdLocationPin },
  { key: "construction", label: "Construction", Component: MdLocationPin },
  { key: "traffic", label: "Traffic", Component: MdLocationPin },
  { key: "parking", label: "Parking", Component: MdLocationPin },
  { key: "camera", label: "Camera", Component: MdLocationPin },
  { key: "antenna", label: "Antenna", Component: MdLocationPin },
  { key: "electric", label: "Electric", Component: MdLocationPin },
  { key: "fire", label: "Fire", Component: MdLocationPin },
  { key: "water", label: "Water", Component: MdLocationPin },
  { key: "park", label: "Park", Component: MdLocationPin },
  { key: "vegetation", label: "Vegetation", Component: MdLocationPin },
  { key: "terrain", label: "Terrain", Component: MdLocationPin },
  { key: "bridge", label: "Bridge", Component: MdLocationPin },
  { key: "security", label: "Security", Component: MdLocationPin },
  { key: "warning", label: "Warning", Component: MdLocationPin },
  { key: "radiation", label: "Radiation", Component: MdLocationPin },
  { key: "accessible", label: "Accessible", Component: MdLocationPin },
  { key: "recycle", label: "Recycle", Component: MdLocationPin },
];

const layerGeometry = (layer) =>
  LAYER_CATEGORIES.includes(layer?.category)
    ? layer.category
    : layer?.type === "raster"
      ? "Raster"
      : LEGACY_CATEGORY_GEOMETRY[layer?.category] || "Point";

const CategoryIcon = ({ cat, ...props }) => {
  const Icon = CATEGORY_ICON_COMPONENTS[cat] || MdFilterHdr;
  return <Icon {...props} />;
};

const PointIconComponent = ({ iconKey, size = 18, color = "currentColor" }) => {
  const entry = POINT_ICONS.find((p) => p.key === iconKey);
  const Icon = entry?.Component || MdLocationPin;
  return <Icon size={size} color={color} />;
};

function LayerStyleEditor({ layer, canDelete, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false);
  const makeDraft = (item) => ({
    name: item.name || "",
    category: layerGeometry(item),
    operationalUse: item.operationalUse || "Reference",
    color: item.color || "#38bdf8",
    fillColor: item.fillColor || item.color || "#38bdf8",
    opacity: item.opacity ?? 0.65,
    fillOpacity: item.fillOpacity ?? 0.18,
    lineWeight: item.lineWeight || 2,
    lineStyle: item.lineStyle || "solid",
    pointIcon: item.pointIcon || "pin",
    pointIconColor: item.pointIconColor || "#ffffff",
    pointSize: item.pointSize || 24,
    showLabels: item.showLabels !== false,
    labelField: item.labelField || "name",
    popupFields: item.popupFields || "",
  });
  const [draft, setDraft] = useState(() => makeDraft(layer));
  const isPoint = draft.category === "Point";
  const isLine = draft.category === "Line";
  const isPolygon = draft.category === "Polygon";
  const isRaster = draft.category === "Raster" || layer.type === "raster";
  const save = () =>
    onUpdate(layer.id, {
      ...draft,
      opacity: Number(draft.opacity),
      fillOpacity: Number(draft.fillOpacity),
      lineWeight: Number(draft.lineWeight),
      pointSize: Number(draft.pointSize),
    });

  return (
    <div className="manage-row mdp-manage-row">
      <div
        className="avatar"
        style={{ background: draft.color || "#163d68", color: draft.pointIconColor || "#fff", display: "grid", placeItems: "center" }}
      >
        {isRaster ? (
          <MdImage size={16} />
        ) : isPoint ? (
          <PointIconComponent iconKey={draft.pointIcon} size={16} color={draft.pointIconColor || "#fff"} />
        ) : (
          <CategoryIcon cat={draft.category} size={16} />
        )}
      </div>
      <div className="mdp-layer-summary">
        <b>{layer.name}</b>
        <small>
          {layer.type} - {layerGeometry(layer)} - {layer.operationalUse || "Reference"} / opacity {Math.round((layer.opacity ?? 0.65) * 100)}%
          {layer.showLabels ? " / labels on" : ""}
        </small>
      </div>
      <button className={`lcp-toggle ${layer.visible !== false ? "on" : "off"}`} onClick={() => onUpdate(layer.id, { visible: layer.visible === false })} title={layer.visible !== false ? "Hide" : "Show"}>
        {layer.visible !== false ? <MdVideocam size={14} /> : <MdVideocam size={14} style={{ opacity: 0.3 }} />}
      </button>
      <button className="unit-action-btn" onClick={() => setOpen((x) => !x)}>
        {open ? "Close" : "Edit"}
      </button>
      {canDelete && (
        <button className="delete-btn" onClick={() => onDelete(layer)}>
          Delete
        </button>
      )}
      {open && (
        <div className="mdp-editor">
          <div className="mdp-row">
            <label className="mdp-label">
              Layer name
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="mdp-label">
              Geometry category
              <select value={draft.category} onChange={(e) => {
                const color = CATEGORY_COLORS[e.target.value] || draft.color;
                setDraft({ ...draft, category: e.target.value, color, fillColor: color });
              }}>
                {LAYER_CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}
              </select>
            </label>
            <label className="mdp-label">
              Operational use
              <select value={draft.operationalUse} onChange={(e) => setDraft({ ...draft, operationalUse: e.target.value })}>
                {OPERATIONAL_USES.map((use) => <option key={use}>{use}</option>)}
              </select>
            </label>
          </div>
          <div className="mdp-row">
            <label className="mdp-label">
              Layer opacity
              <div className="mdp-opacity-row">
                <input type="range" min="0.05" max="1" step="0.05" value={draft.opacity} onChange={(e) => setDraft({ ...draft, opacity: e.target.value })} />
                <span>{Math.round(Number(draft.opacity) * 100)}%</span>
              </div>
            </label>
            {!isPoint && !isRaster && (
              <label className="mdp-label">
                Line width
                <input type="number" min="1" max="12" value={draft.lineWeight} onChange={(e) => setDraft({ ...draft, lineWeight: e.target.value })} />
              </label>
            )}
            {!isPoint && !isRaster && (
              <label className="mdp-label">
                Line style
                <select value={draft.lineStyle} onChange={(e) => setDraft({ ...draft, lineStyle: e.target.value })}>
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </label>
            )}
          </div>
          {isPoint && (
            <div className="mdp-row">
              <label className="mdp-label">
                Point icon
                <div className="mdp-icon-grid">
                  {POINT_ICONS.map((p) => (
                    <button type="button" key={p.key} className={`mdp-icon-btn ${draft.pointIcon === p.key ? "selected" : ""}`} title={p.label} onClick={() => setDraft({ ...draft, pointIcon: p.key })}>
                      <p.Component size={18} />
                    </button>
                  ))}
                </div>
              </label>
              <label className="mdp-label">
                Point size
                <input type="number" min="14" max="44" value={draft.pointSize} onChange={(e) => setDraft({ ...draft, pointSize: e.target.value })} />
              </label>
              <label className="mdp-label mdp-color-label">
                Marker color
                <input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
              </label>
              <label className="mdp-label mdp-color-label">
                Icon color
                <input type="color" value={draft.pointIconColor} onChange={(e) => setDraft({ ...draft, pointIconColor: e.target.value })} />
              </label>
            </div>
          )}
          {(isLine || isPolygon) && (
            <div className="mdp-row mdp-style-row">
              <label className="mdp-label mdp-color-label">
                Line color
                <div className="mdp-color-row">
                  <input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
                  <div className="mdp-presets">
                    {LAYER_COLORS_PRESET.map((color) => (
                      <button type="button" key={color} className={`mdp-preset-dot ${draft.color === color ? "selected" : ""}`} style={{ background: color }} onClick={() => setDraft({ ...draft, color })} />
                    ))}
                  </div>
                </div>
              </label>
              {isPolygon && (
                <label className="mdp-label mdp-color-label">
                  Fill color
                  <input type="color" value={draft.fillColor} onChange={(e) => setDraft({ ...draft, fillColor: e.target.value })} />
                </label>
              )}
              {isPolygon && (
                <label className="mdp-label">
                  Area fill opacity
                  <div className="mdp-opacity-row">
                    <input type="range" min="0" max="0.8" step="0.05" value={draft.fillOpacity} onChange={(e) => setDraft({ ...draft, fillOpacity: e.target.value })} />
                    <span>{Math.round(Number(draft.fillOpacity) * 100)}%</span>
                  </div>
                </label>
              )}
            </div>
          )}
          <div className="mdp-row">
            <label className="mdp-label mdp-check-label">
              <input type="checkbox" checked={draft.showLabels} onChange={(e) => setDraft({ ...draft, showLabels: e.target.checked })} />
              Show labels
            </label>
            <label className="mdp-label">
              Label field
              <input value={draft.labelField} onChange={(e) => setDraft({ ...draft, labelField: e.target.value })} />
            </label>
            <label className="mdp-label mdp-wide">
              Popup fields
              <input value={draft.popupFields} onChange={(e) => setDraft({ ...draft, popupFields: e.target.value })} />
            </label>
          </div>
          <button className="primary mdp-save-style" onClick={save}>Save layer style</button>
        </div>
      )}
    </div>
  );
}

export default function MapDataPanel({ layers, isSuperAdmin, onClose, onCreate, onUpdate, onDelete }) {
  const [mode, setMode] = useState("geojson");
  const [form, setForm] = useState({
    name: "",
    url: "",
    bounds: "7.55,3.70,7.20,4.15",
    opacity: "0.65",
    fillOpacity: "0.18",
    category: "Point",
    operationalUse: "Reference",
    color: "#38bdf8",
    fillColor: "#38bdf8",
    lineWeight: "2",
    lineStyle: "solid",
    pointIcon: "pin",
    pointIconColor: "#ffffff",
    pointSize: "24",
    showLabels: true,
    labelField: "name",
    popupFields: "name,type,status",
  });
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(isSuperAdmin ? "upload" : "manage");

  const readFile = (selected) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.onload = () => resolve(reader.result);
      if (selected.name.toLowerCase().endsWith(".zip")) reader.readAsArrayBuffer(selected);
      else reader.readAsText(selected);
    });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "raster") {
        const nums = form.bounds.split(",").map((x) => Number(x.trim()));
        if (nums.length !== 4 || nums.some((x) => !Number.isFinite(x))) throw new Error("Bounds must be north,west,south,east (4 numbers)");
        await onCreate({
          name: form.name,
          type: "raster",
          url: form.url,
          bounds: [[nums[0], nums[1]], [nums[2], nums[3]]],
          opacity: Number(form.opacity) || 0.65,
          category: "Raster",
          operationalUse: form.operationalUse,
          color: form.color,
          visible: true,
        });
      } else {
        if (!file) throw new Error("Choose a GeoJSON or zipped shapefile (.zip)");
        const raw = await readFile(file);
        const data = file.name.toLowerCase().endsWith(".zip")
          ? await (await import("shpjs")).default(raw)
          : JSON.parse(raw);
        await onCreate({
          name: form.name || file.name,
          type: "geojson",
          data,
          opacity: Number(form.opacity) || 0.65,
          fillOpacity: Number(form.fillOpacity),
          category: form.category,
          operationalUse: form.operationalUse,
          color: form.color,
          fillColor: form.fillColor,
          lineWeight: Number(form.lineWeight),
          lineStyle: form.lineStyle,
          pointIcon: form.pointIcon,
          pointIconColor: form.pointIconColor,
          pointSize: Number(form.pointSize),
          showLabels: form.showLabels,
          labelField: form.labelField,
          popupFields: form.popupFields,
          visible: true,
        });
      }
      setForm((f) => ({ ...f, name: "", url: "" }));
      setFile(null);
      setTab("manage");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const grouped = layers.reduce((acc, layer) => {
    const cat = layerGeometry(layer);
    (acc[cat] ||= []).push(layer);
    return acc;
  }, {});

  const uploadPoint = mode === "geojson" && form.category === "Point";
  const uploadLine = mode === "geojson" && form.category === "Line";
  const uploadPolygon = mode === "geojson" && form.category === "Polygon";

  return (
    <section className="camera-panel map-data-panel">
      <div className="camera-head">
        <div>
          <span className="eyebrow">{isSuperAdmin ? "SYSTEM MAP ADMIN" : "MAP ADMIN"}</span>
          <h2>Custom Map Builder</h2>
        </div>
        <button className="icon-btn" onClick={onClose}><FaTimes /></button>
      </div>
      <div className="camera-tabs">
        {isSuperAdmin && (
          <button className={tab === "upload" ? "active" : ""} onClick={() => setTab("upload")}>Upload Layer</button>
        )}
        <button className={tab === "manage" ? "active" : ""} onClick={() => setTab("manage")}>Manage Layers <i>{layers.length}</i></button>
      </div>
      {tab === "upload" && isSuperAdmin && (
        <>
          <div className="camera-tabs mdp-mode-tabs">
            <button className={mode === "geojson" ? "active" : ""} onClick={() => setMode("geojson")}>GeoJSON / Shapefile</button>
            <button className={mode === "raster" ? "active" : ""} onClick={() => setMode("raster")}>Raster / Image Overlay</button>
          </div>
          <form className="mdp-form" onSubmit={submit}>
            <div className="mdp-row">
              <label className="mdp-label">
                Layer name
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Oyo LGA Boundaries" />
              </label>
              {mode === "geojson" && (
                <label className="mdp-label">
                  Geometry category
                  <select value={form.category} onChange={(e) => {
                    const color = CATEGORY_COLORS[e.target.value] || "#38bdf8";
                    setForm({ ...form, category: e.target.value, color, fillColor: color });
                  }}>
                    {['Point', 'Line', 'Polygon'].map((cat) => <option key={cat}>{cat}</option>)}
                  </select>
                </label>
              )}
              <label className="mdp-label">
                Operational use
                <select value={form.operationalUse} onChange={(e) => setForm({ ...form, operationalUse: e.target.value })}>
                  {OPERATIONAL_USES.map((use) => <option key={use}>{use}</option>)}
                </select>
              </label>
            </div>
            {mode === "raster" ? (
              <div className="mdp-row">
                <label className="mdp-label mdp-wide">
                  Image URL (.png / .jpg / .tif)
                  <input required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/oyo-map.png" />
                </label>
                <label className="mdp-label">
                  Bounds (N,W,S,E)
                  <input required value={form.bounds} onChange={(e) => setForm({ ...form, bounds: e.target.value })} placeholder="7.55,3.70,7.20,4.15" />
                </label>
              </div>
            ) : (
              <label className="mdp-label">
                Shapefile (.zip) or GeoJSON (.geojson / .json)
                <input type="file" accept=".geojson,.json,.zip" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                {file && <span className="mdp-file-name">{file.name}</span>}
              </label>
            )}
            <div className="mdp-row mdp-style-row">
              {(mode === "raster" || uploadPoint || uploadLine || uploadPolygon) && (
                <label className="mdp-label mdp-color-label">
                  {uploadPoint ? "Marker color" : "Line / border color"}
                  <div className="mdp-color-row">
                    <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                    <div className="mdp-presets">
                      {LAYER_COLORS_PRESET.map((color) => (
                        <button type="button" key={color} className={`mdp-preset-dot ${form.color === color ? "selected" : ""}`} style={{ background: color }} onClick={() => setForm({ ...form, color, fillColor: color })} />
                      ))}
                    </div>
                  </div>
                </label>
              )}
              {uploadPolygon && (
                <label className="mdp-label mdp-color-label">
                  Fill color
                  <div className="mdp-color-row">
                    <input type="color" value={form.fillColor} onChange={(e) => setForm({ ...form, fillColor: e.target.value })} />
                  </div>
                </label>
              )}
              <label className="mdp-label">
                Opacity
                <div className="mdp-opacity-row">
                  <input type="range" min="0.05" max="1" step="0.05" value={form.opacity} onChange={(e) => setForm({ ...form, opacity: e.target.value })} />
                  <span>{Math.round(Number(form.opacity) * 100)}%</span>
                </div>
              </label>
            </div>
            {mode === "geojson" && (
              <>
                {(uploadLine || uploadPolygon) && (
                  <div className="mdp-row">
                    <label className="mdp-label">
                      Line style
                      <select value={form.lineStyle} onChange={(e) => setForm({ ...form, lineStyle: e.target.value })}>
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                      </select>
                    </label>
                    <label className="mdp-label">
                      Line width
                      <input type="number" min="1" max="12" value={form.lineWeight} onChange={(e) => setForm({ ...form, lineWeight: e.target.value })} />
                    </label>
                    {uploadPolygon && (
                      <label className="mdp-label">
                        Area fill opacity
                        <div className="mdp-opacity-row">
                          <input type="range" min="0" max="0.8" step="0.05" value={form.fillOpacity} onChange={(e) => setForm({ ...form, fillOpacity: e.target.value })} />
                          <span>{Math.round(Number(form.fillOpacity) * 100)}%</span>
                        </div>
                      </label>
                    )}
                  </div>
                )}
                {uploadPoint && (
                  <div className="mdp-row">
                    <label className="mdp-label">
                      Point icon
                      <div className="mdp-icon-grid">
                        {POINT_ICONS.map((p) => (
                          <button type="button" key={p.key} className={`mdp-icon-btn ${form.pointIcon === p.key ? "selected" : ""}`} title={p.label} onClick={() => setForm({ ...form, pointIcon: p.key })}>
                            <p.Component size={18} />
                          </button>
                        ))}
                      </div>
                    </label>
                    <label className="mdp-label">
                      Point size
                      <input type="number" min="14" max="44" value={form.pointSize} onChange={(e) => setForm({ ...form, pointSize: e.target.value })} />
                    </label>
                    <label className="mdp-label mdp-color-label">
                      Icon color
                      <input type="color" value={form.pointIconColor} onChange={(e) => setForm({ ...form, pointIconColor: e.target.value })} />
                    </label>
                  </div>
                )}
                <div className="mdp-row">
                  <label className="mdp-label mdp-check-label">
                    <input type="checkbox" checked={form.showLabels} onChange={(e) => setForm({ ...form, showLabels: e.target.checked })} />
                    Show feature labels on map
                  </label>
                  {form.showLabels && (
                    <label className="mdp-label">
                      Label field
                      <input value={form.labelField} onChange={(e) => setForm({ ...form, labelField: e.target.value })} placeholder={uploadLine ? "road_name, name" : "name, NAME, ADM2_EN, lga_name"} />
                    </label>
                  )}
                  <label className="mdp-label mdp-wide">
                    Popup fields
                    <input value={form.popupFields} onChange={(e) => setForm({ ...form, popupFields: e.target.value })} placeholder="name,type,status,ward,lga" />
                  </label>
                </div>
              </>
            )}
            {error && <div className="error">{error}</div>}
            <button className="primary mdp-submit" disabled={loading}>{loading ? "Processing shapefile..." : "+ Add layer to map"}</button>
            <div className="mdp-sources">
              <b>Free Nigeria shapefile sources:</b>
              <a href="https://gadm.org/download_country.html" target="_blank" rel="noopener noreferrer">GADM</a>
              <span>-</span>
              <a href="https://data.humdata.org/dataset/cod-ab-nga" target="_blank" rel="noopener noreferrer">HDX</a>
              <span>-</span>
              <a href="https://download.geofabrik.de/africa/nigeria.html" target="_blank" rel="noopener noreferrer">GeoFabrik</a>
            </div>
          </form>
        </>
      )}
      {tab === "manage" && (
        <div className="mdp-manage">
          {!layers.length && (
            <div className="empty-cameras">
              <b>No layers uploaded yet</b>
              <span>{isSuperAdmin ? "Switch to the Upload tab and add your first shapefile." : "Ask a system administrator to upload map layers first."}</span>
            </div>
          )}
          {Object.entries(grouped).map(([cat, catLayers]) => (
            <div key={cat} className="mdp-cat-group">
              <div className="mdp-cat-header">
                <span style={{ color: CATEGORY_COLORS[cat] || "#e2e8f0" }}><CategoryIcon cat={cat} size={14} /></span>
                <b>{cat}</b>
                <span className="mdp-cat-count-badge">{catLayers.length}</span>
              </div>
              {catLayers.map((layer) => (
                <LayerStyleEditor key={layer.id} layer={layer} canDelete={isSuperAdmin} onUpdate={onUpdate} onDelete={onDelete} />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
