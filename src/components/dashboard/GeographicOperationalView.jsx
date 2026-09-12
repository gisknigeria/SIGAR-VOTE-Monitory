import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/client.js';
import { getRegistrationLocationOptions } from '../../../shared/electionData.js';
import './geography-operational-view.css';

const formatLocation = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : 'Location unknown';

const ROLLUP_LABEL = { lga: 'By LGA', ward: 'By ward', pollingUnit: 'By polling unit' };

function ScopeSelector({ scope, onChange }) {
  const options = getRegistrationLocationOptions('Oyo', scope.lga, scope.ward);
  return (
    <div className="area-operation-form geo-view-selectors">
      <label>
        Local government
        <select name="lga" value={scope.lga} onChange={onChange}>
          <option value="">All of Oyo State</option>
          {options.lgas.map((name) => <option key={name}>{name}</option>)}
        </select>
      </label>
      <label>
        Ward
        <select name="ward" value={scope.ward} onChange={onChange} disabled={!scope.lga}>
          <option value="">All wards</option>
          {options.wards.map((name) => <option key={name}>{name}</option>)}
        </select>
      </label>
      <label>
        Polling unit
        <select name="pollingUnit" value={scope.pollingUnit} onChange={onChange} disabled={!scope.ward}>
          <option value="">All polling units</option>
          {options.pollingUnits.map((name, index) => <option key={`${name}-${index}`}>{name}</option>)}
        </select>
      </label>
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

function RollupTable({ title, level, groups }) {
  if (!groups?.length) return null;
  const geoKeys = ['state', 'lga', 'ward', 'pollingUnit'].filter((key) => groups.some((group) => group.geography[key] !== undefined));
  return (
    <div className="geo-view-rollup">
      <h5>{title}</h5>
      <table>
        <thead><tr>{geoKeys.map((key) => <th key={key}>{key}</th>)}<th>Records</th></tr></thead>
        <tbody>
          {groups.map((group, index) => (
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

export default function GeographicOperationalView({ authToken }) {
  const [scope, setScope] = useState({ lga: '', ward: '', pollingUnit: '' });
  const change = (event) => {
    const { name, value } = event.target;
    setScope((previous) => ({
      ...previous,
      [name]: value,
      ...(name === 'lga' ? { ward: '', pollingUnit: '' } : {}),
      ...(name === 'ward' ? { pollingUnit: '' } : {}),
    }));
  };

  const params = new URLSearchParams();
  if (scope.lga) params.set('lga', scope.lga);
  if (scope.ward) params.set('ward', scope.ward);
  if (scope.pollingUnit) params.set('pollingUnit', scope.pollingUnit);
  const queryString = params.toString();
  const view = useQuery({
    queryKey: ['geography-operational-view', authToken, queryString],
    queryFn: ({ signal }) => apiRequest(`/geography/operational-view${queryString ? `?${queryString}` : ''}`, authToken, { signal }),
  });
  const data = view.data;

  return (
    <section className="area-operations geo-view">
      <header>
        <span className="eyebrow">GEOGRAPHIC OPERATIONAL VIEW</span>
        <h3>Select a geography to see who's there, what's happening, and what's needed</h3>
      </header>

      <ScopeSelector scope={scope} onChange={change} />

      {view.isPending && <p role="status">Loading geographic view…</p>}
      {view.isError && (
        <p role="alert">{view.error.message} <button onClick={() => view.refetch()}>Retry</button></p>
      )}

      {data && (
        <>
          <div className="geo-view-scope-summary">
            <span className="eyebrow">
              {[data.scope.state, data.scope.lga, data.scope.ward, data.scope.pollingUnit].filter(Boolean).join(' · ') || 'Oyo State (all)'}
            </span>
            <span className="geo-view-generated">Generated {new Date(data.generatedAt).toLocaleString()}</span>
          </div>

          <div className="area-coverage-grid geo-view-stats">
            <StatTile label="Personnel" value={data.personnel.total} />
            <StatTile label="Readiness signals" value={data.readiness.total} hint={`(${data.readiness.verified} verified)`} />
            <StatTile label="Incidents" value={data.incidents.total} />
            <StatTile label="Results" value={data.results.total} />
            <StatTile label="Tasks" value={data.tasks.total} />
            <StatTile label="CRM signals" value={data.crmSignals.total} />
            <StatTile label="Evidence references" value={data.evidence.items.length} />
            <StatTile label="Resource lines short" value={data.resources.adequacy.filter((r) => r.missing > 0).length} />
          </div>

          <div className="geo-view-outcomes">
            <h4>Outcomes</h4>
            <p>
              {data.outcomes.verifiedIncidents.total} incident{data.outcomes.verifiedIncidents.total === 1 ? '' : 's'} verified
              {' · '}{data.outcomes.completedTasks.total} task{data.outcomes.completedTasks.total === 1 ? '' : 's'} completed
              {' · '}{data.outcomes.decisionOutcomes.total} decision{data.outcomes.decisionOutcomes.total === 1 ? '' : 's'} closed out
            </p>
          </div>

          <div className="geo-view-columns">
            <div className="geo-view-panel">
              <h4>Personnel ({data.personnel.total})</h4>
              {!data.personnel.items.length && <p className="area-note">No personnel assigned to this geography.</p>}
              <ul className="geo-view-list">
                {data.personnel.items.map((person) => (
                  <li key={person.id}>
                    <b>{person.name}</b>
                    <span>{person.role}{person.ward ? ` · ${person.ward}` : ''}</span>
                    <small>{formatLocation(person.lat, person.lng)}</small>
                  </li>
                ))}
              </ul>
            </div>

            <div className="geo-view-panel">
              <h4>Incidents ({data.incidents.total})</h4>
              {!data.incidents.items.length && <p className="area-note">No incidents recorded for this geography.</p>}
              <ul className="geo-view-list">
                {data.incidents.items.map((incident) => (
                  <li key={incident.id}>
                    <b>{incident.title || incident.reportType}</b>
                    <span>{incident.status}{incident.lifecycle?.verifiedAt ? ' · verified' : ''}</span>
                    <small>{[incident.lga, incident.ward, incident.pollingUnit].filter(Boolean).join(' · ') || 'No geography recorded'}</small>
                  </li>
                ))}
              </ul>
            </div>

            <div className="geo-view-panel">
              <h4>Tasks ({data.tasks.total})</h4>
              {!data.tasks.items.length && <p className="area-note">No tasks scoped to this geography.</p>}
              <ul className="geo-view-list">
                {data.tasks.items.map((task) => (
                  <li key={task.id}>
                    <b>{task.title}</b>
                    <span>{task.status}{task.priority ? ` · ${task.priority}` : ''}</span>
                    <small>Owner: {task.accountableOwnerId || 'Unassigned'}</small>
                  </li>
                ))}
              </ul>
            </div>

            <div className="geo-view-panel">
              <h4>Resources</h4>
              {!data.resources.adequacy.length && <p className="area-note">No resource requirements or deployments recorded here.</p>}
              {data.resources.adequacy.length > 0 && (
                <table className="geo-view-resource-table">
                  <thead><tr><th>Type</th><th>Required</th><th>Deployed</th><th>Missing</th></tr></thead>
                  <tbody>
                    {data.resources.adequacy.map((row, index) => (
                      <tr key={index} className={row.missing > 0 ? 'geo-view-shortfall' : ''}>
                        <td>{row.resourceType}</td>
                        <td>{row.required}</td>
                        <td>{row.deployed}</td>
                        <td>{row.missing}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {data.rollups && (
            <div className="geo-view-rollups">
              <h4>{ROLLUP_LABEL[data.drillDownLevel] || 'Roll-up'}</h4>
              <div className="geo-view-rollup-grid">
                <RollupTable title="Incidents" level={data.drillDownLevel} groups={data.rollups.incidents} />
                <RollupTable title="Results" level={data.drillDownLevel} groups={data.rollups.results} />
                <RollupTable title="Tasks" level={data.drillDownLevel} groups={data.rollups.tasks} />
              </div>
            </div>
          )}

          <details className="area-coverage geo-view-limitations">
            <summary>What this view does not show ({data.metadata.limitations.length})</summary>
            <ul>{data.metadata.limitations.map((line, index) => <li key={index}>{line}</li>)}</ul>
          </details>
        </>
      )}
    </section>
  );
}
