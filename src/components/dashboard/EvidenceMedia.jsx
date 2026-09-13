import { useEffect, useState } from "react";
import { apiRequest } from "../../api/client.js";

/**
 * Photos and videos are stored as private evidence references (id + metadata, no bytes), so the
 * media has to be fetched per item from /evidence/:id. Incidents created before that pipeline
 * still carry an inline `data` URL, which is used as-is.
 */
export function useEvidenceUrl(item, token) {
  const [dataUrl, setDataUrl] = useState(item?.data || "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (item?.data || !item?.id) return;
    let cancelled = false;
    setError("");
    apiRequest(`/evidence/${item.id}`, token)
      .then((evidence) => { if (!cancelled) setDataUrl(evidence.data || ""); })
      .catch((fetchError) => { if (!cancelled) setError(fetchError.message || "Unable to load this attachment"); });
    return () => { cancelled = true; };
  }, [item?.id, item?.data, token]);

  return { dataUrl, error };
}

/** Full-size renderer for the incident detail panel. */
export function EvidenceMedia({ item, index, token }) {
  const { dataUrl, error } = useEvidenceUrl(item, token);

  if (error) return <p role="alert" className="report-attachment-error">{error}</p>;
  if (!dataUrl) return <div className="report-attachment-loading">Loading attachment…</div>;

  if (item.type === "document")
    return (
      <a className="report-document-attachment" href={dataUrl} download={item.name || `report-document-${index + 1}`}>
        {item.name || `Document ${index + 1}`}
      </a>
    );

  if (item.type === "video")
    return (
      <div className="report-video-attachment">
        <video controls playsInline preload="metadata">
          <source src={dataUrl} type={item.mimeType || (dataUrl.startsWith("data:video/mp4") ? "video/mp4" : "video/webm")} />
        </video>
        <a href={dataUrl} download={item.name || `report-video-${index + 1}.webm`}>Download video</a>
      </div>
    );

  return <img src={dataUrl} alt={item.name || `Incident attachment ${index + 1}`} />;
}

/** Compact thumbnail for table cells, linking out to the full-size image. */
export function EvidenceThumb({ item, token, alt }) {
  const { dataUrl, error } = useEvidenceUrl(item, token);
  if (error) return <span className="result-evidence-missing" title={error}>!</span>;
  if (!dataUrl) return <span className="result-evidence-loading" aria-label="Loading evidence">…</span>;
  return (
    <a href={dataUrl} target="_blank" rel="noreferrer">
      <img src={dataUrl} alt={alt} />
    </a>
  );
}

export default EvidenceMedia;
