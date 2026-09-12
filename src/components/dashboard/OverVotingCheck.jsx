import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/client.js';
import './over-voting-check.css';

const STATUS_LABEL = {
  'exceeds-registered-voters': 'Exceeds registered voters',
  'within-bounds': 'Within registered voters',
  unknown: 'No data at this scope',
};

export default function OverVotingCheck({ authToken, geography = { state: 'Oyo' } }) {
  const params = new URLSearchParams(Object.entries(geography).filter(([, value]) => value));
  const check = useQuery({
    queryKey: ['over-voting', authToken, params.toString()],
    queryFn: ({ signal }) => apiRequest(`/reports/over-voting?${params.toString()}`, authToken, { signal }),
  });

  const scopeLabel = [geography.state, geography.lga, geography.ward, geography.pollingUnit].filter(Boolean).join(' · ') || 'Oyo State';

  return (
    <article className="post-card overvoting-card">
      <header>
        <div>
          <h3>Over-Voting Check</h3>
          <p>Submitted votes vs. registered voters — {scopeLabel}</p>
        </div>
        {check.data && <span className={`overvoting-badge overvoting-${check.data.status}`}>{STATUS_LABEL[check.data.status]}</span>}
      </header>

      {check.isPending && <p role="status">Checking…</p>}
      {check.isError && <p role="alert">{check.error.message} <button onClick={() => check.refetch()}>Retry</button></p>}

      {check.data && (
        <>
          <div className="overvoting-figures">
            <div><span>Submitted votes</span><b>{check.data.submittedVotes.toLocaleString()}</b></div>
            <div><span>Registered voters</span><b>{check.data.registeredVoters !== null ? check.data.registeredVoters.toLocaleString() : '—'}</b></div>
            <div><span>Polling units reporting</span><b>{check.data.pollingUnitsReporting.toLocaleString()}</b></div>
            {check.data.status === 'exceeds-registered-voters' && (
              <div className="overvoting-excess"><span>Excess votes</span><b>{check.data.excessVotes.toLocaleString()}</b></div>
            )}
          </div>
          {check.data.status === 'unknown' ? (
            <p className="post-card-note">{check.data.note}</p>
          ) : (
            <p className="post-card-note">
              {check.data.registeredVotersSource.sourceName} ({check.data.registeredVotersSource.sourceVersion}) · {check.data.methodology}
            </p>
          )}
        </>
      )}
    </article>
  );
}
