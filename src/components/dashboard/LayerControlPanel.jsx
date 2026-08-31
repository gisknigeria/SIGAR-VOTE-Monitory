import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import {
  MdAdjust,
  MdFilterHdr,
  MdHexagon,
  MdImage,
  MdLocationPin,
  MdPolyline,
  MdVideocam,
} from "react-icons/md";

const LAYER_CATEGORIES = ["Point", "Line", "Polygon", "Raster"];
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

const CategoryIcon = ({ category, ...props }) => {
  const Icon = CATEGORY_ICON_COMPONENTS[category] || MdFilterHdr;
  return <Icon {...props} />;
};

export const layerGeometry = (layer) =>
  LAYER_CATEGORIES.includes(layer?.category)
    ? layer.category
    : layer?.type === "raster"
      ? "Raster"
      : LEGACY_CATEGORY_GEOMETRY[layer?.category] || "Point";

export default function LayerControlPanel({ layers, isAdmin, onToggle, onOpacity, onClose }) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const grouped = layers.reduce((groups, layer) => {
    const category = layerGeometry(layer);
    (groups[category] ||= []).push(layer);
    return groups;
  }, {});
  const visibleCount = layers.filter((layer) => layer.visible !== false).length;

  return (
    <div className="layer-control-panel">
      <div className="lcp-head">
        <div>
          <span className="eyebrow">CUSTOM MAP</span>
          <b className="lcp-title">
            Map Layers <span className="lcp-count">{visibleCount}/{layers.length}</span>
          </b>
        </div>
        <div className="lcp-actions">
          <button className="lcp-icon-btn" onClick={() => setCollapsed((value) => !value)} title={collapsed ? "Expand" : "Collapse"}>
            <MdAdjust size={13} />
          </button>
          <button className="lcp-icon-btn" onClick={onClose} title="Close">
            <FaTimes size={12} />
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="lcp-body">
          <div className="lcp-all-row">
            <button className="lcp-all-btn" onClick={() => layers.forEach((layer) => onToggle(layer.id, true))}>Show all</button>
            <button className="lcp-all-btn" onClick={() => layers.forEach((layer) => onToggle(layer.id, false))}>Hide all</button>
          </div>
          {!layers.length && (
            <div className="lcp-empty">
              No custom layers uploaded yet.
              {isAdmin && " Upload shapefiles via System Administrator -> Map Data."}
            </div>
          )}
          {Object.entries(grouped).map(([category, categoryLayers]) => (
            <div className="lcp-group" key={category}>
              <button
                className="lcp-cat-row"
                onClick={() => setExpandedCategories((current) => ({ ...current, [category]: current[category] === false }))}
              >
                <span className="lcp-cat-icon" style={{ color: CATEGORY_COLORS[category] || "#e2e8f0" }}>
                  <CategoryIcon category={category} size={14} />
                </span>
                <span className="lcp-cat-name">{category}</span>
                <span className="lcp-cat-count">{categoryLayers.length}</span>
                <span className="lcp-cat-arrow"><MdAdjust size={10} /></span>
              </button>
              {expandedCategories[category] !== false && categoryLayers.map((layer) => (
                <div className="lcp-layer-row" key={layer.id}>
                  <span className="lcp-swatch" style={{ background: layer.color || CATEGORY_COLORS[layerGeometry(layer)] || "#38bdf8" }} />
                  <div className="lcp-layer-info">
                    <span className="lcp-layer-name">{layer.name}</span>
                    <span className="lcp-layer-type">{layer.type === "raster" ? "Raster" : "Map layer"} - {layerGeometry(layer)}</span>
                  </div>
                  {isAdmin && (
                    <input
                      className="lcp-opacity"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={layer.opacity ?? 0.65}
                      title={`Opacity: ${Math.round((layer.opacity ?? 0.65) * 100)}%`}
                      onChange={(event) => onOpacity(layer.id, Number(event.target.value))}
                    />
                  )}
                  <button
                    className={`lcp-toggle ${layer.visible !== false ? "on" : "off"}`}
                    onClick={() => onToggle(layer.id, layer.visible === false)}
                    title={layer.visible !== false ? "Hide layer" : "Show layer"}
                  >
                    <MdVideocam size={14} style={layer.visible === false ? { opacity: 0.3 } : undefined} />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
