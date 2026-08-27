import { useState } from "react";
import { FaBell } from "react-icons/fa";

export default function NotificationCenter({
  notifications,
  unreadCount,
  onNotificationClick,
}) {
  const [panelOpen, setPanelOpen] = useState(false);

  const handleBellClick = () => {
    setPanelOpen(!panelOpen);
  };

  const handleNotificationClick = (notification) => {
    setPanelOpen(false);
    onNotificationClick(notification);
  };

  return (
    <div className="notification-center">
      <button
        className={`notification-bell ${unreadCount > 0 ? "has-unread" : ""}`}
        onClick={handleBellClick}
        title={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
            : "Notifications"
        }
      >
        <FaBell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {panelOpen && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <span className="unread-badge">{unreadCount} unread</span>
            )}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="empty-notifications">
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  className={`notification-item ${
                    !notification.read ? "unread" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-content">
                    <p className="notification-title">
                      {notification.incidentType || "Incident Assignment"}
                    </p>
                    <p className="notification-preview">
                      {notification.message?.substring(0, 60) ||
                        "You have a new incident assignment"}
                      {(notification.message?.length || 0) > 60 ? "..." : ""}
                    </p>
                    <p className="notification-time">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="notification-unread-dot" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
