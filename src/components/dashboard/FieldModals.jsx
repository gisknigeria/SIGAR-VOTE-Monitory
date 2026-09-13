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
  UNIT_TYPES,
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
  const [submitState, setSubmitState] = useState("idle");
  const submitting = submitState === "submitting";
  const isAgent = user.role === "Agent";
  const isSupervisor = user.role === "Supervisor";
  const canChooseZone = ["Admin", "Super Admin"].includes(user.role);
  const initialState = normalizeRegistrationState(user.state || DEFAULT_REGISTRATION_STATE);
  const initialStateOptions = getRegistrationLocationOptions(initialState);
  const initialLga = user.lga || initialStateOptions.lgas[0] || "";
  const initialWard = user.ward || getRegistrationLocationOptions(initialState, initialLga).wards[0] || "";
  const initialUnits = getRegistrationLocationOptions(initialState, initialLga, initialWard).pollingUnits;
  const [assignment, setAssignment] = useState({
    state: initialState,
    lga: initialLga,
    ward: initialWard,
    pollingUnit: isAgent ? (user.pollingUnit || "") : (initialUnits.includes(user.pollingUnit) ? user.pollingUnit : initialUnits[0] || ""),
  });
  const [rows, setRows] = useState([{ party: parties[0] || "", votes: "" }]);
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");
  const submittedAt = useMemo(() => new Date(), []);
  const stateOptions = useMemo(
    () => NIGERIA_STATES.map((code) => ({ code, label: STATE_CODE_TO_NAME[code] || code })),
    [],
  );
  const locationOptions = useMemo(
    () => getRegistrationLocationOptions(assignment.state, assignment.lga, assignment.ward),
    [assignment.state, assignment.lga, assignment.ward],
  );

  const changeState = (stateValue) => {
    const state = normalizeRegistrationState(stateValue);
    const lga = getRegistrationLocationOptions(state).lgas[0] || "";
    const ward = getRegistrationLocationOptions(state, lga).wards[0] || "";
    const pollingUnit = getRegistrationLocationOptions(state, lga, ward).pollingUnits[0] || "";
    setAssignment({ state, lga, ward, pollingUnit });
  };
  const changeLga = (lga) => {
    const ward = getRegistrationLocationOptions(assignment.state, lga).wards[0] || "";
    const pollingUnit = getRegistrationLocationOptions(assignment.state, lga, ward).pollingUnits[0] || "";
    setAssignment((current) => ({ ...current, lga, ward, pollingUnit }));
  };
  const changeWard = (ward) => {
    const pollingUnit = getRegistrationLocationOptions(assignment.state, assignment.lga, ward).pollingUnits[0] || "";
    setAssignment((current) => ({ ...current, ward, pollingUnit }));
  };

  useEffect(() => {
    setRows((current) =>
      current.map((row) =>
        parties.includes(row.party) ? row : { ...row, party: parties[0] || "" },
      ),
    );
  }, [parties]);

  const addPhoto = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_ATTACHMENT_BYTES) {
      return setError(`Choose an image not larger than ${MAX_ATTACHMENT_MB}MB.`);
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
        onInvalidCapture={() => setSubmitState("idle")}
        onSubmit={async (event) => {
          event.preventDefault();
          if (submitting) return;
          const results = rows
            .filter((row) => row.party && row.votes !== "")
            .map((row) => ({ party: row.party, votes: Number(row.votes) }));
          if (!results.length) {
            setSubmitState("idle");
            return setError("Add at least one party and vote number.");
          }
          if (!photo) {
            setSubmitState("idle");
            return setError("A photograph of the signed result is required.");
          }
          if (!assignment.pollingUnit) {
            setSubmitState("idle");
            return setError("Select the polling unit being reported.");
          }
          setSubmitState("submitting");
          try {
            await onSave({
              state: assignment.state,
              pollingUnit: assignment.pollingUnit,
              lga: assignment.lga,
              ward: assignment.ward,
              lat: point.lat,
              lng: point.lng,
              results,
              media: [photo],
            });
          } catch (saveError) {
            setError(saveError.message || "Could not submit the result. Please try again.");
          } finally {
            setSubmitState("idle");
          }
        }}
      >
        <div className="panel-title">
          <div>
            <span className="eyebrow">POLLING UNIT RESULT</span>
            <h2>Submit election result</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="result-assignment-grid">
          {canChooseZone && <label>State<select value={assignment.state} onChange={(event) => changeState(event.target.value)}>{stateOptions.map((state) => <option key={state.code} value={state.code}>{state.label}</option>)}</select></label>}
          {canChooseZone && <label>LGA<select value={assignment.lga} onChange={(event) => changeLga(event.target.value)}>{getRegistrationLocationOptions(assignment.state).lgas.map((lga) => <option key={lga}>{lga}</option>)}</select></label>}
          {canChooseZone && <label>Ward<select value={assignment.ward} onChange={(event) => changeWard(event.target.value)}>{getRegistrationLocationOptions(assignment.state, assignment.lga).wards.map((ward) => <option key={ward}>{ward}</option>)}</select></label>}
          {!isAgent && <label>{isSupervisor ? "Polling unit in your ward" : "INEC IReV polling unit"}<select required value={assignment.pollingUnit} onChange={(event) => setAssignment((current) => ({ ...current, pollingUnit: event.target.value }))}><option value="">Select polling unit</option>{locationOptions.pollingUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></label>}
        </div>
        <div className="result-capture-meta">
          <div><span>{isAgent ? "Registered polling unit" : "Selected polling unit"}</span><b>{assignment.pollingUnit || "Not selected"}</b></div>
          <div><span>Result source</span><b>{isAgent ? "Agent" : isSupervisor ? "Supervisor" : "INEC IReV"}</b></div>
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
          <button type="button" className="ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="primary" disabled={!parties.length || submitting} aria-busy={submitting || submitState === "clicked"} onClick={() => setSubmitState("clicked")}>
            {submitting || submitState === "clicked" ? "Submitting…" : "Submit result now"}
          </button>
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

const MAX_ATTACHMENT_BYTES = 40 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 120 * 1024 * 1024;
const MAX_ATTACHMENT_MB = MAX_ATTACHMENT_BYTES / (1024 * 1024);
const MAX_TOTAL_ATTACHMENT_MB = MAX_TOTAL_ATTACHMENT_BYTES / (1024 * 1024);
const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
];
const DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv," + DOCUMENT_MIME_TYPES.join(",");

export function IncidentForm({ point, users, onClose, onSave, isAdmin, currentUser, sharingCamera }) {
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
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isResultReport = form.reportType === POLLING_RESULT_TYPE;
  const isFieldRestricted = ["Agent", "Supervisor"].includes(currentUser?.role);
  const officerOptions = users.filter((user) => ["Response Team", "Agent"].includes(user.role));
  const reportTypeOptions = useMemo(() => REPORT_TYPES, [customTypes, isAdmin]);
  const named = (user) => (user.rank ? `${user.rank} ${user.name}` : user.name);

  const addMedia = (files) => {
    setMediaError("");
    let remainingBytes = MAX_TOTAL_ATTACHMENT_BYTES - form.media.reduce((sum, item) => sum + Number(item.size || 0), 0);
    [...files].slice(0, 6 - form.media.length).forEach((file) => {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo && !DOCUMENT_MIME_TYPES.includes(file.type)) {
        setMediaError(`"${file.name}" isn't a supported file type.`);
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setMediaError(`Each attachment must be ${MAX_ATTACHMENT_MB}MB or smaller.`);
        return;
      }
      if (file.size > remainingBytes) {
        setMediaError(`Attachments can be up to ${MAX_TOTAL_ATTACHMENT_MB}MB in total per incident.`);
        return;
      }
      remainingBytes -= file.size;
      const reader = new FileReader();
      reader.onerror = () => setMediaError(`Could not read "${file.name}". Please try again.`);
      reader.onload = () =>
        setForm((old) => ({
          ...old,
          media: [...old.media, { name: file.name, type: isVideo ? "video" : isImage ? "image" : "document", mimeType: file.type, size: file.size, data: reader.result }].slice(0, 6),
        }));
      reader.readAsDataURL(file);
    });
  };

  const addLiveStreamLink = () => {
    setMediaError("");
    if (form.media.some((item) => item.type === "livestream")) return;
    if (form.media.length >= 6) {
      setMediaError("Remove an attachment before linking your live stream.");
      return;
    }
    setForm((old) => ({
      ...old,
      media: [...old.media, { name: "Live camera stream", type: "livestream", size: 0, data: "", userId: currentUser.id }],
    }));
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
        onSubmit={async (e) => {
          e.preventDefault();
          if (submitting) return;
          setSubmitError("");
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
          setSubmitting(true);
          try {
            await onSave({
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
          } catch (error) {
            setSubmitError(error.message || "Could not submit this report. Please try again.");
          } finally {
            setSubmitting(false);
          }
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
          {currentUser?.role !== "Agent" && (
            <label>
              Severity
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                {Object.keys(severityColor).map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
          )}
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
          {!isResultReport && (
            <label className="capture-btn">
              Attach document
              <input type="file" accept={DOCUMENT_ACCEPT} multiple onChange={(e) => addMedia(e.target.files || [])} />
            </label>
          )}
          {!isResultReport && sharingCamera && (
            <button type="button" className="capture-btn" onClick={addLiveStreamLink}>
              Link my live stream
            </button>
          )}
        </div>
        {mediaError && <div className="error">{mediaError}</div>}
        {form.media.length > 0 && (
          <div className="report-media-list">
            {form.media.map((item, index) => (
              <button type="button" key={`${item.name}-${index}`} onClick={() => removeMedia(index)} title="Remove attachment">
                {item.type === "video" ? "VIDEO" : item.type === "document" ? "DOC" : item.type === "livestream" ? "LIVE" : "PHOTO"} {index + 1}
              </button>
            ))}
          </div>
        )}
        <div className="coordinates">
          <b>{form.geometry ? `${form.geometry.type} incident area` : "Pinned location"}</b>
          <span>{form.lat.toFixed(5)}, {form.lng.toFixed(5)}</span>
        </div>
        {submitError && <div className="error">{submitError}</div>}
        <div className="actions">
          <button type="button" className="ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="primary" disabled={submitting}>
            {submitting ? "Submitting…" : isResultReport ? "Submit polling unit result" : "Submit incident"}
          </button>
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
  const canManageRoles = ["Super Admin", "Admin"].includes(currentUser.role);
  const manageableRoles = ["Supervisor", "Agent", "Stakeholder"];
  if (!canManageRoles) {
    return (
      <div className="modal-backdrop">
        <section className="modal officer-modal">
          <div className="panel-title">
            <div><span className="eyebrow">PERSONNEL</span><h2>Manage users</h2></div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close user manager"><FaTimes /></button>
          </div>
          <p className="muted">Only administrators can create or manage user accounts.</p>
          <div className="actions">
            <button type="button" className="primary" onClick={onClose}>Close</button>
          </div>
        </section>
      </div>
    );
  }
  const defaultRole = "Agent";
  const stateOptions = useMemo(
    () => NIGERIA_STATES.map((code) => ({ code, label: STATE_CODE_TO_NAME[code] || code })),
    [],
  );
  const newAccountForm = () => {
    const state = isSupervisor ? currentUser.state : DEFAULT_REGISTRATION_STATE;
    const stateLocations = getRegistrationLocationOptions(state);
    const lga = isSupervisor && currentUser.lga ? currentUser.lga : stateLocations.lgas[0] || "";
    const lgaLocations = getRegistrationLocationOptions(state, lga);
    const ward = isSupervisor && currentUser.ward ? currentUser.ward : lgaLocations.wards[0] || "";
    const wardLocations = getRegistrationLocationOptions(state, lga, ward);
    const pollingUnit = isSupervisor && currentUser.pollingUnit
      ? currentUser.pollingUnit
      : wardLocations.pollingUnits[0] || "";
    return {
      id: "",
      name: "",
      email: "",
      password: "",
      rank: defaultRole,
      command: "Oyo State Election Operations",
      division: "",
      station: "",
      state,
      lga,
      ward,
      pollingUnit,
      lat: String(currentUser.lat || "8.4799"),
      lng: String(currentUser.lng || "4.5418"),
      role: defaultRole,
    };
  };
  const [form, setForm] = useState(newAccountForm);
  const [managerTab, setManagerTab] = useState("create");
  const [error, setError] = useState("");
  // Stakeholders are read-only statewide observers, so a field assignment does not apply to them.
  const isStakeholderRole = form.role === "Stakeholder";
  const [roleChangeUser, setRoleChangeUser] = useState(null);
  const [roleChangeForm, setRoleChangeForm] = useState({ role: "", state: "", lga: "", ward: "" });
  const [roleChangeError, setRoleChangeError] = useState("");
  const wardOptions = useMemo(
    () => getRegistrationLocationOptions(form.state, form.lga).wards,
    [form.state, form.lga],
  );
  const selectedWards = useMemo(
    () => String(form.ward || "").split(",").map((ward) => ward.trim()).filter(Boolean),
    [form.ward],
  );
  const selectedRoleWards = useMemo(
    () => String(roleChangeForm.ward || "").split(",").map((ward) => ward.trim()).filter(Boolean),
    [roleChangeForm.ward],
  );
  const locationOptions = useMemo(
    () => getRegistrationLocationOptions(form.state, form.lga, form.ward),
    [form.state, form.lga, form.ward],
  );
  const isEditing = Boolean(form.id);

  const resetForm = () => {
    setForm(newAccountForm());
    setError("");
  };
  const canEditAssignment = (user) => {
    if (user.role !== "Agent") return false;
    if (canManageRoles) return true;
    return isSupervisor && user.state === currentUser.state && user.lga === currentUser.lga && user.ward === currentUser.ward;
  };
  const handleStateChange = (value) => {
    const state = normalizeRegistrationState(value);
    const options = getRegistrationLocationOptions(state);
    const lga = options.lgas[0] || "";
    const ward = getRegistrationLocationOptions(state, lga).wards[0] || "";
    const pollingUnit = getRegistrationLocationOptions(state, lga, ward).pollingUnits[0] || "";
    setForm((current) => ({ ...current, state, lga, ward, pollingUnit }));
  };
  const handleLgaChange = (lga) => {
    const options = getRegistrationLocationOptions(form.state, lga);
    const ward = options.wards.includes(form.ward) ? form.ward : options.wards[0] || "";
    const units = getRegistrationLocationOptions(form.state, lga, ward).pollingUnits;
    setForm((current) => ({ ...current, lga, ward, pollingUnit: units.includes(current.pollingUnit) ? current.pollingUnit : units[0] || "" }));
  };
  const handleWardChange = (nextWards) => {
    const wardList = Array.isArray(nextWards) ? nextWards : [nextWards].filter(Boolean);
    const normalized = wardList.filter(Boolean);
    const selectedWard = normalized[0] || "";
    const units = selectedWard ? getRegistrationLocationOptions(form.state, form.lga, selectedWard).pollingUnits : [];
    setForm((current) => ({
      ...current,
      ward: normalized.join(", "),
      pollingUnit: units.includes(current.pollingUnit) ? current.pollingUnit : normalized.length === 1 ? units[0] || "" : "",
    }));
  };
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      if (isEditing) await onUpdate(form);
      else await onCreate(form);
      resetForm();
      if (isEditing) setManagerTab("list");
    } catch (submitError) {
      setError(submitError.message || "Unable to save this user");
    }
  };
  const editAssignment = (user) => {
    setForm({ ...newAccountForm(), ...user, password: "", lat: String(user.lat || ""), lng: String(user.lng || "") });
    setManagerTab("create");
    setError("");
  };
  const resetPassword = async (user) => {
    const password = window.prompt(`Enter a new password for ${user.name}. Use at least 12 characters with uppercase, lowercase, number, and special character.`);
    if (!password) return;
    setError("");
    try {
      await onPassword(user, password);
    } catch (passwordError) {
      setError(passwordError.message || "Unable to reset the password");
    }
  };
  const openRoleChange = (user) => {
    setRoleChangeUser(user);
    setRoleChangeForm({ role: user.role, state: user.state || DEFAULT_REGISTRATION_STATE, lga: user.lga || "", ward: user.ward || "" });
    setRoleChangeError("");
  };
  const submitRoleChange = async () => {
    setRoleChangeError("");
    try {
      await onRoleChange(roleChangeUser, roleChangeForm);
      setRoleChangeUser(null);
    } catch (roleError) {
      setRoleChangeError(roleError.message || "Unable to update this role");
    }
  };

  return (
    <div className="modal-backdrop">
      <section className="modal officer-modal">
        <div className="panel-title">
          <div><span className="eyebrow">PERSONNEL</span><h2>Manage users</h2></div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close user manager"><FaTimes /></button>
        </div>
        <div className="personnel-tabs" role="tablist" aria-label="User management">
          <button type="button" className={managerTab === "create" ? "active" : ""} onClick={() => setManagerTab("create")}>{isEditing ? "Edit account" : "Create account"}</button>
          <button type="button" className={managerTab === "list" ? "active" : ""} onClick={() => setManagerTab("list")}>Existing users ({users.filter((user) => user.role !== "Super Admin").length})</button>
        </div>

        {managerTab === "list" && (
          <div className="manage-list">
            {roleChangeUser && (
              <div className="role-change-panel">
                <div className="role-change-header"><b>Change role or ward: {roleChangeUser.name}</b><button type="button" className="icon-btn" onClick={() => setRoleChangeUser(null)}><FaTimes /></button></div>
                <div className="role-change-fields">
                  <label>Role<select value={roleChangeForm.role} onChange={(event) => setRoleChangeForm((current) => ({ ...current, role: event.target.value }))}><option value="Supervisor">Supervisor</option><option value="Agent">Agent</option></select></label>
                  <label>State<select value={roleChangeForm.state} onChange={(event) => { const state = normalizeRegistrationState(event.target.value); const options = getRegistrationLocationOptions(state); const lga = options.lgas[0] || ""; setRoleChangeForm((current) => ({ ...current, state, lga, ward: getRegistrationLocationOptions(state, lga).wards[0] || "" })); }}>{stateOptions.map((state) => <option key={state.code} value={state.code}>{state.label}</option>)}</select></label>
                  <label>LGA<select value={roleChangeForm.lga} onChange={(event) => { const lga = event.target.value; setRoleChangeForm((current) => ({ ...current, lga, ward: getRegistrationLocationOptions(current.state, lga).wards.slice(0, 1).join(', ') || "" })); }}>{getRegistrationLocationOptions(roleChangeForm.state).lgas.map((lga) => <option key={lga}>{lga}</option>)}</select></label>
                  <label>Wards
                    <span className="ward-scope-actions"><button type="button" onClick={() => setRoleChangeForm((current) => ({ ...current, ward: getRegistrationLocationOptions(current.state, current.lga).wards.join(", ") }))}>Assign whole LGA</button><button type="button" onClick={() => setRoleChangeForm((current) => ({ ...current, ward: "" }))}>Clear</button></span>
                    <select multiple size={Math.min(8, getRegistrationLocationOptions(roleChangeForm.state, roleChangeForm.lga).wards.length || 1)} value={selectedRoleWards} onChange={(event) => setRoleChangeForm((current) => ({ ...current, ward: [...event.target.selectedOptions].map((option) => option.value).join(", ") }))}>{getRegistrationLocationOptions(roleChangeForm.state, roleChangeForm.lga).wards.map((ward) => <option key={ward} value={ward}>{ward}</option>)}</select>
                  </label>
                </div>
                {roleChangeError && <div className="error">{roleChangeError}</div>}
                <div className="role-change-actions"><button type="button" className="primary" onClick={submitRoleChange}>Save changes</button><button type="button" className="ghost" onClick={() => setRoleChangeUser(null)}>Cancel</button></div>
              </div>
            )}
            {error && <div className="error">{error}</div>}
            {users.filter((user) => user.role !== "Super Admin").map((user) => (
              <div className="manage-row" key={user.id}>
                <div className="avatar">{user.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
                <div className="manage-user-summary"><b>{user.rank ? `${user.rank} ${user.name}` : user.name}</b><small>{user.role === "Supervisor" ? "Ward Supervisor" : user.role} · {user.email}<br />{STATE_CODE_TO_NAME[user.state] || user.state || "No state"} · {user.lga || "No LGA"} · {(String(user.ward || "").split(",").map((ward) => ward.trim()).filter(Boolean).join(" • ") || "No ward")} · {user.pollingUnit || user.unit || "No assignment"}</small></div>
                <div className="manage-user-actions">
                  <button type="button" className="unit-action-btn" onClick={() => resetPassword(user)}>Password</button>
                  {canEditAssignment(user) && <button type="button" className="unit-action-btn" onClick={() => editAssignment(user)}>Edit assignment</button>}
                  {canManageRoles && ["Supervisor", "Agent"].includes(user.role) && <button type="button" className="unit-action-btn role-change-btn" onClick={() => openRoleChange(user)}>{user.role === "Supervisor" ? "Demote / Ward" : "Promote / Ward"}</button>}
                  <button type="button" className="delete-btn" onClick={() => onDelete(user)}>Delete</button>
                </div>
              </div>
            ))}
            {!users.some((user) => user.role !== "Super Admin") && <p className="muted">No manageable users are available.</p>}
          </div>
        )}

        {managerTab === "create" && (
          <form className="personnel-create-form" onSubmit={submit}>
            <h3>{isEditing ? "Edit agent assignment" : "Create personnel account"}</h3>
            <div className="officer-form-grid">
              <label>Full name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              {canManageRoles && !isEditing && <label>System role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value, rank: event.target.value })}>{manageableRoles.map((role) => <option key={role}>{role}</option>)}</select></label>}
              <label>State<select required value={form.state} onChange={(event) => handleStateChange(event.target.value)} disabled={isSupervisor}>{stateOptions.map((state) => <option key={state.code} value={state.code}>{state.label}</option>)}</select></label>
              <label>LGA {isStakeholderRole && "(not required)"}<select required={!isStakeholderRole} value={form.lga} onChange={(event) => handleLgaChange(event.target.value)} disabled={isSupervisor}>{getRegistrationLocationOptions(form.state).lgas.map((lga) => <option key={lga}>{lga}</option>)}</select></label>
               <label>Ward / supervisor zone
                 {form.role === "Supervisor" && !isSupervisor && <span className="ward-scope-actions"><button type="button" onClick={() => handleWardChange(wardOptions)}>Assign whole LGA</button><button type="button" onClick={() => handleWardChange([])}>Clear</button></span>}
                 <select multiple size={Math.min(8, wardOptions.length || 1)} value={selectedWards} onChange={(event) => handleWardChange([...event.target.selectedOptions].map((option) => option.value))} disabled={isSupervisor}>{wardOptions.map((ward) => <option key={ward} value={ward}>{ward}</option>)}</select>
               </label>
              <label>Polling unit {form.role === "Supervisor" ? "(optional)" : "assignment"}<select required={form.role === "Agent"} value={form.pollingUnit} onChange={(event) => setForm({ ...form, pollingUnit: event.target.value })}><option value="">All units in selected ward(s)</option>{locationOptions.pollingUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
              <label>Contact / call sign<input required={!isStakeholderRole} value={form.station} onChange={(event) => setForm({ ...form, station: event.target.value })} /></label>
              {!isEditing && <label>Password<input required minLength="12" type="password" title="At least 12 characters with uppercase, lowercase, number, and special character" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>}
              <label>Initial latitude<input required={!isStakeholderRole} value={form.lat} onChange={(event) => setForm({ ...form, lat: event.target.value })} /></label>
              <label>Initial longitude<input required={!isStakeholderRole} value={form.lng} onChange={(event) => setForm({ ...form, lng: event.target.value })} /></label>
            </div>
            <div className="location-summary">
              <strong>Selected assignment</strong>
              <span>
                {isStakeholderRole
                  ? "Stakeholders observe the whole state and are read-only — no field assignment is needed."
                  : `${STATE_CODE_TO_NAME[form.state] || form.state} · ${form.lga || "No LGA"} · ${form.ward || "No ward"} · ${form.pollingUnit || "All units"}`}
              </span>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="form-actions"><button className="primary" disabled={!manageableRoles.length}>{isEditing ? "Save changes" : "Create account"}</button>{isEditing && <button type="button" className="ghost" onClick={() => { resetForm(); setManagerTab("list"); }}>Cancel edit</button>}</div>
          </form>
        )}
      </section>
    </div>
  );
}
