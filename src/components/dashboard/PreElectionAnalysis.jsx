import { useState } from "react";
import AreaOperations from "./AreaOperations.jsx";
import ReportingLifecycle from "./ReportingLifecycle.jsx";
import PreElectionPulse from "./PreElectionPulse.jsx";
import SentimentMapTab from "./SentimentMapTab.jsx";
import NextActionsTab from "./NextActionsTab.jsx";

/**
 * Pre-election: the Pulse first, then Sentiment (the map, which also carries the 2023 election
 * history as layers), Next actions (an urgent/important matrix), and the admin tabs. Uploads live
 * in the sidebar under Tools -> Manage Data.
 */
const TABS = [
  { id: "pulse", label: "Pulse" },
  { id: "map", label: "Sentiment" },
  { id: "actions", label: "Next actions" },
  { id: "operations", label: "Resources management", admin: true },
  { id: "reports", label: "Reports", admin: true },
];

export default function PreElectionAnalysis({ authToken, canAdmin = false }) {
  const [tab, setTab] = useState("pulse");
  const [mapLga, setMapLga] = useState(null);
  const openOnMap = (lga) => { setMapLga(lga); setTab("map"); };

  return (
    <section className="pre-election-dashboard">
      <div className="rc-tab-bar pre-election-tabs">
        {TABS.filter((item) => !item.admin || canAdmin).map((item) => (
          <button key={item.id} className={tab === item.id ? "rc-tab active" : "rc-tab"} onClick={() => { if (item.id === "map") setMapLga(null); setTab(item.id); }}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "pulse" && <PreElectionPulse authToken={authToken} />}
      {tab === "map" && <SentimentMapTab key={mapLga?.key || "all"} authToken={authToken} initialLga={mapLga} />}
      {tab === "actions" && <NextActionsTab authToken={authToken} onOpenMap={openOnMap} />}
      {tab === "operations" && canAdmin && <AreaOperations authToken={authToken} />}
      {tab === "reports" && canAdmin && <ReportingLifecycle authToken={authToken} />}
    </section>
  );
}
