import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { FaCircle, FaPlay, FaTimes, FaVolumeDown, FaVolumeMute, FaVolumeUp } from "react-icons/fa";
import { apiRequest } from "../../api/client.js";

const formatRecordingWhen = (iso) => {
  const time = Date.parse(iso || "");
  return Number.isFinite(time) ? new Date(time).toLocaleString() : "Unknown time";
};

const formatRecordingDuration = (startedAt, endedAt) => {
  const start = Date.parse(startedAt || "");
  const end = Date.parse(endedAt || "");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "";
  const seconds = Math.round((end - start) / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

const groupRecordingsByLocation = (recordings) => {
  const byLga = new Map();
  for (const recording of recordings) {
    const lga = recording.geography?.lga || "Location not assigned";
    const ward = recording.geography?.ward || "Ward not assigned";
    if (!byLga.has(lga)) byLga.set(lga, new Map());
    const byWard = byLga.get(lga);
    if (!byWard.has(ward)) byWard.set(ward, []);
    byWard.get(ward).push(recording);
  }
  return [...byLga.entries()].map(([lga, byWard]) => ({
    lga,
    wards: [...byWard.entries()].map(([ward, items]) => ({ ward, items })),
  }));
};

const watermarkLines = (feed = {}) => {
  const location = feed.location || {};
  const primary = location.label || feed.locationLabel || (Number.isFinite(Number(feed.lat)) && Number.isFinite(Number(feed.lng)) ? `${Number(feed.lat).toFixed(5)}, ${Number(feed.lng).toFixed(5)}` : "Location awaiting GPS");
  return [
    primary,
    location.street && location.street !== primary ? location.street : "",
    `Polling Unit: ${feed.pollingUnit || feed.station || "Not assigned"}`,
    `Ward: ${feed.ward || "Not assigned"}  •  LGA: ${feed.lga || "Not assigned"}`,
    Number(feed.accuracy) > 0 ? `GPS accuracy ±${Math.round(Number(feed.accuracy))} m` : "",
  ].filter(Boolean);
};

const createWatermarkedStream = async (source, feed = {}) => {
  const canvas = document.createElement("canvas");
  if (!canvas.captureStream) return { stream: source, cleanup: () => {} };
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = source;
  await video.play();
  const settings = source.getVideoTracks()[0]?.getSettings?.() || {};
  canvas.width = Math.max(640, Number(settings.width) || video.videoWidth || 1280);
  canvas.height = Math.max(360, Number(settings.height) || video.videoHeight || 720);
  const context = canvas.getContext("2d");
  if (!context) return { stream: source, cleanup: () => { video.pause(); video.srcObject = null; } };
  let animationFrame;
  const draw = () => {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const fontSize = Math.max(15, Math.round(canvas.width / 54));
    const lineHeight = Math.round(fontSize * 1.35);
    const lines = [...watermarkLines(feed), new Date().toLocaleString("en-NG", { hour12: true }), "© OpenStreetMap contributors"];
    const panelHeight = lines.length * lineHeight + fontSize * 1.5;
    context.fillStyle = "rgba(0, 0, 0, 0.72)";
    context.fillRect(0, canvas.height - panelHeight, canvas.width, panelHeight);
    context.fillStyle = "#ffffff";
    context.font = `600 ${fontSize}px Arial, sans-serif`;
    context.textBaseline = "top";
    lines.forEach((line, index) => {
      context.fillText(String(line).slice(0, 110), fontSize, canvas.height - panelHeight + fontSize * 0.65 + index * lineHeight, canvas.width - fontSize * 2);
    });
    animationFrame = requestAnimationFrame(draw);
  };
  draw();
  const output = canvas.captureStream(24);
  source.getAudioTracks().forEach(track => output.addTrack(track));
  return {
    stream: output,
    cleanup: () => {
      cancelAnimationFrame(animationFrame);
      output.getVideoTracks().forEach(track => track.stop());
      video.pause();
      video.srcObject = null;
    },
  };
};

function StreamVideo({ src, stream, muted = false, showControls = true, watermark }) {
  const ref = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [soundMuted, setSoundMuted] = useState(muted);
  const [volume, setVolume] = useState(muted ? 0 : 1);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
      return () => {
        video.srcObject = null;
      };
    }
    if (!src) return;
    let hls;
    if (src.includes(".m3u8") && Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else video.src = src;
    return () => {
      hls?.destroy();
      video.removeAttribute("src");
    };
  }, [src, stream]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = soundMuted || volume === 0;
    video.volume = Math.max(0, Math.min(1, volume));
  }, [soundMuted, volume]);

  const toggleSound = () => {
    if (soundMuted || volume === 0) {
      setSoundMuted(false);
      if (volume === 0) setVolume(1);
    } else {
      setSoundMuted(true);
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    const video = ref.current;
    try {
      const source =
        stream || video?.captureStream?.() || video?.mozCaptureStream?.();
      if (!source)
        throw new Error("Recording is not supported in this browser");
      const prepared = watermark ? await createWatermarkedStream(source, watermark) : { stream: source, cleanup: () => {} };
      chunksRef.current = [];
      const recorder = new MediaRecorder(prepared.stream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : "video/webm",
      });
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        setRecording(false);
        prepared.cleanup();
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `election-monitor-recording-${Date.now()}.webm`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
      recorderRef.current = recorder;
      recorder.start(1000);
      setRecording(true);
    } catch (error) {
      alert(error.message || "Unable to start recording this stream");
    }
  };

  return (
    <div className="recordable-video">
      <video ref={ref} controls={showControls} autoPlay playsInline muted={soundMuted} />
      {watermark && <div className="video-location-watermark">{watermarkLines(watermark).map((line, index) => index === 0 ? <strong key={line}>{line}</strong> : <span key={`${line}-${index}`}>{line}</span>)}<small>© OpenStreetMap contributors</small></div>}
      {showControls && (
        <>
          <div className="stream-audio-controls">
            <button type="button" onClick={toggleSound} title={soundMuted || volume === 0 ? "Turn sound on" : "Turn sound off"} aria-label={soundMuted || volume === 0 ? "Turn sound on" : "Turn sound off"}>
              {soundMuted || volume === 0 ? <FaVolumeMute /> : volume < 0.5 ? <FaVolumeDown /> : <FaVolumeUp />}
            </button>
            <input type="range" min="0" max="1" step="0.05" value={soundMuted ? 0 : volume} onChange={(event) => { const nextVolume = Number(event.target.value); setVolume(nextVolume); setSoundMuted(nextVolume === 0); }} aria-label="Stream volume" title={`Volume ${Math.round((soundMuted ? 0 : volume) * 100)}%`} />
            <span>{Math.round((soundMuted ? 0 : volume) * 100)}%</span>
          </div>
          <button type="button" className={`stream-record-button ${recording ? "record-stop" : ""}`} onClick={toggleRecording}>
            {recording ? "Stop & save" : "Record"}
          </button>
        </>
      )}
    </div>
  );
}

