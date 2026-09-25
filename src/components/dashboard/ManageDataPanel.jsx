import { FaTimes } from "react-icons/fa";
import PreElectionData from "./PreElectionData.jsx";

/**
 * Tools -> Manage Data: the pre-election uploads (survey, members, contacts, contact center
 * report, population / voter register), opened from the sidebar like Map Data.
 */
export default function ManageDataPanel({ authToken, onClose }) {
  return (
    <section className="camera-panel map-data-panel manage-data-panel" aria-label="Manage data">
      <div className="camera-head">
        <div>
          <span className="eyebrow">PRE-ELECTION DATA</span>
          <h2>Manage Data</h2>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><FaTimes /></button>
      </div>
      <PreElectionData authToken={authToken} />
    </section>
  );
}
