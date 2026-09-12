import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client.js';
import { getRegistrationLocationOptions } from '../../../shared/electionData.js';
import ResourceIntelligence from './ResourceIntelligence.jsx';
import './area-analysis.css';

const initial = { title: '', category: 'Observer coverage', lga: '', ward: '', date: '', notes: '' };
export default function AreaOperations({ authToken }) {
  const [tab, setTab] = useState('plans');
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const client = useQueryClient();
  const key = ['area-operation-plans', authToken];
  const plans = useQuery({ queryKey: key, queryFn: ({ signal }) => apiRequest('/area-operations/plans', authToken, { signal }) });
  const options = getRegistrationLocationOptions('Oyo', form.lga);
  const change = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.value, ...(event.target.name === 'lga' ? { ward: '' } : {}) }));
  const save = async event => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const plan = await apiRequest('/area-operations/plans', authToken, { method: 'POST', body: JSON.stringify(form) });
      client.setQueryData(key, previous => [plan, ...(previous || [])]);
      setForm(initial); setMessage('Operation saved.');
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  };
  const remove = async id => {
    setBusy(true); setError(''); setMessage('');
    try {
      await apiRequest(`/area-operations/plans/${id}`, authToken, { method: 'DELETE' });
      client.setQueryData(key, previous => (previous || []).filter(plan => plan.id !== id));
      setMessage('Operation removed.');
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  };
  return <section className="area-operations"><header><span className="eyebrow">ADMIN WORKSPACE</span></header>
    <div className="rc-tab-bar">
      <button className={tab === 'plans' ? 'rc-tab active' : 'rc-tab'} onClick={() => setTab('plans')}>Plans</button>
      <button className={tab === 'resources' ? 'rc-tab active' : 'rc-tab'} onClick={() => setTab('resources')}>Resources</button>
    </div>
    {tab === 'resources' && <ResourceIntelligence authToken={authToken} />}
    {tab === 'plans' && <>
    <form className="area-operation-form" onSubmit={save}>
      <label>Operation title<input required maxLength={120} name="title" value={form.title} onChange={change} placeholder="e.g. Observer orientation" /></label>
      <label>Type<select name="category" value={form.category} onChange={change}>{['Observer coverage', 'Training', 'Logistics', 'Accessibility', 'Campaign'].map(type => <option key={type}>{type}</option>)}</select></label>
      <label>Local government<select required name="lga" value={form.lga} onChange={change}><option value="">Select LGA</option>{options.lgas.map(name => <option key={name}>{name}</option>)}</select></label>
      <label>Ward<select name="ward" value={form.ward} onChange={change} disabled={!form.lga}><option value="">All wards in LGA</option>{options.wards.map(name => <option key={name}>{name}</option>)}</select></label>
      <label>Date<input required type="date" name="date" value={form.date} onChange={change} /></label>
      <label className="area-form-wide">Operational notes<textarea name="notes" value={form.notes} onChange={change} maxLength={2000} rows={3} placeholder="Venue, equipment, access needs, and logistics" /></label>
      <div className="area-form-wide area-crm"><strong>Area information</strong><p>{form.lga ? `Oyo · ${form.lga}${form.ward ? ` · ${form.ward}` : ''}` : 'Select an area to plan an operation.'}</p><p>CRM not connected. Area profiles will be available after integration.</p></div>
      <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save operation'}</button>
    </form>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    <h3>Saved operations</h3>
    {plans.isPending && <p role="status">Loading operations…</p>}
    {plans.isError && <p role="alert">{plans.error.message} <button onClick={() => plans.refetch()}>Retry</button></p>}
    <div className="area-plan-list">{(plans.data || []).map(plan => <article key={plan.id}><div><span className="eyebrow">{plan.category} · {plan.date}</span><h4>{plan.title}</h4><p>{plan.lga} · {plan.ward || 'All wards'}</p><p className="area-plan-notes">{plan.notes}</p></div><button disabled={busy} onClick={() => remove(plan.id)} aria-label={`Remove ${plan.title}`}>Remove</button></article>)}</div>
    {plans.isSuccess && !plans.data.length && <p>No operations planned yet.</p>}
    </>}
  </section>;
}
