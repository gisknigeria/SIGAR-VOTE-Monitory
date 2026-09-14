import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import { apiRequest } from "../../api/client.js";
import { oyoBoundariesQuery } from "../../queries/boundaries.js";
import "./stakeholder.css";

const PHASES = [
  { id: "pre-election", label: "Pre-election", blurb: "Readiness and coverage before polls open." },
  { id: "election-day", label: "Election day", blurb: "Results as they arrive from polling units." },
  { id: "post-election", label: "Post-election", blurb: "Final tallies, turnout and outstanding checks." },
];

// Sequential gold ramp, light to dark. Monotonic by lightness; the darkest step still clears
// 2:1 on the wine surface, so the lowest band never disappears into the panel.
const GOLD_RAMP = ["#6d4a12", "#a8761f", "#d9aa4b", "#f5dc9a"];
// Fixed status palette. Every use is paired with a visible label -- these hues are never
// allowed to carry meaning on their own.
const SEVERITY = {
  Critical: "#d03b3b",
  High: "#ec835a",
  Medium: "#fab219",
  Low: "#0ca30c",
};

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
const lgaKey = (value) => {
  const normalized = String(value ?? "").trim().replace(/[^a-z0-9]+/gi, " ").replace(/\s+/g, " ").toLowerCase();
  return LGA_SPELLING_VARIANTS[normalized] || normalized;
};
const featureLgaName = (feature) =>
  String(feature?.properties?.ADM2_EN || feature?.properties?.ADM2_REF || feature?.properties?.lga || feature?.properties?.name || "").trim();

const num = (value) => (Number.isFinite(Number(value)) ? Number(value).toLocaleString() : "—");
const pct = (value) => (value === null || value === undefined ? "—" : `${Number(value).toFixed(1)}%`);

function StatTile({ label, value, sub, emphasis = false }) {
  return (
    <div className={emphasis ? "sh-tile sh-tile-lead" : "sh-tile"}>
      <span className="sh-tile-label">{label}</span>
      <strong className="sh-tile-value">{value}</strong>
      {sub && <span className="sh-tile-sub">{sub}</span>}
    </div>
  );
}

/** Horizontal magnitude bars: one measure, direct-labelled, so colour never carries the identity. */
function BarList({ rows, total, emptyMessage, formatValue = num }) {
  if (!rows.length) return <p className="sh-empty">{emptyMessage}</p>;
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
                background: row.color || GOLD_RAMP[Math.min(index, GOLD_RAMP.length - 1)],
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

/** Cumulative returns over time. One series, so it carries no legend -- the heading names it. */
function ReturnsChart({ timeline }) {
  if (timeline.length < 2) return <p className="sh-empty">Not enough returns yet to plot a trend.</p>;
  const width = 720;
  const height = 200;
  const pad = { top: 12, right: 14, bottom: 26, left: 52 };
  const peak = Math.max(...timeline.map((point) => point.cumulative), 1);
  const x = (i) => pad.left + (i / (timeline.length - 1)) * (width - pad.left - pad.right);
  const y = (v) => pad.top + (1 - v / peak) * (height - pad.top - pad.bottom);
  const line = timeline.map((point, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(point.cumulative).toFixed(1)}`).join(" ");
  const area = `${line} L${x(timeline.length - 1).toFixed(1)},${height - pad.bottom} L${x(0).toFixed(1)},${height - pad.bottom} Z`;
  const ticks = [0, peak / 2, peak];
  const labelAt = (index) => new Date(timeline[index].hour).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <svg className="sh-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Cumulative polling units reported, reaching ${peak}`}>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="#4a2a35" strokeWidth="1" />
          <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" className="sh-axis">{Math.round(tick).toLocaleString()}</text>
        </g>
      ))}
      <path d={area} fill="#d9aa4b" fillOpacity="0.16" />
      <path d={line} fill="none" stroke="#d9aa4b" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(timeline.length - 1)} cy={y(timeline[timeline.length - 1].cumulative)} r="4" fill="#f5dc9a" stroke="#260711" strokeWidth="2" />
      <text x={pad.left} y={height - 8} textAnchor="start" className="sh-axis">{labelAt(0)}</text>
      <text x={width - pad.right} y={height - 8} textAnchor="end" className="sh-axis">{labelAt(timeline.length - 1)}</text>
    </svg>
  );
}

