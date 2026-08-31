import DashboardMapWorkspace from "./DashboardMapWorkspace.jsx";
import DashboardModals from "./DashboardModals.jsx";
import DashboardOverlays from "./DashboardOverlays.jsx";
import DashboardSidebar from "./DashboardSidebar.jsx";

export default function DashboardView({ controller }) {
  const { session } = controller;

  return (
    <main className={`app-shell role-${session.user.role.toLowerCase().replaceAll(" ", "-")}`}>
      <DashboardSidebar controller={controller} />
      <DashboardMapWorkspace controller={controller} />
      <DashboardOverlays controller={controller} />
      <DashboardModals controller={controller} />
    </main>
  );
}
