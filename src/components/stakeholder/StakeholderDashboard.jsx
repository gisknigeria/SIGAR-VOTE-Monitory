import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../api/client.js";
import { BarList, BigNumbers, GOLD_RAMP, LgaMap, lgaKey, NO_DATA_FILL, num, Panel, pct, time } from "./ui.jsx";
import "./stakeholder.css";

const VoterSurvey = lazy(() => import("./VoterSurvey.jsx"));

const PHASES = [
  { id: "pre-election", label: "Before the election" },
  { id: "election-day", label: "Election day" },
  { id: "post-election", label: "After the election" },
];

// Fixed status palette. Every use is paired with a visible label -- these hues are never
// allowed to carry meaning on their own.
const SEVERITY = {
  Critical: "#d03b3b",
  High: "#ec835a",
  Medium: "#fab219",
  Low: "#0ca30c",
};

/** One readiness measure as a progress line. Nothing recorded reads "No data yet", never "0%". */
function ReadinessRow({ label, value, hasData = true, detail }) {
  const shown = hasData && value !== null && value !== undefined;
  const width = shown ? Math.min(Math.max(Number(value), 0), 100) : 0;
  return (
    <li className="sh-ready-row">
      <span className="sh-ready-label">{label}</span>
      <span className="sh-ready-track" aria-hidden="true"><span className="sh-ready-fill" style={{ width: `${width}%` }} /></span>
      <strong className={shown ? "sh-ready-value" : "sh-ready-value sh-ready-none"}>{shown ? `${width < 10 ? width.toFixed(1) : Math.round(width)}%` : "No data yet"}</strong>
      {detail && <small className="sh-ready-detail">{detail}</small>}
    </li>
  );
}

