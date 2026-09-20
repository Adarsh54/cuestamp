import test from 'node:test';import assert from 'node:assert/strict';
import {meterFromSeconds,insertMeterTime,deleteMeterTime,insertMeterSection} from '../src/experimental/meter-time-edit.js';
import {insertTempoTime,deleteTempoTime} from '../src/experimental/tempo-time-edit.js';
const s={tempo:120,meter:4,meterChanges:[{id:'six',bar:3,numerator:6,denominator:8},{id:'three',bar:5,numerator:3,denominator:4}]};
test('signature insertion preserves identity and shifts whole bars',()=>{
 const out=insertMeterTime(s,2,2);assert.deepEqual(out.meterChanges,s.meterChanges.map(p=>({...p,bar:p.bar+1})));assert.equal(s.meterChanges[0].bar,3);
 assert.throws(()=>insertMeterTime(s,2,.5),/inside a bar/);assert.equal(insertMeterTime({tempo:120,meter:4},2,.5),null);
});
test('signature deletion removes interior changes and restores the seam',()=>{
 const out=deleteMeterTime(s,2,5.5);assert.equal(out.meterChanges[0].bar,2);assert.equal(out.meterChanges[0].numerator,6);assert.equal(out.meterChanges[1].bar,3);assert.equal(out.meterChanges[1].id,'three');
 const head=deleteMeterTime(s,0,4);assert.equal(head.meter,6);assert.equal(head.meterDenominator,8);assert.equal(head.meterChanges[0].bar,3);
 assert.throws(()=>deleteMeterTime(s,.5,1),/inside a bar/);
});
test('signature edits integrate the resulting tempo map',()=>{
 const source={...s,tempoChanges:[{id:'slow',beat:4,bpm:60}]};
 const insertedTempo=insertTempoTime(source,2,2),inserted=insertMeterTime(source,2,2,insertedTempo);assert.equal(inserted.meterChanges[0].bar,4);
 const deletedTempo=deleteTempoTime(source,0,2),deleted=deleteMeterTime(source,0,2,deletedTempo);assert.equal(deleted.meterChanges[0].bar,2);
});
test('signature reconstruction validates all points and collapses duplicates',()=>{
 assert.throws(()=>meterFromSeconds([{time:0,numerator:4,denominator:3}],s));
 assert.throws(()=>meterFromSeconds([{time:1,numerator:4,denominator:4}],s));
 const result=meterFromSeconds([{time:0,numerator:4,denominator:4},{time:2,numerator:4,denominator:4},{time:4,numerator:6,denominator:8,id:'keep'}],s);assert.equal(result.meterChanges[0].bar,3);assert.equal(result.meterChanges[0].id,'keep');
});

test('copied signatures restore destination and get independent IDs',()=>{
 const out=insertMeterSection(s,s,4,7,2);assert.deepEqual(out.meterChanges.map(p=>[p.bar,p.numerator,p.denominator]),[[2,6,8],[4,4,4],[5,6,8],[7,3,4]]);
 assert.notEqual(out.meterChanges[0].id,'six');assert.equal(out.meterChanges[2].id,'six');assert.equal(new Set(out.meterChanges.map(p=>p.id)).size,4);
 const moved=insertMeterSection({tempo:120,meter:4},s,4,7,2,{tempo:120},{move:true});assert.equal(moved.meterChanges[0].id,'six');
 assert.throws(()=>insertMeterSection(s,s,4,5,2),/inside a bar/);
});
