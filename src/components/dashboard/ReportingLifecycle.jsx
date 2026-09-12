import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client.js';
import { getRegistrationLocationOptions } from '../../../shared/electionData.js';
import './reporting-lifecycle.css';

const PHASES = [
  { value: '', label: 'Custom range' },
  { value: 'pre-election', label: 'Pre-election' },
  { value: 'election-day', label: 'Election day' },
  { value: 'post-election', label: 'Post-election' },
];

const formatDuration = (ms) => {
  if (ms === null || ms === undefined) return '—';
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${minutes} min`;
  return `${(minutes / 60).toFixed(1)} hr`;
};

const buildQuery = (filter) => {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => { if (value) params.set(key, value); });
  return params.toString();
};

function ScopeFilters({ filter, onChange }) {
  const options = getRegistrationLocationOptions('Oyo', filter.lga, filter.ward);
  return (
    <div className="area-operation-form reporting-filters">
      <label>Local government
        <select name="lga" value={filter.lga} onChange={onChange}>
          <option value="">All of Oyo State</option>
          {options.lgas.map((name) => <option key={name}>{name}</option>)}
        </select>
      </label>
      <label>Ward
        <select name="ward" value={filter.ward} onChange={onChange} disabled={!filter.lga}>
          <option value="">All wards</option>
          {options.wards.map((name) => <option key={name}>{name}</option>)}
        </select>
      </label>
      <label>Polling unit
        <select name="pollingUnit" value={filter.pollingUnit} onChange={onChange} disabled={!filter.ward}>
          <option value="">All polling units</option>
          {options.pollingUnits.map((name, index) => <option key={`${name}-${index}`}>{name}</option>)}
        </select>
      </label>
      <label>Lifecycle phase
        <select name="phase" value={filter.phase} onChange={onChange}>
          {PHASES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label>Since<input type="datetime-local" name="since" value={filter.since} onChange={onChange} /></label>
      <label>Until<input type="datetime-local" name="until" value={filter.until} onChange={onChange} /></label>
      <label>Election ID<input name="electionId" value={filter.electionId} onChange={onChange} placeholder="e.g. ng-oyo-election" /></label>
      <label>Contest ID<input name="contestId" value={filter.contestId} onChange={onChange} placeholder="e.g. governor" /></label>
    </div>
  );
}

function StatTile({ label, value, hint }) {
  return (
    <div>
      <span>{label}</span>
      <b>{value}{hint ? <small> {hint}</small> : null}</b>
    </div>
  );
}

function RollupTable({ title, groups }) {
  if (!groups?.length) return null;
  const top = [...groups].sort((a, b) => b.records - a.records).slice(0, 8);
  const geoKeys = ['state', 'lga', 'ward', 'pollingUnit'].filter((key) => top.some((group) => group.geography[key] !== undefined));
  return (
    <div className="geo-view-rollup">
      <h5>{title}</h5>
      <table>
        <thead><tr>{geoKeys.map((key) => <th key={key}>{key}</th>)}<th>Records</th></tr></thead>
        <tbody>
          {top.map((group, index) => (
            <tr key={index}>
              {geoKeys.map((key) => <td key={key}>{group.geography[key] || '—'}</td>)}
              <td>{group.records}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportMetrics({ data }) {
  const { metrics, scope, window, rollups, sources, metadata } = data;
  const scopeLabel = [scope.state, scope.lga, scope.ward, scope.pollingUnit].filter(Boolean).join(' · ') || 'Oyo State (all)';
  const windowLabel = window.since || window.until
    ? `${window.since ? new Date(window.since).toLocaleString() : 'start of records'} → ${window.until ? new Date(window.until).toLocaleString() : 'now'}${window.phase ? ` (${window.phase})` : ''}`
    : 'All time';
  const shortResourceLines = (metrics.resources.byType || []).filter((row) => row.missing > 0);
  return (
    <>
      <div className="geo-view-scope-summary">
        <span className="eyebrow">{scopeLabel}</span>
        <span className="geo-view-generated">Generated {new Date(data.generatedAt).toLocaleString()}</span>
      </div>
      <p className="area-note reporting-window-note">Window: {windowLabel}</p>

      <div className="area-coverage-grid geo-view-stats">
        <StatTile label="Result coverage" value={`${metrics.coverage.percent}%`} hint={`(${metrics.coverage.submitted}/${metrics.coverage.denominator})`} />
        <StatTile label="Records last 24h" value={metrics.timeliness.recordsLast24h} />
        <StatTile label="Open incidents" value={metrics.backlog.openIncidents} />
        <StatTile label="Pending decisions" value={metrics.backlog.pendingDecisions} />
        <StatTile label="Open/overdue tasks" value={metrics.backlog.openOrOverdueTasks} />
        <StatTile label="Geography completeness" value={`${metrics.quality.completenessPercent}%`} hint={`(${metrics.quality.completeGeographyRecords}/${metrics.quality.totalIncidentRecords})`} />
        <StatTile label="Avg. time to acknowledge" value={formatDuration(metrics.responseTime.averageMillisecondsToAcknowledge)} />
        <StatTile label="Avg. time to resolve" value={formatDuration(metrics.responseTime.averageMillisecondsToResolve)} />
        <StatTile label="Resource lines short" value={shortResourceLines.length} />
        <StatTile label="Reconciliations pending" value={metrics.reconciliation.pending} />
      </div>

      <div className="geo-view-outcomes">
        <h4>Outcomes</h4>
        <p>
          {metrics.outcomes.decisionsCompleted} decision{metrics.outcomes.decisionsCompleted === 1 ? '' : 's'} completed
          {' · '}{metrics.outcomes.decisionsRejected} rejected
          {' · '}{metrics.outcomes.tasksCompleted} task{metrics.outcomes.tasksCompleted === 1 ? '' : 's'} completed
          {' · '}{metrics.outcomes.tasksOpenOrOverdue} open or overdue
        </p>
      </div>

      {shortResourceLines.length > 0 && (
        <div className="geo-view-panel reporting-resource-panel">
          <h4>Resource shortfalls</h4>
          <table className="geo-view-resource-table">
            <thead><tr><th>Type</th><th>Required</th><th>Deployed</th><th>Missing</th></tr></thead>
            <tbody>
              {shortResourceLines.map((row, index) => (
                <tr key={index} className="geo-view-shortfall">
                  <td>{row.resourceType}</td><td>{row.required}</td><td>{row.deployed}</td><td>{row.missing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="geo-view-rollups">
        <h4>Roll-ups</h4>
        <div className="geo-view-rollup-grid">
          <RollupTable title="By LGA" groups={rollups.byLga} />
          <RollupTable title="By ward" groups={rollups.byWard} />
          <RollupTable title="By polling unit" groups={rollups.byPollingUnit} />
        </div>
      </div>

      <p className="area-note reporting-sources-note">
        Sources: {Object.entries(sources).map(([key, count]) => `${key} ${count}`).join(' · ')}
      </p>

      <details className="area-coverage geo-view-limitations">
        <summary>What this report does not show ({metadata.limitations.length})</summary>
        <ul>{metadata.limitations.map((line, index) => <li key={index}>{line}</li>)}</ul>
      </details>
    </>
  );
}

export default function ReportingLifecycle({ authToken }) {
  const [filter, setFilter] = useState({ lga: '', ward: '', pollingUnit: '', phase: '', since: '', until: '', electionId: '', contestId: '' });
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState('');
  const [viewingId, setViewingId] = useState('');
  const client = useQueryClient();

  const change = (event) => {
    const { name, value } = event.target;
    setFilter((previous) => ({
      ...previous,
      [name]: value,
      ...(name === 'lga' ? { ward: '', pollingUnit: '' } : {}),
      ...(name === 'ward' ? { pollingUnit: '' } : {}),
    }));
    setSaveMessage(''); setSaveError('');
  };

  const queryString = buildQuery(filter);
  const report = useQuery({
    queryKey: ['reporting-operational', authToken, queryString],
    queryFn: ({ signal }) => apiRequest(`/reports/operational${queryString ? `?${queryString}` : ''}`, authToken, { signal }),
  });

  const snapshots = useQuery({
    queryKey: ['reporting-snapshots', authToken],
    queryFn: ({ signal }) => apiRequest('/reports/operational/snapshots', authToken, { signal }),
  });

  const snapshotDetail = useQuery({
    queryKey: ['reporting-snapshot', authToken, viewingId],
    queryFn: ({ signal }) => apiRequest(`/reports/operational/snapshots/${viewingId}`, authToken, { signal }),
    enabled: Boolean(viewingId),
  });

  const saveSnapshot = async () => {
    setSaving(true); setSaveMessage(''); setSaveError('');
    try {
      await apiRequest('/reports/operational/snapshots', authToken, { method: 'POST', body: JSON.stringify({ ...filter, label }) });
      setSaveMessage('Snapshot saved.');
      setLabel('');
      client.invalidateQueries({ queryKey: ['reporting-snapshots', authToken] });
    } catch (error) {
      setSaveError(error.message || 'Could not save snapshot.');
    } finally {
      setSaving(false);
    }
  };

  const downloadCsv = async () => {
    setCsvLoading(true); setCsvError('');
    try {
      const csv = await apiRequest(`/reports/operational/export${queryString ? `?${queryString}` : ''}&format=csv`, authToken);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `operational-report-${Date.now()}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setCsvError(error.message || 'Could not export CSV.');
    } finally {
      setCsvLoading(false);
    }
  };

  return (
    <section className="area-operations reporting-lifecycle">
      <header>
        <span className="eyebrow">REPORTING LIFECYCLE</span>
        <h3>Operational reporting across pre-election, election-day and post-election phases</h3>
      </header>

      <ScopeFilters filter={filter} onChange={change} />
      {filter.phase && (filter.since || filter.until) && (
        <p className="area-note">Since/Until overrides the "{filter.phase}" phase window while both are set.</p>
      )}

      <div className="reporting-actions">
        <button type="button" onClick={downloadCsv} disabled={csvLoading}>{csvLoading ? 'Preparing…' : 'Download CSV'}</button>
        <label className="reporting-label-field">
          Snapshot label
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Optional, e.g. Election-day 6pm check" />
        </label>
        <button type="button" className="primary" onClick={saveSnapshot} disabled={saving || report.isPending || report.isError}>{saving ? 'Saving…' : 'Save snapshot'}</button>
      </div>
      {csvError && <p role="alert">{csvError}</p>}
      {saveError && <p role="alert">{saveError}</p>}
      {saveMessage && <p className="area-note">{saveMessage}</p>}

      {report.isPending && <p role="status">Loading report…</p>}
      {report.isError && <p role="alert">{report.error.message} <button onClick={() => report.refetch()}>Retry</button></p>}
      {report.data && <ReportMetrics data={report.data} />}

      <div className="reporting-snapshots">
        <h4>Saved snapshots {snapshots.data ? `(${snapshots.data.length})` : ''}</h4>
        {snapshots.isPending && <p role="status">Loading snapshots…</p>}
        {snapshots.isError && <p role="alert">{snapshots.error.message} <button onClick={() => snapshots.refetch()}>Retry</button></p>}
        {snapshots.data && !snapshots.data.length && <p className="area-note">No snapshots saved yet for this account's accessible geography.</p>}
        {snapshots.data && snapshots.data.length > 0 && (
          <ul className="geo-view-list reporting-snapshot-list">
            {snapshots.data.map((snapshot) => (
              <li key={snapshot.id}>
                <b>{snapshot.label || snapshot.phase || 'Snapshot'}</b>
                <span>{snapshot.phase || 'custom range'}{snapshot.electionId ? ` · ${snapshot.electionId}` : ''}</span>
                <small>{new Date(snapshot.createdAt).toLocaleString()} · by {snapshot.requestedBy || 'unknown'}</small>
                <button type="button" onClick={() => setViewingId(viewingId === snapshot.id ? '' : snapshot.id)}>{viewingId === snapshot.id ? 'Hide' : 'View'}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {viewingId && (
        <div className="reporting-snapshot-viewer">
          <header><h4>Snapshot detail</h4><button type="button" onClick={() => setViewingId('')}>Close</button></header>
          {snapshotDetail.isPending && <p role="status">Loading snapshot…</p>}
          {snapshotDetail.isError && <p role="alert">{snapshotDetail.error.message}</p>}
          {snapshotDetail.data && <ReportMetrics data={snapshotDetail.data.report} />}
        </div>
      )}
    </section>
  );
}
