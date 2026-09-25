import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { API } from "../../config.js";
import { apiRequest } from "../../api/client.js";
import "./pre-election-pulse.css";

/**
 * Where admins load everything the Pulse reads. Nothing is hardcoded: each card uploads a file,
 * shows what the server made of it (rows read, duplicates, LGAs it could not match) and can
 * remove it again.
 */

const num = (value) => (value == null ? "—" : Number(value).toLocaleString());
const when = (value) => (value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "");
const MEMBER_LABELS = ["Polling-unit agents", "BSA-YV volunteers", "Ward executives", "Party members"];
const contentType = (file) => (file.name.toLowerCase().endsWith(".csv") ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

const CARDS = [
  {
    kind: "survey",
    title: "Voter survey",
    body: "The cleaned poll workbook (the “Cleaned Table” sheet). Each upload is added to the survey. Collector names and submission IDs are removed on import.",
  },
  {
    kind: "members",
    title: "Member lists",
    body: "Agents, volunteers or members with LGA, ward, polling unit and phone. Names and phone numbers are not stored: people are matched by phone so someone on two lists counts once. Uploading a list with the same name replaces it.",
  },
  {
    kind: "contacts",
    title: "Contact list",
    body: "A phone list with an LGA column. Only the number of phones per LGA is kept. A new upload replaces the old list.",
  },
  {
    kind: "contact-center",
    title: "Contact center report",
    body: "The weekly report exported from the contact center (Overview, Calls Per LGA, Issues in the Area…). Agent names are not kept. A new report replaces the previous one.",
  },
  {
    kind: "reference",
    title: "Population & voter register",
    body: "One row per LGA: population, registered voters and PVCs collected. Until all 33 LGAs are loaded, state totals use INEC and NPC published figures.",
  },
];

async function downloadTemplate(kind, token) {
  const response = await fetch(`${API}/pre-election/templates/${kind}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("The template could not be downloaded.");
  const url = URL.createObjectURL(await response.blob());
  const link = Object.assign(document.createElement("a"), { href: url, download: `pre-election-${kind}-template.csv` });
  link.click();
  URL.revokeObjectURL(url);
}

function Summary({ item }) {
  const s = item.summary || {};
  const parts = item.kind === "members"
    ? [`${num(s.uniquePeople)} people`, `${num(s.rowsRead)} rows`, s.duplicatesInFile ? `${num(s.duplicatesInFile)} repeats` : "", s.noPhone ? `${num(s.noPhone)} without a valid phone` : ""]
    : item.kind === "contacts"
      ? [`${num(s.stored)} phones`, s.duplicatesInFile ? `${num(s.duplicatesInFile)} repeats` : "", s.invalid ? `${num(s.invalid)} invalid` : ""]
      : item.kind === "contact-center"
        ? [`${num(s.calls)} calls`, `${num(s.lgas)} LGAs`, s.issuesThemed ? `${num(s.issuesThemed)} issue calls grouped into themes` : ""]
        : [`${num(s.stored)} LGAs`, s.missingLgas?.length ? `${s.missingLgas.length} LGAs missing` : "all 33 LGAs"];
  return (
    <>
      <small>{parts.filter(Boolean).join(" · ")}</small>
      {s.truncated && <small className="warn">Stops at Excel’s 1,048,574-row limit, so the list is probably incomplete. Export it straight to CSV.</small>}
      {s.unmatched?.length > 0 && <small className="warn">Not matched to an Oyo LGA: {s.unmatched.slice(0, 6).map((row) => `${row.name} (${num(row.count)})`).join(", ")}</small>}
      {s.warnings?.map((warning) => <small key={warning} className="warn">{warning}</small>)}
    </>
  );
}

function UploadCard({ card, token, items, survey, onChanged }) {
  const input = useRef(null);
  const [label, setLabel] = useState(MEMBER_LABELS[0]);
  const [source, setSource] = useState("");
  const [state, setState] = useState({ status: "idle" });

  const upload = async () => {
    const files = [...(input.current?.files || [])];
    if (!files.length) return setState({ status: "error", message: "Choose a file first." });
    setState({ status: "busy", message: `Uploading ${files.map((file) => file.name).join(", ")}… large files can take a minute.` });
    try {
      const results = [];
      for (const file of files) {
        const path = card.kind === "survey"
          ? `/voter-survey/import?fileName=${encodeURIComponent(file.name)}`
          : `/pre-election/datasets?kind=${card.kind}&fileName=${encodeURIComponent(file.name)}&label=${encodeURIComponent(card.kind === "members" ? label : "")}&source=${encodeURIComponent(source)}`;
        results.push(await apiRequest(path, token, { method: "POST", body: file, headers: { "Content-Type": contentType(file) } }));
      }
      const last = results.at(-1);
      const message = card.kind === "survey"
        ? `Added ${num(results.reduce((sum, result) => sum + result.addedResponses, 0))} responses. The survey now has ${num(last.totalResponses)}.`
        : `Loaded ${results.length} file${results.length === 1 ? "" : "s"}.${last.replaced ? " The previous upload was replaced." : ""}`;
      setState({ status: "ok", message });
      if (input.current) input.current.value = "";
      onChanged();
    } catch (error) {
      setState({ status: "error", message: error.message });
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Remove “${item.label}” (${item.sourceFile})? The Pulse will stop using it.`)) return;
    try {
      await apiRequest(`/pre-election/datasets/${item.id}`, token, { method: "DELETE" });
      onChanged();
    } catch (error) {
      setState({ status: "error", message: error.message });
    }
  };

  return (
    <article className="pep-data-card">
      <h3>{card.title}</h3>
      <p>{card.body}</p>
      <div className="pep-data-form">
        {card.kind === "members" && (
          <label>
            List name
            <input type="text" list="pep-member-labels" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} />
            <datalist id="pep-member-labels">{MEMBER_LABELS.map((option) => <option key={option} value={option} />)}</datalist>
          </label>
        )}
        {card.kind === "reference" && (
          <label>
            Source (e.g. INEC 2023 register, NPC 2022 projection)
            <input type="text" value={source} onChange={(event) => setSource(event.target.value)} maxLength={200} />
          </label>
        )}
        <input ref={input} type="file" multiple={!["reference", "contact-center"].includes(card.kind)} accept=".xlsx,.csv" disabled={state.status === "busy"} />
        <div className="pep-data-actions">
          <button type="button" className="primary action-btn" onClick={upload} disabled={state.status === "busy"}>{state.status === "busy" ? "Uploading…" : "Upload"}</button>
          {!["survey", "contact-center"].includes(card.kind) && <button type="button" className="pep-link" onClick={() => downloadTemplate(card.kind, token).catch((error) => setState({ status: "error", message: error.message }))}>Download template</button>}
        </div>
        {state.message && <p className={`pep-data-status ${state.status === "error" ? "error" : state.status === "ok" ? "ok" : ""}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
      </div>
      {card.kind === "survey" ? (
        survey ? <ul className="pep-uploads"><li className="pep-upload"><header><strong>{survey.sourceFile}</strong></header><small>{num(survey.responses)} responses · {when(survey.importedAt)}</small></li></ul> : <p className="pep-data-status">No survey loaded yet.</p>
      ) : items.length ? (
        <ul className="pep-uploads">
          {items.map((item) => (
            <li key={item.id} className="pep-upload">
              <header><strong>{item.label}</strong><button type="button" className="pep-danger" onClick={() => remove(item)}>Remove</button></header>
              <small>{item.sourceFile} · {when(item.uploadedAt)}{item.source ? ` · ${item.source}` : ""}</small>
              <Summary item={item} />
            </li>
          ))}
        </ul>
      ) : <p className="pep-data-status">Nothing loaded yet.</p>}
    </article>
  );
}

export default function PreElectionData({ authToken }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["pre-election-datasets"],
    queryFn: ({ signal }) => apiRequest("/pre-election/datasets", authToken, { signal }),
  });
  const changed = () => {
    queryClient.invalidateQueries({ queryKey: ["pre-election-datasets"] });
    queryClient.invalidateQueries({ queryKey: ["pre-election-pulse"] });
    queryClient.invalidateQueries({ queryKey: ["voter-survey"] });
  };
  if (query.isError) return <p className="pep-empty">{query.error.message}</p>;
  const datasets = query.data?.datasets || [];
  return (
    <section className="pep-data">
      <p className="pep-data-intro">Upload Excel (.xlsx) or CSV files. Columns are found by their header names, so the files you already have work as they are. LGA spellings are matched to INEC’s 33 Oyo LGAs, and anything that doesn’t match is listed under the upload.</p>
      <div className="pep-data-grid">
        {CARDS.map((card) => (
          <UploadCard key={card.kind} card={card} token={authToken} items={datasets.filter((item) => item.kind === card.kind)} survey={query.data?.survey} onChanged={changed} />
        ))}
      </div>
    </section>
  );
}
