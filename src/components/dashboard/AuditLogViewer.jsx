import { Fragment, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FaTimes } from 'react-icons/fa';
import { apiRequest } from '../../api/client.js';
import './audit-log-viewer.css';

const ENTITY_TYPES = ['', 'user', 'incident', 'resource', 'evidence', 'decision', 'reference_release'];
const PAGE_SIZE = 25;

const formatDetails = (details) => {
  if (!details || typeof details !== 'object' || !Object.keys(details).length) return '—';
  return Object.entries(details).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' · ');
};

const formatGeography = (geography) => {
  if (!geography) return '';
  return [geography.state, geography.lga, geography.ward, geography.pollingUnit].filter(Boolean).join(' · ');
};

function AuditLogTab({ authToken }) {
  const [filters, setFilters] = useState({ actorId: '', entityType: '', action: '', since: '', until: '' });
  const [offset, setOffset] = useState(0);

  const change = (event) => {
    setFilters((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    setOffset(0);
  };

  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });

  const log = useQuery({
    queryKey: ['audit-log', authToken, params.toString()],
    queryFn: ({ signal }) => apiRequest(`/audit?${params.toString()}`, authToken, { signal }),
    keepPreviousData: true,
  });

  const page = log.data;
  const pageEnd = page ? Math.min(page.offset + page.limit, page.total) : 0;

  return (
    <>
      <p className="alv-note">This is the permanent record: every login, result, incident, and change to a user or resource is written here automatically and can never be edited or deleted afterward — not even by an admin.</p>

      <div className="alv-filters">
        <label>Person (ID)<input name="actorId" value={filters.actorId} onChange={change} placeholder="e.g. u1" /></label>
        <label>Kind of record
          <select name="entityType" value={filters.entityType} onChange={change}>
            {ENTITY_TYPES.map((type) => <option key={type || 'any'} value={type}>{type || 'Any kind'}</option>)}
          </select>
        </label>
        <label>Action<input name="action" value={filters.action} onChange={change} placeholder="e.g. identity.user_created" /></label>
        <label>From date<input type="datetime-local" name="since" value={filters.since} onChange={change} /></label>
        <label>To date<input type="datetime-local" name="until" value={filters.until} onChange={change} /></label>
      </div>

      {log.isPending && <p role="status">Loading audit events…</p>}
      {log.isError && <p role="alert">{log.error.message} <button onClick={() => log.refetch()}>Retry</button></p>}

      {page && page.total === 0 && (
        <div className="alv-empty-state">
          <b>Nothing recorded yet — that's expected, not broken.</b>
          <p>As soon as anyone logs in, submits a result, or changes something important, it will show up here automatically. Once an event is written here, it can never be edited or deleted by anyone, including an admin.</p>
        </div>
      )}

      {page && page.total > 0 && (
        <>
          <div className="alv-summary">
            Showing {page.offset + 1}-{pageEnd} of {page.total}
          </div>
          <div className="alv-table-wrap">
            <table className="alv-table">
              <thead>
                <tr><th>When</th><th>Who</th><th>What happened</th><th>Record affected</th><th>Location</th><th>Details</th></tr>
              </thead>
              <tbody>
                {page.items.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                    <td>{entry.actorId || 'system'}{entry.actorRole ? <small> · {entry.actorRole}</small> : null}</td>
                    <td><code>{entry.action}</code></td>
                    <td>{entry.entityType}{entry.entityId ? <small> · {entry.entityId}</small> : null}</td>
                    <td>{formatGeography(entry.geography) || '—'}</td>
                    <td className="alv-details">{formatDetails(entry.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="alv-pagination">
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</button>
            <button disabled={pageEnd >= page.total} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</button>
          </div>
        </>
      )}
    </>
  );
}

function AccessReviewTab({ authToken }) {
  const [noteDrafts, setNoteDrafts] = useState({});
  const [openRow, setOpenRow] = useState('');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const client = useQueryClient();
  const key = ['access-review', authToken];
  const review = useQuery({ queryKey: key, queryFn: ({ signal }) => apiRequest('/security/access-review', authToken, { signal }) });

  const recordReview = async (userId) => {
    setBusyId(userId); setError('');
    try {
      await apiRequest(`/users/${userId}/access-review`, authToken, { method: 'POST', body: JSON.stringify({ notes: noteDrafts[userId] || '' }) });
      setOpenRow('');
      client.invalidateQueries({ queryKey: key });
    } catch (err) { setError(err.message); }
    finally { setBusyId(''); }
  };

  return (
    <>
      <p className="alv-note">Every Admin, Super Admin, and Supervisor account is checked off here periodically, to confirm each person still needs the access level they have. An account is "Overdue" if it's never been checked, or hasn't been checked recently enough.</p>
      {review.isPending && <p role="status">Loading access review status…</p>}
      {review.isError && <p role="alert">{review.error.message} <button onClick={() => review.refetch()}>Retry</button></p>}
      {review.data && review.data.length === 0 && (
        <div className="alv-empty-state">
          <b>No admin or supervisor accounts to review yet.</b>
          <p>Once Admin, Super Admin, or Supervisor accounts exist, they'll appear here for periodic review.</p>
        </div>
      )}
      {review.data && review.data.length > 0 && (
        <div className="alv-table-wrap">
          <table className="alv-table">
            <thead><tr><th>Account</th><th>Role</th><th>Last reviewed</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {review.data.map((account) => (
                <Fragment key={account.userId}>
                  <tr>
                    <td>{account.name}</td>
                    <td>{account.role}</td>
                    <td>{account.lastReviewedAt ? <>{new Date(account.lastReviewedAt).toLocaleString()}<small> by {account.lastReviewedBy}</small></> : 'Never'}</td>
                    <td><span className={`alv-badge ${account.overdue ? 'alv-overdue' : 'alv-current'}`}>{account.overdue ? 'Overdue' : 'Current'}</span></td>
                    <td><button onClick={() => setOpenRow(openRow === account.userId ? '' : account.userId)}>Check this account</button></td>
                  </tr>
                  {openRow === account.userId && (
                    <tr>
                      <td colSpan={5}>
                        <div className="alv-inline-review">
                          <input placeholder="Optional notes" value={noteDrafts[account.userId] || ''} onChange={(e) => setNoteDrafts((previous) => ({ ...previous, [account.userId]: e.target.value }))} />
                          <button className="primary" disabled={busyId === account.userId} onClick={() => recordReview(account.userId)}>{busyId === account.userId ? 'Saving…' : 'Confirm reviewed today'}</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}

const READY_OK_VALUES = ['ok', 'configured', 'cloudflare', 'expressturn'];
const READY_WARN_VALUES = ['not-configured', 'stun-fallback-only', 'checking'];

function StatCard({ label, value, hint, warn }) {
  return (
    <div className={`sh-stat-card${warn ? ' sh-stat-warn' : ''}`}>
      <span>{label}</span>
      <b>{value}</b>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function SystemHealthTab({ authToken }) {
  const ready = useQuery({
    queryKey: ['ops-ready', authToken],
    queryFn: ({ signal }) => apiRequest('/ready', authToken, { signal }),
    refetchInterval: 30000,
  });
  const metrics = useQuery({
    queryKey: ['ops-metrics', authToken],
    queryFn: ({ signal }) => apiRequest('/metrics', authToken, { signal }),
    refetchInterval: 30000,
  });

  return (
    <>
      <p className="alv-note">A live, plain read of whether the system itself is healthy right now — separate from election activity. Nobody gets automatically paged or texted from this screen; someone has to be looking at it.</p>

      <div className="sh-toolbar">
        <button type="button" onClick={() => { ready.refetch(); metrics.refetch(); }}>Refresh now</button>
        {ready.data && <span className="sh-checked-at">Checked {new Date(ready.data.checkedAt).toLocaleTimeString()}</span>}
      </div>

      {ready.isPending && <p role="status">Checking readiness…</p>}
      {ready.isError && <p role="alert">{ready.error.message} <button onClick={() => ready.refetch()}>Retry</button></p>}
      {ready.data && (
        <div className={`sh-ready-banner ${ready.data.ready ? 'sh-ready-ok' : 'sh-ready-down'}`}>
          <b>{ready.data.ready ? 'Ready to serve traffic' : 'Not ready'}</b>
          <div className="sh-chip-row">
            {Object.entries(ready.data.checks).filter(([key]) => key !== 'databaseError').map(([key, value]) => (
              <span key={key} className={`sh-chip ${READY_OK_VALUES.includes(value) ? 'sh-chip-ok' : READY_WARN_VALUES.includes(value) ? 'sh-chip-warn' : value === 'error' ? 'sh-chip-error' : ''}`}>
                {key}: {value}
              </span>
            ))}
          </div>
          {ready.data.checks.databaseError && <p role="alert" className="sh-error-detail">Database error: {ready.data.checks.databaseError}</p>}
        </div>
      )}

      {metrics.isPending && <p role="status">Loading metrics…</p>}
      {metrics.isError && <p role="alert">{metrics.error.message} <button onClick={() => metrics.refetch()}>Retry</button></p>}
      {metrics.data && (
        <>
          <div className="sh-stat-grid">
            <StatCard label="Incidents" value={metrics.data.incidents.total} hint={`${metrics.data.incidents.open} open`} warn={metrics.data.incidents.open > 0} />
            <StatCard label="Tasks" value={metrics.data.tasks.total} hint={`${metrics.data.tasks.overdue} overdue`} warn={metrics.data.tasks.overdue > 0} />
            <StatCard label="Notification outbox" value={metrics.data.notificationOutbox.pending} hint="pending delivery" warn={metrics.data.notificationOutbox.pending > 0} />
            <StatCard label="Reference data" value={metrics.data.referenceData.pendingApproval} hint="pending approval" warn={metrics.data.referenceData.pendingApproval > 0} />
            <StatCard label="Audit events" value={metrics.data.audit.eventsLast24h} hint="last 24h" />
          </div>
          <p className="alv-note">Generated {new Date(metrics.data.generatedAt).toLocaleString()}</p>
          <details className="area-coverage">
            <summary>Limitations ({metrics.data.limitations.length})</summary>
            <ul>{metrics.data.limitations.map((line, index) => <li key={index}>{line}</li>)}</ul>
          </details>
        </>
      )}
    </>
  );
}

function PolicyTab({ authToken }) {
  const policy = useQuery({ queryKey: ['security-policy', authToken], queryFn: ({ signal }) => apiRequest('/security/policy', authToken, { signal }) });
  if (policy.isPending) return <p role="status">Loading policy…</p>;
  if (policy.isError) return <p role="alert">{policy.error.message} <button onClick={() => policy.refetch()}>Retry</button></p>;
  const data = policy.data;
  return (
    <div className="alv-policy">
      <p className="alv-note">These are the fixed rules the platform enforces automatically — nobody can turn them off from within the app.</p>
      <div className="alv-policy-card">
        <h4>How long we keep records</h4>
        <p>Evidence (photos, documents): {data.retention.evidenceDays} days. Audit log entries: {data.retention.auditLogsDays} days.</p>
        <p className="area-note">Rule: {data.retention.deletionPolicy}</p>
      </div>
      <div className="alv-policy-card">
        <h4>Account check-up schedule</h4>
        <p>Every admin-level account gets reviewed at least every {data.accessReview.cadenceDays} days{data.accessReview.requiredForAdminChanges ? ', and before any admin-level change can be made' : ''}.</p>
      </div>
      <div className="alv-policy-card">
        <h4>System security setup</h4>
        <p>Running in {data.environment} mode{data.secretManagement.enforceProductionEnv ? ' — production security rules are enforced' : ''}.</p>
        <p className="area-note">Login security key length: {data.secretManagement.jwtSecretLength} bytes (longer is stronger).</p>
      </div>
      <div className="alv-policy-card alv-policy-wide">
        <h4>Who can do what</h4>
        <table className="alv-table">
          <thead><tr><th>Role</th><th>Can see/act on</th><th>Widest reach</th></tr></thead>
          <tbody>
            {Object.entries(data.roleScope).map(([role, scope]) => (
              <tr key={role}><td>{role}</td><td>{scope.geographies.join(', ')}</td><td>{scope.maxScope}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AuditLogViewer({ authToken, onClose }) {
  const [tab, setTab] = useState('log');
  return (
    <section className="camera-panel audit-log-viewer">
      <div className="camera-head">
        <div>
          <span className="eyebrow">SECURITY &amp; GOVERNANCE</span>
          <h2>{tab === 'log' ? 'Activity Log' : tab === 'review' ? 'Access Review' : tab === 'health' ? 'System Health' : 'Policy'}</h2>
        </div>
        <button className="icon-btn" onClick={onClose}><FaTimes /></button>
      </div>
      <p className="alv-intro">
        A tamper-proof record of who did what, so any dispute about a result or an action can be proven either way.{' '}
        <b>Activity Log</b> is the permanent record itself. <b>Access Review</b> checks that admin accounts still need the access they have.{' '}
        <b>Policy</b> is the plain rules this is all built on. <b>System Health</b> is a separate check on whether the platform itself is running well.
      </p>
      <div className="rc-tab-bar">
        <button className={tab === 'log' ? 'rc-tab active' : 'rc-tab'} onClick={() => setTab('log')}>Activity Log</button>
        <button className={tab === 'review' ? 'rc-tab active' : 'rc-tab'} onClick={() => setTab('review')}>Access Review</button>
        <button className={tab === 'policy' ? 'rc-tab active' : 'rc-tab'} onClick={() => setTab('policy')}>Policy</button>
        <button className={tab === 'health' ? 'rc-tab active' : 'rc-tab'} onClick={() => setTab('health')}>System Health</button>
      </div>
      {tab === 'log' && <AuditLogTab authToken={authToken} />}
      {tab === 'review' && <AccessReviewTab authToken={authToken} />}
      {tab === 'policy' && <PolicyTab authToken={authToken} />}
      {tab === 'health' && <SystemHealthTab authToken={authToken} />}
    </section>
  );
}
