import { useEffect, useMemo, useState } from "react";
import {
  FaBullseye,
  FaKey,
  FaTimes,
} from "react-icons/fa";
import {
  MdLocationPin,
  MdPlace,
  MdPushPin,
  MdHome,
  MdBusiness,
  MdSchool,
  MdLocalHospital,
  MdAccountBalance,
  MdFactory,
  MdStore,
  MdMosque,
  MdChurch,
  MdLocalGasStation,
  MdDirectionsBus,
  MdTrain,
  MdFlight,
  MdAnchor,
  MdLocalShipping,
  MdConstruction,
  MdTraffic,
  MdLocalParking,
  MdVideocam,
  MdSettingsInputAntenna,
  MdFlashOn,
  MdLocalFireDepartment,
  MdWaterDrop,
  MdPark,
  MdGrass,
  MdTerrain,
  MdSignpost,
  MdSecurity,
  MdWarning,
  MdOutlineRadio,
  MdAccessible,
  MdRecycling,
  MdPolyline,
  MdHexagon,
  MdImage,
  MdFilterHdr,
} from "react-icons/md";
import {
  DEFAULT_REGISTRATION_STATE,
  NIGERIA_STATES,
  POLLING_UNITS,
  STATE_CODE_TO_NAME,
  normalizeRegistrationState,
  getRegistrationLocationOptions,
} from "../../../shared/electionData.js";

const severityColor = {
  Low: "#38bdf8",
  Medium: "#facc15",
  High: "#fb923c",
  Critical: "#ef4444",
};

const POINT_ICONS = [
  { key: "pin", label: "Pin", Component: MdLocationPin },
  { key: "place", label: "Place", Component: MdPlace },
  { key: "pushpin", label: "Push Pin", Component: MdPushPin },
  { key: "home", label: "Home", Component: MdHome },
  { key: "business", label: "Building", Component: MdBusiness },
  { key: "school", label: "School", Component: MdSchool },
  { key: "hospital", label: "Hospital", Component: MdLocalHospital },
  { key: "bank", label: "Bank", Component: MdAccountBalance },
  { key: "factory", label: "Factory", Component: MdFactory },
  { key: "store", label: "Store", Component: MdStore },
  { key: "mosque", label: "Mosque", Component: MdMosque },
  { key: "church", label: "Church", Component: MdChurch },
  { key: "fuel", label: "Fuel", Component: MdLocalGasStation },
  { key: "busstop", label: "Bus Stop", Component: MdDirectionsBus },
  { key: "train", label: "Train", Component: MdTrain },
  { key: "airport", label: "Airport", Component: MdFlight },
  { key: "anchor", label: "Anchor", Component: MdAnchor },
  { key: "truck", label: "Truck", Component: MdLocalShipping },
  { key: "construction", label: "Construction", Component: MdConstruction },
  { key: "traffic", label: "Traffic", Component: MdTraffic },
  { key: "parking", label: "Parking", Component: MdLocalParking },
  { key: "camera", label: "Camera", Component: MdVideocam },
  { key: "antenna", label: "Antenna", Component: MdSettingsInputAntenna },
  { key: "electric", label: "Electric", Component: MdFlashOn },
  { key: "fire", label: "Fire", Component: MdLocalFireDepartment },
  { key: "water", label: "Water", Component: MdWaterDrop },
  { key: "park", label: "Park", Component: MdPark },
  { key: "vegetation", label: "Vegetation", Component: MdGrass },
  { key: "terrain", label: "Terrain", Component: MdTerrain },
  { key: "bridge", label: "Bridge", Component: MdSignpost },
  { key: "security", label: "Security", Component: MdSecurity },
  { key: "warning", label: "Warning", Component: MdWarning },
  { key: "radiation", label: "Radiation", Component: MdOutlineRadio },
  { key: "accessible", label: "Accessible", Component: MdAccessible },
  { key: "recycle", label: "Recycle", Component: MdRecycling },
];

