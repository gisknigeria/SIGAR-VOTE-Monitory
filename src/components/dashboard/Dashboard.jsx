import { lazy, Suspense } from "react";
import DashboardRuntime from "./DashboardRuntime.jsx";

const StakeholderDashboard = lazy(() => import("../stakeholder/StakeholderDashboard.jsx"));

/**
 * Stakeholders branch before the operational runtime rather than inside it. DashboardRuntime
 * opens sockets and fetches incidents, users, cameras and chat on mount -- hiding that behind
 * conditionals would still deliver the data to an observer's browser. Not starting it is the
 * only version of "read-only" that actually holds.
 */
export default function Dashboard(props) {
  if (props.session?.user?.role === "Stakeholder") {
    return (
      <Suspense fallback={<div className="stakeholder-boot" role="status">Loading election overview…</div>}>
        <StakeholderDashboard session={props.session} onLogout={props.onLogout} />
      </Suspense>
    );
  }
  return <DashboardRuntime {...props} />;
}