/** Incidents in one place: severity as labelled chips, the most common types as bars. */
function IncidentsPanel({ incidents, wide = false }) {
  const typeRows = (incidents.byType || []).slice(0, 5).map((entry) => ({ name: entry.name, value: entry.count }));
  return (
    <Panel wide={wide} title="Incidents reported" sub={incidents.total ? `${num(incidents.total)} in total. Counts only, no locations or names.` : undefined}>
      {incidents.total === 0 ? (
        <p className="sh-empty">No incidents have been reported.</p>
      ) : (
        <>
          <ul className="sh-chips" aria-label="By severity">
            {(incidents.bySeverity || []).map((entry) => (
              <li key={entry.name}>
                <i style={{ background: SEVERITY[entry.name] || "#a8761f" }} aria-hidden="true" />
                {entry.name} <b>{num(entry.count)}</b>
              </li>
            ))}
          </ul>
          <BarList rows={typeRows} total={incidents.total} emptyMessage="" />
        </>
      )}
    </Panel>
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

/** Reporting volume per LGA as a sequential gold ramp. */
function CoverageMap({ byLga }) {
  const rowsByKey = useMemo(() => new Map(byLga.map((row) => [lgaKey(row.lga), row])), [byLga]);
  const peak = useMemo(() => Math.max(...byLga.map((row) => row.reporting), 1), [byLga]);
  const fill = useCallback((row) => {
    const count = row?.reporting || 0;
    if (!count) return NO_DATA_FILL;
    return GOLD_RAMP[Math.min(Math.floor((count / peak) * GOLD_RAMP.length), GOLD_RAMP.length - 1)];
  }, [peak]);
  const tooltip = useCallback(
    (name, row) => `<b>${name}</b><br>${row?.reporting || 0} unit${row?.reporting === 1 ? "" : "s"} reported<br>${num(row?.votes || 0)} votes${row?.leadingParty ? `<br>Leading: ${row.leadingParty}` : ""}`,
    [],
  );
  return (
    <LgaMap
      rowsByKey={rowsByKey}
      fill={fill}
      tooltip={tooltip}
      legend={<>
        <span>Fewer reported</span>
        <span className="sh-legend-swatches">
          <i style={{ background: NO_DATA_FILL }} />
          {GOLD_RAMP.map((step) => <i key={step} style={{ background: step }} />)}
        </span>
        <span>More</span>
      </>}
    />
  );
}

const OYO10X_SOURCE = {
  ok: (at) => `Live from oyo10x · updated ${time(at) || "just now"}`,
  stale: (at) => `oyo10x is not responding. Showing the last figures received${at ? ` at ${time(at)}` : ""}.`,
  unavailable: () => "oyo10x is not responding right now. Figures will appear once it recovers.",
  "not-configured": () => "oyo10x is not connected to this platform yet.",
};

/**
 * Grassroots mobilisation, read from the campaign's oyo10x platform through our own backend
 * (the API key never reaches the browser). Fetched separately from the election overview so an
 * oyo10x outage can never take the rest of this page down with it.
 */
function MobilisationPanel({ token, scope }) {
  const query = useQuery({
    queryKey: ["oyo10x-mobilisation"],
    queryFn: ({ signal }) => apiRequest("/integrations/oyo10x", token, { signal }),
    refetchInterval: 60_000,
  });
  const result = query.data;
  const data = result?.data;
  const statusText = (OYO10X_SOURCE[result?.status] || OYO10X_SOURCE.unavailable)(result?.fetchedAt);
  const districtRows = useMemo(
    () => (data?.bySenatorialDistrict || []).map((row) => ({ name: row.name, value: row.members })),
    [data],
  );

  return (
    <Panel title="Supporters and mobilisers" sub={query.isPending ? "Connecting to oyo10x…" : statusText} wide>
      {query.isError && (
        <p className="sh-error" role="alert">
          {query.error?.message || "Mobilisation figures are unavailable."}{" "}
          <button type="button" onClick={() => query.refetch()}>Try again</button>
        </p>
      )}

      {data && (
        <>
          <div className="sh-mini-numbers">
            <div>
              <strong>{num(data.totals.registered)}</strong>
              <span>supporters registered</span>
              <small>{num(data.totals.verified)} verified</small>
            </div>
            <div>
              <strong>{num(data.totals.unitPromoters + data.totals.grassroots)}</strong>
              <span>mobilisers</span>
              <small>{num(data.totals.unitPromoters)} unit promoters · {num(data.totals.grassroots)} grassroots</small>
            </div>
            <div>
              <strong>{num(data.coverage.pollingUnits)}</strong>
              <span>polling units reached</span>
              <small>of {num(scope?.pollingUnits)} in the state</small>
            </div>
          </div>

          {districtRows.length > 0 && (
            <>
              <h3 className="sh-subhead">Supporters by senatorial district</h3>
              <BarList rows={districtRows} total={data.totals.registered} emptyMessage="" />
            </>
          )}

          <p className="sh-footline">
            {num(data.candidates.total)} candidates on the ticket · {num(data.candidates.nomineesVerified)} of {num(data.candidates.nomineesTotal)} nominees verified
          </p>
        </>
      )}
    </Panel>
  );
}

/** The one sentence a stakeholder should leave with, written from the figures for each phase. */
function headline(phase, data) {
  const { coverage, leading, preElection } = data;
  const units = `${num(coverage.reportingUnits)} of ${num(coverage.totalUnits)} polling units have reported (${pct(coverage.percent)}).`;

  if (phase === "pre-election") {
    return {
      title: `${num(preElection.agentCount)} agents and ${num(preElection.supervisorCount)} supervisors are registered.`,
      sub: `Oyo State has ${num(data.scope.pollingUnits)} polling units across ${num(data.scope.lgas)} LGAs.`,
    };
  }
  if (!coverage.reportingUnits) {
    return { title: "No results have come in yet.", sub: "Figures appear here as soon as polling units start reporting." };
  }
  if (!leading) return { title: units, sub: "No votes have been recorded yet." };

  return {
    title: `${leading.party} is ahead by ${num(leading.margin)} votes${leading.decisive ? "" : " so far"}.`,
    sub: `${units}${leading.decisive ? "" : " The lead can still change."}${phase === "post-election" ? " Official results are declared by INEC." : ""}`,
  };
}

export default function StakeholderDashboard({ session, onLogout }) {
  const [phase, setPhase] = useState("election-day");
  const isSurvey = phase === "survey";
  const overview = useQuery({
    queryKey: ["stakeholder-overview", phase],
    queryFn: ({ signal }) => apiRequest(`/stakeholder/overview?phase=${phase}`, session.token, { signal }),
    refetchInterval: 60_000,
    enabled: !isSurvey,
  });

  const data = isSurvey ? null : overview.data;
  const partyRows = useMemo(() => (data?.parties || []).map((entry) => ({ name: entry.party, value: entry.votes })), [data]);
  const lead = data ? headline(phase, data) : null;
  const critical = data?.summary?.riskSummary?.critical || 0;
  const serious = critical + (data?.summary?.riskSummary?.high || 0);

  const resultNumbers = data ? [
    {
      label: "Polling units reported",
      value: `${num(data.coverage.reportingUnits)} of ${num(data.coverage.totalUnits)}`,
      sub: `${pct(data.coverage.percent)} of the state`,
    },
    {
      label: data.leading?.decisive ? "Leading" : "Leading so far",
      value: data.leading ? data.leading.party : "—",
      sub: data.leading ? `${num(data.leading.votes)} votes · ${num(data.leading.margin)} ahead` : "No votes counted yet",
      lead: true,
    },
    phase === "post-election"
      ? { label: "Turnout", value: data.turnout.percent === null ? "—" : pct(data.turnout.percent), sub: `${num(data.turnout.votesCounted)} votes counted` }
      : { label: "Votes counted", value: num(data.turnout.votesCounted), sub: data.turnout.percent === null ? "Turnout not available" : `Turnout ${pct(data.turnout.percent)}` },
  ] : [];

  return (
    <main className="stakeholder-shell">
      <div className="sh-page">
        <div className="sh-head" role="banner">
          <div>
            <span className="sh-eyebrow">Oyo State</span>
            <h1>Election overview</h1>
          </div>
          <div className="sh-head-right">
            <span className="sh-who">{session.user.name}</span>
            <button type="button" className="sh-logout" onClick={onLogout}>Sign out</button>
          </div>
        </div>

        <nav className="sh-phases" aria-label="Election phase">
          {[...PHASES, { id: "survey", label: "Voter survey" }].map((item) => (
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

        {isSurvey && (
          <Suspense fallback={<p className="sh-empty" role="status">Loading the voter survey…</p>}>
            <VoterSurvey token={session.token} />
          </Suspense>
        )}

        {!isSurvey && overview.isPending && <p className="sh-empty" role="status">Loading the latest figures…</p>}
        {!isSurvey && overview.isError && (
          <p className="sh-error" role="alert">
            {overview.error?.message || "The overview is unavailable right now."}{" "}
            <button type="button" onClick={() => overview.refetch()}>Try again</button>
          </p>
        )}

        {data && (
          <>
            <section className="sh-headline" aria-live="polite">
              <p className="sh-headline-title">{lead.title}</p>
              <p className="sh-headline-sub">{lead.sub}</p>
              <p className="sh-updated">Updated {time(data.generatedAt)} · refreshes every minute</p>
            </section>

            {phase !== "pre-election" && serious > 0 && (
              <p className="sh-alert" role="status">
                <b>{num(serious)} serious incident{serious === 1 ? "" : "s"}</b> reported
                {critical > 0 && ` (${num(critical)} critical)`}. The operations team is following up.
              </p>
            )}

            {phase === "pre-election" ? (
              <div className="sh-grid">
                <Panel title="Are we ready?" sub="How prepared the field team is before polls open.">
                  <ul className="sh-ready">
                    <ReadinessRow
                      label="Agent coverage"
                      value={data.preElection.staffingCoverage}
                      detail={`${num(data.preElection.agentCount)} agents for ${num(data.scope.pollingUnits)} polling units`}
                    />
                    <ReadinessRow label="Training done" value={data.preElection.trainingCompletion} hasData={data.preElection.hasTrainingData} />
                    <ReadinessRow label="Equipment ready" value={data.preElection.equipmentReadiness} hasData={data.preElection.hasEquipmentData} />
                    <ReadinessRow
                      label="Logistics ready"
                      value={data.preElection.logisticsReadiness}
                      hasData={data.preElection.hasLogisticsData}
                      detail={data.preElection.hasLogisticsData ? `${num(data.preElection.totalAvailableResources)} of ${num(data.preElection.totalRequiredResources)} items in place` : undefined}
                    />
                  </ul>
                </Panel>
                <IncidentsPanel incidents={data.incidents} />
                <MobilisationPanel token={session.token} scope={data.scope} />
              </div>
            ) : (
              <>
                <BigNumbers items={resultNumbers} />
                <div className="sh-grid">
                  <Panel title="Votes by party" sub={data.coverage.reportingUnits ? `From ${num(data.coverage.reportingUnits)} polling units so far.` : undefined}>
                    <BarList rows={partyRows} total={data.turnout.votesCounted} emptyMessage="No votes have been counted yet." />
                  </Panel>
                  <Panel title="Where results have come in" sub="Brighter gold means more polling units have reported. Tap an LGA for its figures.">
                    <CoverageMap byLga={data.byLga} />
                  </Panel>
                  {data.timeline.length >= 2 && (
                    <Panel title="Results coming in" sub="Total polling units reported, hour by hour." wide>
                      <ReturnsChart timeline={data.timeline} />
                    </Panel>
                  )}
                  <IncidentsPanel incidents={data.incidents} wide />
                </div>
              </>
            )}

            <details className="sh-notes">
              <summary>About these figures</summary>
              <ul>
                {data.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            </details>
          </>
        )}
      </div>
    </main>
  );
}
