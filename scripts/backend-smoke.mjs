import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const directory=mkdtempSync(join(tmpdir(),'oyo-backend-smoke-'));
const withPilot=process.argv.includes('--with-pilot');
const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,NODE_ENV:'test',DATABASE_URL:'',DATA_FILE:join(directory,'data.json'),PORT:'0',JWT_SECRET:'test-only-secret-'.repeat(3),SUPER_ADMIN_EMAIL:'superadmin@command.local',SUPER_ADMIN_PASSWORD:'SmokeTest!2026Strong',ADMIN_PASSWORD:'SmokeTest!2026Strong',IREV_AUTO_SYNC:'false',IREV_OYO_ELECTION_ID:'',ENABLE_OSUN_PILOT:withPilot?'true':'false'},stdio:['ignore','pipe','pipe']});
let logs=''; child.stdout.on('data',d=>{logs+=d});child.stderr.on('data',d=>{logs+=d});
try {
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Startup timed out\n'+logs)),180000);
    child.once('exit',code=>{clearTimeout(timer);reject(Error(`Server exited ${code}\n${logs}`))});
    child.stdout.on('data',()=>{if(logs.includes('listening on port')){clearTimeout(timer);resolve()}});
  });
  const port=logs.match(/listening on port (\d+)/)[1];
  const base=`http://127.0.0.1:${port}`;
  const health=await (await fetch(base+'/api/health')).json();
  assert.equal(health.deployment.state,'Oyo');

  const readyResponse=await fetch(base+'/api/ready');
  assert.equal(readyResponse.status,200,'readiness must report ok when there is no configured database to fail against');
  const readyBody=await readyResponse.json();
  assert.equal(readyBody.checks.database,'not-configured');
  assert.ok(readyResponse.headers.get('x-request-id'),'every response must carry a request id for log correlation');
  for (const path of ['/api/users','/api/incidents','/api/parties','/api/notifications','/api/cameras','/api/map-layers','/api/ai/status','/api/irev/oyo','/api/chat/rooms','/api/geography/operational-view']) {
    assert.equal((await fetch(base+path)).status,401,path);
  }
  assert.equal((await fetch(base+'/api/irev/osun')).status,withPilot?401:404);
  assert.equal((await fetch(base+'/api/missing')).status,404);
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'superadmin@command.local',password:'SmokeTest!2026Strong'})});
  assert.equal(login.status,200,await login.clone().text());
  const {token}=await login.json();
  const headers={Authorization:`Bearer ${token}`};
  for(const path of ['/api/users','/api/incidents','/api/parties','/api/notifications','/api/cameras','/api/map-layers','/api/ai/status','/api/irev/oyo','/api/geography/operational-view','/api/reports/operational'])assert.equal((await fetch(base+path,{headers})).status,200,path);
  if(withPilot) assert.equal((await fetch(base+'/api/irev/osun/results',{headers})).status,200);

  const phaseWithoutConfig=await fetch(base+'/api/reports/operational?phase=election-day',{headers});
  assert.equal(phaseWithoutConfig.status,400,'a lifecycle phase report must fail closed, not guess a date, when SIGAR_ELECTION_DATE is unset');

  const exportResponse=await fetch(base+'/api/reports/operational/export',{headers});
  assert.equal(exportResponse.status,200);
  assert.match(exportResponse.headers.get('content-type')||'',/text\/csv/);
  assert.match(await exportResponse.text(),/^level,state,lga,ward,pollingUnit,records/);

  const createSnapshot=await fetch(base+'/api/reports/operational/snapshots',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({label:'smoke snapshot'})});
  assert.equal(createSnapshot.status,201,await createSnapshot.clone().text());
  const snapshot=await createSnapshot.json();
  assert.equal((await fetch(base+`/api/reports/operational/snapshots/${snapshot.id}`,{headers})).status,200);
  assert.equal((await fetch(base+'/api/reports/operational/snapshots',{headers})).status,200);

  const newsSummary=await fetch(base+'/api/news/summary',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({articles:[{title:'INEC announces Oyo polling schedule',source:'Test Wire'}]})});
  assert.equal(newsSummary.status,200,await newsSummary.clone().text());
  const newsBody=await newsSummary.json();
  assert.equal(newsBody.generationType,'deterministic-rule','no AI provider key is configured in this smoke env, so this must fall back to a labeled deterministic rule, not silently claim to be AI-generated');
  assert.ok(newsBody.generatedAt);

  const analysis=await fetch(base+'/api/analysis/ai',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({context:{incidents:[],coverage:0}})});
  assert.equal(analysis.status,200,await analysis.clone().text());
  const analysisBody=await analysis.json();
  assert.equal(analysisBody.generationType,'deterministic-rule');

  // Regression coverage: creating/updating/role-changing/deleting a user and deleting an
  // incident used to throw ReferenceError: emitAuthorized is not defined -- after the
  // underlying write had already succeeded -- because it was passed by index.js but never
  // destructured in these route modules. Exercise every one of those paths for real.
  const createUser=await fetch(base+'/api/users',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({name:'Smoke Agent',email:'smoke-agent@command.local',password:'SmokeAgent!2026Strong',role:'Agent',rank:'Agent',lga:'AFIJIO'})});
  assert.equal(createUser.status,201,await createUser.clone().text());
  const smokeUser=await createUser.json();
  const updateUser=await fetch(base+`/api/users/${smokeUser.id}`,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({name:'Smoke Agent Updated'})});
  assert.equal(updateUser.status,200,await updateUser.clone().text());
  const roleChange=await fetch(base+`/api/users/${smokeUser.id}/role`,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({role:'Supervisor',ward:'AKINMORIN/JOBELE'})});
  assert.equal(roleChange.status,200,await roleChange.clone().text());
  const deleteUser=await fetch(base+`/api/users/${smokeUser.id}`,{method:'DELETE',headers});
  assert.equal(deleteUser.status,204,`user deletion must not throw after the write succeeds (got ${deleteUser.status})`);

  const createIncident=await fetch(base+'/api/incidents',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({title:'Smoke incident',description:'smoke test',reportType:'Network Connectivity',severity:'Low',lat:7.3775,lng:3.947,state:'Oyo'})});
  assert.equal(createIncident.status,201,await createIncident.clone().text());
  const smokeIncident=await createIncident.json();
  const deleteIncident=await fetch(base+`/api/incidents/${smokeIncident.id}`,{method:'DELETE',headers});
  assert.equal(deleteIncident.status,204,`incident deletion must not throw after the write succeeds (got ${deleteIncident.status})`);

  const metrics=await fetch(base+'/api/metrics',{headers});
  assert.equal(metrics.status,200,await metrics.clone().text());
  const metricsBody=await metrics.json();
  assert.ok(Number.isFinite(metricsBody.incidents.total));
  assert.ok(Number.isFinite(metricsBody.audit.eventsLast24h));

  const securityPolicy=await fetch(base+'/api/security/policy',{headers});
  assert.equal(securityPolicy.status,200,await securityPolicy.clone().text());
  const policyBody=await securityPolicy.json();
  assert.ok(policyBody.retention?.auditLogsDays>0,'the retention policy must be a real, queryable value, not silent metadata');

  const evidenceSweep=await fetch(base+'/api/evidence/retention/sweep',{method:'POST',headers});
  assert.equal(evidenceSweep.status,200,await evidenceSweep.clone().text());
  const sweepBody=await evidenceSweep.json();
  assert.ok(Array.isArray(sweepBody.deleted));

  const accessReviewBefore=await fetch(base+'/api/security/access-review',{headers});
  assert.equal(accessReviewBefore.status,200,await accessReviewBefore.clone().text());
  const superAdminEntry=(await accessReviewBefore.json()).find((entry)=>entry.role==='Super Admin');
  assert.equal(superAdminEntry.overdue,true,'an account with no recorded review must show overdue, not silently pass');
  const meId=superAdminEntry.userId;
  const recordReview=await fetch(base+`/api/users/${meId}/access-review`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({notes:'smoke review'})});
  assert.equal(recordReview.status,201,await recordReview.clone().text());
  const accessReviewAfter=await fetch(base+'/api/security/access-review',{headers});
  assert.equal((await accessReviewAfter.json()).find((entry)=>entry.userId===meId).overdue,false,'recording a review must clear the overdue flag');

  const resourceRequirement=await fetch(base+'/api/area-operations/resources/requirements',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({resourceType:'Radio',quantity:5,geography:{lga:'Afijio'}})});
  assert.equal(resourceRequirement.status,201,await resourceRequirement.clone().text());
  const resourceAvailability=await fetch(base+'/api/area-operations/resources/availability',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({resourceType:'Radio',quantity:5,geography:{lga:'Afijio'}})});
  assert.equal(resourceAvailability.status,201,await resourceAvailability.clone().text());
  const resourceDispatch=await fetch(base+'/api/area-operations/resources/dispatch',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({resourceType:'Radio',quantity:5,geography:{lga:'Afijio'},sourceGeography:{lga:'Afijio'}})});
  assert.equal(resourceDispatch.status,201,await resourceDispatch.clone().text());
  const dispatched=await resourceDispatch.json();
  const resourceUtilization=await fetch(base+`/api/area-operations/resources/${dispatched.id}/utilization`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({utilizationStatus:'adequate',usedQuantity:5})});
  assert.equal(resourceUtilization.status,200,await resourceUtilization.clone().text());

  const auditLog=await fetch(base+'/api/audit',{headers});
  assert.equal(auditLog.status,200,await auditLog.clone().text());
  const auditActions=(await auditLog.json()).items.map((entry)=>entry.action);
  for(const expected of ['identity.user_created','identity.user_updated','identity.user_role_changed','identity.user_deleted','incident.created','incident.deleted','evidence.retention_swept','identity.access_reviewed','resource.requirement_created','resource.availability_recorded','resource.dispatched','resource.utilization_reviewed']){
    assert.ok(auditActions.includes(expected),`expected a durable audit event for ${expected}, saw: ${auditActions.join(', ')}`);
  }

  console.log(`Backend smoke passed: Oyo health, authentication, protected routes, dormant feed, lifecycle reporting export/snapshots, phase fail-closed behavior, AI-governance labeling, durable audit coverage (identity/incident/resource/evidence/access-review), the emitAuthorized regression fix, ${withPilot?'Osun pilot preserved':'explicit pilot opt-out'} and API 404.`);
} finally {child.kill(); await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));rmSync(directory,{recursive:true,force:true});}
