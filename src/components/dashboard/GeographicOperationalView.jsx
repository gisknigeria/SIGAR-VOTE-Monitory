import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import { apiRequest } from '../../api/client.js';
import { API } from '../../config.js';
import { createStreetLayer } from '../../mapTiles.js';
import { oyoBoundariesQuery } from '../../queries/boundaries.js';
import { getRegistrationLocationOptions, resolveCanonicalName } from '../../../shared/electionData.js';
import './geography-operational-view.css';

const formatLocation = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : 'Location unknown';

const ROLLUP_LABEL = { lga: 'By LGA', ward: 'By ward', pollingUnit: 'By polling unit' };
const normalizeName = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
// The boundary map service spells four Oyo LGAs differently from the canonical
// INEC-based reference list (not just case/punctuation, so the usual fuzzy
// matcher can't bridge these): confirmed by testing all 33 boundary names
// against the real API and finding exactly these four 400s.
const BOUNDARY_LGA_ALIASES = { atigbo: 'ATISBO', 'ogbomosho north': 'OGBOMOSO NORTH', 'ogbomosho south': 'OGBOMOSO SOUTH', orelope: 'OORELOPE' };
const resolveClickedLgaName = (rawName) => BOUNDARY_LGA_ALIASES[normalizeName(rawName)] || resolveCanonicalName(getRegistrationLocationOptions('Oyo').lgas, rawName) || rawName;

/** Lets a user click an LGA (then a ward) directly on a real boundary map instead of using the dropdowns below -- the two stay in sync either way. */
function ScopeMap({ scope, onSelectLga, onSelectWard }) {
  const el = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  const lgaBoundaries = useQuery(oyoBoundariesQuery);
  const wardBoundaries = useQuery({
    queryKey: ['geo-view-ward-boundaries', scope.lga],
    queryFn: async ({ signal }) => {
      const response = await fetch(`${API}/boundaries/oyo/wards?lga=${encodeURIComponent(scope.lga)}`, { signal });
      if (!response.ok) throw new Error('Ward boundary data is unavailable right now.');
      return response.json();
    },
    enabled: Boolean(scope.lga),
    staleTime: 60 * 60_000,
  });

  useEffect(() => {
    if (mapRef.current || !el.current) return;
    const map = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView([8.0, 3.9], 8);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    createStreetLayer().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layerRef.current?.remove();
    layerRef.current = null;

    const showingWards = Boolean(scope.lga);
    const geojson = showingWards ? wardBoundaries.data?.wards : lgaBoundaries.data?.lgas;
    if (!geojson?.features?.length) return;

    const layer = L.geoJSON(geojson, {
      style: (feature) => {
        const rawName = showingWards ? feature.properties?.ward : feature.properties?.ADM2_EN;
        const isSelected = showingWards ? normalizeName(rawName) === normalizeName(scope.ward) : normalizeName(rawName) === normalizeName(scope.lga);
        return { color: isSelected ? '#facc15' : '#22d3ee', weight: isSelected ? 3 : 1.5, fillOpacity: isSelected ? 0.35 : 0.08, fillColor: isSelected ? '#facc15' : '#22d3ee' };
      },
      onEachFeature: (feature, layerGeo) => {
        const rawName = showingWards ? feature.properties?.ward : feature.properties?.ADM2_EN;
        if (!rawName) return;
        layerGeo.bindTooltip(rawName, { sticky: true, className: 'nigeria-lga-tooltip' });
        layerGeo.on('click', () => {
          if (showingWards) {
            const canonical = resolveCanonicalName(getRegistrationLocationOptions('Oyo', scope.lga).wards, rawName);
            onSelectWard(canonical || rawName);
          } else {
            onSelectLga(resolveClickedLgaName(rawName));
          }
        });
      },
    }).addTo(map);
    layerRef.current = layer;
    try { map.fitBounds(layer.getBounds(), { padding: [12, 12] }); } catch { /* empty bounds on first paint */ }
  }, [scope.lga, scope.ward, lgaBoundaries.data, wardBoundaries.data]);

  return (
    <div className="geo-view-map-wrap">
      <div className="geo-view-map-toolbar">
        <p className="geo-view-map-hint">Click a {scope.lga ? 'ward' : 'local government'} on the map — or use the dropdowns below instead.</p>
        {scope.lga && <button type="button" onClick={() => onSelectLga('')}>&laquo; Back to all of Oyo State</button>}
      </div>
      <div ref={el} className="geo-view-map" />
      {scope.lga && wardBoundaries.isError && <p role="alert" className="area-note">Ward boundaries aren't available for this LGA right now — the dropdowns below still work.</p>}
    </div>
  );
}

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
  const selectLgaFromMap = (lga) => setScope({ lga, ward: '', pollingUnit: '' });
  const selectWardFromMap = (ward) => setScope((previous) => ({ ...previous, ward, pollingUnit: '' }));

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
        <span className="eyebrow">GEOGRAPHY</span>
        <h3>Zoom into any location to see the full picture</h3>
      </header>
      <p className="geo-view-intro">
        Pick a local government, then narrow to a ward, then a single polling unit — or leave it at "All of Oyo State" for the big picture.
        Whatever you land on, this shows who's assigned there, what's been reported, what's been done about it, and what's still missing.
      </p>

      <ScopeMap scope={scope} onSelectLga={selectLgaFromMap} onSelectWard={selectWardFromMap} />
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

          {data.personnel.total === 0 && data.incidents.total === 0 && data.tasks.total === 0 && data.results.total === 0 && (
            <div className="geo-view-quiet-note">Nothing recorded for this location yet — that's expected before real field activity starts, not a fault.</div>
          )}

          <div className="area-coverage-grid geo-view-stats">
            <StatTile label="People assigned" value={data.personnel.total} />
            <StatTile label="Readiness checks" value={data.readiness.total} hint={`(${data.readiness.verified} verified)`} />
            <StatTile label="Incidents reported" value={data.incidents.total} />
            <StatTile label="Results submitted" value={data.results.total} />
            <StatTile label="Tasks" value={data.tasks.total} />
            <StatTile label="Contact Centre reports" value={data.crmSignals.total} />
            <StatTile label="Evidence files" value={data.evidence.items.length} />
            <StatTile label="Resource shortages" value={data.resources.adequacy.filter((r) => r.missing > 0).length} />
          </div>

          <div className="geo-view-outcomes">
            <h4>What's been resolved so far</h4>
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
