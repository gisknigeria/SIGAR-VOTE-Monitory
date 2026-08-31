import { useEffect, useRef, useState } from "react";
import { FaVolumeDown, FaVolumeMute, FaVolumeUp } from "react-icons/fa";

const cameraWatermarkLines = (feed = {}) => {
  const location = feed.location || {};
  const primary = location.name || location.displayName || feed.locationName || feed.station || "Location unavailable";
  return [
    primary,
    location.street && location.street !== primary ? location.street : "",
    `Polling Unit: ${feed.pollingUnit || feed.station || "Not assigned"}`,
    `Ward: ${feed.ward || "Not assigned"}  •  LGA: ${feed.lga || "Not assigned"}`,
    Number(feed.accuracy) > 0 ? `GPS accuracy ±${Math.round(Number(feed.accuracy))} m` : "",
    feed.timestamp ? new Date(feed.timestamp).toLocaleString() : new Date().toLocaleString(),
  ].filter(Boolean);
};

export default function StreamVideo({ src, stream, muted = false, showControls = true, watermark }) {
  const videoRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [soundMuted, setSoundMuted] = useState(muted);
  const [volume, setVolume] = useState(muted ? 0 : 1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
      return () => { video.srcObject = null; };
    }
    if (!src) return;
    let hls;
    let disposed = false;
    const attachSource = async () => {
      if (src.includes(".m3u8") && !video.canPlayType("application/vnd.apple.mpegurl")) {
        const { default: Hls } = await import("hls.js");
        if (disposed) return;
        if (Hls.isSupported()) {
          hls = new Hls({ lowLatencyMode: true });
          hls.loadSource(src);
          hls.attachMedia(video);
          return;
        }
      }
      video.src = src;
    };
    attachSource();
    return () => {
      disposed = true;
      hls?.destroy();
      video.removeAttribute("src");
    };
  }, [src, stream]);

  useEffect(() => {
    const video = videoRef.current;
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
    const video = videoRef.current;
    try {
      const source = stream || video?.captureStream?.() || video?.mozCaptureStream?.();
      if (!source) throw new Error("Recording is not supported in this browser");
      chunksRef.current = [];
      const recorder = new MediaRecorder(source, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm",
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
      <video ref={videoRef} controls={showControls} autoPlay playsInline muted={soundMuted} />
      {watermark && (
        <div className="video-location-watermark">
          {cameraWatermarkLines(watermark).map((line, index) => index === 0
            ? <strong key={line}>{line}</strong>
            : <span key={`${line}-${index}`}>{line}</span>)}
          <small>© OpenStreetMap contributors</small>
        </div>
      )}
      {showControls && (
        <>
          <div className="stream-audio-controls">
            <button type="button" onClick={toggleSound} title={soundMuted || volume === 0 ? "Turn sound on" : "Turn sound off"} aria-label={soundMuted || volume === 0 ? "Turn sound on" : "Turn sound off"}>
              {soundMuted || volume === 0 ? <FaVolumeMute /> : volume < 0.5 ? <FaVolumeDown /> : <FaVolumeUp />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={soundMuted ? 0 : volume}
              onChange={(event) => {
                const nextVolume = Number(event.target.value);
                setVolume(nextVolume);
                setSoundMuted(nextVolume === 0);
              }}
              aria-label="Stream volume"
              title={`Volume ${Math.round((soundMuted ? 0 : volume) * 100)}%`}
            />
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
