import { useState } from "react";
import { FaTimes } from "react-icons/fa";

export default function ProfileModal({ session, onClose, onSave }) {
  const parseWardList = (value) =>
    String(value || "")
      .split(",")
      .map((ward) => ward.trim())
      .filter(Boolean);
  const [form, setForm] = useState({
    name: session.user.name || "",
    email: session.user.email || "",
    station: session.user.station || "",
    password: "",
    currentPassword: "",
  });
  const [error, setError] = useState("");
  const roleLabel = session.user.role === "Supervisor" ? "Ward Supervisor" : session.user.role;
  const wardList = parseWardList(session.user.ward);

  return (
    <div className="modal-backdrop">
      <form
        className="modal profile-modal"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");

          try {
            await onSave(form);
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        <div className="panel-title">
          <div>
            <span className="eyebrow">PROFILE</span>
            <h2>Profile</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="profile-role-row">
          <strong>{roleLabel}</strong>
          {session.user.lga && <span>{session.user.lga}</span>}
        </div>
        {session.user.role === "Supervisor" && wardList.length > 0 && (
          <div className="profile-ward-summary">
            <span>Wards supervised</span>
            <strong>{wardList.join(" • ")}</strong>
          </div>
        )}

        <label>
          Name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>

        <label>
          Email
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>

        <label>
          Contact / call sign
          <input
            value={form.station}
            onChange={(e) => setForm({ ...form, station: e.target.value })}
          />
        </label>

        <label>
          New password
          <input
            type="password"
            minLength="12"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Leave blank to keep current password"
          />
        </label>

        {form.password && <label>
          Current password
          <input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
          <small>New password: at least 12 characters, including uppercase, lowercase, a number, and a symbol.</small>
        </label>}

        {error && <div className="error">{error}</div>}

        <div className="actions">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="primary">Save</button>
        </div>
      </form>
    </div>
  );
}
