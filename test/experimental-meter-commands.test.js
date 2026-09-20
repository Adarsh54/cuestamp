import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,SessionHistory,sessionSchema} from '../src/experimental/session.js';
test('signature commands persist, edit, delete and undo without retiming notes',()=>{
 const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:8}},{op:'note.add',target:'r',values:{start:1,duration:2}}]);const tracks=structuredClone(h.session.tracks);
 h.execute([{op:'meter.add',values:{id:'six',bar:2,numerator:6,denominator:8}}]);assert.deepEqual(h.session.tracks,tracks);assert.equal(sessionSchema.parse(JSON.parse(JSON.stringify(h.session))).meterChanges[0].bar,2);
 h.execute([{op:'meter.set',target:'six',values:{bar:3}}]);assert.equal(h.session.meterChanges[0].bar,3);h.undo();assert.equal(h.session.meterChanges[0].bar,2);
 h.execute([{op:'meter.delete',target:'six'}]);assert.equal(h.session.meterChanges.length,0);h.undo();assert.equal(h.session.meterChanges.length,1);
});
test('invalid signatures and unsupported time edits reject atomically',()=>{
 const h=new SessionHistory(newSession());h.execute([{op:'meter.add',values:{id:'six',bar:3,numerator:6,denominator:8}}]);const before=structuredClone(h.session);
 for(const values of [{bar:3,numerator:7,denominator:4},{bar:1,numerator:4,denominator:4},{bar:4,numerator:4,denominator:3},{bar:10000000,numerator:4,denominator:4},{id:h.session.id,bar:4,numerator:4,denominator:4}])assert.throws(()=>h.execute([{op:'meter.add',values}]));
 assert.throws(()=>h.execute([{op:'session.insertTime',values:{position:1,duration:.5}}]),/inside a bar/);assert.deepEqual(h.session,before);
 h.execute([{op:'session.insertTime',values:{position:0,duration:2}}]);assert.equal(h.session.meterChanges[0].bar,4);h.undo();assert.deepEqual(h.session.meterChanges,before.meterChanges);
});