const INCIDENT_TYPES = [
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

const POLLING_RESULT_TYPE = "Polling Unit Result";
const COMMAND_PARTY = "Party";
const REPORT_TYPES = [...INCIDENT_TYPES, POLLING_RESULT_TYPE];
const REPORT_TYPE_STYLES = {
  "BS-Black Spot": {
    icon: "BS",
    color: "#dc2626",
    fillColor: "#ef4444",
    opacity: 0.75,
    fillOpacity: 0.22,
    geometryType: "circle",
    radius: 350,
  },
  "KP-Key Point": {
    icon: "KP",
    color: "#2563eb",
    fillColor: "#60a5fa",
    opacity: 0.8,
    fillOpacity: 0.16,
  },
  "VP-Vulnerable Point": {
    icon: "VP",
    color: "#f59e0b",
    fillColor: "#fbbf24",
    opacity: 0.8,
    fillOpacity: 0.18,
  },
  "POI-Point of Interest": {
    icon: "POI",
    color: "#8b5cf6",
    fillColor: "#a78bfa",
    opacity: 0.8,
    fillOpacity: 0.16,
  },
  "IP-Incident Point": {
    icon: "IP",
    color: "#ef4444",
    fillColor: "#f87171",
    opacity: 0.85,
    fillOpacity: 0.16,
  },
  "SOS-Emergency": {
    icon: "SOS",
    color: "#dc2626",
    fillColor: "#ef4444",
    opacity: 0.95,
    fillOpacity: 0.24,
  },
  Custom: {
    icon: "custom",
    color: "#38bdf8",
    fillColor: "#7dd3fc",
    opacity: 0.8,
    fillOpacity: 0.16,
  },
};

const REPORT_TYPE_ICONS = {
  "BS-Black Spot": FaBullseye,
  "KP-Key Point": FaKey,
  "VP-Vulnerable Point": MdWarning,
  "POI-Point of Interest": MdPlace,
  "IP-Incident Point": MdLocationPin,
  "SOS-Emergency": MdWarning,
  BS: FaBullseye,
  KP: FaKey,
  VP: MdWarning,
  POI: MdPlace,
  IP: MdLocationPin,
  SOS: MdWarning,
  custom: MdHexagon,
  Custom: MdHexagon,
};

const ReportIcon = ({ iconKey, size = 14, color = "currentColor" }) => {
  const pointEntry = POINT_ICONS.find((p) => p.key === iconKey);
  if (pointEntry?.Component) {
    const Icon = pointEntry.Component;
    return <Icon size={size} color={color} />;
  }
  const Icon = REPORT_TYPE_ICONS[iconKey] || REPORT_TYPE_ICONS.Custom;
  return <Icon size={size} color={color} aria-hidden="true" focusable="false" />;
};

const ReportTypeIcon = ({ type, size = 14, color = "currentColor" }) => {
  return <ReportIcon iconKey={type} size={size} color={color} />;
};

export function PollingResultForm({ user, point, parties, onClose, onSave }) {
  const [rows, setRows] = useState([{ party: parties[0] || "", votes: "" }]);
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");
  const submittedAt = useMemo(() => new Date(), []);

  useEffect(() => {
    setRows((current) =>
      current.map((row) =>
        parties.includes(row.party) ? row : { ...row, party: parties[0] || "" },
      ),
    );
  }, [parties]);

  const addPhoto = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      return setError("Choose an image not larger than 8MB.");
    }
    const reader = new FileReader();
    reader.onload = () =>
      setPhoto({
        name: file.name,
        type: "image",
        size: file.size,
        data: reader.result,
      });
    reader.readAsDataURL(file);
  };

  return (
    <div className="modal-backdrop">
      <form
        className="modal polling-result-modal"
        onSubmit={(event) => {
          event.preventDefault();
          const results = rows
            .filter((row) => row.party && row.votes !== "")
            .map((row) => ({ party: row.party, votes: Number(row.votes) }));
          if (!results.length) return setError("Add at least one party and vote number.");
          if (!photo) return setError("A photograph of the signed result is required.");
          onSave({
            state: user.state,
            pollingUnit: user.pollingUnit,
            lga: user.lga,
            ward: user.ward,
            lat: point.lat,
            lng: point.lng,
            results,
            media: [photo],
          });
        }}
      >
        <div className="panel-title">
          <div>
            <span className="eyebrow">POLLING UNIT RESULT</span>
            <h2>Submit election result</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="result-capture-meta">
          <div><span>Registered polling unit</span><b>{user.pollingUnit || "Not assigned"}</b></div>
          <div><span>Current location</span><b>{Number(point.lat).toFixed(6)}, {Number(point.lng).toFixed(6)}</b></div>
          <div><span>Sending time</span><b>{submittedAt.toLocaleString()}</b></div>
        </div>
        {!parties.length && <div className="error">Admin must upload the political-party list before results can be submitted.</div>}
        <div className="party-vote-rows">
          {rows.map((row, index) => (
            <div className="party-vote-row" key={index}>
              <select
                required
                value={row.party}
                onChange={(e) =>
                  setRows((old) => old.map((item, i) => (i === index ? { ...item, party: e.target.value } : item)))
                }
              >
                <option value="">Select party</option>
                {parties.map((party) => <option key={party}>{party}</option>)}
              </select>
              <input
                required
                type="number"
                min="0"
                step="1"
                value={row.votes}
                onChange={(e) =>
                  setRows((old) => old.map((item, i) => (i === index ? { ...item, votes: e.target.value } : item)))
                }
                placeholder="Votes"
              />
              <button type="button" onClick={() => setRows((old) => old.filter((_, i) => i !== index))}><FaTimes /></button>
            </div>
          ))}
        </div>
        <button type="button" className="ghost add-party-result" disabled={!parties.length} onClick={() => setRows((old) => [...old, { party: parties.find((p) => !old.some((row) => row.party === p)) || "", votes: "" }])}>Add another party</button>
        <label className="capture-btn result-photo">
          Photograph signed result
          <input type="file" accept="image/*" capture="environment" onChange={(e) => addPhoto(e.target.files?.[0])} />
        </label>
        {photo && <div className="result-photo-ready">Photo ready: {photo.name}</div>}
        {error && <div className="error">{error}</div>}
        <div className="actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!parties.length}>Submit result now</button>
        </div>
      </form>
    </div>
  );
}

