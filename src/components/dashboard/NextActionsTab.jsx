import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "../../api/client.js";
import { useFitHeight } from "./useFitHeight.js";
import "./next-actions.css";

/**
 * Next actions as an urgent/important (Eisenhower) matrix. The server fills it from rules over
 * the pre-election data, or from the last AI plan written from those same facts; this screen
 * draws it, lets admins track status, and asks for a fresh AI plan.
 */

const QUADRANTS = [
  { id: "do_now", number: 1, label: "Do now", hint: "urgent · important" },
  { id: "plan", number: 2, label: "Plan", hint: "important · not urgent" },
  { id: "delegate", number: 3, label: "Delegate", hint: "urgent · less important" },
  { id: "reduce", number: 4, label: "Reduce", hint: "neither: move effort elsewhere" },
];
const STATUS_LABELS = { todo: "To do", doing: "Doing", done: "Done" };
const when = (value) => (value ? new Date(value).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const num = (value) => (value == null ? "—" : Number(value).toLocaleString());
const compact = (value) => (value >= 1e6 ? `${(value / 1e6).toFixed(2)}M` : num(value));

function ActionCard({ action, facts, canEdit, onStatus, onOpenMap, scopeLga }) {
  const [open, setOpen] = useState(false);
  const cited = action.evidence?.map((id) => facts.find((fact) => fact.id === id)).filter(Boolean) || [];
  return (
    <article className={`nxa-card nxa-${action.status}`}>
      <button type="button" className="nxa-card-head" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <h4>{action.title}</h4>
        <span className="nxa-chevron" aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <p className="nxa-why">{action.why}</p>
      <div className="nxa-meta">
        {action.owner && <i>{action.owner}</i>}
        {action.due && <i>{action.due}</i>}
        {action.target && <i title="Target">{action.target}</i>}
        {action.unverified?.length > 0 && <i className="nxa-warn" title="These figures were not found in the data; check them">check: {action.unverified.join(", ")}</i>}
      </div>
      {action.where?.length > 0 && (
        <div className="nxa-where">
          {action.where.slice(0, 6).map((name) => (
            <button key={name} type="button" onClick={() => onOpenMap?.(scopeLga ? { key: scopeLga, name: scopeLga } : { key: name, name })} title="Open on the sentiment map">{name}</button>
          ))}
          {action.where.length > 6 && <span>+{action.where.length - 6}</span>}
        </div>
      )}
      {open && cited.length > 0 && (
        <ul className="nxa-evidence">
          {cited.map((fact) => <li key={fact.id}><b>{fact.id}</b> {fact.fact}</li>)}
        </ul>
      )}
      <div className="nxa-status" role="group" aria-label="Status">
        {Object.entries(STATUS_LABELS).map(([id, label]) => (
          <button key={id} type="button" className={action.status === id ? "on" : ""} disabled={!canEdit} onClick={() => onStatus(action.key, id)}>{label}</button>
        ))}
      </div>
    </article>
  );
}

export default function NextActionsTab({ authToken, onOpenMap }) {
  const [lga, setLga] = useState("");
  const [horizon, setHorizon] = useState("week");
  const [notice, setNotice] = useState("");
  const [fitRef, fitHeight] = useFitHeight();
  const queryClient = useQueryClient();
  const queryKey = ["pre-election-actions", lga, horizon];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => apiRequest(`/pre-election/actions?lga=${encodeURIComponent(lga)}&horizon=${horizon}`, authToken, { signal }),
    placeholderData: (previous) => previous,
  });
  const generate = useMutation({
    mutationFn: () => apiRequest("/pre-election/actions/generate", authToken, { method: "POST", body: JSON.stringify({ lga, horizon }) }),
    onMutate: () => setNotice(""),
    onSuccess: (result) => { setNotice(`Written by ${result.provider} (${result.model}).`); queryClient.invalidateQueries({ queryKey: ["pre-election-actions"] }); },
    onError: (error) => setNotice(error.message),
  });
  const status = useMutation({
    mutationFn: ({ key, value }) => apiRequest("/pre-election/actions/status", authToken, { method: "PUT", body: JSON.stringify({ key, status: value }) }),
    onMutate: ({ key, value }) => {
      queryClient.setQueryData(queryKey, (data) => data && ({
        ...data,
        quadrants: Object.fromEntries(Object.entries(data.quadrants).map(([id, items]) => [id, items.map((item) => (item.key === key ? { ...item, status: value } : item))])),
      }));
    },
    onError: (error) => { setNotice(error.message); queryClient.invalidateQueries({ queryKey }); },
  });

  if (query.isError) return <section className="nxa" ref={fitRef}><p className="nxa-empty">{query.error.message}</p></section>;
  if (!query.data) return <section className="nxa" ref={fitRef}><p className="nxa-empty">Working out the next actions…</p></section>;

  const data = query.data;
  const all = QUADRANTS.flatMap((quadrant) => data.quadrants[quadrant.id] || []);
  const done = all.filter((action) => action.status === "done").length;
  const c = data.counts;

  return (
    <section ref={fitRef} style={fitHeight ? { height: fitHeight } : undefined} className={`nxa${query.isFetching ? " nxa-busy" : ""}`} aria-label="Next actions">
      <header className="nxa-bar">
        <div>
          <h2>Action matrix · {data.scope.label}</h2>
          <p>Each action is placed by how urgent and how important it is, from the survey, members, contact center, INEC register and 2023 results.</p>
        </div>
        <div className="nxa-controls">
          <select value={lga} onChange={(event) => setLga(event.target.value)} aria-label="Scope">
            <option value="">All 33 LGAs</option>
            {data.scope.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={horizon} onChange={(event) => setHorizon(event.target.value)} aria-label="Time horizon">
            {Object.entries(data.horizons).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <button type="button" className="nxa-ai" disabled={generate.isPending} onClick={() => generate.mutate()}>
            {generate.isPending ? "Asking Gemini…" : "✦ Refresh with Gemini"}
          </button>
        </div>
      </header>
      <div className="nxa-sources">
        Built from
        <span>Survey <b>{num(c.survey)}</b></span>
        <span>Members <b>{num(c.members)}</b></span>
        <span>Calls <b>{num(c.calls)}</b></span>
        <span>Contacts <b>{compact(c.contacts)}</b></span>
        <span>INEC register <b>{num(c.pollingUnits)} PUs</b></span>
        <span>2023 results</span>
        <em>{data.plan.source === "ai" ? `Written by ${data.plan.provider} · ${when(data.plan.generatedAt)}` : data.plan.staleAi ? "Rule-based: the data changed since the last AI plan" : "Rule-based plan"} · {all.length} actions · {done} done</em>
        {notice && <strong role="status">{notice}</strong>}
      </div>

      <div className="nxa-main">
        <div className="nxa-matrix">
          <div />
          <div className="nxa-axis">URGENT</div>
          <div className="nxa-axis">NOT URGENT</div>
          <div className="nxa-axis nxa-v">IMPORTANT</div>
          {QUADRANTS.slice(0, 2).map((quadrant) => <Quadrant key={quadrant.id} quadrant={quadrant} data={data} onStatus={(key, value) => status.mutate({ key, value })} onOpenMap={onOpenMap} lga={lga} />)}
          <div className="nxa-axis nxa-v">NOT IMPORTANT</div>
          {QUADRANTS.slice(2).map((quadrant) => <Quadrant key={quadrant.id} quadrant={quadrant} data={data} onStatus={(key, value) => status.mutate({ key, value })} onOpenMap={onOpenMap} lga={lga} />)}
        </div>

        <aside className="nxa-side">
          <section className="nxa-box">
            <h3>{data.plan.source === "ai" ? "✦ Gemini brief" : "Brief"}</h3>
            <p><b>Where we stand.</b> {data.brief.where_we_stand}</p>
            <p><b>Focus.</b> {data.brief.focus}</p>
            {data.plan.source === "ai" && <span className="nxa-tag">AI suggestions: check before acting. Figures come from the data; any figure the data does not contain is marked "check".</span>}
          </section>
          <section className="nxa-box">
            <h3>How to read it</h3>
            <ul className="nxa-legend">
              {QUADRANTS.map((quadrant) => <li key={quadrant.id}><i className={`q-${quadrant.id}`} /><b>{quadrant.number} {quadrant.label}</b> · {quadrant.hint}</li>)}
            </ul>
          </section>
          {data.dataGaps.length > 0 && (
            <section className="nxa-box">
              <h3>Data to close</h3>
              <ul className="nxa-gaps">{data.dataGaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
            </section>
          )}
        </aside>
      </div>
    </section>
  );
}

function Quadrant({ quadrant, data, onStatus, onOpenMap, lga }) {
  const items = data.quadrants[quadrant.id] || [];
  return (
    <section className={`nxa-q q-${quadrant.id}`} aria-label={`${quadrant.number} ${quadrant.label}`}>
      <header><b>{quadrant.number}</b><span>{quadrant.label}</span><em>{items.length} action{items.length === 1 ? "" : "s"}</em></header>
      <div className="nxa-q-body">
        {items.length ? items.map((action) => (
          <ActionCard key={action.key} action={action} facts={data.facts} canEdit={data.canEdit} onStatus={onStatus} onOpenMap={onOpenMap} scopeLga={lga} />
        )) : <p className="nxa-none">Nothing here for this scope.</p>}
      </div>
    </section>
  );
}