export default function CameraPanel({
  cameras,
  phoneShares,
  remoteStreams,
  viewerConnectFailed,
  turnStatus,
  isAdmin,
  authToken,
  onClose,
  onDelete,
  onView,
  onShowMap,
}) {
  const [recordAll, setRecordAll] = useState(false);
  const [sharingFeedId, setSharingFeedId] = useState(null);
  const [preparedShares, setPreparedShares] = useState({});
  const [fullscreen, setFullscreen] = useState(null);
  const [recordings, setRecordings] = useState(null);
  const [recordingsError, setRecordingsError] = useState("");
  const recordersRef = useRef({});

  const viewLiveFeed = (feed) => {
    onView(feed.userId);
    setFullscreen({ type: "live", feed });
  };

  const loadRecordings = () => {
    setRecordingsError("");
    apiRequest("/camera/recordings", authToken)
      .then(setRecordings)
      .catch((error) => setRecordingsError(error.message || "Unable to load recordings"));
  };

  const playRecording = (recording) => {
    setFullscreen({ type: "recording", recording, dataUrl: null, loading: true, error: "" });
    apiRequest(`/evidence/${recording.evidenceId}`, authToken)
      .then((evidence) => setFullscreen({ type: "recording", recording, dataUrl: evidence.data, loading: false, error: "" }))
      .catch((error) => setFullscreen({ type: "recording", recording, dataUrl: null, loading: false, error: error.message || "Unable to load this recording" }));
  };

  const [view, setView] = useState("All");
  useEffect(() => {
    if (view !== "Recordings") return;
    loadRecordings();
    const timer = setInterval(loadRecordings, 15000);
    return () => clearInterval(timer);
  }, [view, authToken]);

  const phoneFeeds = phoneShares.map((feed) => ({
    ...feed,
    id: `phone-${feed.userId}`,
    feedType: "Phone",
  }));

  const cameraFeeds = cameras.map((camera) => ({
    ...camera,
    feedType: camera.type || "CCTV",
  }));

  const feeds = [...phoneFeeds, ...cameraFeeds].filter(
    (feed) => view === "All" || feed.feedType === view,
  );

  const counts = {
    All: phoneFeeds.length + cameraFeeds.length,
    Phone: phoneFeeds.length,
    CCTV: cameraFeeds.filter((x) => x.feedType === "CCTV").length,
    Drone: cameraFeeds.filter((x) => x.feedType === "Drone").length,
  };

  const relayName = turnStatus?.provider === "cloudflare"
    ? "Cloudflare TURN"
    : turnStatus?.provider === "expressturn"
      ? "ExpressTURN"
      : "Metered TURN";
  const turnStatusLabel = turnStatus?.route === "turn"
    ? `Connected via ${relayName}`
    : turnStatus?.provider !== "stun-fallback" && turnStatus?.route === "direct"
      ? `${relayName} ready · direct route`
      : turnStatus?.provider !== "stun-fallback"
        ? `${relayName} ready${turnStatus?.region ? ` · ${turnStatus.region}` : ""}`
        : "STUN fallback only";

  useEffect(() => {
    const availableIds = new Set(phoneFeeds.map((feed) => String(feed.userId)));
    setFullscreen((current) => (current?.type === "live" && !availableIds.has(String(current.feed.userId)) ? null : current));
  }, [phoneShares]);

  const saveFeedRecording = (feed, chunks, mimeType) => {
    if (!chunks.length) return;
    const blob = new Blob(chunks, { type: mimeType || "video/webm" });
    const extension = blob.type.includes("mp4") ? "mp4" : "webm";
    const pollingUnit = String(feed?.pollingUnit || feed?.station || "unknown-polling-unit")
      .trim()
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-|-$/g, "");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${pollingUnit}_${timestamp}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const shareFeedVideo = async (feed) => {
    const stream = remoteStreams[feed.userId];
    if (!stream || typeof MediaRecorder === "undefined") {
      onView(feed.userId);
      return;
    }
    try {
      setSharingFeedId(feed.userId);
      const prepared = await createWatermarkedStream(stream, feed);
      const mimeType = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
        .find((type) => MediaRecorder.isTypeSupported?.(type));
      const recorder = new MediaRecorder(prepared.stream, mimeType ? { mimeType } : undefined);
      const chunks = [];
      recorder.ondataavailable = (event) => event.data?.size && chunks.push(event.data);
      const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
      recorder.start(500);
      setTimeout(() => recorder.state !== "inactive" && recorder.stop(), 10000);
      await stopped;
      prepared.cleanup();
      const type = recorder.mimeType || mimeType || "video/webm";
      const extension = type.includes("mp4") ? "mp4" : "webm";
      const unit = String(feed.pollingUnit || feed.station || "live-feed").replace(/[^a-z0-9_-]+/gi, "-");
      const file = new File(chunks, `${unit}_${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`, { type });
      setPreparedShares((current) => ({
        ...current,
        [feed.userId]: {
          file,
          title: "Election monitoring live feed",
          text: `${feed.name || "Field agent"} — ${feed.location?.label || feed.pollingUnit || "Polling unit"}`,
        },
      }));
    } catch (error) {
      if (error.name !== "AbortError") alert(error.message || "Unable to prepare this feed");
    } finally {
      setSharingFeedId(null);
    }
  };

  const sharePreparedFeedVideo = async (feed) => {
    const prepared = preparedShares[feed.userId];
    if (!prepared) return shareFeedVideo(feed);
    const shareData = { title: prepared.title, text: prepared.text, files: [prepared.file] };
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
      } else {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(prepared.file);
        link.download = prepared.file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        alert("The video was downloaded. You can attach it to your social media post.");
      }
      setPreparedShares((current) => {
        const next = { ...current };
        delete next[feed.userId];
        return next;
      });
    } catch (error) {
      if (error.name !== "AbortError") alert(error.message || "Unable to share this feed");
    }
  };

  useEffect(() => {
    const active = recordersRef.current;
    if (recordAll) {
      phoneFeeds.forEach((feed) => {
        const stream = remoteStreams[feed.userId];
        if (!stream || active[feed.userId] || typeof MediaRecorder === "undefined") return;
        const preferred = [
          "video/webm;codecs=vp8,opus",
          "video/webm",
          "video/mp4",
        ].find((type) => MediaRecorder.isTypeSupported?.(type));
        try {
          const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
          const entry = { recorder, chunks: [], feed };
          active[feed.userId] = entry;
          recorder.ondataavailable = (event) => {
            if (event.data?.size) entry.chunks.push(event.data);
          };
          recorder.onstop = () => {
            saveFeedRecording(entry.feed, entry.chunks, recorder.mimeType);
            delete active[feed.userId];
          };
          recorder.start(1000);
        } catch (error) {
          console.error("Unable to record live feed", error);
        }
      });
    }
    Object.entries(active).forEach(([userId, entry]) => {
      if ((!recordAll || !remoteStreams[userId]) && entry.recorder.state !== "inactive") {
        entry.recorder.stop();
      }
    });
  }, [recordAll, remoteStreams, phoneShares]);

  useEffect(
    () => () => {
      Object.values(recordersRef.current).forEach(({ recorder }) => {
        if (recorder.state !== "inactive") recorder.stop();
      });
    },
    [],
  );

  return (
    <section className="camera-panel">
      <div className="camera-head">
        <div>
          <span className="eyebrow">LIVE VISUAL INTELLIGENCE</span>
          <h2>{view === "Recordings" ? "Saved recordings" : "Camera feeds"}</h2>
        </div>
        <div className="camera-head-actions">
          <span className={`turn-status ${turnStatus?.route === "turn" ? "relayed" : turnStatus?.provider !== "stun-fallback" ? "ready" : "fallback"}`}>
            {turnStatusLabel}
          </span>
          <button className="icon-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
      </div>
      <div className="camera-tabs">
        {["All", "Phone"].map((tab) => (
          <button
            key={tab}
            className={view === tab ? "active" : ""}
            onClick={() => setView(tab)}
          >
            {tab} <i>{counts[tab]}</i>
          </button>
        ))}
        {isAdmin && (
          <button
            className={view === "Recordings" ? "active" : ""}
            onClick={() => { setView("Recordings"); if (!recordings) loadRecordings(); }}
          >
            Recordings
          </button>
        )}
      </div>
      {view === "Recordings" ? (
        <div className="recordings-browser">
          <p className="alv-note">Every camera-share session is saved automatically as it happens, grouped here by where it was recorded.</p>
          {recordingsError && <p role="alert">{recordingsError} <button onClick={loadRecordings}>Retry</button></p>}
          {!recordingsError && recordings === null && <p role="status">Loading recordings…</p>}
          {recordings?.length === 0 && <div className="empty-cameras"><b>No recordings yet</b><span>Recordings appear during each livestream. Offline clips appear when the phone reconnects.</span></div>}
          {recordings?.length > 0 && groupRecordingsByLocation(recordings).map((lgaGroup) => (
            <div className="recordings-lga-group" key={lgaGroup.lga}>
              <h4>{lgaGroup.lga}</h4>
              {lgaGroup.wards.map((wardGroup) => (
                <div className="recordings-ward-group" key={wardGroup.ward}>
                  <span className="recordings-ward-label">{wardGroup.ward}</span>
                  <div className="recordings-list">
                    {wardGroup.items.map((recording) => (
                      <button type="button" className="recording-item" key={recording.id} onClick={() => playRecording(recording)}>
                        <FaPlay size={11} />
                        <span className="recording-item-main">
                          <b>{recording.submittedByName || "Field agent"}</b>
                          {recording.location?.lat != null && <small>GPS: {recording.location.lat.toFixed(5)}, {recording.location.lng.toFixed(5)}</small>}
                          <small>{recording.submittedByRole} · {recording.geography?.pollingUnit || "Polling unit not assigned"}</small>
                        </span>
                        <span className="recording-item-when">
                          {formatRecordingWhen(recording.startedAt || recording.createdAt)}
                          {formatRecordingDuration(recording.startedAt, recording.endedAt) && ` · ${formatRecordingDuration(recording.startedAt, recording.endedAt)}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <>
      {isAdmin && (
        <label className="record-all-feeds">
          <input
            type="checkbox"
            checked={recordAll}
            onChange={(event) => setRecordAll(event.target.checked)}
          />
          <span>Record all live feeds to this device</span>
        </label>
      )}
      <div className="camera-grid compact">
        {feeds.map((feed) =>
          feed.feedType === "Phone" ? (
            <article
              className="camera-card agent-feed-card"
              key={feed.id}
              title={`${feed.name || "Agent"} — ${feed.pollingUnit || feed.station || "Polling unit not assigned"}`}
            >
              <button type="button" className="live-notification" onClick={() => viewLiveFeed(feed)}>
                <span className="live-badge">
                  <FaCircle size={8} style={{ marginRight: 3 }} />
                  LIVE
                </span>
                <b>{feed.name || "Agent"} is live</b>
                <small>{feed.role || "Agent"}</small>
                <span className="live-notification-line">
                  Registered to: {[feed.pollingUnit || feed.station, feed.ward, feed.lga].filter(Boolean).join(" · ") || "Not assigned"}
                </span>
                <span className="live-notification-line">
                  Currently at: {feed.location?.label || (Number.isFinite(Number(feed.lat)) && Number.isFinite(Number(feed.lng)) ? `${Number(feed.lat).toFixed(5)}, ${Number(feed.lng).toFixed(5)}` : "Waiting for GPS")}
                </span>
                <span className="live-notification-cta">View live stream →</span>
              </button>
              <div className="camera-actions">
                {feed.lat && (
                  <button onClick={() => onShowMap(feed)}>Show on map</button>
                )}
                <button className={preparedShares[feed.userId] ? "share-ready" : ""} disabled={sharingFeedId === feed.userId} onClick={() => preparedShares[feed.userId] ? sharePreparedFeedVideo(feed) : shareFeedVideo(feed)}>
                  {sharingFeedId === feed.userId ? "Recording 10s…" : preparedShares[feed.userId] ? "Share ready" : "Prepare video"}
                </button>
              </div>
            </article>
          ) : (
            <article className="camera-card" key={feed.id}>
              <div className="video-shell">
                <StreamVideo src={feed.url} muted />
              </div>
              <div className="camera-meta">
                <div>
                  <b>{feed.name}</b>
                  <small>
                    {feed.feedType} / {feed.lat.toFixed(4)}, {feed.lng.toFixed(4)}
                  </small>
                </div>
                <span
                  className={
                    feed.feedType === "Drone" ? "live-badge" : "online-badge"
                  }
                >
                  {feed.feedType === "Drone" ? "DRONE" : "ONLINE"}
                </span>
                {isAdmin && (
                  <button
                    className="camera-delete"
                    onClick={() => onDelete(feed)}
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="camera-actions">
                <button onClick={() => onShowMap(feed)}>Show on map</button>
              </div>
            </article>
          ),
        )}
        {!feeds.length && (
          <div className="empty-cameras">
            <b>
              No {view === "All" ? "" : view.toLowerCase()} feeds registered
            </b>
            <span>
              Add an HLS stream or ask a field agent to share their phone camera.
            </span>
          </div>
        )}
      </div>
        </>
      )}
      {fullscreen && (
        <div className="live-fullscreen-overlay">
          <div className="live-fullscreen-head">
            <div>
              {fullscreen.type === "live" ? (
                <>
                  <b>{fullscreen.feed.name || "Agent"} — LIVE</b>
                  <small>{[fullscreen.feed.pollingUnit || fullscreen.feed.station, fullscreen.feed.ward, fullscreen.feed.lga].filter(Boolean).join(" · ") || "Location not assigned"}</small>
                </>
              ) : (
                <>
                  <b>{fullscreen.recording.submittedByName || "Field agent"} — Recording</b>
                  <small>{formatRecordingWhen(fullscreen.recording.createdAt)} · {[fullscreen.recording.geography?.pollingUnit, fullscreen.recording.geography?.ward, fullscreen.recording.geography?.lga].filter(Boolean).join(" · ") || "Location not assigned"}</small>
                </>
              )}
            </div>
            <button className="icon-btn" onClick={() => setFullscreen(null)}><FaTimes /></button>
          </div>
          <div className="live-fullscreen-body video-shell">
            {fullscreen.type === "live" ? (
              remoteStreams[fullscreen.feed.userId] ? (
                <StreamVideo stream={remoteStreams[fullscreen.feed.userId]} watermark={fullscreen.feed} />
              ) : viewerConnectFailed?.[fullscreen.feed.userId] ? (
                <div className="connect-feed connect-failed" role="alert">
                  <p>{viewerConnectFailed[fullscreen.feed.userId]}</p>
                  <button onClick={() => onView(fullscreen.feed.userId)}>Retry connection</button>
                </div>
              ) : (
                <div className="connect-feed connecting">Connecting…</div>
              )
            ) : fullscreen.loading ? (
              <div className="connect-feed connecting">Loading recording…</div>
            ) : fullscreen.error ? (
              <p role="alert">{fullscreen.error} <button onClick={() => playRecording(fullscreen.recording)}>Retry</button></p>
            ) : (
              <StreamVideo src={fullscreen.dataUrl} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
