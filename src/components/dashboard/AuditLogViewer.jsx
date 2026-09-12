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
      <p className="alv-note">Every identity, access, reference-approval, incident, resource, decision, and evidence change is recorded here and cannot be edited or deleted once written.</p>

      <div className="alv-filters">
        <label>Actor ID<input name="actorId" value={filters.actorId} onChange={change} placeholder="e.g. u1" /></label>
        <label>Entity type
          <select name="entityType" value={filters.entityType} onChange={change}>
            {ENTITY_TYPES.map((type) => <option key={type || 'any'} value={type}>{type || 'All entity types'}</option>)}
          </select>
        </label>
        <label>Action<input name="action" value={filters.action} onChange={change} placeholder="e.g. identity.user_created" /></label>
        <label>Since<input type="datetime-local" name="since" value={filters.since} onChange={change} /></label>
        <label>Until<input type="datetime-local" name="until" value={filters.until} onChange={change} /></label>
      </div>

      {log.isPending && <p role="status">Loading audit events…</p>}
      {log.isError && <p role="alert">{log.error.message} <button onClick={() => log.refetch()}>Retry</button></p>}

      {page && (
        <>
          <div className="alv-summary">
            {page.total ? `Showing ${page.offset + 1}-${pageEnd} of ${page.total}` : 'No audit events match these filters.'}
          </div>
          <div className="alv-table-wrap">
            <table className="alv-table">
              <thead>
                <tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Geography</th><th>Details</th></tr>
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
      <p className="alv-note">Every Admin, Super Admin, and Supervisor account is listed here. An account is overdue if it has never been reviewed, or was last reviewed more than the configured cadence ago.</p>
      {review.isPending && <p role="status">Loading access review status…</p>}
      {review.isError && <p role="alert">{review.error.message} <button onClick={() => review.refetch()}>Retry</button></p>}
      {review.data && (
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
                    <td><button onClick={() => setOpenRow(openRow === account.userId ? '' : account.userId)}>Record review</button></td>
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
      <p className="alv-note">Composed readiness and operational counters for an external monitor to poll. No alert dispatch is wired to these numbers &mdash; nothing here pages anyone automatically.</p>

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
            <StatCard label="Notification outbox" value={metrics.data.notificationOutbox.pendingApprox} hint={`capped at ${metrics.data.notificationOutbox.cappedAt}`} warn={metrics.data.notificationOutbox.pendingApprox > 0} />
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
      <div className="alv-policy-card">
        <h4>Retention</h4>
        <p>Evidence retained {data.retention.evidenceDays} days. Audit records retained {data.retention.auditLogsDays} days.</p>
        <p className="area-note">Policy: {data.retention.deletionPolicy}</p>
      </div>
      <div className="alv-policy-card">
        <h4>Access review</h4>
        <p>Cadence: every {data.accessReview.cadenceDays} days{data.accessReview.requiredForAdminChanges ? ' · required before admin changes' : ''}.</p>
      </div>
      <div className="alv-policy-card">
        <h4>Secrets &amp; environment</h4>
        <p>Environment: {data.environment}{data.secretManagement.enforceProductionEnv ? ' (production secrets enforced)' : ''}.</p>
        <p className="area-note">JWT secret length: {data.secretManagement.jwtSecretLength} bytes.</p>
      </div>
      <div className="alv-policy-card alv-policy-wide">
        <h4>Role scope</h4>
        <table className="alv-table">
          <thead><tr><th>Role</th><th>Geographies</th><th>Max scope</th></tr></thead>
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
          <h2>{tab === 'log' ? 'Audit Log' : tab === 'review' ? 'Access Review' : tab === 'health' ? 'System Health' : 'Policy'}</h2>
        </div>
        <button className="icon-btn" onClick={onClose}><FaTimes /></button>
      </div>
      <div className="rc-tab-bar">
        <button className={tab === 'log' ? 'rc-tab active' : 'rc-tab'} onClick={() => setTab('log')}>Audit Log</button>
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
