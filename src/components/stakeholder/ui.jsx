import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import { oyoBoundariesQuery } from "../../queries/boundaries.js";
import { STREET_TILES } from "../../config.js";

// Building blocks shared by the election overview and the voter survey, so both read the same.

// Sequential gold ramp, dark to light. Monotonic by lightness; the darkest step still clears
// 2:1 on the wine surface, so the lowest band never disappears into the panel.
export const GOLD_RAMP = ["#6d4a12", "#a8761f", "#d9aa4b", "#f5dc9a"];
export const NO_DATA_FILL = "#3a1420";

export const num = (value) => (Number.isFinite(Number(value)) ? Number(value).toLocaleString() : "—");
export const pct = (value) => (value === null || value === undefined ? "—" : `${Number(value).toFixed(1)}%`);
/** A 0-1 share as a percentage. */
export const share = (value, digits = 1) => (value === null || value === undefined ? "—" : `${(Number(value) * 100).toFixed(digits)}%`);
export const time = (value) => (value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
export { escapeHtml };

// Boundary features name their LGA "Ibadan North-West" while results carry "IBADAN NORTH WEST",
// so matching has to ignore case and punctuation or every LGA silently shades as zero.
//
// Four LGAs are also spelled differently between the two authoritative sources -- the bundled
// polling-unit register and the official boundary file. They are the same four real LGAs, and
// without this reconciliation 4 of 33 would render as "no results" on the map even while
// reporting, which on an election map reads as a real finding rather than a spelling mismatch.
// Verified by diffing the full 33 names from both sources; extend only from that same diff.
const LGA_SPELLING_VARIANTS = {
  atigbo: "atisbo",
  "ogbomosho north": "ogbomoso north",
  "ogbomosho south": "ogbomoso south",
  orelope: "oorelope",
};
export const lgaKey = (value) => {
  const normalized = String(value ?? "").trim().replace(/[^a-z0-9]+/gi, " ").replace(/\s+/g, " ").toLowerCase();
  return LGA_SPELLING_VARIANTS[normalized] || normalized;
};
export const featureLgaName = (feature) =>
  String(feature?.properties?.ADM2_EN || feature?.properties?.ADM2_REF || feature?.properties?.lga || feature?.properties?.name || "").trim();

/** A few large figures, read left to right. Never more than three, so each one is noticed. */
export function BigNumbers({ items }) {
  return (
    <section className="sh-numbers" aria-label="Key figures">
      {items.map((item) => (
        <div key={item.label} className={item.lead ? "sh-number sh-number-lead" : "sh-number"}>
          <span className="sh-number-label">{item.label}</span>
          <strong className="sh-number-value">{item.value}</strong>
          {item.sub && <span className="sh-number-sub">{item.sub}</span>}
        </div>
      ))}
    </section>
  );
}

export function Panel({ title, sub, wide = false, children }) {
  return (
    <section className={wide ? "sh-panel sh-panel-wide" : "sh-panel"}>
      <h2>{title}</h2>
      {sub && <p className="sh-panel-sub">{sub}</p>}
      {children}
    </section>
  );
}

/** Horizontal magnitude bars: one measure, direct-labelled, so colour never carries the identity. */
export function BarList({ rows, total, emptyMessage, formatValue = num }) {
  if (!rows.length) return emptyMessage ? <p className="sh-empty">{emptyMessage}</p> : null;
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul className="sh-bars">
      {rows.map((row, index) => (
        <li key={row.name}>
          <span className="sh-bar-name" title={row.name}>{row.name}</span>
          <span className="sh-bar-track">
            <span
              className="sh-bar-fill"
              style={{
                width: `${Math.max((row.value / max) * 100, row.value > 0 ? 2 : 0)}%`,
                // Brightest for the largest value: on this dark page, light gold is what the eye goes to.
                background: row.color || GOLD_RAMP[Math.max(GOLD_RAMP.length - 1 - index, 0)],
              }}
            />
          </span>
          <span className="sh-bar-value">
            {formatValue(row.value)}
            {total > 0 && <em>{((row.value / total) * 100).toFixed(1)}%</em>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Oyo LGA choropleth over the real boundaries.
 * rowsByKey: Map of lgaKey -> row; fill(row) -> colour; tooltip(name, row) -> HTML (escape data!).
 */
export function LgaMap({ rowsByKey, fill, tooltip, legend }) {
  const holder = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const boundaries = useQuery(oyoBoundariesQuery);

  useEffect(() => {
    if (!holder.current || mapRef.current) return;
    mapRef.current = L.map(holder.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, zoomSnap: 0.25 }).setView([8.1, 3.6], 8);
    // Same tile source as the operations map, so this view needs no key of its own and falls
    // back to the keyless CARTO street map exactly as that one does.
    const maptilerKey = import.meta.env.VITE_MAPTILER_KEY;
    (maptilerKey
      ? L.tileLayer(`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${maptilerKey}`, {
          attribution: "&copy; MapTiler &copy; OpenStreetMap contributors",
          maxZoom: 12,
        })
      : L.tileLayer(STREET_TILES.url, {
          attribution: STREET_TILES.attribution,
          subdomains: STREET_TILES.subdomains,
          maxZoom: 12,
        })
    ).addTo(mapRef.current);
    // The map often mounts before its panel has its final width (tab switches, grid reflow), and
    // Leaflet then fits the LGAs into the wrong box. Re-measure and re-fit whenever the box changes.
    const observer = new ResizeObserver(() => {
      const map = mapRef.current;
      if (!map) return;
      map.invalidateSize();
      if (layerRef.current) {
        try { map.fitBounds(layerRef.current.getBounds(), { padding: [12, 12] }); } catch { /* empty geometry */ }
      }
    });
    observer.observe(holder.current);
    return () => { observer.disconnect(); mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const lgas = boundaries.data?.lgas;
    if (!map || !lgas) return;
    layerRef.current?.remove();
    layerRef.current = L.geoJSON(lgas, {
      style: (feature) => ({ color: "#8b1e46", weight: 1, fillColor: fill(rowsByKey.get(lgaKey(featureLgaName(feature)))), fillOpacity: 0.82 }),
      onEachFeature: (feature, layer) => {
        const name = featureLgaName(feature);
        layer.bindTooltip(tooltip(escapeHtml(name || "Unnamed LGA"), rowsByKey.get(lgaKey(name))), { sticky: true });
      },
    }).addTo(map);
    map.invalidateSize();
    try { map.fitBounds(layerRef.current.getBounds(), { padding: [12, 12] }); } catch { /* empty geometry */ }
  }, [boundaries.data, rowsByKey, fill, tooltip]);

  return (
    <div className="sh-map-holder">
      <div ref={holder} className="sh-map" />
      {boundaries.isError && <p className="sh-empty sh-map-note">The boundary service is unavailable, so the map cannot be drawn. The figures beside it are unaffected.</p>}
      {legend && <div className="sh-legend" aria-hidden="true">{legend}</div>}
    </div>
  );
}
