import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('archive starts next segment before pending storage and saves without a live viewer', async () => {
  const source = readFileSync(new URL('../src/components/dashboard/DashboardRuntime.jsx', import.meta.url), 'utf8');
  const code = source.slice(source.indexOf('  const startArchiveRecording ='), source.indexOf('  useEffect(() => {\n    activeRoomRef.current'));
  const recorders = [];
  const saved = [];
  let releaseStorage;
  class Recorder {
    static isTypeSupported() { return true; }
    constructor() { this.mimeType = 'video/webm'; recorders.push(this); }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; }
  }
  const ref = current => ({ current });
  const context = { MediaRecorder: Recorder, Blob, Date, console, navigator: {},
    localCameraStreamRef: ref({}), sharingCameraRef: ref(true), archiveRecorderRef: ref(null),
    archiveRunningRef: ref(false), archiveChunksRef: ref([]), archiveSegmentTimerRef: ref(null),
    gpsBestRef: ref({ lat: 7.4, lng: 3.9 }), session: { user: { id: 'agent', lga: 'Ibadan', ward: '1' } },
    setTimeout: () => 1, clearTimeout() {}, setNotice() {}, flushOfflineVideoQueue() {},
    queueOfflineVideo: (blob, details) => { saved.push({ blob, details }); return new Promise(resolve => { releaseStorage = resolve; }); },
  };
  vm.runInNewContext(`${code}\nstartArchiveRecording();`, context);
  recorders[0].ondataavailable({ data: new Blob(['video']) });
  const saving = recorders[0].onstop();
  assert.equal(recorders.length, 2, 'recording must not wait for persistence or upload');
  assert.equal(saved[0].details.userId, 'agent');
  assert.equal(saved[0].details.lat, 7.4);
  assert.equal(saved[0].details.geography.ward, '1');
  assert.ok(saved[0].details.startedAt);
  releaseStorage();
  await saving;
});
