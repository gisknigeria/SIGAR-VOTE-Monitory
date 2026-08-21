import { FaCheck, FaComments, FaTimes } from "react-icons/fa";

export default function IncidentNotificationModal({ notification, incident, users = [], onClose, onOpenChat, onResolve }) {
  const reporter = users.find((user) => user.id === incident?.createdBy)?.name || "Field reporter";
  return (
    <div className="modal-backdrop">
      <section className="modal notification-detail-modal">
        <div className="panel-title">
          <div><span className="eyebrow">FIELD ASSIGNMENT</span><h2>{notification.incidentType || "Command notification"}</h2></div>
          <button type="button" className="icon-btn" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="command-message"><span>Instruction from command</span><p>{notification.message}</p></div>
        {incident ? <>
          <div className="notification-incident-grid">
            <div><span>Incident</span><b>{incident.title}</b></div><div><span>Severity</span><b>{incident.severity}</b></div>
            <div><span>Status</span><b>{incident.status}</b></div><div><span>Reported by</span><b>{reporter}</b></div>
            <div><span>LGA / Ward</span><b>{[incident.lga, incident.ward].filter(Boolean).join(" / ") || "Not supplied"}</b></div><div><span>Polling unit</span><b>{incident.pollingUnit || "Not supplied"}</b></div>
          </div>
          <p className="notification-description">{incident.description || "No written incident description was supplied."}</p>
          {incident.media?.length > 0 && <div className="notification-media">{incident.media.map((item, index) => item.type === "image" ? <a href={item.data} target="_blank" rel="noreferrer" key={index}><img src={item.data} alt={item.name || "Incident evidence"} /></a> : <a href={item.data} target="_blank" rel="noreferrer" key={index}>{item.name || `Evidence ${index + 1}`}</a>)}</div>}
        </> : <p className="muted">Incident details are being synchronized.</p>}
        <div className="actions">
          <button type="button" className="ghost" onClick={() => onOpenChat(incident || notification)} disabled={!incident}><FaComments /> Report situation</button>
          <button type="button" className="primary" onClick={() => onResolve(incident)} disabled={!incident}><FaCheck /> Mark resolved</button>
        </div>
      </section>
    </div>
  );
}
