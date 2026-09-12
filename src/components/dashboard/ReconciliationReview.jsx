import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client.js';
import './reconciliation-review.css';

const STATUS_FILTERS = [
  { value: 'pending-review', label: 'Pending review' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: '', label: 'All' },
];

const DECISIONS = [
  { value: 'accept-official', label: 'Accept the official record' },
  { value: 'retain-provisional', label: 'Retain the provisional (field) record' },
  { value: 'reject-official', label: 'Reject the official record' },
  { value: 'correct', label: 'Apply a corrected result' },
];

function CorrectionViewer({ authToken, reconciliationId }) {
  const corrections = useQuery({
    queryKey: ['reconciliation-corrections', authToken, reconciliationId],
    queryFn: ({ signal }) => apiRequest(`/results/reconciliation/${reconciliationId}/corrections`, authToken, { signal }),
  });
  if (corrections.isPending) return <p role="status">Loading correction…</p>;
  if (corrections.isError) return <p role="alert">{corrections.error.message}</p>;
  if (!corrections.data?.length) return <p className="area-note">No correction record found for this case.</p>;
  return (
    <div className="rr-corrections">
      {corrections.data.map((item) => (
        <div key={item.id} className="rr-correction">
          <span>Corrected by {item.correctedBy || 'unknown'} · {new Date(item.createdAt).toLocaleString()}</span>
          <p>{item.reason}</p>
          <ul>{Object.entries(item.correctedResult || {}).map(([party, votes]) => <li key={party}><b>{party}</b>: {votes}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

function ReconciliationCase({ authToken, item, onReviewed }) {
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [correctedVotes, setCorrectedVotes] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showCorrection, setShowCorrection] = useState(false);

  const parties = [...new Set((item.discrepancies || []).map((entry) => entry.party))];

  const submit = async () => {
    setError('');
    if (!decision) { setError('Choose a decision.'); return; }
    if (!reason.trim()) { setError('A reason is required.'); return; }
    const correctedResult = Object.fromEntries(parties.filter((party) => correctedVotes[party] !== undefined && correctedVotes[party] !== '').map((party) => [party, Number(correctedVotes[party])]));
    if (decision === 'correct' && !Object.keys(correctedResult).length) { setError('Enter at least one corrected vote count.'); return; }
    setBusy(true);
    try {
      const body = { decision, reason: reason.trim() };
      if (decision === 'correct') body.correctedResult = correctedResult;
      await apiRequest(`/results/reconciliation/${item.id}/review`, authToken, { method: 'POST', body: JSON.stringify(body) });
      setOpen(false);
      onReviewed();
    } catch (err) {
      setError(err.message || 'Could not save the review decision.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rr-case">
      <div className="rr-case-head">
        <div>
          <b>{item.pollingUnit || 'Unknown polling unit'}</b>
          <span>{item.electionId} · {item.contestId} · source {item.sourceVersion}</span>
        </div>
        <span className={`rr-status ${item.status === 'reviewed' ? 'rr-status-reviewed' : 'rr-status-pending'}`}>{item.status === 'reviewed' ? 'Reviewed' : 'Pending review'}</span>
      </div>

      <ul className="rr-discrepancies">
        {(item.discrepancies || []).map((entry, index) => (
          <li key={index}><b>{entry.party}</b> observed {entry.observed ?? '—'} vs official {entry.official ?? '—'} <small>({entry.reason})</small></li>
        ))}
        {!(item.discrepancies || []).length && <li className="area-note">No party-level discrepancies were recorded for this case.</li>}
      </ul>

      {item.status === 'reviewed' && item.reviewerDecision && (
        <p className="area-note">Decision: <b>{item.reviewerDecision.decision}</b> — {item.reviewerDecision.reason} <small>by {item.reviewerId} at {new Date(item.reviewedAt).toLocaleString()}</small></p>
      )}
      {item.status === 'reviewed' && item.correctionId && (
        <>
          <button type="button" onClick={() => setShowCorrection((value) => !value)}>{showCorrection ? 'Hide correction' : 'View correction'}</button>
          {showCorrection && <CorrectionViewer authToken={authToken} reconciliationId={item.id} />}
        </>
      )}

      {item.status !== 'reviewed' && (
        <>
          <button type="button" onClick={() => setOpen((value) => !value)}>{open ? 'Cancel review' : 'Review this case'}</button>
          {open && (
            <div className="rr-review-form">
              <label>Decision
                <select value={decision} onChange={(event) => setDecision(event.target.value)}>
                  <option value="">Choose…</option>
                  {DECISIONS.map((item2) => <option key={item2.value} value={item2.value}>{item2.label}</option>)}
                </select>
              </label>
              <label>Reason
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the basis for this decision" />
              </label>
              {decision === 'correct' && parties.length > 0 && (
                <div className="rr-corrected-votes">
                  {parties.map((party) => (
                    <label key={party}>{party}
                      <input type="number" min="0" value={correctedVotes[party] ?? ''} onChange={(event) => setCorrectedVotes((previous) => ({ ...previous, [party]: event.target.value }))} />
                    </label>
                  ))}
                </div>
              )}
              {error && <p role="alert">{error}</p>}
              <button type="button" className="primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Submit decision'}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ReconciliationReview({ authToken }) {
  const [status, setStatus] = useState('pending-review');
  const client = useQueryClient();
  const cases = useQuery({
    queryKey: ['reconciliation-cases', authToken, status],
    queryFn: ({ signal }) => apiRequest(`/results/reconciliation${status ? `?status=${status}` : ''}`, authToken, { signal }),
  });

  return (
    <article className="post-card reconciliation-card">
      <header>
        <div>
          <h3>Reconciliation Review</h3>
          <p>Formal field-vs-official discrepancy cases requiring an independent reviewer decision</p>
        </div>
        <label className="rr-status-filter">
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {STATUS_FILTERS.map((item) => <option key={item.value || 'all'} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </header>

      {cases.isPending && <p role="status">Loading reconciliation cases…</p>}
      {cases.isError && <p role="alert">{cases.error.message} <button onClick={() => cases.refetch()}>Retry</button></p>}
      {cases.data && !cases.data.length && (
        <p className="area-note">No reconciliation cases{status ? ` with status "${status}"` : ''} yet.</p>
      )}
      {cases.data && cases.data.length > 0 && (
        <div className="rr-case-list">
          {cases.data.map((item) => (
            <ReconciliationCase
              key={item.id}
              authToken={authToken}
              item={item}
              onReviewed={() => client.invalidateQueries({ queryKey: ['reconciliation-cases', authToken] })}
            />
          ))}
        </div>
      )}
      <p className="post-card-note">Reconciliation cases are opened by comparing a submitted field result against an approved authoritative record; that comparison is currently only available directly through the API, not yet from this dashboard.</p>
    </article>
  );
}
