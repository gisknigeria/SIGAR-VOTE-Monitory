import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccessPolicy } from './access-policy.js';

test('incident realtime delivery obeys the same policy as record reads',()=>{
  const delivered=[];
  const users=[{id:'admin',role:'Admin'},{id:'owner',role:'Agent'},{id:'assigned',role:'Agent'},{id:'viewer',role:'Agent'},{id:'outsider',role:'Agent'},{id:'supervisor',role:'Supervisor',lga:'LGA',ward:'WARD'}];
  const sockets=new Map(users.map(user=>[user.id,{data:{authUser:user},emit:(event,value)=>delivered.push({id:user.id,event,value})}]));
  const policy=createAccessPolicy({io:{sockets:{sockets}}});
  const incident={id:'incident',createdBy:'owner',assignedTo:'assigned',visibleTo:['viewer'],lga:'LGA',ward:'WARD'};
  policy.emitIncidentToViewers('incident:updated',incident);
  assert.deepEqual(delivered.map(d=>d.id),['admin','owner','assigned','viewer','supervisor']);
  assert.equal(policy.canAccessIncident(users[4],incident),false);
});

test('geographic delivery uses authenticated assignment scope', () => {
  const policy = createAccessPolicy({ io: { sockets: { sockets: new Map() } } });
  const supervisor = { id: 'supervisor', role: 'Supervisor', state: 'Oyo', lga: 'Ibadan North', ward: 'Ward 1,Ward 2' };
  const agent = { id: 'agent', role: 'Agent', state: 'Oyo', lga: 'Ibadan North', ward: 'Ward 1', pollingUnit: 'PU 1' };
  assert.equal(policy.canAccessGeography(supervisor, { state: 'Oyo', lga: 'Ibadan North', ward: 'Ward 2' }), true);
  assert.equal(policy.canAccessGeography(supervisor, { state: 'Oyo', lga: 'Ibadan South', ward: 'Ward 2' }), false);
  assert.equal(policy.canAccessGeography(agent, { state: 'Oyo', lga: 'Ibadan North', ward: 'Ward 1', pollingUnit: 'PU 2' }), false);
  assert.equal(policy.canAccessGeography(agent, { state: 'Osun', lga: 'Ibadan North', ward: 'Ward 1', pollingUnit: 'PU 1' }), false);
});
