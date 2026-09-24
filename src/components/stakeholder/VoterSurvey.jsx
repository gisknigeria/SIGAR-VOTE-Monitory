import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/client.js";
import { BarList, BigNumbers, GOLD_RAMP, LgaMap, lgaKey, NO_DATA_FILL, num, Panel, share } from "./ui.jsx";
import "./stakeholder.css";

/**
 * The campaign's voter survey, read from the server's aggregates (never raw rows). Everything a
 * pivot in the survey workbook showed is here, plus what a pivot could not do: LGA weighting,
 * second-choice transfers, written-answer themes and data-quality warnings.
 */

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "candidates", label: "Candidates" },
  { id: "issues", label: "Issues & messages" },
  { id: "influence", label: "Influence" },
  { id: "turnout", label: "Turnout" },
  { id: "sentiment", label: "Sentiment" },
  { id: "quality", label: "Data quality" },
];

const SHORT_NAMES = { "Olufemi Ajadi Oguntoyinbo": "Ajadi" };
const shortName = (name, focusName) => {
  if (!name) return "—";
  if (name === focusName) return "Sen. Alli";
  return SHORT_NAMES[name] || name.split(" ").slice(-1)[0];
};

const FOCUS_COLOR = "#f5dc9a";
// Gold is always Sen. Alli, rose is always the other candidates -- on every chart on these pages.
const OTHERS_COLOR = "#c9748f";
const TONE_COLORS = { positive: "#0ca30c", neutral: "#8f7d86", negative: "#ec835a" };
// Fixed bins, not relative to the peak, so the map colours mean the same thing under every filter.
const SHARE_BINS = [0.2, 0.35, 0.5];
const FLAG_LABELS = { "small-sample": "Fewer than 100 people", "one-collector": "Mostly one collector" };

/** A question's answers as bars, with the base ("N answered") always stated. */
function QuestionPanel({ data, field, title, wide = false, limit = 10 }) {
  const question = data.questions[field];
  if (!question) return null;
  const wording = data.source.questions?.[field];
  return (
    <Panel title={title} sub={`${wording ? `“${wording}” · ` : ""}${num(question.answered)} answered`} wide={wide}>
      <BarList rows={question.rows.slice(0, limit).map((row) => ({ name: row.name, value: row.count }))} total={question.answered} emptyMessage="No answers for this selection." />
    </Panel>
  );
}