/** LGA choropleth: reporting volume as a sequential gold ramp over the real Oyo boundaries. */
function CoverageMap({ byLga }) {
  const holder = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const boundaries = useQuery(oyoBoundariesQuery);

  const byName = useMemo(() => {
    const lookup = new Map();
    for (const row of byLga) lookup.set(lgaKey(row.lga), row);
    return lookup;
  }, [byLga]);
  const peak = useMemo(() => Math.max(...byLga.map((row) => row.reporting), 1), [byLga]);

  useEffect(() => {
    if (!holder.current || mapRef.current) return;
    mapRef.current = L.map(holder.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([8.1, 3.6], 8);
    // Same tile source as the operations map, so this view needs no key of its own and falls
    // back to OpenStreetMap exactly as that one does.
    const maptilerKey = import.meta.env.VITE_MAPTILER_KEY;
    (maptilerKey
      ? L.tileLayer(`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${maptilerKey}`, {
          attribution: "&copy; MapTiler &copy; OpenStreetMap contributors",
          maxZoom: 12,
        })
      : L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 12,
        })
    ).addTo(mapRef.current);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const lgas = boundaries.data?.lgas;
    if (!map || !lgas) return;
    layerRef.current?.remove();
    const shade = (count) => {
      if (!count) return "#3a1420";
      const step = Math.min(Math.floor((count / peak) * GOLD_RAMP.length), GOLD_RAMP.length - 1);
      return GOLD_RAMP[step];
    };
    layerRef.current = L.geoJSON(lgas, {
      style: (feature) => {
        const row = byName.get(lgaKey(featureLgaName(feature)));
        return { color: "#8b1e46", weight: 1, fillColor: shade(row?.reporting || 0), fillOpacity: 0.82 };
      },
      onEachFeature: (feature, layer) => {
        const rawName = featureLgaName(feature);
        const row = byName.get(lgaKey(rawName));
        layer.bindTooltip(
          `<b>${rawName || "Unnamed LGA"}</b><br>${row?.reporting || 0} unit${row?.reporting === 1 ? "" : "s"} reported<br>${num(row?.votes || 0)} votes${row?.leadingParty ? `<br>Leading: ${row.leadingParty}` : ""}`,
          { sticky: true },
        );
      },
    }).addTo(map);
    try { map.fitBounds(layerRef.current.getBounds(), { padding: [12, 12] }); } catch { /* empty geometry */ }
  }, [boundaries.data, byName, peak]);

  return (
    <div className="sh-map-holder">
      <div ref={holder} className="sh-map" />
      {boundaries.isError && <p className="sh-empty sh-map-note">The boundary service is unavailable, so the map cannot be drawn. The figures beside it are unaffected.</p>}
      <div className="sh-legend" aria-hidden="true">
        <span>Fewer units reported</span>
        <span className="sh-legend-swatches">
          <i style={{ background: "#3a1420" }} />
          {GOLD_RAMP.map((step) => <i key={step} style={{ background: step }} />)}
        </span>
        <span>More</span>
      </div>
    </div>
  );
}

