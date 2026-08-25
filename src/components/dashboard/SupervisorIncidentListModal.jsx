import { useMemo, useState } from "react";
import { FaTimes, FaCheckCircle, FaClipboardList, FaUserCheck } from "react-icons/fa";
import { getRegistrationLocationOptions } from "../../../shared/electionData.js";

export default function SupervisorIncidentListModal({
  incidents = [],
  currentUser,
  users,
  onClose,
  onAssign,
  onClaim,
}) {
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAssignment, setFilterAssignment] = useState("all");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const scopeLabel = useMemo(() => {
    const assigned = String(currentUser?.ward || "").split(",").map((ward) => ward.trim()).filter(Boolean);
    const lgaWards = getRegistrationLocationOptions(currentUser?.state, currentUser?.lga).wards || [];
    const assignedKeys = new Set(assigned.map((ward) => ward.toLowerCase()));
    const wholeLga = lgaWards.length > 0 && lgaWards.every((ward) => assignedKeys.has(ward.toLowerCase()));
    if (wholeLga) return `${currentUser?.lga} LGA`;
    return assigned.join(" • ") || currentUser?.lga || "Your Assigned Area";
  }, [currentUser]);

  // The API already returns the supervisor's assigned ward(s), plus anything
  // directly assigned to them. Keep that server-authoritative scope here.
  const wardIncidents = useMemo(() => {
    return incidents;
  }, [incidents]);

  // Apply status and assignment filters
  const filteredIncidents = useMemo(() => {
    let filtered = wardIncidents;

    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter((i) => i.status === filterStatus);
    }

    // Filter by assignment
    if (filterAssignment === "assigned-to-me") {
      filtered = filtered.filter((i) => i.assignedTo === currentUser.id);
    } else if (filterAssignment === "unassigned") {
      filtered = filtered.filter((i) => !i.assignedTo);
    } else if (filterAssignment === "assigned-to-others") {
      filtered = filtered.filter((i) => i.assignedTo && i.assignedTo !== currentUser.id);
    }

    return filtered;
  }, [wardIncidents, filterStatus, filterAssignment, currentUser.id]);

  // Get available agents and supervisors for assignment
  const availableUsers = useMemo(() => {
    return users
      .filter((u) => ["Agent", "Supervisor"].includes(u.role))
      .filter((u) => u.id !== currentUser.id); // Don't show self
  }, [users, currentUser.id]);

  const getAssignedUserName = (userId) => {
    const user = users.find((u) => u.id === userId);
    return user ? (user.rank ? `${user.rank} ${user.name}` : user.name) : "Unknown";
  };

  const handleClaim = async (incident) => {
    setError("");
    try {
      await onClaim(incident.id);
      setSelectedIncident(null);
    } catch (err) {
      setError(err.message || "Failed to claim incident. Please try again.");
    }
  };

  const handleAssignClick = (incident) => {
    setSelectedIncident(incident);
    setAssignModalOpen(true);
    setMessage("");
    setAssignedUserId("");
  };

  const handleSubmitAssign = async (e) => {
    e.preventDefault();
    setError("");

    if (!assignedUserId) {
      setError("Please select a person to assign this incident to.");
      return;
    }

    if (!message.trim()) {
      setError("Please enter a message for the assignment.");
      return;
    }

    setLoading(true);
    try {
      await onAssign({
        incidentId: selectedIncident.id,
        assignedUserId,
        message: message.trim(),
      });
      setAssignModalOpen(false);
      setSelectedIncident(null);
    } catch (err) {
      setError(err.message || "Failed to assign incident. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "Critical":
        return "#ef4444";
      case "High":
        return "#fb923c";
      case "Medium":
        return "#facc15";
      case "Low":
        return "#38bdf8";
      default:
        return "#6b7280";
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal supervisor-incidents-modal" style={{ maxWidth: "900px", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div className="modal-header">
          <h2>Incidents in {scopeLabel}</h2>
          <button className="icon-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-content" style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          {/* Filters */}
          <div className="incident-filters" style={{ marginBottom: "1rem", padding: "0 1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="filter-group">
              <label>Status:</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">All Statuses</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Assignment:</label>
              <select value={filterAssignment} onChange={(e) => setFilterAssignment(e.target.value)}>
                <option value="all">All Incidents</option>
                <option value="unassigned">Unassigned</option>
                <option value="assigned-to-me">Assigned to Me</option>
                <option value="assigned-to-others">Assigned to Others</option>
              </select>
            </div>
          </div>

          {/* Incidents List */}
          <div style={{ flex: 1, overflow: "auto", borderTop: "1px solid #6d2638" }}>
            {filteredIncidents.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
                <FaClipboardList size={32} style={{ marginBottom: "1rem", opacity: 0.5 }} />
                <p>No incidents found in this filter</p>
              </div>
            ) : (
              <div style={{ padding: "0.5rem" }}>
                {filteredIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    style={{
                      padding: "1rem",
                      marginBottom: "0.5rem",
                      border: "1px solid #6d2638",
                      borderRadius: "0.375rem",
                      backgroundColor: "#210b13",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.backgroundColor = "#35121c";
                      e.currentTarget.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem" }}>
                          <span
                            style={{
                              display: "inline-block",
                              width: "12px",
                              height: "12px",
                              borderRadius: "50%",
                              backgroundColor: getSeverityColor(incident.severity),
                            }}
                          />
                          <strong>{incident.title || incident.reportType}</strong>
                          <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                            ({incident.reportType})
                          </span>
                        </div>
                        <p style={{ margin: "0.25rem 0", fontSize: "0.875rem", color: "#6b7280" }}>
                          {incident.description}
                        </p>
                        <p style={{ margin: "0.25rem 0", fontSize: "0.75rem", color: "#9ca3af" }}>
                          {incident.lga} • {incident.ward}
                          {incident.pollingUnit && ` • ${incident.pollingUnit}`}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.25rem 0.75rem",
                            backgroundColor:
                              incident.status === "Resolved"
                                ? "#193b2b"
                                : incident.status === "In Progress"
                                  ? "#3c2c09"
                                  : "#35121c",
                            color:
                              incident.status === "Resolved"
                                ? "#86efac"
                                : incident.status === "In Progress"
                                  ? "#fde68a"
                                  : "#f5dc9a",
                            borderRadius: "0.25rem",
                            fontSize: "0.75rem",
                            fontWeight: "500",
                          }}
                        >
                          {incident.status}
                        </span>
                      </div>
                    </div>

                    {/* Assignment info */}
                    <div style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.75rem" }}>
                      {incident.assignedTo ? (
                        <span>
                          <strong>Assigned to:</strong> {getAssignedUserName(incident.assignedTo)}
                          {incident.assignedTo === currentUser.id && (
                            <span style={{ color: "#059669", fontWeight: "500" }}> (You)</span>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: "#dc2626" }}>
                          <strong>Unassigned</strong>
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      {!incident.assignedTo && (
                        <button
                          type="button"
                          onClick={() => handleClaim(incident)}
                          style={{
                            padding: "0.5rem 1rem",
                            backgroundColor: "#6d2638",
                            color: "white",
                            border: "none",
                            borderRadius: "0.375rem",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <FaUserCheck size={14} /> Claim
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAssignClick(incident)}
                        style={{
                          padding: "0.5rem 1rem",
                          backgroundColor: incident.assignedTo ? "#842044" : "#6d2638",
                          color: "white",
                          border: "none",
                          borderRadius: "0.375rem",
                          cursor: "pointer",
                          fontSize: "0.875rem",
                        }}
                      >
                        {incident.assignedTo ? "Reassign" : "Assign"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Assign Modal */}
        {assignModalOpen && selectedIncident && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: "#16080e",
                borderRadius: "0.5rem",
                padding: "1.5rem",
                maxWidth: "500px",
                width: "90%",
                maxHeight: "90vh",
                overflow: "auto",
              }}
            >
              <h3 style={{ marginTop: 0 }}>Assign Incident</h3>
              <p style={{ color: "#6b7280" }}>
                <strong>{selectedIncident.title || selectedIncident.reportType}</strong>
              </p>

              <form onSubmit={handleSubmitAssign}>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                    Assign to:
                  </label>
                  <select
                    value={assignedUserId}
                    onChange={(e) => setAssignedUserId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "1px solid #6d2638",
                      borderRadius: "0.375rem",
                    }}
                  >
                    <option value="">Select a person...</option>
                    {availableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.rank ? `${user.rank} ${user.name}` : user.name} ({user.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                    Message:
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter a message about this assignment..."
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "1px solid #6d2638",
                      borderRadius: "0.375rem",
                      fontFamily: "inherit",
                      fontSize: "1rem",
                      minHeight: "100px",
                    }}
                  />
                </div>

                {error && (
                  <div style={{ color: "#dc2626", marginBottom: "1rem", fontSize: "0.875rem" }}>
                    {error}
                  </div>
                )}

                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAssignModalOpen(false);
                      setError("");
                    }}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: "#35121c",
                      color: "#f5dc9a",
                      border: "none",
                      borderRadius: "0.375rem",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !assignedUserId}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: loading || !assignedUserId ? "#6b4452" : "#842044",
                      color: "white",
                      border: "none",
                      borderRadius: "0.375rem",
                      cursor: loading || !assignedUserId ? "not-allowed" : "pointer",
                    }}
                  >
                    {loading ? "Assigning..." : "Assign"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
