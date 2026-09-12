import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import { apiRequest } from '../../api/client.js';
import { oyoBoundariesQuery } from '../../queries/boundaries.js';
import { agentsInArea, areaKey, matchArea, partyColor, resultSummary } from '../../../shared/areaAnalysis.js';
import { getRegistrationLocationOptions } from '../../../shared/electionData.js';
import './area-analysis.css';

const labelFor = (feature, level) => {
  const p = feature.properties || {};
  return level === 'lga' ? p.ADM2_EN || p.lga_name || p.LGA || p.lga || p.LTNAME || p.name : p.ward || p.WARD || p.name;
};
const aliasesFor = (feature, level) => [labelFor(feature, level), ...String(feature.properties?.ward_alt_names || '').split(/[;,|]/)];
const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const countText = count => `${count.toLocaleString()} agent${count === 1 ? '' : 's'}`;
const shareText = area => resultSummary(area).top.map(p => `${p.party} ${p.percentage == null ? '—' : `${p.percentage.toFixed(1)}%`}`).join(' · ');

function Shares({ area }) {
  const result = resultSummary(area);
  return <><span className="area-winner">{result.tie ? 'Tied lead' : result.winner ? `${result.winner} leads` : 'No recorded lead'}</span><div className="area-shares">{result.top.map(p => <span key={p.party}><i style={{ background: partyColor(p.party) }} /><b>{p.party}</b><strong>{p.percentage == null ? '—' : `${p.percentage.toFixed(1)}%`}</strong></span>)}</div></>;
}

