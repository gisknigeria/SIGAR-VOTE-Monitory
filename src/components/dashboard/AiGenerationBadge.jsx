import "./ai-generation-badge.css";

const GENERATION_LABELS = {
  "generative-ai": "AI Generated",
  "machine-learning": "ML Generated",
  "predictive-model": "Predictive Model",
  statistical: "Statistical",
  "deterministic-rule": "Rule-Based",
};

// Renders the AI/analytical governance envelope (generationType, provider, model,
// generatedAt, uncertainty, reviewStatus) that the backend attaches to every
// generated response, so readers can tell AI-authored text from a deterministic
// fallback at a glance instead of trusting prose alone.
export default function AiGenerationBadge({ meta }) {
  if (!meta || !meta.generationType) return null;
  const label = GENERATION_LABELS[meta.generationType] || meta.generationType;
  const source = [meta.provider, meta.model].filter((value) => value && value !== "local").join(" ");
  const when = meta.generatedAt ? new Date(meta.generatedAt).toLocaleString() : "";
  const title = [
    `Generation type: ${meta.generationType}`,
    meta.provider ? `Provider: ${meta.provider}` : "",
    meta.model ? `Model: ${meta.model}` : "",
    when ? `Generated: ${when}` : "",
    meta.uncertainty ? `Uncertainty: ${meta.uncertainty}` : "",
    meta.reviewStatus ? `Review status: ${meta.reviewStatus}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <span className={`ai-gen-badge ai-gen-${meta.generationType}`} title={title}>
      {label}
      {source ? <small>{source}</small> : null}
    </span>
  );
}