export function PartyManager({ parties, onClose, onSave }) {
  const [text, setText] = useState(parties.join("\n"));
  const loadFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ""));
    reader.readAsText(file);
  };

  return (
    <div className="modal-backdrop">
      <form
        className="modal party-manager-modal"
        onSubmit={(e) => {
          e.preventDefault();
          onSave([...new Set(text.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean))]);
        }}
      >
        <div className="panel-title">
          <div><span className="eyebrow">ADMIN SETUP</span><h2>Political parties</h2></div>
          <button type="button" className="icon-btn" onClick={onClose}><FaTimes /></button>
        </div>
        <p className="muted">Enter one party per line, paste a comma-separated list, or upload a CSV/TXT file. Field reporters can only select from this list.</p>
        <label className="capture-btn">
          Upload party list
          <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => loadFile(e.target.files?.[0])} />
        </label>
        <label>
          Party list
          <textarea required value={text} onChange={(e) => setText(e.target.value)} placeholder={"Party 1\nParty 2\nParty 3"} />
        </label>
        <div className="actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary">Save party list</button>
        </div>
      </form>
    </div>
  );
}

export function IncidentForm({ point, users, onClose, onSave, isAdmin, currentUser }) {
  const initialType = point.reportType || INCIDENT_TYPES[0];
  const initialStyle = {
    ...REPORT_TYPE_STYLES[initialType],
    ...(point.style || {}),
  };
  const center = point.geometry?.type === "circle"
    ? { lat: point.geometry.center[0], lng: point.geometry.center[1] }
    : point.geometry?.type === "freehand" && point.geometry.points?.length
      ? {
          lat: point.geometry.points.reduce((sum, p) => sum + p[0], 0) / point.geometry.points.length,
          lng: point.geometry.points.reduce((sum, p) => sum + p[1], 0) / point.geometry.points.length,
        }
      : point;

  const [customTypes, setCustomTypes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("report-custom-types") || "[]");
    } catch {
      return [];
    }
  });
  const [customTypeName, setCustomTypeName] = useState("");
  const [pollingUnit, setPollingUnit] = useState(String(point?.pollingUnit || currentUser?.pollingUnit || ""));
  const [resultCount, setResultCount] = useState(String(point?.resultCount || ""));
  const [form, setForm] = useState({
    title: "",
    description: "",
    reportType: initialType,
    severity: "High",
    status: "Open",
    assignedTo: "",
    visibleTo: [],
    media: [],
    geometry: point.geometry || null,
    style: initialStyle,
    lat: center.lat,
    lng: center.lng,
  });
  const [mediaError, setMediaError] = useState("");
  const isResultReport = form.reportType === POLLING_RESULT_TYPE;
  const isFieldRestricted = ["Agent", "Supervisor"].includes(currentUser?.role);
  const officerOptions = users.filter((user) => ["Response Team", "Agent"].includes(user.role));
  const reportTypeOptions = useMemo(() => REPORT_TYPES, [customTypes, isAdmin]);
  const named = (user) => (user.rank ? `${user.rank} ${user.name}` : user.name);

  const addMedia = (files) => {
    setMediaError("");
    let remainingBytes = 10 * 1024 * 1024 - form.media.reduce((sum, item) => sum + Number(item.size || 0), 0);
    [...files].slice(0, 6 - form.media.length).forEach((file) => {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) return;
      if (file.size > 8 * 1024 * 1024) {
        setMediaError("Each photo or video must be 8MB or smaller.");
        return;
      }
      if (file.size > remainingBytes) {
        setMediaError("Attachments can be up to 10MB in total per incident.");
        return;
      }
      remainingBytes -= file.size;
      const reader = new FileReader();
      reader.onload = () =>
        setForm((old) => ({
          ...old,
          media: [...old.media, { name: file.name, type: file.type.startsWith("video/") ? "video" : "image", size: file.size, data: reader.result }].slice(0, 6),
        }));
      reader.readAsDataURL(file);
    });
  };

  const removeMedia = (index) =>
    setForm((old) => ({ ...old, media: old.media.filter((_, i) => i !== index) }));

  const updateVisible = (event) =>
    setForm({ ...form, visibleTo: [...event.target.selectedOptions].map((option) => option.value) });

  const updateType = (type) => {
    setForm((old) => ({
      ...old,
      reportType: type,
      style: { ...old.style, ...(REPORT_TYPE_STYLES[type] || REPORT_TYPE_STYLES.Custom) },
    }));
    if (type !== "Custom") setCustomTypeName("");
  };

  const updateStyle = (changes) =>
    setForm((old) => ({ ...old, style: { ...old.style, ...changes } }));

  return (
    <div className="modal-backdrop">
      <form
        className="modal report-modal"
        onSubmit={(e) => {
          e.preventDefault();
          if (isResultReport && !form.media.some((item) => item.type === "image")) {
            setMediaError("A clear photograph of the signed polling-unit result is required.");
            return;
          }
          const nextType = form.reportType === "Custom" && customTypeName.trim() ? customTypeName.trim() : form.reportType;
          if (form.reportType === "Custom" && customTypeName.trim()) {
            const nextCustomTypes = [...new Set([customTypeName.trim(), ...customTypes])];
            localStorage.setItem("report-custom-types", JSON.stringify(nextCustomTypes));
            setCustomTypes(nextCustomTypes);
          }
          const normalizedPollingUnit = pollingUnit.trim();
          const normalizedResultCount = resultCount.trim();
          onSave({
            ...form,
            title: isResultReport ? `Polling Unit Result - ${normalizedPollingUnit}` : form.title,
            description: isResultReport
              ? `Polling unit: ${normalizedPollingUnit}\n\n${COMMAND_PARTY} vote count:\n${normalizedResultCount}`
              : form.description,
            reportType: nextType,
            pollingUnit: normalizedPollingUnit,
            resultCount: normalizedResultCount,
            lga: currentUser?.lga || "",
            ward: currentUser?.ward || "",
          });
        }}
      >
        <div className="panel-title">
          <div>
            <span className="eyebrow">{isResultReport ? "ELECTION RESULT" : "NEW FIELD INCIDENT"}</span>
            <h2>{isResultReport ? "Report polling unit result" : "Create incident"}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="two-col">
          <label>
            Incident category
            <span className="report-category-select">
              <ReportTypeIcon type={form.reportType} size={17} color={form.style.color} />
              <select value={form.reportType} onChange={(e) => updateType(e.target.value)}>
                {reportTypeOptions.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </span>
          </label>
          <label>
            Severity
            <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              {Object.keys(severityColor).map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
        </div>
        {isResultReport ? (
          <>
            <label>
              Polling unit
              <select
                required
                autoFocus
                value={pollingUnit}
                onChange={(e) => setPollingUnit(e.target.value)}
                disabled={currentUser?.role === "Agent"}
              >
                <option value="">Select polling unit</option>
                {currentUser?.pollingUnit && !POLLING_UNITS.includes(currentUser.pollingUnit) && <option>{currentUser.pollingUnit}</option>}
                {POLLING_UNITS.map((unit) => <option key={unit}>{unit}</option>)}
              </select>
            </label>
            <label>
              {COMMAND_PARTY} vote count
              <input required type="number" min="0" step="1" value={resultCount} onChange={(e) => setResultCount(e.target.value)} placeholder={`Enter ${COMMAND_PARTY} votes only, e.g. 120`} />
            </label>
          </>
        ) : (
          <>
            <label>
              Incident title
              <input required autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What is happening or what is this point?" />
            </label>
            <label>
              Notes
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Write statement, observation, instructions or evidence notes..." />
            </label>
          </>
        )}
        {!isFieldRestricted && (
          <div className="report-style-box">
            <div className="report-style-preview" style={{ "--pin": form.style.color, "--fill": form.style.fillColor, opacity: form.style.opacity }}>
              <span>
                <ReportIcon iconKey={form.style.icon || "IP"} size={16} color="#fff" />
              </span>
            </div>
            <label>
              Icon
              <select value={form.style.icon || "IP"} onChange={(e) => updateStyle({ icon: e.target.value })}>
                { ["BS", "KP", "VP", "POI", "IP", ...POINT_ICONS.map((icon) => icon.key)].map((icon) => {
                    const label = POINT_ICONS.find((p) => p.key === icon)?.label || icon;
                    return <option key={icon} value={icon}>{label}</option>;
                  }) }
              </select>
            </label>
            {form.reportType === "Custom" && (
              <label>
                Describe this custom incident type
                <input required value={customTypeName} onChange={(e) => setCustomTypeName(e.target.value)} placeholder="e.g. Roadblock, Flooding, Security sweep" />
              </label>
            )}
            <label>
              Border color
              <input type="color" value={form.style.color} onChange={(e) => updateStyle({ color: e.target.value })} />
            </label>
            <label>
              Fill color
              <input type="color" value={form.style.fillColor || form.style.color} onChange={(e) => updateStyle({ fillColor: e.target.value })} />
            </label>
            <label>
              Transparency
              <input type="range" min="0.1" max="1" step="0.05" value={form.style.opacity ?? 0.8} onChange={(e) => updateStyle({ opacity: Number(e.target.value), fillOpacity: Math.max(0.05, Number(e.target.value) * 0.35) })} />
            </label>
          </div>
        )}
        {!isFieldRestricted && (
          <div className="two-col">
            <label>
              Assign responder
              <select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
                <option value="">Unassigned</option>
                {officerOptions.map((x) => <option value={x.id} key={x.id}>{named(x)}</option>)}
              </select>
            </label>
            <label>
              Who can see this incident
              <select className="report-viewer-select" multiple size={6} value={form.visibleTo} onChange={updateVisible}>
                {users.filter((x) => x.role !== "Super Admin").map((x) => (
                  <option value={x.id} key={x.id}>{named(x)}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="report-capture-row">
          <label className="capture-btn">
            {isResultReport ? "Photograph signed result" : "Snap photo"}
            <input type="file" accept="image/*" capture="environment" onChange={(e) => addMedia(e.target.files || [])} />
          </label>
          {!isResultReport && (
            <label className="capture-btn">
              Record video
              <input type="file" accept="video/*" capture="environment" onChange={(e) => addMedia(e.target.files || [])} />
            </label>
          )}
          {!isResultReport && (
            <label className="capture-btn">
              Attach media
              <input type="file" accept="image/*,video/*" multiple onChange={(e) => addMedia(e.target.files || [])} />
            </label>
          )}
        </div>
        {mediaError && <div className="error">{mediaError}</div>}
        {form.media.length > 0 && (
          <div className="report-media-list">
            {form.media.map((item, index) => (
              <button type="button" key={`${item.name}-${index}`} onClick={() => removeMedia(index)} title="Remove attachment">
                {item.type === "video" ? "VIDEO" : "PHOTO"} {index + 1}
              </button>
            ))}
          </div>
        )}
        <div className="coordinates">
          <b>{form.geometry ? `${form.geometry.type} incident area` : "Pinned location"}</b>
          <span>{form.lat.toFixed(5)}, {form.lng.toFixed(5)}</span>
        </div>
        <div className="actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary">{isResultReport ? "Submit polling unit result" : "Submit incident"}</button>
        </div>
      </form>
    </div>
  );
}

export function OfficerManager({
  users,
  currentUser,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onPassword,
  onRoleChange,
}) {
    const isSupervisor = currentUser.role === "Supervisor";
    const manageableRoles = currentUser.role === "Super Admin"
      ? ["Admin", "Response Team", "Supervisor", "Agent"]
      : ["Response Team", "Supervisor", "Agent"];
    const canEditAssignment = (user) => {
      if (user.role !== "Agent") return false;
      if (currentUser.role === "Super Admin" || currentUser.role === "Admin") return true;
      if (isSupervisor) {
        return (
          user.state === currentUser.state &&
          user.lga === currentUser.lga &&
          user.ward === currentUser.ward
        );
      }
      return false;
    };
    const defaultRole = manageableRoles[manageableRoles.length - 1];
    const stateOptions = useMemo(
      () => NIGERIA_STATES.map((stateCode) => ({
        code: stateCode,
        label: STATE_CODE_TO_NAME[stateCode] || stateCode,
      })),
      [],
    );
    const initialLocationOptions = getRegistrationLocationOptions(DEFAULT_REGISTRATION_STATE);
    const emptyForm = {
      id: "",
      name: "",
      email: "",
      password: "",
      rank: defaultRole,
      unit: "Field Team",
      unitType: "Field Team",
      command: "Oyo State Election Operations",
      division: "",
      station: "",
      state: isSupervisor ? currentUser.state : DEFAULT_REGISTRATION_STATE,
      lga: isSupervisor ? currentUser.lga : initialLocationOptions.lgas[0] || "",
      ward: isSupervisor ? currentUser.ward : initialLocationOptions.wards[0] || "",
      pollingUnit: isSupervisor
        ? currentUser.pollingUnit || initialLocationOptions.pollingUnits[0] || ""
        : initialLocationOptions.pollingUnits[0] || "",
      lat: "7.3775",
      lng: "3.9470",
      role: defaultRole,
    };
    const [form, setForm] = useState(emptyForm);
    const locationOptions = useMemo(
      () => getRegistrationLocationOptions(form.state, form.lga, form.ward),
      [form.state, form.lga, form.ward],
    );

    const handleStateChange = (value) => {
      const nextState = normalizeRegistrationState(value);
      const nextOptions = getRegistrationLocationOptions(nextState);
      const nextLga = nextOptions.lgas[0] || "";
      const nextWard = nextOptions.wards[0] || "";
      const nextPollingOptions = getRegistrationLocationOptions(nextState, nextLga, nextWard).pollingUnits;
      setForm((prev) => ({
        ...prev,
        state: nextState,
        lga: nextLga,
        ward: nextWard,
        pollingUnit: nextPollingOptions[0] || "",
      }));
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (form.id) {
        await onUpdate(form);
      } else {
        await onCreate(form);
      }
      setForm(emptyForm);
    };

    return (
      <div className="modal-backdrop">
        <div className="modal officer-manager-modal">
          <div className="panel-title">
            <div><span className="eyebrow">PERSONNEL</span><h2>Manage officers</h2></div>
            <button type="button" className="icon-btn" onClick={onClose}><FaTimes /></button>
          </div>
          <form onSubmit={handleSubmit} className="officer-form-grid">
            <label>Full name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={form.id ? "Leave blank to keep current" : "Set password"} /></label>
            <label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{manageableRoles.map((role) => <option key={role}>{role}</option>)}</select></label>
            <label>Rank<input value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} /></label>
            <label>Unit<input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></label>
            <label>Unit type<input value={form.unitType} onChange={(e) => setForm({ ...form, unitType: e.target.value })} /></label>
            <label>Station<input value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })} /></label>
            <label>State<select value={form.state} onChange={(e) => handleStateChange(e.target.value)}>{stateOptions.map((state) => <option key={state.code} value={state.code}>{state.label}</option>)}</select></label>
            <label>LGA<select value={form.lga} onChange={(e) => setForm((prev) => ({ ...prev, lga: e.target.value, ward: locationOptions.wards[0] || "", pollingUnit: getRegistrationLocationOptions(form.state, e.target.value, locationOptions.wards[0] || "").pollingUnits[0] || "" }))}>{(getRegistrationLocationOptions(form.state).lgas || []).map((lga) => <option key={lga}>{lga}</option>)}</select></label>
            <label>Ward<select value={form.ward} onChange={(e) => setForm((prev) => ({ ...prev, ward: e.target.value, pollingUnit: getRegistrationLocationOptions(form.state, prev.lga, e.target.value).pollingUnits[0] || "" }))}>{(getRegistrationLocationOptions(form.state, form.lga).wards || []).map((ward) => <option key={ward}>{ward}</option>)}</select></label>
            <label>Polling unit<select value={form.pollingUnit} onChange={(e) => setForm({ ...form, pollingUnit: e.target.value })}>{(locationOptions.pollingUnits || []).map((unit) => <option key={unit}>{unit}</option>)}</select></label>
            <label>Latitude<input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></label>
            <label>Longitude<input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></label>
            <div className="actions" style={{ gridColumn: "1 / -1" }}>
              <button type="button" className="ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="primary">{form.id ? "Save changes" : "Create officer"}</button>
            </div>
          </form>
        </div>
      </div>
    );
}
