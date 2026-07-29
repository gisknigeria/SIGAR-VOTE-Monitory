import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeContextLocally, summarizeNewsLocally } from './ai.js';

test('summarizeNewsLocally produces a useful summary from headlines', () => {
  const summary = summarizeNewsLocally([
    { title: 'INEC reports late opening at Ibadan polling unit', source: 'Premium Times' },
    { title: 'Security incident reported near Oyo ward', source: 'Guardian' },
  ]);

  assert.match(summary, /Ibadan|INEC|operational/i);
});

test('analyzeContextLocally highlights critical issues and confidence', () => {
  const analysis = analyzeContextLocally({
    incidents: [
      { severity: 'Critical', reportType: 'SOS-Emergency', status: 'Open' },
      { severity: 'High', reportType: 'Vote Buying', status: 'Open' },
    ],
    coverage: 8,
    leader: 'Party A',
  });

  assert.match(analysis, /Critical|SOS|coverage/i);
  assert.match(analysis, /Party A/i);
});
