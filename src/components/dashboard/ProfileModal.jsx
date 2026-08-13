import { useState } from "react";
import { FaTimes } from "react-icons/fa";

export default function ProfileModal({ session, onClose, onSave }) {
  const [form, setForm] = useState({
    name: session.user.name || "",
    email: session.user.email || "",
    station: session.user.station || "",
    password: "",
  });
  const [error, setError] = useState("");

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
            minLength="6"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Leave blank to keep current password"
          />
        </label>

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
