import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerResultRoutes } from './routes.js';
import { createStore } from '../../store.js';
import { getRegistrationLocationOptions } from '../../../shared/electionData.js';

function fixture(overrides={}) {
  const routes=new Map();
  const app=Object.fromEntries(['get','put','post'].map(method=>[method,(path,...handlers)=>routes.set(`${method}:${path}`,handlers.at(-1))]));
  const records=[];
  const resultRecords=[];
  const auditEntries=[];
  const submissionStore = new Map();
  const next=(_req,_res,next)=>next?.();
  const store={
    referenceDataReleases: async () => [{ id: 'release-1', scopeId: 'ng-oyo', sourceVersion: '2026-09-10-v1', records: [{ providerId: 'inec-pu-1', state: 'Oyo' }] }],
    parties:async()=>['A'],
    getFieldSubmission: async (submissionId) => submissionStore.get(submissionId) ?? null,
    saveFieldSubmission: async (record) => { submissionStore.set(record.submissionId, record); return record; },
    hashPayload: (payload) => createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    createIncident:async record=>{records.push(record);return record},
    createResultRecord:async record=>{resultRecords.push(record);return record},
    createAuditEntry:(record)=>({ ...record }),
    appendAuditEntry:async record=>{auditEntries.push(record); return record},
    canonicalGeography:({ country = 'Nigeria', state = 'Oyo', lga = '', ward = '', pollingUnit = '' }={})=>({
      country,
      state,
      lga,
      ward,
      pollingUnit,
      scopeId:'ng-oyo',
      sourceVersion:'oyo-operational-v1',
      sourceClassification:'field-observed',
      dataStatus:'approved',
      isCanonical:true,
    }),
    sourceProvenance:({ classification='field-observed', source='manual-submission', recordedBy='', recordedAt='', verificationStatus='unverified', electionId='ng-oyo-election', sourceVersion='oyo-operational-v1', sourceReleaseId='' }={})=>({
      classification,
      sourceType: classification,
      source,
      sourceVersion,
      electionId,
      sourceReleaseId,
      recordedBy,
      recordedAt,
      verificationStatus,
      isAuthoritative:false,
      acceptedBy:'',
    }),
    ...overrides,
  };
  registerResultRoutes({app,auth:next,rateLimit:next,adminOnly:next,asyncRoute:fn=>fn,store,io:{emit(){}},normalizeKey:value=>String(value).trim().toLowerCase(),logIp(){},getClientIp:()=>'',emitIncidentToViewers(){}});
  return {records,resultRecords,auditEntries,submit:async(body,user={id:'admin',name:'Command',role:'Admin',state:'Oyo'})=>{
    const res={statusCode:200,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}};
    await routes.get('post:/api/results')({body,user},res);
    return res;
  }};
}
function validBody() {
  const lga=getRegistrationLocationOptions('Oyo').lgas[0];
  const ward=getRegistrationLocationOptions('Oyo',lga).wards[0];
  const pollingUnit=getRegistrationLocationOptions('Oyo',lga,ward).pollingUnits[0];
  return {state:'Oyo',lga,ward,pollingUnit,referenceReleaseId:'release-1',lat:7.4,lng:3.9,results:[{party:'A',votes:0}],media:[{type:'image',data:'data:image/png;base64,iVBORw0KGgo='}]};
}
test('manual command result remains an unverified Oyo field observation',async()=>{
  const f=fixture();const res=await f.submit(validBody());
  assert.equal(res.statusCode,201);
  assert.equal(res.body.style.resultSource,'Command Centre');
  assert.equal(res.body.style.provenance.classification,'field-observed');
  assert.equal(res.body.style.provenance.verificationStatus,'unverified');
  assert.equal(res.body.style.scopeId,'ng-oyo');
  assert.equal(JSON.parse(res.body.resultCount)[0].votes,0);
  assert.equal(res.body.style.provenance.sourceType,'field-observed');
  assert.equal(res.body.style.provenance.sourceVersion,'2026-09-10-v1');
  assert.equal(res.body.style.provenance.sourceReleaseId,'release-1');
  assert.equal(res.body.style.provenance.electionId,'ng-oyo-election');
  assert.equal(res.body.style.geography.state,'Oyo');
  assert.equal(res.body.style.geography.lga,validBody().lga);
  assert.equal(res.body.style.geography.ward,validBody().ward);
  assert.equal(res.body.style.geography.pollingUnit,validBody().pollingUnit);
});
test('result write boundary rejects wrong state, unknown ward, invalid coordinates and missing counts without persisting',async()=>{
  const f=fixture();
  for(const patch of [{state:'Osun'},{state:'Unknown'},{ward:'Unknown'},{lat:100},{results:[{party:'A',votes:''}]},{results:[{party:'A',votes:2},{party:'A',votes:3}]}]) {
    const res=await f.submit({...validBody(),...patch});
    assert.ok([400,403].includes(res.statusCode),JSON.stringify(patch));
  }
  assert.equal(f.records.length,0);
});