export default function StakeholderDashboard({ session, onLogout }) {
  const [phase, setPhase] = useState("election-day");
  const overview = useQuery({
    queryKey: ["stakeholder-overview", phase],
    queryFn: ({ signal }) => apiRequest(`/stakeholder/overview?phase=${phase}`, session.token, { signal }),
    refetchInterval: 60_000,
  });

  const data = overview.data;
  const partyRows = useMemo(() => (data?.parties || []).map((entry) => ({ name: entry.party, value: entry.votes })), [data]);
  const incidentRows = useMemo(() => (data?.incidents?.byType || []).slice(0, 8).map((entry) => ({ name: entry.name, value: entry.count })), [data]);
  const severityRows = useMemo(
    () => (data?.incidents?.bySeverity || []).map((entry) => ({ name: entry.name, value: entry.count, color: SEVERITY[entry.name] || "#a8761f" })),
    [data],
  );
  const activePhase = PHASES.find((item) => item.id === phase);

  const summaryCards = [
    { label: "Coverage status", value: data?.summary?.coverageState || "—", sub: data?.summary?.coverageNarrative || "Pending" },
    { label: "Decision confidence", value: data ? `${data.summary?.decisionConfidence ?? 0}%` : "—", sub: "Based on return depth and risk signals" },
    { label: "Current leader", value: data?.leading ? data.leading.party : "—", sub: data?.leading ? `${num(data.leading.margin)} vote lead` : "No lead established" },
    { label: "Fastest LGA", value: data?.summary?.leadingLga ? data.summary.leadingLga.lga : "—", sub: data?.summary?.leadingLga ? `${data.summary.leadingLga.reporting} units reported` : "No reporting yet" },
  ];

  const readinessCards = phase === "pre-election" ? [
    { label: "Active agents", value: num(data?.preElection?.agentCount ?? 0), sub: `${pct(data?.preElection?.staffingCoverage ?? 0)} of polling units covered` },
    { label: "Supervisors", value: num(data?.preElection?.supervisorCount ?? 0), sub: "Deployment and oversight coverage" },
    { label: "Training completion", value: `${pct(data?.preElection?.trainingCompletion ?? 0)}`, sub: "Field orientation and process readiness" },
    { label: "Equipment readiness", value: `${pct(data?.preElection?.equipmentReadiness ?? 0)}`, sub: "BVAS and critical equipment availability" },
    { label: "Logistics readiness", value: `${pct(data?.preElection?.logisticsReadiness ?? 0)}`, sub: `${num(data?.preElection?.totalAvailableResources ?? 0)} / ${num(data?.preElection?.totalRequiredResources ?? 0)} resources ready` },
  ] : [];

  return (
    <main className="stakeholder-shell">
      <header className="sh-head">
        <div>
          <span className="sh-eyebrow">Oyo State · Election observatory</span>
          <h1>Election overview</h1>
        </div>
        <div className="sh-head-right">
          <span className="sh-who">{session.user.name}<small>Stakeholder</small></span>
          <button type="button" className="sh-logout" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      <nav className="sh-phases" aria-label="Election phase">
        {PHASES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === phase ? "sh-phase active" : "sh-phase"}
            aria-pressed={item.id === phase}
            onClick={() => setPhase(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <p className="sh-blurb">{activePhase?.blurb}</p>

      {overview.isPending && <p className="sh-empty" role="status">Loading the latest figures…</p>}
      {overview.isError && (
        <p className="sh-error" role="alert">
          {overview.error?.message || "The overview is unavailable right now."}{" "}
          <button type="button" onClick={() => overview.refetch()}>Try again</button>
        </p>
      )}

      {data && (
        <>
          <section className="sh-tiles" aria-label="Headline figures">
            <StatTile
              label="Polling units reported"
              value={`${num(data.coverage.reportingUnits)} / ${num(data.coverage.totalUnits)}`}
              sub={`${pct(data.coverage.percent)} of Oyo State`}
            />
            <StatTile label="Votes counted" value={num(data.turnout.votesCounted)} sub={data.turnout.basis ? `Turnout ${pct(data.turnout.percent)}` : "Turnout unavailable"} />
            <StatTile
              label={data.leading ? (data.leading.decisive ? "Leading" : "Leading so far") : "Leading"}
              value={data.leading ? data.leading.party : "—"}
              sub={data.leading ? `${num(data.leading.margin)} ahead · ${pct(data.leading.marginPercent)} of counted` : "No results yet"}
              emphasis
            />
            <StatTile label="Incidents reported" value={num(data.incidents.total)} sub="Counts only" />
          </section>

          <section className="sh-panel sh-panel-wide sh-summary-panel">
            <div className="sh-summary-header">
              <div>
                <h2>Stakeholder summary</h2>
                <p className="sh-panel-sub">{data.summary?.keyMessage}</p>
              </div>
              <div className="sh-confidence-badge" aria-live="polite">{data.summary?.decisionConfidence ?? 0}% confidence</div>
            </div>
            <div className="sh-summary-grid">
              {summaryCards.map((card) => (
                <div key={card.label} className="sh-summary-card">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.sub}</small>
                </div>
              ))}
            </div>
          </section>

          {phase === "pre-election" && readinessCards.length > 0 && (
            <section className="sh-panel sh-panel-wide">
              <h2>Pre-election readiness</h2>
              <p className="sh-panel-sub">Operational capacity before the polls open.</p>
              <div className="sh-readiness-grid">
                {readinessCards.map((card) => (
                  <div key={card.label} className="sh-readiness-card">
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                    <small>{card.sub}</small>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="sh-grid">
            <article className="sh-panel">
              <h2>Watchlist</h2>
              <p className="sh-panel-sub">What to watch before the next leadership decision.</p>
              <ul className="sh-watchlist">
                {(data.watchlist || []).map((item) => (
                  <li key={item.label} className={`sh-watch-item ${item.tone}`}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <small>{item.detail}</small>
                  </li>
                ))}
              </ul>
            </article>

            <article className="sh-panel sh-panel-wide">
              <h2>Where results have come in</h2>
              <p className="sh-panel-sub">Shaded by how many polling units have reported in each LGA. Hover an LGA for its figures.</p>
              <CoverageMap byLga={data.byLga} />
            </article>

            <article className="sh-panel">
              <h2>Votes by party</h2>
              <p className="sh-panel-sub">Across {num(data.coverage.reportingUnits)} reporting polling units.</p>
              <BarList rows={partyRows} total={data.turnout.votesCounted} emptyMessage="No results have been submitted yet." />
            </article>

            <article className="sh-panel sh-panel-wide">
              <h2>Returns over time</h2>
              <p className="sh-panel-sub">Cumulative polling units reported.</p>
              <ReturnsChart timeline={data.timeline} />
            </article>

            <article className="sh-panel">
              <h2>Incidents by type</h2>
              <p className="sh-panel-sub">Reported by field agents. Counts only.</p>
              <BarList rows={incidentRows} total={data.incidents.total} emptyMessage="No incidents have been reported." />
            </article>

            <article className="sh-panel">
              <h2>Incidents by severity</h2>
              <p className="sh-panel-sub">Each severity is labelled, never shown by colour alone.</p>
              <BarList rows={severityRows} total={data.incidents.total} emptyMessage="No incidents have been reported." />
            </article>
          </section>

          <section className="sh-panel sh-notes">
            <h2>How to read these figures</h2>
            <ul>
              {data.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
            <p className="sh-generated">Updated {new Date(data.generatedAt).toLocaleString()} · refreshes every minute</p>
          </section>
        </>
      )}
    </main>
  );
}
