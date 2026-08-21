import { useEffect, useRef, useState } from "react";
import { FaBell, FaTimes } from "react-icons/fa";

export default function NotificationCenter({ notifications = [], onOpen }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const unread = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        type="button"
        className={`notification-bell ${unread ? "has-unread" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-label={`${unread} unread notifications`}
        title="Assignments and command notifications"
      >
        <FaBell />
        {unread > 0 && <span>{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <section className="notification-panel" aria-label="Notifications">
          <header>
            <div><b>Notifications</b><small>{unread ? `${unread} unread` : "All caught up"}</small></div>
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close notifications"><FaTimes /></button>
          </header>
          <div className="notification-list">
            {notifications.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`notification-item ${item.read ? "" : "unread"}`}
                onClick={() => { setOpen(false); onOpen(item); }}
              >
                <i />
                <span>
                  <b>{item.incidentType || "Command update"}</b>
                  <em>{item.message || "Open this notification for details."}</em>
                  <small>{item.createdAt ? new Date(item.createdAt).toLocaleString() : "Just now"}</small>
                </span>
              </button>
            ))}
            {!notifications.length && <p className="notification-empty">No notifications yet.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