test('result submissions create a dedicated result record with evidence and provenance',async()=>{
  const f=fixture();
  const res=await f.submit(validBody());
  assert.equal(res.statusCode,201);
  assert.equal(f.resultRecords.length,1);
  assert.equal(f.resultRecords[0].geography.state,'Oyo');
  assert.equal(f.resultRecords[0].provenance.electionId,'ng-oyo-election');
  assert.equal(f.resultRecords[0].sourceReleaseId,'release-1');
  assert.equal(f.resultRecords[0].provenance.classification,'field-observed');
  assert.equal(f.resultRecords[0].evidence.length,1);
  assert.equal(f.resultRecords[0].evidence[0].type,'image');
});

test('result submissions append an audit event for governance and traceability',async()=>{
  const f=fixture();
  const res=await f.submit(validBody(), { id:'admin', name:'Command', role:'Admin', state:'Oyo' });
  assert.equal(res.statusCode,201);
  assert.equal(f.auditEntries.length,2);
  assert.equal(f.auditEntries[0].entityType,'result');
  assert.equal(f.auditEntries[0].action,'result_submitted');
  assert.equal(f.auditEntries[0].actorId,'admin');
});

test('same submission ID with same payload is accepted as a replay, but a different payload conflicts', async () => {
  const base = validBody();
  const submissionId = 'offline-submission-123';
  const payload = {
    ...base,
    submissionId,
    payloadHash: createHash('sha256').update(JSON.stringify({
      ...base,
      submissionId,
    })).digest('hex'),
  };
  const store = {
    referenceDataReleases: async () => [{ id: 'release-1', scopeId: 'ng-oyo', sourceVersion: '2026-09-10-v1', records: [{ providerId: 'inec-pu-1', state: 'Oyo' }] }],
    parties: async () => ['A'],
    createIncident: async (record) => record,
    createResultRecord: async (record) => record,
    createAuditEntry: (record) => ({ ...record }),
    appendAuditEntry: async (record) => record,
    canonicalGeography: ({ country = 'Nigeria', state = 'Oyo', lga = '', ward = '', pollingUnit = '' } = {}) => ({
      country,
      state,
      lga,
      ward,
      pollingUnit,
      scopeId: 'ng-oyo',
      sourceVersion: 'oyo-operational-v1',
      sourceClassification: 'field-observed',
      dataStatus: 'approved',
      isCanonical: true,
    }),
    sourceProvenance: ({ classification = 'field-observed', source = 'manual-submission', recordedBy = '', recordedAt = '', verificationStatus = 'unverified', electionId = 'ng-oyo-election', sourceVersion = 'oyo-operational-v1', sourceReleaseId = '' } = {}) => ({
      classification,
      sourceType: classification,
      source,
      sourceVersion,
      electionId,
      sourceReleaseId,
      recordedBy,
      recordedAt,
      verificationStatus,
      isAuthoritative: false,
      acceptedBy: '',
    }),
  };
  const f = fixture(store);
  const first = await f.submit(payload, { id: 'agent-1', name: 'A', role: 'Agent', state: 'Oyo', lga: base.lga, ward: base.ward, pollingUnit: base.pollingUnit });
  assert.equal(first.statusCode, 201);

  const replay = await f.submit(payload, { id: 'agent-1', name: 'A', role: 'Agent', state: 'Oyo', lga: base.lga, ward: base.ward, pollingUnit: base.pollingUnit });
  assert.equal(replay.statusCode, 201);
  assert.equal(replay.body.message, 'Submission replay accepted');

  const conflict = await f.submit({
    ...payload,
    payloadHash: createHash('sha256').update(JSON.stringify({ ...payload, results: [{ party: 'A', votes: 1 }], submissionId })).digest('hex'),
    results: [{ party: 'A', votes: 1 }],
  }, { id: 'agent-1', name: 'A', role: 'Agent', state: 'Oyo', lga: base.lga, ward: base.ward, pollingUnit: base.pollingUnit });

  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.body.message, 'Submission conflict: this submission ID has already been used with different payload content.');
});

