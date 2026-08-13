import { useMemo, useState } from "react";
import { FaChartBar, FaTimes, FaSyncAlt } from "react-icons/fa";
import { MdFlashOn } from "react-icons/md";

const POLLING_RESULT_TYPE = "Polling Unit Result";

const parseResultEntries = (rawText = "") =>
  (rawText || "")
    .split(/\n|,/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const match = segment.match(/^([^:=]+)[:=]\s*(\d+(?:\.\d+)?)/);
      if (match) return { label: match[1].trim() || "Party", value: Number(match[2]) };
      const numericMatch = segment.match(/(\d+(?:\.\d+)?)/);
      if (!numericMatch) return null;
      return {
        label: segment.replace(numericMatch[0], "").trim() || "Count",
        value: Number(numericMatch[1]),
      };
    })
    .filter(Boolean);

export default function ResultsDashboard({
  incidents = [],
  parties = [],
  officers = [],
  mapLayers = [],
  selected = null,
  onClose,
  authToken,
  initialFocusParty = "",
  onPartyMapChange,
  onTool,
  onCsv,
  onClear,
}) {
  const [view, setView] = useState("pulse");
  const [focusParty, setFocusParty] = useState(initialFocusParty);
  const [outlook, setOutlook] = useState("");
  const [outlookLoading, setOutlookLoading] = useState(false);

  const reports = useMemo(
    () => incidents.filter((item) => item.reportType === POLLING_RESULT_TYPE),
    [incidents],
  );

  const partyNames = useMemo(() => {
    const names = new Set(parties);
    reports.forEach((report) => {
      parseResultEntries(report.resultCount).forEach(({ label }) => names.add(label));
    });
    return [...names].filter(Boolean);
  }, [parties, reports]);

  const summary = useMemo(() => {
    const totals = Object.fromEntries(partyNames.map((party) => [party, 0]));
    reports.forEach((report) => {
      parseResultEntries(report.resultCount).forEach(({ label, value }) => {
        if (totals[label] !== undefined) totals[label] += value;
      });
    });
    return { partyNames, totals };
  }, [partyNames, reports]);

  const totalIncidents = incidents.length;
  const resolvedCount = incidents.filter((i) => i.status === "Resolved").length;
  const openCount = incidents.filter((i) => i.status === "Open" || !i.status).length;
  const highRiskCount = incidents.filter((item) => ["High", "Critical"].includes(item.severity)).length;

  const actions = [
    `Review ${openCount} open incidents and ${highRiskCount} high-risk reports before the next report cycle.`,
    `Current dashboard includes ${totalIncidents} live incidents and ${resolvedCount} resolved items.`,
  ];

  return (
    <div className="results-center">
      <header className="results-center-head">
        <div>
          <span className="eyebrow">INTELLIGENCE DASHBOARD</span>
          <h1>Analytics Dashboard</h1>
          <p>Live operational pulse, election results, actions, and news.</p>
        </div>
        <button className="icon-btn" onClick={onClose} title="Close dashboard">
          <FaTimes />
        </button>
      </header>

      <div className="rc-tab-bar">
        <button className={view === "action" ? "rc-tab active" : "rc-tab"} onClick={() => setView("action")}>
          Action
        </button>
        <button className={view === "pulse" ? "rc-tab active" : "rc-tab"} onClick={() => setView("pulse")}>
          Pulse
        </button>
        <button className={view === "breakdown" ? "rc-tab active" : "rc-tab"} onClick={() => setView("breakdown")}>
          Result
        </button>
      </div>

      <main className="results-center-body">
        {view === "pulse" && (
          <section className="result-table-card">
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
              <div className="ap-kpi-card ap-kpi-blue">
                <span className="ap-kpi-label">Field Personnel</span>
                <strong className="ap-kpi-val">{officers.length}</strong>
                <span className="ap-kpi-sub">{mapLayers.length} map layers active</span>
              </div>
            </div>
          </section>
        )}

        {view === "action" && (
          <section className="result-table-card">
            <div className="result-table-title">
              <div>
                <h2>Party performance & operational outlook</h2>
                <p>Neutral analysis based on submitted results and field reports.</p>
              </div>
              <div className="analysis-actions">
                <label className="party-focus-field">
                  <span>Party focus</span>
                  <select value={focusParty} onChange={(e) => setFocusParty(e.target.value)} aria-label="Select party for operational analysis">
                    <option value="">All parties</option>
                    {summary.partyNames.map((party) => (
                      <option key={party} value={party}>{party}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="primary action-btn summary-action-btn"
                  disabled={outlookLoading}
                  onClick={async () => {
                    setOutlookLoading(true);
                    try {
                      const result = await fetch("/api/analysis/ai", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                        body: JSON.stringify({ focusParty, incidents }),
                      });
                      const data = await result.json();
                      setOutlook(data.analysis || "No operational analysis returned.");
                    } catch {
                      setOutlook("Operational analysis unavailable at the moment.");
                    } finally {
                      setOutlookLoading(false);
                    }
                  }}
                >
                  <MdFlashOn /> <span>{outlookLoading ? "Analyzing…" : "Operational Analysis"}</span>
                </button>
              </div>
            </div>

            <ul>
              {actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>

            {outlook && <div className="news-summary">{outlook}</div>}
          </section>
        )}

        {view === "breakdown" && (
          <section className="result-table-card">
            <div className="result-table-title">
              <div>
                <h2>Polling-unit breakdown</h2>
                <p>Counts and evidence submitted from the field.</p>
              </div>
              <b>{reports.length} submitted</b>
            </div>
            <div className="result-table-scroll">
              <table className="result-progress-table">
                <thead>
                  <tr>
                    <th>Party</th>
                    <th>Votes</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.partyNames.map((party) => (
                    <tr key={party}>
                      <td>{party}</td>
                      <td>{summary.totals[party] || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
