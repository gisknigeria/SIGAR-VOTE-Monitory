import { useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";

export default function AssignIncidentModal({ incident, users = [], currentUser, onClose, onAssign }) {
  const [assignedUserId, setAssignedUserId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const candidates = useMemo(() => users.filter((user) => {
    if (!["Agent", "Supervisor", "Response Team"].includes(user.role)) return false;
    if (currentUser?.role !== "Supervisor") return true;
    return user.id === currentUser.id || (
      user.role === "Agent" &&
      String(user.lga || "").toLowerCase() === String(currentUser.lga || "").toLowerCase() &&
      String(user.ward || "").toLowerCase() === String(currentUser.ward || "").toLowerCase()
    );
  }), [users, currentUser]);

  const submit = async (event) => {
    event.preventDefault();
    if (!assignedUserId || !message.trim()) return setError("Select a field user and include a clear operational instruction.");
    setBusy(true); setError("");
    try {
      await onAssign({ incidentId: incident.id, assignedUserId, message: message.trim() });
      onClose();
    } catch (assignError) {
      setError(assignError.message || "The assignment could not be sent.");
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop">
      <form className="modal assignment-modal" onSubmit={submit}>
        <div className="panel-title">
          <div><span className="eyebrow">COMMAND DISPATCH</span><h2>Assign incident</h2></div>
          <button type="button" className="icon-btn" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="assignment-incident-card">
          <b>{incident.title}</b>
          <span>{incident.reportType} · {incident.severity} · {incident.status}</span>
          <small>{[incident.lga, incident.ward, incident.pollingUnit].filter(Boolean).join(" • ") || `${Number(incident.lat).toFixed(5)}, ${Number(incident.lng).toFixed(5)}`}</small>
        </div>
        <label>Assign to<select required value={assignedUserId} onChange={(event) => setAssignedUserId(event.target.value)}><option value="">Choose field personnel</option>{candidates.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.role}{user.pollingUnit ? ` · ${user.pollingUnit}` : ""}</option>)}</select></label>
        <label>Operational instruction<textarea required rows="4" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="State what must be checked, what evidence is required, and when to report back." /></label>
        {error && <p className="error">{error}</p>}
        <div className="actions"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Sending…" : "Assign & notify"}</button></div>
      </form>
    </div>
  );
}
