import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { FaCircle, FaTimes, FaVolumeDown, FaVolumeMute, FaVolumeUp } from "react-icons/fa";

function StreamVideo({ src, stream, muted = false, showControls = true }) {
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

  const toggleRecording = () => {
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
      chunksRef.current = [];
      const recorder = new MediaRecorder(source, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : "video/webm",
      });
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        setRecording(false);
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
  turnStatus,
  isAdmin,
  onClose,
  onCreate,
  onDelete,
  onView,
  onShowMap,
}) {
  const [recordAll, setRecordAll] = useState(false);
  const [sharingFeedId, setSharingFeedId] = useState(null);
  const recordersRef = useRef({});
  const requestedFeedsRef = useRef(new Set());
  const [form, setForm] = useState({
    name: "",
    type: "CCTV",
    url: "",
    lat: "7.3775",
    lng: "3.9470",
  });
  const [view, setView] = useState("All");

  const submit = async (e) => {
    e.preventDefault();
    await onCreate(form);
    setForm({ name: "", type: "CCTV", url: "", lat: "7.3775", lng: "3.9470" });
  };

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

  const turnStatusLabel = turnStatus?.route === "turn"
    ? "Connected via Metered TURN"
    : turnStatus?.provider === "metered" && turnStatus?.route === "direct"
      ? "Metered ready · direct route"
      : turnStatus?.provider === "metered"
        ? `Metered TURN ready${turnStatus?.region ? ` · ${turnStatus.region}` : ""}`
        : turnStatus?.provider === "stun-fallback"
          ? "STUN fallback only"
          : "Checking TURN";

  useEffect(() => {
    if (!isAdmin) return;
    const availableIds = new Set(phoneFeeds.map((feed) => String(feed.userId)));
    requestedFeedsRef.current.forEach((id) => {
      if (!availableIds.has(String(id))) requestedFeedsRef.current.delete(id);
    });
    phoneFeeds.forEach((feed) => {
      const id = String(feed.userId);
      if (!remoteStreams[feed.userId] && !requestedFeedsRef.current.has(id)) {
        requestedFeedsRef.current.add(id);
        onView(feed.userId);
      }
    });
  }, [isAdmin, phoneShares, remoteStreams, onView]);

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
      const mimeType = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
        .find((type) => MediaRecorder.isTypeSupported?.(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks = [];
      recorder.ondataavailable = (event) => event.data?.size && chunks.push(event.data);
      const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
      recorder.start(500);
      setTimeout(() => recorder.state !== "inactive" && recorder.stop(), 10000);
      await stopped;
      const type = recorder.mimeType || mimeType || "video/webm";
      const extension = type.includes("mp4") ? "mp4" : "webm";
      const unit = String(feed.pollingUnit || feed.station || "live-feed").replace(/[^a-z0-9_-]+/gi, "-");
      const file = new File(chunks, `${unit}_${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`, { type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "Election monitoring live feed", text: `${feed.name || "Field agent"} — ${feed.pollingUnit || "Polling unit"}`, files: [file] });
      } else {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(file);
        link.download = file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        alert("The video was downloaded. You can attach it to your social media post.");
      }
    } catch (error) {
      if (error.name !== "AbortError") alert(error.message || "Unable to share this feed");
    } finally {
      setSharingFeedId(null);
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
          <h2>{view === "Drone" ? "Drone view" : "Camera feeds"}</h2>
        </div>
        <div className="camera-head-actions">
          <span className={`turn-status ${turnStatus?.route === "turn" ? "relayed" : turnStatus?.provider === "metered" ? "ready" : "fallback"}`}>
            {turnStatusLabel}
          </span>
          <button className="icon-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
      </div>
      <div className="camera-tabs">
        {["All", "Phone", "CCTV", "Drone"].map((tab) => (
          <button
            key={tab}
            className={view === tab ? "active" : ""}
            onClick={() => setView(tab)}
          >
            {tab} <i>{counts[tab]}</i>
          </button>
        ))}
      </div>
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
              <div className="video-shell">
                {remoteStreams[feed.userId] ? (
                  <StreamVideo stream={remoteStreams[feed.userId]} />
                ) : (
                  <button
                    className="connect-feed"
                    onClick={() => onView(feed.userId)}
                  >
                    Play Connect
                  </button>
                )}
              </div>
              <div className="camera-meta">
                <div>
                  <b>{feed.name}</b>
                  <small>PHONE / WEBRTC</small>
                </div>
                <span className="live-badge">
                  <FaCircle size={8} style={{ marginRight: 3 }} />
                  LIVE
                </span>
              </div>
              <div className="camera-actions">
                {feed.lat && (
                  <button onClick={() => onShowMap(feed)}>Show on map</button>
                )}
                <button disabled={sharingFeedId === feed.userId} onClick={() => shareFeedVideo(feed)}>
                  {sharingFeedId === feed.userId ? "Recording 10s…" : "Share video"}
                </button>
              </div>
              <div className="agent-feed-hover">
                <b>{feed.name || "Agent"}</b>
                <span>{feed.role || "Agent"}</span>
                <span>Polling unit: {feed.pollingUnit || feed.station || "Not assigned"}</span>
                {(feed.ward || feed.lga) && (
                  <span>{[feed.ward, feed.lga].filter(Boolean).join(" · ")}</span>
                )}
                {feed.email && <span>{feed.email}</span>}
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
      {isAdmin && (
        <form className="camera-form" onSubmit={submit}>
          <h3>Add CCTV / drone stream</h3>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Camera name"
          />
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option>CCTV</option>
            <option>Drone</option>
            <option>Vehicle</option>
            <option>Other</option>
          </select>
          <input
            required
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="HLS URL ending in .m3u8 or video URL"
          />
          <input
            value={form.lat}
            onChange={(e) => setForm({ ...form, lat: e.target.value })}
            placeholder="Latitude"
          />
          <input
            value={form.lng}
            onChange={(e) => setForm({ ...form, lng: e.target.value })}
            placeholder="Longitude"
          />
          <button className="primary">Add feed</button>
        </form>
      )}
    </section>
  );
}
