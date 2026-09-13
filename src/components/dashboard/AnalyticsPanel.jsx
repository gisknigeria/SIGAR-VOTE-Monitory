import { useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";

export default function AnalyticsPanel({
  incidents,
  officers,
  mapLayers,
  selected,
  onClose,
  onTool,
  onCsv,
  onClear,
  full,
  embedded = false,
  helpers,
}) {
  const { COMMAND_PARTY, parseResultEntries, POLLING_RESULT_TYPE, REPORT_TYPE_STYLES, ReportTypeIcon } = helpers;
  const resultReports = useMemo(
    () => incidents.filter((item) => item.reportType === POLLING_RESULT_TYPE),
    [incidents],
  );
  const pollingUnitSummaries = useMemo(() => {
    const grouped = new Map();
    resultReports.forEach((item) => {
      const unit = (item.pollingUnit || "Unspecified polling unit").trim();
      if (!grouped.has(unit)) {
        grouped.set(unit, {
          unit,
          count: 0,
          total: 0,
          submissions: [],
          breakdown: new Map(),
        });
      }
      const entry = grouped.get(unit);
      entry.count += 1;
      entry.submissions.push(item);
      const directVotes = Number(String(item.resultCount || "").trim());
      const legacyParty = [
        ...parseResultEntries(item.resultCount),
        ...(item.partyResult ? parseResultEntries(item.partyResult) : []),
      ].find(({ label }) => /^party$/i.test(String(label).trim()))?.value;
      const numbers = [{ label: COMMAND_PARTY, value: Number.isFinite(directVotes) ? directVotes : Number(legacyParty || 0) }];
      entry.total += numbers.reduce((sum, value) => sum + value.value, 0);
      numbers.forEach((detail) => {
        const existing = entry.breakdown.get(detail.label) || { label: detail.label, total: 0 };
        existing.total += detail.value;
        entry.breakdown.set(detail.label, existing);
      });
    });
    return Array.from(grouped.values())
      .map((entry) => ({
        ...entry,
        breakdown: Array.from(entry.breakdown.values()).sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total);
  }, [resultReports]);
  const [result, setResult] = useState("Click an analysis tool to execute");
  const pointLayers = mapLayers.filter(
    (layer) => layer.category === "Point" || layer.type === "geojson",
  );
  const severityLevels = ["Low", "Medium", "High", "Critical"];
  const severityBreakdown = useMemo(
    () =>
      severityLevels.map((level) => [
        level,
        incidents.filter((item) => item.severity === level).length,
      ]),
    [incidents],
  );
  const reportTypeBreakdown = useMemo(() => {
    const counts = incidents.reduce((acc, item) => {
      const key = item.reportType || "Custom";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [incidents]);
  const maxSeverity = Math.max(
    1,
    ...severityBreakdown.map(([, count]) => count),
  );
  const maxType = Math.max(1, ...reportTypeBreakdown.map(([, count]) => count));
  const highRiskCount = incidents.filter((item) =>
    ["High", "Critical"].includes(item.severity),
  ).length;
  const isToday = (d) => {
    if (!d) return false;
    const dt = new Date(d);
    const now = new Date();
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate();
  };
  const sosToday = incidents.filter((i) => (i.reportType === "SOS-Emergency" || i.reportType === "SOS") && isToday(i.createdAt)).length;
  const incidentsToday = incidents.filter((i) => isToday(i.createdAt) && i.reportType !== POLLING_RESULT_TYPE).length;
  const anythingToday = incidents.filter((i) => isToday(i.createdAt)).length;
  const run = async (tool) => setResult(await onTool(tool));
  const totalIncidents = incidents.length;
  const resolvedCount = incidents.filter(i => String(i.status || "").toLowerCase() === "resolved").length;
  const openCount = incidents.filter(i => !["resolved", "closed"].includes(String(i.status || "").toLowerCase())).length;
  const resolvedPct = totalIncidents ? Math.round((resolvedCount / totalIncidents) * 100) : 0;

  // Donut chart values for severity
  const severityColors = { Low: "#38bdf8", Medium: "#facc15", High: "#fb923c", Critical: "#ef4444" };
  const donutR = 54;
  const donutCx = 70;
  const donutCy = 70;
  const donutCirc = 2 * Math.PI * donutR;
  let donutOffset = 0;
  const donutSlices = severityBreakdown
    .filter(([, c]) => c > 0)
    .map(([level, count]) => {
      const pct = count / Math.max(1, totalIncidents);
      const dash = pct * donutCirc;
      const slice = { level, count, dash, offset: donutOffset, color: severityColors[level] };
      donutOffset += dash;
      return slice;
    });

  return (
    <section className={embedded ? "analytics-embedded" : full ? "results-center" : "analytics-panel"}>
      {/* Header */}
      {!embedded && <div className="results-center-head ap-head">
        <div>
          <span className="eyebrow">INTELLIGENCE DASHBOARD</span>
          <h1>Map Analysis &amp; Reports</h1>
          <p>Live operational pulse — incident distribution &amp; field analytics</p>
        </div>
        <div className="ap-head-right">
          <div className="analytics-pulse">● Live</div>
          <button className="icon-btn" onClick={onClose} title="Close">
            <FaTimes />
          </button>
        </div>
      </div>}

      <div className="results-center-body ap-body">

        {/* KPI stat cards */}
        <div className="ap-kpi-row">
          <div className="ap-kpi-card ap-kpi-red">
            <span className="ap-kpi-label">Total Incidents</span>
            <strong className="ap-kpi-val">{totalIncidents}</strong>
            <span className="ap-kpi-sub">{openCount} open · {resolvedCount} resolved</span>
          </div>
          <div className="ap-kpi-card ap-kpi-orange">
            <span className="ap-kpi-label">High Risk</span>
            <strong className="ap-kpi-val">{highRiskCount}</strong>
            <span className="ap-kpi-sub">High + Critical severity</span>
          </div>
          <div className="ap-kpi-card ap-kpi-red2">
            <span className="ap-kpi-label">SOS Today</span>
            <strong className="ap-kpi-val">{sosToday}</strong>
            <span className="ap-kpi-sub">Emergency alerts today</span>
          </div>
          <div className="ap-kpi-card ap-kpi-amber">
            <span className="ap-kpi-label">Incidents Today</span>
            <strong className="ap-kpi-val">{incidentsToday}</strong>
            <span className="ap-kpi-sub">{anythingToday} total reports today</span>
          </div>
          <div className="ap-kpi-card ap-kpi-blue">
            <span className="ap-kpi-label">Field Personnel</span>
            <strong className="ap-kpi-val">{officers.length}</strong>
            <span className="ap-kpi-sub">{pointLayers.length} point layers active</span>
          </div>
          <div className="ap-kpi-card ap-kpi-green">
            <span className="ap-kpi-label">Resolved</span>
            <strong className="ap-kpi-val">{resolvedPct}%</strong>
            <span className="ap-kpi-sub">{resolvedCount} of {totalIncidents} incidents</span>
          </div>
        </div>

        {/* Charts row */}
        <div className="ap-charts-row">

          {/* Donut — severity */}
          <div className="ap-card ap-donut-card">
            <div className="ap-card-head">
              <b>Severity Breakdown</b>
              <span>Incident intensity distribution</span>
            </div>
            <div className="ap-donut-wrap">
              <svg viewBox="0 0 140 140" className="ap-donut-svg" role="img" aria-label="Severity donut chart">
                <circle cx={donutCx} cy={donutCy} r={donutR} fill="none" stroke="#1a2f42" strokeWidth="18" />
                {donutSlices.length === 0 && (
                  <circle cx={donutCx} cy={donutCy} r={donutR} fill="none" stroke="#1a2f42" strokeWidth="18" />
                )}
                {donutSlices.map(({ level, dash, offset, color }) => (
                  <circle
                    key={level}
                    cx={donutCx} cy={donutCy} r={donutR}
                    fill="none"
                    stroke={color}
                    strokeWidth="18"
                    strokeDasharray={`${dash} ${donutCirc - dash}`}
                    strokeDashoffset={-offset + donutCirc * 0.25}
                    strokeLinecap="butt"
                    style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
                  />
                ))}
                <text x={donutCx} y={donutCy - 6} textAnchor="middle" className="ap-donut-big">{totalIncidents}</text>
                <text x={donutCx} y={donutCy + 12} textAnchor="middle" className="ap-donut-sub">total</text>
              </svg>
              <div className="ap-donut-legend">
                {severityBreakdown.map(([level, count]) => (
                  <div className="ap-legend-row" key={level}>
                    <span className="ap-legend-dot" style={{ background: severityColors[level], boxShadow: `0 0 6px ${severityColors[level]}99` }} />
                    <span className="ap-legend-label">{level}</span>
                    <strong className="ap-legend-val">{count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bar chart — report types */}
          <div className="ap-card ap-bar-card">
            <div className="ap-card-head">
              <b>Report Type Breakdown</b>
              <span>Top incident categories</span>
            </div>
            <div className="ap-bar-list">
              {reportTypeBreakdown.length === 0 && (
                <div className="ap-empty">No reports yet</div>
              )}
              {reportTypeBreakdown.map(([type, count]) => {
                const pct = Math.round((count / Math.max(1, totalIncidents)) * 100);
                const col = REPORT_TYPE_STYLES[type]?.color || "#38bdf8";
                return (
                  <div className="ap-bar-row" key={type}>
                    <div className="ap-bar-meta">
                      <span className="ap-bar-icon"><ReportTypeIcon type={type} size={13} color={col} /></span>
                      <span className="ap-bar-name">{type}</span>
                      <strong className="ap-bar-count">{count}</strong>
                    </div>
                    <div className="ap-bar-track">
                      <div className="ap-bar-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${col}cc, ${col}55)`, boxShadow: `0 0 8px ${col}66` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resolution progress */}
          <div className="ap-card ap-progress-card">
            <div className="ap-card-head">
              <b>Resolution Progress</b>
              <span>Incident closure rate</span>
            </div>
            <div className="ap-progress-wrap">
              <svg viewBox="0 0 120 120" className="ap-ring-svg" role="img" aria-label="Resolution ring">
                <circle cx="60" cy="60" r="48" fill="none" stroke="#1a2f42" strokeWidth="12" />
                <circle cx="60" cy="60" r="48" fill="none"
                  stroke="url(#resolveGrad)" strokeWidth="12"
                  strokeDasharray={`${(resolvedPct / 100) * 301.6} 301.6`}
                  strokeDashoffset="75.4"
                  strokeLinecap="round"
                  style={{ filter: "drop-shadow(0 0 8px #34d39988)" }}
                />
                <defs>
                  <linearGradient id="resolveGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                </defs>
                <text x="60" y="55" textAnchor="middle" className="ap-donut-big">{resolvedPct}%</text>
                <text x="60" y="72" textAnchor="middle" className="ap-donut-sub">resolved</text>
              </svg>
              <div className="ap-progress-stats">
                <div className="ap-pstat"><span>Open</span><b style={{color:"#fb923c"}}>{openCount}</b></div>
                <div className="ap-pstat"><span>Resolved</span><b style={{color:"#34d399"}}>{resolvedCount}</b></div>
                <div className="ap-pstat"><span>Total</span><b>{totalIncidents}</b></div>
                <div className="ap-pstat"><span>Selected</span><b style={{color:"#facc15",fontSize:"10px"}}>{selected?.title || "None"}</b></div>
              </div>
            </div>
          </div>
        </div>

        {/* Polling unit summaries */}
        {pollingUnitSummaries.length > 0 && (
          <div className="ap-card ap-polls-card">
            <div className="ap-card-head">
              <b>Polling Unit Vote Results</b>
              <span>{pollingUnitSummaries.length} unit{pollingUnitSummaries.length === 1 ? "" : "s"} submitted</span>
            </div>
            <div className="polling-unit-list">
              {pollingUnitSummaries.map((entry) => (
                <div className="polling-unit-item" key={entry.unit}>
                  <div>
                    <strong>{entry.unit}</strong>
                    <small>{entry.count} submission{entry.count === 1 ? "" : "s"}</small>
                  </div>
                  <b>Total {entry.total}</b>
                  <div className="polling-unit-breakdown">
                    {entry.breakdown.map((detail) => (
                      <div className="polling-unit-breakdown-row" key={detail.label}>
                        <span>{detail.label}</span>
                        <b>{detail.total}</b>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}