test('composed local store persists result records separately from incidents', async () => {
  const jsonDb = {
    incidents: [],
    resultRecords: [],
    parties: ['A'],
    fieldSubmissions: {},
    auditEntries: [],
    referenceDataReleases: {
      'reference-release:release-1': {
        id: 'release-1',
        status: 'approved',
        scopeId: 'ng-oyo',
        sourceVersion: '2026-09-10-v1',
        records: [{ providerId: 'inec-pu-1', state: 'Oyo' }],
      },
    },
  };
  const store = createStore({ pool: null, jsonDb, saveJson: () => {}, mappers: {}, scanner: async () => ({ status: 'clean', scanner: 'test-scanner' }) });
  const routes = new Map();
  const app = Object.fromEntries(['get', 'put', 'post'].map((method) => [method, (path, ...handlers) => routes.set(path, handlers.at(-1))]));
  const next = (_req, _res, nextHandler) => nextHandler?.();
  registerResultRoutes({
    app,
    auth: next,
    rateLimit: next,
    adminOnly: next,
    asyncRoute: (handler) => handler,
    store,
    io: { emit() {} },
    normalizeKey: (value) => String(value).trim().toLowerCase(),
    logIp() {},
    getClientIp: () => '',
    emitIncidentToViewers() {},
  });
  const responseFor = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const submission = { ...validBody(), submissionId: 'composed-retry-1' };
  const submit = async (body, user = { id: 'admin', name: 'Command', role: 'Admin', state: 'Oyo' }) => {
    const response = responseFor();
    await routes.get('/api/results')({ body, user }, response);
    return response;
  };

  const [first, concurrentRetry] = await Promise.all([submit(submission), submit(submission)]);

  assert.equal(first.statusCode, 201);
  assert.equal(concurrentRetry.statusCode, 201);
  assert.equal(jsonDb.resultRecords.length, 1);
  assert.equal(jsonDb.resultRecords[0].pollingUnit, validBody().pollingUnit);
  assert.equal(jsonDb.resultRecords[0].sourceReleaseId, 'release-1');
  assert.equal(jsonDb.incidents.length, 1);
  assert.equal(jsonDb.incidents[0].reportType, 'Polling Unit Result');
  assert.equal(jsonDb.resultRecords[0].reportType, undefined);
  assert.equal(first.body.resultRecord.id, jsonDb.resultRecords[0].id);
  assert.equal(concurrentRetry.body.message, 'Submission replay accepted');

  const conflict = await submit({ ...submission, results: [{ party: 'A', votes: 1 }] }, { id: 'another-admin', name: 'Other', role: 'Admin', state: 'Oyo' });
  assert.equal(conflict.statusCode, 409);
  assert.equal(jsonDb.resultRecords.length, 1);
  assert.equal(jsonDb.incidents.length, 1);
});

test('composed local transaction rolls back result, incident, submission, and audit writes', async () => {
  const jsonDb = { incidents: [], resultRecords: [], fieldSubmissions: {}, auditEntries: [] };
  const store = createStore({ pool: null, jsonDb, saveJson: () => {}, mappers: {}, scanner: async () => ({ status: 'clean', scanner: 'test-scanner' }) });

  await assert.rejects(
    store.withTransaction(async (transactionStore) => {
      await transactionStore.createResultRecord({
        id: 'rr-rollback',
        submissionId: 'rollback-1',
        payloadHash: 'rollback-hash',
        submittedBy: 'admin',
        evidence: [],
      });
      await transactionStore.protectMediaPayload([{ type: 'image', data: 'data:image/png;base64,iVBORw0KGgo=' }], {
        actorId: 'admin',
      });
      await transactionStore.createIncident({ id: 'incident-rollback', title: 'rollback', lat: 7, lng: 3 });
      jsonDb.fieldSubmissions['field-submission:rollback-1'] = { submissionId: 'rollback-1' };
      jsonDb.auditEntries.push({ id: 'audit-rollback' });
      throw new Error('simulated persistence failure');
    }),
    /simulated persistence failure/,
  );

  assert.deepEqual(jsonDb, { incidents: [], resultRecords: [], fieldSubmissions: {}, auditEntries: [] });
});