/** Sen. Alli's supporters vs people who named another candidate, answer by answer. */
function ComparePanel({ data, field, title, note, limit = 7 }) {
  const segment = data.segments?.[field];
  if (!segment?.rows?.length) return null;
  const rows = segment.rows.slice(0, limit);
  const max = Math.max(...rows.flatMap((row) => [row.focus, row.others]), 0.01);
  return (
    <Panel title={title} sub={note}>
      <div className="sv-compare-legend" aria-hidden="true">
        <span><i style={{ background: FOCUS_COLOR }} />Sen. Alli's supporters ({num(segment.focusAnswered)})</span>
        <span><i style={{ background: OTHERS_COLOR }} />Other candidates' voters ({num(segment.othersAnswered)})</span>
      </div>
      <ul className="sv-compare">
        {rows.map((row) => (
          <li key={row.name}>
            <span className="sv-compare-name">{row.name}</span>
            <span className="sv-compare-bars">
              <span className="sv-compare-bar"><i style={{ width: `${(row.focus / max) * 100}%`, background: FOCUS_COLOR }} /><b>{share(row.focus, 0)}</b></span>
              <span className="sv-compare-bar"><i style={{ width: `${(row.others / max) * 100}%`, background: OTHERS_COLOR }} /><b>{share(row.others, 0)}</b></span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** The workbook's "Candidates Analysis": each group's vote split, as shares of people who named someone. */
function CrosstabPanel({ data, field, title, sub }) {
  const table = data.crosstabs?.[field];
  if (!table?.rows?.length) return null;
  const focus = data.focus?.name;
  return (
    <Panel title={title} sub={sub} wide>
      <div className="sv-table-wrap">
        <table className="sv-table">
          <thead>
            <tr>
              <th scope="col">{title.replace(/^Vote by /, "").replace(/^./, (c) => c.toUpperCase())}</th>
              <th scope="col" className="num">Named someone</th>
              {table.candidates.map((name) => <th key={name} scope="col" className="num">{shortName(name, focus)}</th>)}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.name}>
                <th scope="row">{row.name}</th>
                <td className="num">{num(row.named)}</td>
                {table.candidates.map((name) => (
                  <td key={name} className={row.leader === name ? "num sv-lead" : "num"}>{share(row.named ? row.counts[name] / row.named : 0, 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function SurveyMap({ data }) {
  const rowsByKey = useMemo(() => new Map(data.byLga.filter((row) => row.key).map((row) => [lgaKey(row.lga), row])), [data.byLga]);
  const focus = data.focus?.name;
  const fill = useCallback((row) => {
    if (!row || row.named < 10) return NO_DATA_FILL;
    const step = SHARE_BINS.findIndex((edge) => row.focusShare < edge);
    return GOLD_RAMP[step === -1 ? GOLD_RAMP.length - 1 : step];
  }, []);
  const tooltip = useCallback((name, row) => {
    if (!row) return `<b>${name}</b><br>Nobody surveyed here`;
    const flags = row.flags.map((flag) => FLAG_LABELS[flag]).filter(Boolean);
    return `<b>${name}</b><br>${num(row.responses)} surveyed · ${num(row.named)} named a candidate<br>Sen. Alli: ${share(row.focusShare, 0)}${row.leader ? `<br>Leading: ${shortName(row.leader, focus).replace(/[<>&]/g, "")} (${share(row.leaderShare, 0)})` : ""}${flags.length ? `<br><i>⚠ ${flags.join(" · ")}</i>` : ""}`;
  }, [focus]);
  return (
    <LgaMap
      rowsByKey={rowsByKey}
      fill={fill}
      tooltip={tooltip}
      legend={<>
        <span className="sh-legend-swatches">
          <i style={{ background: NO_DATA_FILL }} title="Too few answers" />
          {GOLD_RAMP.map((step) => <i key={step} style={{ background: step }} />)}
        </span>
        <span>Too few · under 20% · 20–35% · 35–50% · 50%+ for Sen. Alli</span>
      </>}
    />
  );
}

/** Plain-English findings written from the figures, most decision-relevant first. */
function findingsFrom(data) {
  const out = [];
  const focus = data.focus;
  const weighted = data.vote.weighted;
  if (focus && weighted) {
    const leader = weighted.rows[0];
    const focusWeighted = weighted.rows.find((row) => row.name === focus.name);
    const gap = (focusWeighted?.share || 0) - focus.share;
    const why = gap < -0.02
      ? "The survey over-represents Sen. Alli's strongest LGAs, so the weighted figure is the fairer read of the whole state."
      : gap > 0.02
        ? "The survey under-represents LGAs where Sen. Alli is strong, so the weighted figure is the fairer read of the whole state."
        : "Weighting changes little, so the raw figure is a reasonable read of the state.";
    out.push({
      tone: leader?.name === focus.name ? "good" : "warn",
      text: `Among people surveyed, Sen. Alli ${focus.rank === 1 ? "leads with" : "has"} ${share(focus.share)} of those who named a candidate. Weighted by LGA size, ${leader?.name === focus.name ? "he leads" : `${shortName(leader?.name)} leads`} with ${share(leader?.share)} and Sen. Alli has ${share(focusWeighted?.share)}. ${why}`,
    });
  } else if (focus) {
    out.push({ tone: focus.rank === 1 ? "good" : "warn", text: `Sen. Alli is ${focus.rank === 1 ? "first" : `number ${focus.rank}`} here with ${share(focus.share)} of those who named a candidate${focus.rival ? ` (${shortName(focus.rival.name)}: ${share(focus.rival.share)})` : ""}.` });
  }
  const rival = data.vote.transfers.find((row) => row.candidate !== focus?.name);
  const toFocus = rival?.to.find((row) => row.name === focus?.name);
  if (rival && toFocus) out.push({ tone: "info", text: `If ${shortName(rival.candidate)} were not running, ${share(toFocus.share, 0)} of his voters would pick Sen. Alli.` });
  const issue = data.questions.topIssue?.rows[0];
  if (issue) out.push({ tone: "info", text: `${issue.name} is the top issue for ${share(issue.share, 0)} of respondents.` });
  const platform = data.questions.platform?.rows[0];
  if (platform) out.push({ tone: "info", text: `${platform.name} is the most influential platform (${share(platform.share, 0)}), well ahead of any other.` });
  const trusted = data.questions.truthSource?.rows[0];
  if (trusted) out.push({ tone: "info", text: `People trust ${trusted.name.toLowerCase()} most to tell the truth about politics (${share(trusted.share, 0)}).` });
  const message = [...(data.segments?.message?.rows || [])].sort((a, b) => b.others - a.others)[0];
  if (message) out.push({ tone: "info", text: `The message most likely to win over other candidates' voters: "${message.name}" (${share(message.others, 0)} of them).` });
  const barrier = data.questions.barrier?.rows[0];
  if (barrier) out.push({ tone: "info", text: `${barrier.name} is the main thing that could stop people voting (${share(barrier.share, 0)}).` });
  if (data.quality.duplicateShare > 0.05 || data.quality.oneCollectorLgas.length) {
    out.push({ tone: "warn", text: `Treat LGA-level figures with care: ${share(data.quality.duplicateShare, 0)} of responses are exact copies of another, and ${data.quality.oneCollectorLgas.length} LGAs were collected mostly by one person. See Data quality.` });
  }
  return out;
}

function SummaryTab({ data }) {
  const focus = data.focus;
  const weighted = data.vote.weighted;
  const focusWeighted = weighted?.rows.find((row) => row.name === focus?.name);
  const findings = findingsFrom(data);
  return (
    <>
      <BigNumbers items={[
        { label: "People surveyed", value: num(data.filter.responses), sub: `${num(data.vote.named)} named a candidate` },
        { label: "Sen. Alli, as surveyed", value: focus ? share(focus.share) : "—", sub: focus ? `${num(focus.votes)} people · ranked ${focus.rank === 1 ? "first" : `#${focus.rank}`}` : "", lead: true },
        weighted
          ? { label: "Sen. Alli, weighted by LGA", value: share(focusWeighted?.share), sub: `${shortName(weighted.rows[0]?.name, focus?.name)} leads at ${share(weighted.rows[0]?.share)}` }
          : { label: "LGAs covered", value: num(data.source.lgas), sub: "Weighting applies to the whole state only" },
      ]} />

      <Panel title="Key findings" wide>
        <ul className="sv-findings">
          {findings.map((item) => <li key={item.text} className={`sv-finding-${item.tone}`}>{item.text}</li>)}
        </ul>
      </Panel>

      <div className="sh-grid">
        <Panel title="First choice, as surveyed" sub={`“If the election were held today…” · ${num(data.vote.named)} named a candidate`}>
          <BarList rows={data.vote.firstChoice.slice(0, 6).map((row) => ({ name: shortName(row.name, focus?.name), value: row.count, color: row.name === focus?.name ? FOCUS_COLOR : OTHERS_COLOR }))} total={data.vote.named} emptyMessage="Nobody named a candidate in this selection." />
        </Panel>
        {weighted ? (
          <Panel title="First choice, weighted by LGA size" sub={`Each LGA counts by its size, not by how many people were surveyed there. Covers ${share(weighted.coverage, 0)} of the state (${weighted.lgasIncluded} LGAs with ${weighted.minimumAnswersPerLga}+ answers). Sized by ${weighted.basis}.`}>
            <BarList rows={weighted.rows.filter((row) => row.share >= 0.001).slice(0, 6).map((row) => ({ name: shortName(row.name, focus?.name), value: Math.round(row.share * 1000) / 10, color: row.name === focus?.name ? FOCUS_COLOR : OTHERS_COLOR }))} total={0} formatValue={(value) => `${value.toFixed(1)}%`} />
          </Panel>
        ) : (
          <Panel title="Who they would pick instead" sub={`“If your candidate was not running…” · ${num(data.vote.secondChoice.answered)} answered`}>
            <BarList rows={data.vote.secondChoice.rows.slice(0, 6).map((row) => ({ name: shortName(row.name, focus?.name), value: row.count, color: row.name === focus?.name ? FOCUS_COLOR : OTHERS_COLOR }))} total={data.vote.secondChoice.answered} emptyMessage="No second choices in this selection." />
          </Panel>
        )}
        <Panel title="Sen. Alli's share by LGA" sub="Share of people who named a candidate. Hover or tap an LGA for its numbers and any warnings." wide>
          <SurveyMap data={data} />
        </Panel>
      </div>
    </>
  );
}

function CandidatesTab({ data }) {
  const focus = data.focus?.name;
  const columns = data.vote.firstChoice.slice(0, 3).map((row) => row.name);
  return (
    <div className="sh-grid">
      <Panel title="Second choice: where each candidate's voters would go" sub="“If your candidate was not running, who would you vote for?”" wide>
        <ul className="sv-transfers">
          {data.vote.transfers.map((row) => (
            <li key={row.candidate}>
              <span className="sv-transfer-from">{shortName(row.candidate, focus)} <small>{num(row.voters)} voters · {num(row.answered)} gave a second choice</small></span>
              <span className="sv-transfer-to">
                {row.to.length ? row.to.filter((to) => to.share >= 0.005).map((to) => <span key={to.name}><b>{share(to.share, 0)}</b> {shortName(to.name, focus)}</span>) : <span>No second choices given</span>}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Vote by LGA" sub="Share of people in each LGA who named a candidate. Warnings mark LGAs where the figures are shaky." wide>
        <div className="sv-table-wrap">
          <table className="sv-table">
            <thead>
              <tr>
                <th scope="col">LGA</th>
                <th scope="col" className="num">Surveyed</th>
                {columns.map((name) => <th key={name} scope="col" className="num">{shortName(name, focus)}</th>)}
                <th scope="col">Warnings</th>
              </tr>
            </thead>
            <tbody>
              {data.byLga.map((row) => (
                <tr key={row.key || "none"}>
                  <th scope="row">{row.lga}</th>
                  <td className="num">{num(row.responses)}</td>
                  {columns.map((name) => {
                    const hit = row.candidates.find((item) => item.name === name);
                    return <td key={name} className={row.leader === name ? "num sv-lead" : "num"}>{row.named ? share(hit?.share || 0, 0) : "—"}</td>;
                  })}
                  <td>{row.flags.map((flag) => <span key={flag} className="sv-flag">{FLAG_LABELS[flag]}</span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <CrosstabPanel data={data} field="respondent" title="Vote by respondent group" sub="Which groups back which candidate." />
      <CrosstabPanel data={data} field="topIssue" title="Vote by top issue" sub="What each candidate's voters care about most." />
      <CrosstabPanel data={data} field="platform" title="Vote by influence platform" sub="Which media each candidate's voters follow." />
      <CrosstabPanel data={data} field="candidateFactor" title="Vote by what matters most in a candidate" />
      <CrosstabPanel data={data} field="firstHeard" title="Vote by where they first heard of their candidate" />
    </div>
  );
}

function IssuesTab({ data }) {
  return (
    <div className="sh-grid">
      <QuestionPanel data={data} field="topIssue" title="Top priority issue" />
      <QuestionPanel data={data} field="lgaProblem" title="Biggest problem in their LGA" />
      <QuestionPanel data={data} field="sector" title="Sector that most needs improvement" />
      <QuestionPanel data={data} field="satisfaction" title="Satisfaction with the current government" />
      <QuestionPanel data={data} field="fairAttention" title="Does their LGA get fair attention?" />
      <ComparePanel data={data} field="message" title="Message most likely to win support" note="The pink bars are the people the campaign still has to win." />
      <ComparePanel data={data} field="communicate" title="What should be communicated more clearly" />
      <ComparePanel data={data} field="topIssue" title="Top issue: supporters vs others" />
      <ComparePanel data={data} field="satisfaction" title="Satisfaction: supporters vs others" />
    </div>
  );
}

function InfluenceTab({ data }) {
  return (
    <div className="sh-grid">
      <QuestionPanel data={data} field="platform" title="Most influential platform" />
      <ComparePanel data={data} field="platform" title="Platform: supporters vs others" />
      <QuestionPanel data={data} field="truthSource" title="Who they trust to tell the truth" />
      <ComparePanel data={data} field="truthSource" title="Trusted voices: supporters vs others" />
      <QuestionPanel data={data} field="firstHeard" title="Where they first heard of their candidate" />
      <ComparePanel data={data} field="firstHeard" title="First heard: supporters vs others" />
      <QuestionPanel data={data} field="candidateFactor" title="What matters most in a candidate" />
      <QuestionPanel data={data} field="familiarity" title="How well they know their candidate" />
      <QuestionPanel data={data} field="respondent" title="Who was surveyed" wide />
    </div>
  );
}

function TurnoutTab({ data }) {
  return (
    <div className="sh-grid">
      <QuestionPanel data={data} field="hasPvc" title="Has a PVC (voter's card)" />
      <QuestionPanel data={data} field="votedLast" title="Voted in the last state election" />
      <QuestionPanel data={data} field="likelihood" title="Likely to vote this time" />
      <QuestionPanel data={data} field="barrier" title="What could stop them voting" />
      <ComparePanel data={data} field="barrier" title="Barriers: supporters vs others" note="Sen. Alli's supporters who might not turn out, and why." />
      <QuestionPanel data={data} field="goodGovernor" title="Will their candidate make a good governor?" />
    </div>
  );
}

function ToneBar({ tone }) {
  const parts = [
    ["positive", "Positive", tone.positive.share],
    ["neutral", "No clear view", tone.neutral.share],
    ["negative", "Negative or doubtful", tone.negative.share + tone.mixed.share],
  ];
  return (
    <>
      <div className="sv-tone" role="img" aria-label={parts.map(([, label, value]) => `${label} ${share(value, 0)}`).join(", ")}>
        {parts.map(([key, , value]) => <i key={key} style={{ width: `${value * 100}%`, background: TONE_COLORS[key] }} />)}
      </div>
      <ul className="sv-tone-legend">
        {parts.map(([key, label, value]) => <li key={key}><i style={{ background: TONE_COLORS[key] }} />{label} <b>{share(value, 0)}</b></li>)}
      </ul>
    </>
  );
}

function SentimentTab({ data }) {
  const { sentiment } = data;
  const focus = data.focus?.name;
  if (!sentiment.answers) return <p className="sh-empty">No written answers in this selection.</p>;
  return (
    <div className="sh-grid">
      <Panel title="Overall tone of written answers" sub={`${num(sentiment.answers)} short answers to “overall impression”, “why yes” and “why no”. Most people were describing the candidate they back.`} wide>
        <ToneBar tone={sentiment.tone} />
      </Panel>

      <Panel title="Why people back each candidate" sub="The reasons their own supporters give, most mentioned first." wide>
        <ul className="sv-reasons">
          {sentiment.byCandidate.map((row) => (
            <li key={row.candidate}>
              <div className="sv-reasons-head">
                <strong>{shortName(row.candidate, focus)}</strong>
                <span>{num(row.answers)} answers · {share(row.positive, 0)} positive · {share(row.negative, 0)} negative</span>
              </div>
              <div className="sv-reasons-themes">
                {row.themes.map((theme) => <span key={theme.id} className={`sv-theme sv-theme-${theme.tone}`}>{theme.label} <b>{share(theme.share, 0)}</b></span>)}
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="All themes" sub="How often each theme comes up, with the most common wording. Only phrases used by 5 or more people are quoted." wide>
        <ul className="sv-themes">
          {sentiment.themes.map((theme) => (
            <li key={theme.id}>
              <span className={`sv-theme sv-theme-${theme.tone}`}>{theme.label}</span>
              <b>{share(theme.share, 0)}</b>
              <small>{theme.examples.map((example) => `“${example.phrase}” (${num(example.count)})`).join(" · ")}</small>
            </li>
          ))}
        </ul>
        <p className="sh-footline">Themes are found by fixed word rules written for this survey's answers, so every label can be checked and nothing is sent to an outside service. One answer can carry more than one theme.</p>
      </Panel>
    </div>
  );
}

function QualityTab({ data, canImport, token }) {
  const q = data.quality;
  const items = [
    { label: "Exact duplicate responses", value: `${num(q.duplicates)} (${share(q.duplicateShare, 1)})`, note: "Responses identical to another in every answer. Some repetition is normal with multiple-choice questions, but this many suggests copied submissions.", tone: q.duplicateShare > 0.05 ? "warn" : "ok" },
    { label: "Copy-pasted written answers", value: `${num(q.templatedAnswers)} (${share(q.templatedShare, 0)})`, note: q.templatedExamples.length ? `Long sentences repeated word for word, e.g. ${q.templatedExamples.slice(0, 2).map((item) => `“${item.phrase}” ×${num(item.count)}`).join(", ")}.` : "No long sentence is repeated suspiciously often.", tone: q.templatedShare > 0.1 ? "warn" : "ok" },
    { label: "LGAs collected mostly by one person", value: num(q.oneCollectorLgas.length), note: q.oneCollectorLgas.map((item) => `${item.lga} (${share(item.share, 0)})`).join(", ") || "None.", tone: q.oneCollectorLgas.length ? "warn" : "ok" },
    { label: "LGAs with fewer than 100 people", value: num(q.smallSampleLgas.length), note: q.smallSampleLgas.map((item) => `${item.lga} (${num(item.responses)})`).join(", ") || "None.", tone: q.smallSampleLgas.length ? "warn" : "ok" },
    { label: "No vote answer", value: num(q.noVoteAnswer), note: "People who did not name a candidate. Vote shares leave them out.", tone: "info" },
    { label: "Sen. Alli supporters naming him as their second choice", value: num(q.focusSecondChoiceIsFocus), note: "A contradiction; excluded from second-choice figures.", tone: q.focusSecondChoiceIsFocus ? "warn" : "ok" },
    { label: "“Good governor: yes” but a reason against given", value: num(q.goodGovernorYesWithReasonAgainst), note: "Answers that contradict each other; worth raising with collectors.", tone: q.goodGovernorYesWithReasonAgainst ? "warn" : "ok" },
    { label: "Voting LGA not given", value: num(q.lgaNotGiven), note: "Counted in state figures, left off the map and LGA table.", tone: "info" },
  ];
  return (
    <div className="sh-grid">
      <Panel title="Can these figures be trusted?" sub={`${data.source.file || "Survey"} · sheet “${data.source.sheet}” · imported ${new Date(data.source.importedAt).toLocaleDateString()} · ${num(data.source.responses)} responses from ${num(data.source.collectors)} collectors`} wide>
        <ul className="sv-quality">
          {items.map((item) => (
            <li key={item.label} className={`sv-quality-${item.tone}`}>
              <span className="sv-quality-label">{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.note}</small>
            </li>
          ))}
        </ul>
        <p className="sh-footline">Percentages on these pages use people who answered each question as the base. Collectors' names and submission IDs were removed when the file was imported.</p>
      </Panel>
    </div>
  );
}

function ImportPanel({ token }) {
  const input = useRef(null);
  const queryClient = useQueryClient();
  const [state, setState] = useState({ status: "idle" });
  const upload = async (files) => {
    const selected = [...(files || [])];
    if (!selected.length) return;
    setState({ status: "uploading", name: selected.map((file) => file.name).join(", ") });
    try {
      const results = [];
      for (const file of selected) {
        results.push(await apiRequest(`/voter-survey/import?fileName=${encodeURIComponent(file.name)}`, token, {
          method: "POST",
          body: file,
          headers: { "Content-Type": file.name.toLowerCase().endsWith(".csv") ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
        }));
      }
      setState({ status: "done", results });
      queryClient.invalidateQueries({ queryKey: ["voter-survey"] });
    } catch (error) {
      setState({ status: "error", message: error.message });
    } finally {
      if (input.current) input.current.value = "";
    }
  };
  return (
    <Panel title="Add survey data" sub="Admins only. Add one or more cleaned Excel or CSV files. Each upload is added to the current survey and the analysis updates." wide>
      <div className="sv-import">
        <input ref={input} type="file" multiple accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(event) => upload(event.target.files)} disabled={state.status === "uploading"} />
        {state.status === "uploading" && <p role="status">Importing {state.name}… this can take up to a minute for a large file.</p>}
        {state.status === "error" && <p className="sh-error" role="alert">{state.message}</p>}
        {state.status === "done" && (
          <div role="status">
            <p>Added {num(state.results.reduce((total, result) => total + result.addedResponses, 0))} responses. The survey now contains {num(state.results.at(-1).totalResponses)} responses.</p>
          </div>
        )}
      </div>
    </Panel>
  );
}

export default function VoterSurvey({ token }) {
  const [tab, setTab] = useState("summary");
  const [filter, setFilter] = useState({ lga: "", respondent: "" });
  const [ai, setAi] = useState({ status: "idle" });
  const query = useQuery({
    queryKey: ["voter-survey", filter.lga, filter.respondent],
    queryFn: ({ signal }) => apiRequest(`/voter-survey?lga=${encodeURIComponent(filter.lga)}&respondent=${encodeURIComponent(filter.respondent)}`, token, { signal }),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });
  const data = query.data;
  const requestAi = async () => {
    setAi({ status: "loading" });
    try {
      const result = await apiRequest("/voter-survey/ai", token, { method: "POST", body: JSON.stringify(filter) });
      setAi({ status: "done", ...result });
    } catch (error) {
      setAi({ status: "error", message: error.message, configured: error.configured });
    }
  };

  if (query.isPending) return <p className="sh-empty" role="status">Loading the voter survey…</p>;
  if (query.isError && !data) {
    return (
      <p className="sh-error" role="alert">
        {query.error?.message || "The voter survey is unavailable right now."}{" "}
        <button type="button" onClick={() => query.refetch()}>Try again</button>
      </p>
    );
  }
  if (data?.status === "empty") {
    return (
      <>
        <section className="sh-headline"><p className="sh-headline-title">No voter survey has been loaded yet.</p><p className="sh-headline-sub">{data.canImport ? "Load the cleaned survey workbook below to see the analysis." : "An administrator needs to load the survey file first."}</p></section>
        {data.canImport && <ImportPanel token={token} />}
      </>
    );
  }

  const focus = data.focus;
  const filtered = Boolean(filter.lga || filter.respondent);
  return (
    <div className="sv">
      <section className="sh-headline">
        <p className="sh-headline-title">
          {focus
            ? `Sen. Alli is ${focus.rank === 1 ? "the first choice" : `number ${focus.rank}`} of ${share(focus.share, 0)} of people who named a candidate${filtered ? " in this selection" : ""}.`
            : "Voter survey"}
        </p>
        <p className="sh-headline-sub">
          {num(data.filter.responses)} people{filter.lga ? ` in ${data.filter.lga}` : ` across ${num(data.source.lgas)} LGAs`}{filter.respondent ? ` · ${filter.respondent}` : ""}. A campaign survey, not a random sample of voters. Read with the warnings under Data quality.
        </p>
      </section>

      <div className="sv-filters" role="group" aria-label="Filter the survey">
        <label>LGA
          <select value={filter.lga} onChange={(event) => setFilter((current) => ({ ...current, lga: event.target.value }))}>
            <option value="">All LGAs</option>
            {data.options.lgas.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label>Respondent group
          <select value={filter.respondent} onChange={(event) => setFilter((current) => ({ ...current, respondent: event.target.value }))}>
            <option value="">Everyone</option>
            {data.options.respondents.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        {filtered && <button type="button" className="sv-clear" onClick={() => setFilter({ lga: "", respondent: "" })}>Clear filters</button>}
        {query.isFetching && <span className="sv-updating" role="status">Updating…</span>}
        <button type="button" className="sv-clear" onClick={requestAi} disabled={ai.status === "loading"}>{ai.status === "loading" ? "Analysing…" : "Generate AI analysis"}</button>
      </div>
      {ai.status === "error" && <p className="sh-error" role="alert">{ai.message}{ai.configured && ` Detected: ${Object.entries(ai.configured).filter(([, available]) => available).map(([provider]) => provider).join(", ") || "none"}.`}</p>}
      {ai.status === "done" && <Panel title="AI survey analysis" sub={`Generated from the aggregate survey figures${ai.model ? ` using ${ai.model}` : ""}.`} wide><div className="sv-ai-output">{ai.analysis}</div></Panel>}
      {data.canImport && <ImportPanel token={token} />}
      {data.filter.smallSample && <p className="sh-alert" role="status">Only {num(data.filter.responses)} people in this selection. Percentages can swing a lot with numbers this small.</p>}

      <nav className="sv-tabs" aria-label="Survey sections">
        {TABS.map((item) => (
          <button key={item.id} type="button" className={item.id === tab ? "sv-tab active" : "sv-tab"} aria-pressed={item.id === tab} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "summary" && <SummaryTab data={data} />}
      {tab === "candidates" && <CandidatesTab data={data} />}
      {tab === "issues" && <IssuesTab data={data} />}
      {tab === "influence" && <InfluenceTab data={data} />}
      {tab === "turnout" && <TurnoutTab data={data} />}
      {tab === "sentiment" && <SentimentTab data={data} />}
      {tab === "quality" && <QualityTab data={data} canImport={data.canImport} token={token} />}
    </div>
  );
}
