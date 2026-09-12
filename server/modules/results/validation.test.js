import test from 'node:test';
import assert from 'node:assert/strict';
import { validateResultEntries } from './validation.js';
import { validateOyoAssignment } from '../geography/validation.js';
import { requireOyoState } from '../../config/deployment.js';
import { getRegistrationLocationOptions } from '../../../shared/electionData.js';

test('result validation preserves zero and rejects missing, duplicate and invalid votes', () => {
  assert.deepEqual(validateResultEntries([{party:'A',votes:0},{party:'B',votes:'12'}],['A','B']),[{party:'A',votes:0},{party:'B',votes:12}]);
  for(const votes of [null,undefined,'',false,-1,1.5,Infinity,Number.MAX_SAFE_INTEGER+1]) assert.throws(()=>validateResultEntries([{party:'A',votes}],['A']));
  assert.throws(()=>validateResultEntries([{party:'A',votes:2},{party:'A',votes:3}],['A']));
  assert.throws(()=>validateResultEntries([{party:'Unknown',votes:2}],['A']));
});
test('Oyo deployment rejects other states and geography from a different parent', () => {
  assert.equal(requireOyoState(' oyo '),'Oyo');
  for(const state of ['Osun','Lagos','Unknown'])assert.throws(()=>requireOyoState(state));
  const lga=getRegistrationLocationOptions('Oyo').lgas[0];
  const ward=getRegistrationLocationOptions('Oyo',lga).wards[0];
  const pollingUnit=getRegistrationLocationOptions('Oyo',lga,ward).pollingUnits[0];
  assert.equal(validateOyoAssignment({state:'Oyo',lga,ward,pollingUnit}).pollingUnit,pollingUnit);
  assert.throws(()=>validateOyoAssignment({state:'Osun',lga,ward,pollingUnit}));
  assert.throws(()=>validateOyoAssignment({state:'Oyo',lga,ward:'Unknown ward'}));
  assert.throws(()=>validateOyoAssignment({state:'Oyo',lga,ward,pollingUnit:'Unknown unit'}));
  assert.throws(()=>validateOyoAssignment({state:'Oyo',ward}));
});
