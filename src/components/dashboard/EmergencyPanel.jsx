import { useState } from "react";
import { FaTimes } from "react-icons/fa";

const EMERGENCY_TYPES = [
  "Vote Buying",
  "Thuggery and Violence",
  "Voter Intimidation",
  "Collusion",
  "Compromised Privacy",
  "Over-voting",
  "Late Opening",
  "Material Shortages",
  "Missing Registers",
  "Lack of Crowd Control",
  "BVAS Failure",
  "Network Connectivity",
  "Battery Depletion",
];

export default function EmergencyPanel({ onClose, onSend }) {
  const [type, setType] = useState(EMERGENCY_TYPES[0]);
  const [custom, setCustom] = useState("");

  const submit = (e) => {
    e.preventDefault();
    onSend({
      type,
      text: custom,
    });
  };

  return (
    <div className="modal-backdrop">
      <form className="modal emergency-send-modal" onSubmit={submit}>
        <div className="panel-title">
          <div>
            <span className="eyebrow">FIELD EMERGENCY</span>
            <h2>Send SOS alert</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <label>
          Emergency type
          <select required value={type} onChange={(e) => setType(e.target.value)}>
            {EMERGENCY_TYPES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Optional message
          <textarea
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Add any detail, or leave blank"
          />
        </label>
        <button className="emergency-submit">Send emergency now</button>
      </form>
    </div>
  );
}
