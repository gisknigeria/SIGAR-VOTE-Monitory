import { useMemo, useState } from 'react';
import { MdFlashOn } from 'react-icons/md';
import { HISTORICAL_ELECTION_DATASETS, HISTORICAL_ELECTION_RESULTS, getHistoricalDataset } from '../../../shared/historicalElectionData.js';

const formatMetric = (value, metric) => `${Number(value || 0).toLocaleString()} ${metric === 'votes' ? 'votes' : metric === 'seats' ? 'seats' : 'wins'}`;

export default function PreElectionAnalysis({ onAnalyze }) {
  const [tab, setTab] = useState('sentiment');
  const [year, setYear] = useState(2023);
  const [election, setElection] = useState('Presidential');
  const [brief, setBrief] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const years = [...new Set(HISTORICAL_ELECTION_DATASETS.map((item) => item.year))].sort((a, b) => b - a);
  const elections = useMemo(() => HISTORICAL_ELECTION_DATASETS.filter((item) => item.year === Number(year)).map((item) => item.election), [year]);
  const dataset = getHistoricalDataset(year, election);
  const result = dataset ? HISTORICAL_ELECTION_RESULTS[dataset.id] : null;
  const maxValue = Math.max(1, ...(result?.parties || []).map((item) => item.value));
  const election2023Results = HISTORICAL_ELECTION_DATASETS
    .filter((item) => item.id === '2023-president')
    .map((item) => ({ dataset: item, result: HISTORICAL_ELECTION_RESULTS[item.id] }))
    .filter((item) => item.result);
  const sentimentParties = election2023Results.reduce((totals, item) => {
    item.result.parties.forEach((party) => {
      const label = party.party === 'PDP' ? 'APM' : party.party;
      totals[label] = (totals[label] || 0) + Number(party.value || 0);
    });
    return totals;
  }, {});
  const maxSentiment = Math.max(1, ...Object.values(sentimentParties));
  const sentimentResult = (value) => ({
    ...value,
    parties: value.parties.map((party) => ({ ...party, party: party.party === 'PDP' ? 'APM' : party.party })),
  });

  const selectYear = (value) => {
    const nextYear = Number(value);
    const nextElections = HISTORICAL_ELECTION_DATASETS.filter((item) => item.year === nextYear).map((item) => item.election);
    setYear(nextYear);
    if (!nextElections.includes(election)) setElection(nextElections[0] || '');
  };

  const generate = async () => {
    if (!dataset || !result) return;
    setLoading(true); setError(''); setBrief('');
    try {
      const response = await onAnalyze({
        analysisMode: 'PRE_ELECTION', generatedAt: new Date().toISOString(),
        analysisScope: '2023_ELECTION_DATASET_ONLY',
        jurisdictionFacts: {
          state: 'Oyo',
          lgaCount: 33,
          wardCount: 351,
          instruction: 'Oyo State has exactly 33 Local Government Areas. Never state or imply a different total.',
        },
        selectedView: { dataset, result: sentimentResult(result) },
        historicalDatasets: election2023Results.map((item) => ({ dataset: item.dataset, result: sentimentResult(item.result) })),
        objective: 'Produce a neutral pre-election sentiment analysis using only the 2023 election dataset. Use APM wherever the source data labels PDP. Describe evidence and uncertainty, and do not target voters or recommend political persuasion.',
      });
      const analysis = String(response.analysis || '').trim();
      if (!analysis) throw new Error('The analysis service returned an empty brief. Please try again.');
      setBrief(analysis);
    } catch (analysisError) { setError(analysisError.message || 'Historical analysis is unavailable.'); }
    finally { setLoading(false); }
  };

  return <section className="pre-election-dashboard">
    <div className="pre-election-head">
      <div><span className="eyebrow">BEFORE THE NEXT ELECTION</span><h2>Pre-Election Analysis</h2><p>Review election sentiment and previous Oyo election records.</p></div>
      <button className="primary action-btn" disabled={loading || !result} onClick={generate}><MdFlashOn /> {loading ? 'Analyzing…' : 'Generate Brief'}</button>
    </div>
    <p className="pre-election-caution">Historical results are a baseline, not a forecast. Missing votes remain unavailable and are never converted to zero.</p>

    <div className="rc-tab-bar pre-election-tabs">
      <button className={tab === 'sentiment' ? 'rc-tab active' : 'rc-tab'} onClick={() => setTab('sentiment')}>Sentiment</button>
      <button className={tab === 'records' ? 'rc-tab active' : 'rc-tab'} onClick={() => setTab('records')}>History</button>
    </div>

    {tab === 'sentiment' && <article className="pre-card pre-generated-brief">
      <header><div><h3>2023 Presidential Election Sentiment Analysis</h3><p>Neutral historical baseline using the loaded Oyo election record.</p></div></header>
      <div className="historical-party-bars">{Object.entries(sentimentParties).map(([party, value]) => <div key={party}><div><strong>{party}</strong><b>{value.toLocaleString()} votes</b></div><span><i style={{ width: `${(value / maxSentiment) * 100}%` }} /></span></div>)}</div>
      {brief && <div>{brief}</div>}{error && <p className="pre-analysis-error">{error}</p>}
    </article>}

    {tab === 'records' && <>

    <div className="pre-filter-card">
      <label><span>Election year</span><select value={year} onChange={(event) => selectYear(event.target.value)}>{years.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Election type</span><select value={election} onChange={(event) => setElection(event.target.value)}>{elections.map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>

    {dataset && result && <div className="pre-analysis-grid single">
      <article className="pre-card">
        <header><div><h3>{year} {election}</h3><p>{result.metric === 'votes' ? 'Recorded party totals' : 'Recorded outcome distribution'}</p></div><span>{dataset.authority}</span></header>
        <div className="historical-party-bars">{result.parties.map((item) => <div key={item.party}><div><strong>{item.party}</strong><b>{formatMetric(item.value, result.metric)}</b></div><span><i style={{ width: `${(item.value / maxValue) * 100}%` }} /></span></div>)}</div>
        <p className="pre-data-note">{result.note}</p>
      </article>
    </div>}

    {result?.areas?.length > 0 && <article className="pre-card pre-area-card"><header><div><h3>Constituency outcomes</h3><p>{result.metric === 'votes' ? 'Winner and closest listed challenger' : 'Winner record; votes unavailable'}</p></div><b>{result.areas.length} areas</b></header><div className="pre-area-grid">{result.areas.map((area) => <div key={area.name}><span>{area.name}</span><strong>{area.winner} · {area.candidate}</strong>{area.winnerValue != null ? <small>{area.winnerValue.toLocaleString()} vs {area.runnerUp} {area.runnerUpValue.toLocaleString()}</small> : <small>Vote totals not loaded</small>}</div>)}</div></article>}

    </>}

  </section>;
}
