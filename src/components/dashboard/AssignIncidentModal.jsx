import { useEffect, useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { getRegistrationLocationOptions } from "../../../shared/electionData.js";

export default function AssignIncidentModal({
  incident,
  users,
  onClose,
  onAssign,
}) {
  const [message, setMessage] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [selectedLga, setSelectedLga] = useState("");
  const [selectedWard, setSelectedWard] = useState("");
  const [selectedPollingUnit, setSelectedPollingUnit] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Get available filters based on incident location
  const incidentState = incident?.state || "Oyo";

  // Get location options
  const stateOptions = useMemo(() => {
    return getRegistrationLocationOptions(incidentState);
  }, [incidentState]);

  const lgaOptions = useMemo(() => {
    return stateOptions.lgas || [];
  }, [stateOptions]);

  const wardOptions = useMemo(() => {
    if (!selectedLga) return [];
    return getRegistrationLocationOptions(incidentState, selectedLga).wards || [];
  }, [incidentState, selectedLga]);

  const pollingUnitOptions = useMemo(() => {
    if (!selectedLga || !selectedWard) return [];
    return getRegistrationLocationOptions(incidentState, selectedLga, selectedWard).pollingUnits || [];
  }, [incidentState, selectedLga, selectedWard]);

  // Filter available users based on selections
  const filteredUsers = useMemo(() => {
    const agentsAndSupervisors = users.filter((u) =>
      ["Agent", "Supervisor"].includes(u.role),
    );

    if (!selectedLga) return agentsAndSupervisors;

    let filtered = agentsAndSupervisors.filter(
      (u) =>
        u.lga &&
        u.lga.toLowerCase() === selectedLga.toLowerCase(),
    );

    if (selectedWard) {
      filtered = filtered.filter(
        (u) =>
          u.ward &&
          u.ward.toLowerCase() === selectedWard.toLowerCase(),
      );
    }

    if (selectedPollingUnit) {
      filtered = filtered.filter(
        (u) =>
          u.pollingUnit &&
          u.pollingUnit.toLowerCase() ===
            selectedPollingUnit.toLowerCase(),
      );
    }

    return filtered;
  }, [users, selectedLga, selectedWard, selectedPollingUnit]);

  const handleAssign = async (e) => {
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
        incidentId: incident.id,
        assignedUserId,
        message: message.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to assign incident. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal incident-assign-modal">
        <div className="modal-header">
          <h2>Assign Incident</h2>
          <button className="icon-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-content">
          <div className="incident-preview">
            <p className="incident-type">{incident?.reportType || "Incident"}</p>
            <p className="incident-title">{incident?.title || "Untitled"}</p>
            <p className="incident-location">{incident?.location?.displayName || incident?.location?.label || (Number.isFinite(Number(incident?.lat)) && Number.isFinite(Number(incident?.lng)) ? `${Number(incident.lat).toFixed(6)}, ${Number(incident.lng).toFixed(6)}` : "Unknown location")}</p>
            <div className="incident-assignment-summary">
              <span><b>State</b>{incident?.state || "Oyo"}</span>
              <span><b>LGA</b>{incident?.lga || "Not supplied"}</span>
              <span><b>Ward</b>{incident?.ward || "Not supplied"}</span>
              <span><b>Polling Unit</b>{incident?.pollingUnit || "Not supplied"}</span>
              <span><b>Severity</b>{incident?.severity || "Unknown"}</span>
              <span><b>Status</b>{incident?.status || "Open"}</span>
            </div>
            <p className="incident-assignment-description">{incident?.description || "No incident description supplied."}</p>
          </div>

          <form onSubmit={handleAssign}>
            {/* Filters */}
            <div className="assign-filters">
              <div className="filter-group">
                <label htmlFor="assign-lga">Local Government (LG)</label>
                <select
                  id="assign-lga"
                  value={selectedLga}
                  onChange={(e) => {
                    setSelectedLga(e.target.value);
                    setSelectedWard("");
                    setSelectedPollingUnit("");
                    setAssignedUserId("");
                  }}
                >
                  <option value="">All LGs</option>
                  {lgaOptions.map((lga) => (
                    <option key={lga} value={lga}>
                      {lga}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="assign-ward">Ward</label>
                <select
                  id="assign-ward"
                  value={selectedWard}
                  onChange={(e) => {
                    setSelectedWard(e.target.value);
                    setSelectedPollingUnit("");
                    setAssignedUserId("");
                  }}
                  disabled={!selectedLga}
                >
                  <option value="">All Wards</option>
                  {wardOptions.map((ward) => (
                    <option key={ward} value={ward}>
                      {ward}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="assign-polling-unit">Polling Unit</label>
                <select
                  id="assign-polling-unit"
                  value={selectedPollingUnit}
                  onChange={(e) => {
                    setSelectedPollingUnit(e.target.value);
                    setAssignedUserId("");
                  }}
                  disabled={!selectedLga || !selectedWard}
                >
                  <option value="">All Polling Units</option>
                  {pollingUnitOptions.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assignee Selection */}
            <div className="form-group">
              <label htmlFor="assign-to">Assign to:</label>
              <select
                id="assign-to"
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                required
              >
                <option value="">
                  {filteredUsers.length === 0
                    ? "No agents or supervisors available"
                    : "Select a person..."}
                </option>
                {filteredUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.rank ? `${user.rank} ${user.name}` : user.name} ({user.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Message Input */}
            <div className="form-group">
              <label htmlFor="assign-message">Message:</label>
              <textarea
                id="assign-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your message about this incident..."
                rows={4}
                required
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="modal-actions">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !assignedUserId}
                className="btn-primary"
              >
                {loading ? "Assigning..." : "Assign & Send"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
