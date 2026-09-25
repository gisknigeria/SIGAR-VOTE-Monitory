import { lazy, Suspense, useState } from "react";
import AreaOperations from "./AreaOperations.jsx";
import GeographicOperationalView from "./GeographicOperationalView.jsx";
import ReportingLifecycle from "./ReportingLifecycle.jsx";
import PreElectionPulse from "./PreElectionPulse.jsx";
import PreElectionData from "./PreElectionData.jsx";
import SentimentMapTab from "./SentimentMapTab.jsx";

const VoterSurvey = lazy(() => import("../stakeholder/VoterSurvey.jsx"));

/**
 * Pre-election: the Pulse first, then the sentiment map (which now carries the 2023 election
 * history as map layers), the voter survey, and the admin tabs.
 */
const TABS = [
  { id: "pulse", label: "Pulse" },
  { id: "map", label: "Sentiment map" },
  { id: "survey", label: "Voter survey" },
  { id: "data", label: "Data", admin: true },
  { id: "operations", label: "Operations planning", admin: true },
  { id: "geography", label: "Geography", admin: true },
  { id: "reports", label: "Reports", admin: true },
];

export default function PreElectionAnalysis({ authToken, canAdmin = false }) {
  const [tab, setTab] = useState("pulse");

  return (
    <section className="pre-election-dashboard">
      <div className="rc-tab-bar pre-election-tabs">
        {TABS.filter((item) => !item.admin || canAdmin).map((item) => (
          <button key={item.id} className={tab === item.id ? "rc-tab active" : "rc-tab"} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "pulse" && (
        <PreElectionPulse
          authToken={authToken}
          onOpenData={canAdmin ? () => setTab("data") : undefined}
        />
      )}
      {tab === "map" && <SentimentMapTab authToken={authToken} />}
      {tab === "survey" && (
        <div className="stakeholder-shell pep-survey-shell">
          <Suspense fallback={<p className="sh-empty" role="status">Loading the voter survey…</p>}>
            <VoterSurvey token={authToken} />
          </Suspense>
        </div>
      )}
      {tab === "data" && canAdmin && <PreElectionData authToken={authToken} />}
      {tab === "operations" && canAdmin && <AreaOperations authToken={authToken} />}
      {tab === "geography" && canAdmin && <GeographicOperationalView authToken={authToken} />}
      {tab === "reports" && canAdmin && <ReportingLifecycle authToken={authToken} />}
    </section>
  );
}