export default function SentimentMap({ authToken, canAdmin }) {
  const [lga, setLga] = useState(null);
  const [ward, setWard] = useState(null);
  const [unit, setUnit] = useState(null);
  const [showAgents, setShowAgents] = useState(false);
  const [search, setSearch] = useState('');
  const mapNode = useRef(null);
  const map = useRef(null);
  const level = ward ? 'polling-unit' : lga ? 'ward' : 'lga';
  const path = `/history/oyo/2023/presidential${lga ? `/lga/${encodeURIComponent(lga.id)}` : ''}${ward ? `/ward/${encodeURIComponent(ward.code)}` : ''}`;
  const history = useQuery({ queryKey: ['sentiment-history', path, authToken], queryFn: ({ signal }) => apiRequest(path, authToken, { signal }), staleTime: 3600000 });
  const boundaries = useQuery(oyoBoundariesQuery);
  const wardBoundaries = useQuery({ queryKey: ['sentiment-wards', lga?.name], queryFn: ({ signal }) => apiRequest(`/boundaries/oyo/wards?lga=${encodeURIComponent(lga.name)}`, authToken, { signal }), enabled: !!lga, staleTime: 86400000 });
  const agents = useQuery({ queryKey: ['area-agent-counts', authToken], queryFn: ({ signal }) => apiRequest('/area-operations/agents', authToken, { signal }), enabled: canAdmin && showAgents, staleTime: 30000 });
  const areas = history.data?.areas || [];
  const assignments = agents.data?.assignments || [];
  const currentBoundaryLevel = lga ? 'ward' : 'lga';
  const rawFeatures = (lga ? wardBoundaries.data?.wards : boundaries.data?.lgas)?.features || [];
  const features = ward ? rawFeatures.filter(f => matchArea([ward], aliasesFor(f, 'ward'))) : rawFeatures;
  const agentsReady = showAgents && canAdmin && agents.isSuccess;
  const countFor = area => agentsInArea(assignments, lga?.name || area.name, lga ? ward?.name || area.name : '', ward ? area.name : '');
  const canonicalLga = getRegistrationLocationOptions('Oyo').lgas.find(name => areaKey(name) === areaKey(lga?.name));
  const options = getRegistrationLocationOptions('Oyo', canonicalLga);
  const canonicalWard = options.wards.find(name => areaKey(name) === areaKey(ward?.name));
  const coverageNames = !lga ? options.lgas : !ward ? options.wards : getRegistrationLocationOptions('Oyo', canonicalLga, canonicalWard).pollingUnits;
  const coverageRows = canonicalWard || !ward ? coverageNames : [];
  const matched = useMemo(() => new Set(features.map(f => matchArea(areas, aliasesFor(f, currentBoundaryLevel))?.id).filter(Boolean)), [features, areas, currentBoundaryLevel]);
  const openArea = area => {
    setSearch(''); setUnit(null);
    if (level === 'lga') { setLga(area); setWard(null); }
    else if (level === 'ward') setWard(area);
    else setUnit(area);
  };

  useEffect(() => {
    const instance = L.map(mapNode.current, { scrollWheelZoom: true }).setView([8.0, 3.8], 8);
    map.current = instance;
    const maptilerKey = import.meta.env.VITE_MAPTILER_KEY;
    (maptilerKey
      ? L.tileLayer(`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${maptilerKey}`, { attribution: '&copy; MapTiler &copy; OpenStreetMap contributors', maxZoom: 19 })
      : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 })
    ).addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(mapNode.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    const group = L.featureGroup().addTo(map.current);
    const geo = L.geoJSON({ type: 'FeatureCollection', features }, {
      style: feature => {
        const area = ward || matchArea(areas, aliasesFor(feature, currentBoundaryLevel));
        return { color: '#fff', weight: 2, opacity: 1, fillColor: resultSummary(area).color, fillOpacity: 1 };
      },
      onEachFeature: (feature, layer) => {
        const area = ward || matchArea(areas, aliasesFor(feature, currentBoundaryLevel));
        const name = labelFor(feature, currentBoundaryLevel) || 'Unnamed area';
        const count = agentsInArea(assignments, lga?.name || name, lga ? name : '');
        const result = area ? shareText(area) : 'No matched result';
        const tooltip = `<strong>${escapeText(name)}</strong><br>${escapeText(result)}${agentsReady ? `<br>${escapeText(countText(count))}` : ''}`;
        layer.bindTooltip(tooltip, { sticky: true });
        if (area && !ward && !history.isFetching) layer.on('click', () => openArea(area));
      },
    }).addTo(group);
    if (ward) {
      for (const area of areas) {
        if (!Array.isArray(area.coordinates) || area.coordinates.length !== 2) continue;
        const [lng, lat] = area.coordinates;
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
        L.circleMarker([lat, lng], { radius: 9, color: '#fff', weight: 2, opacity: 1, fillOpacity: 1, fillColor: resultSummary(area).color })
          .bindTooltip(`${escapeText(area.name)}<br>${escapeText(shareText(area))}${agentsReady ? `<br>${escapeText(countText(countFor(area)))}` : ''}`)
          .on('click', () => setUnit(area)).addTo(group);
      }
    }
    const bounds = geo.getBounds().isValid() ? geo.getBounds() : group.getBounds();
    if (bounds.isValid()) map.current.fitBounds(bounds, { padding: [24, 24], maxZoom: ward ? 14 : 11 });
    return () => group.remove();
  }, [history.data, history.isFetching, boundaries.data, wardBoundaries.data, lga, ward, agents.data, agentsReady]);

  const selected = unit || ward || lga;
  return <section className="sentiment-explorer">
    <header className="area-toolbar"><div><span className="eyebrow">HISTORICAL RESULTS · OYO</span><h3>2023 Presidential election</h3><p>Select an LGA, then a ward, then a polling unit.</p></div>{canAdmin && <button type="button" aria-pressed={showAgents} className={showAgents ? 'primary' : ''} onClick={() => setShowAgents(value => !value)}>{showAgents ? 'Hide agent counts' : 'Show agent counts on map'}</button>}</header>
    <nav className="area-breadcrumb" aria-label="Area navigation"><button onClick={() => { setLga(null); setWard(null); setUnit(null); setSearch(''); }}>All LGAs</button>{lga && <><span>›</span><button onClick={() => { setWard(null); setUnit(null); setSearch(''); }}>{lga.name}</button></>}{ward && <><span>›</span><button onClick={() => setUnit(null)}>{ward.name}</button></>}{unit && <span>› {unit.name}</span>}</nav>
    <div className="area-legend">{[...new Set(areas.map(a => resultSummary(a).winner).filter(Boolean))].map(p => <span key={p}><i style={{ background: partyColor(p) }} />{p}</span>)}<span><i style={{ background: '#596273' }} />Unavailable / no votes</span><span><i style={{ background: '#766140' }} />Tie</span></div>
    <p className="area-note">Percentages are shares of all recorded party votes in each area; only the top three are displayed. Historical results do not measure current sentiment. Party names follow the source.</p>
    {history.data?.notice && <p className="area-note">{history.data.notice}</p>}
    {history.isFetching && <p role="status">Loading {level === 'lga' ? 'local governments' : level === 'ward' ? 'wards' : 'polling units'}…</p>}
    {history.isError && <p role="alert">{history.error.message} <button onClick={() => history.refetch()}>Retry results</button></p>}
    {(lga ? wardBoundaries.isError : boundaries.isError) && <p role="alert">Map boundaries are unavailable. You can still explore results using the area cards. <button onClick={() => (lga ? wardBoundaries : boundaries).refetch()}>Retry boundaries</button></p>}
    {showAgents && agents.isFetching && <p role="status">Loading agent assignments…</p>}
    {showAgents && agents.isError && <p role="alert">Agent counts unavailable: {agents.error.message} <button onClick={() => agents.refetch()}>Retry counts</button></p>}
    {agentsReady && <p className="area-note">{countText(agents.data.total)} registered and active in Oyo. {agents.data.unassigned} have no LGA assignment. Counts use registration assignments, not live GPS. <button onClick={() => agents.refetch()}>Refresh counts</button></p>}
    <div className="area-explorer-grid"><div><div ref={mapNode} className="area-map" aria-label="Historical election results map" />
      <p className="area-note">{lga ? wardBoundaries.data?.attribution : 'Administrative boundaries: ArcGIS feature service'}. {lga && wardBoundaries.data?.notice}</p>
      {level !== 'polling-unit' && history.isSuccess && <p className="area-note">{matched.size} of {areas.length} result areas matched to boundaries. Unmatched areas remain available in the list; boundary matches use unique names.</p>}
      {ward && <p className="area-note">{areas.filter(a => Array.isArray(a.coordinates)).length} of {areas.length} polling units have source coordinates. Units without coordinates are shown as colored cards in the list; their map positions are unavailable. {!features.length && 'No boundary matched this ward.'}</p>}
      {selected && <article className="area-detail"><span className="eyebrow">{unit ? 'POLLING UNIT' : ward ? 'WARD' : 'LOCAL GOVERNMENT'}</span><h3>{selected.name}</h3><Shares area={selected} /><p>{resultSummary(selected).total.toLocaleString()} recorded party votes{selected.code ? ` · ${selected.code}` : ''}</p><p>Area information: CRM not connected.</p></article>}
    </div><aside className="area-results"><label>Find an area<input value={search} onChange={event => setSearch(event.target.value)} placeholder={`Search ${level === 'lga' ? 'LGAs' : level === 'ward' ? 'wards' : 'polling units'}`} /></label>
      <div className="area-result-list">{areas.filter(a => areaKey(a.name + a.code).includes(areaKey(search))).map(area => <button key={area.id} type="button" className={`area-result-card${unit?.id === area.id ? ' selected' : ''}`} style={{ borderLeftColor: resultSummary(area).color }} onClick={() => openArea(area)}><strong>{area.name}</strong>{area.code && <small>{area.code}</small>}<Shares area={area} />{agentsReady && <b>{countText(countFor(area))}</b>}<small>{level === 'lga' ? 'View wards →' : level === 'ward' ? 'View polling units →' : 'View details →'}</small></button>)}</div>
      {history.isSuccess && !areas.length && <p>No results are loaded for this area.</p>}
    </aside></div>
    {agentsReady && <details className="area-coverage"><summary>Agent coverage by {level === 'lga' ? 'local government' : level === 'ward' ? 'ward' : 'polling unit'}</summary><p>All registered areas are listed, including areas without historical results. Unmatched assignments are retained in parent totals.</p><div className="area-coverage-grid">{coverageRows.map(name => <div key={name}><span>{name}</span><b>{countText(countFor({ name }))}</b></div>)}</div></details>}
    {history.data?.source && <p className="area-note">Source: <a href={history.data.source.url} target="_blank" rel="noreferrer">{history.data.source.name}</a></p>}
  </section>;
}
