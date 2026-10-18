import test from 'node:test';
import assert from 'node:assert/strict';
import {copyDrumBar} from '../src/experimental/drum-pattern-copy.js';
import {SessionHistory} from '../src/experimental/session.js';
test('copy bar replaces only destination percussion, preserves musical timing and supports undo',()=>{
 const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'midi',instrument:'drumKit'}},{op:'region.add',target:'t',values:{id:'r',duration:8}},{op:'note.add',target:'r',values:{id:'a',pitch:36,start:.25,duration:.125,velocity:.7,channel:9,mute:true}},{op:'note.add',target:'r',values:{id:'b',pitch:38,start:2.5,duration:.1,channel:9}},{op:'note.add',target:'r',values:{id:'c',pitch:60,start:2.5,duration:.1,channel:0}}]);
 // Tempo changes applied by the engine retime the existing MIDI region.
 h.execute([{op:'tempo.add',values:{beat:4,bpm:60}}]);
 const before=structuredClone(h.session.tracks),r=h.session.tracks[0].regions[0];h.execute([{op:'region.copyDrumBar',target:r.id,values:{bar:1}}]);
 const notes=h.session.tracks[0].regions[0].notes;assert.ok(!notes.some(n=>n.id==='b'));assert.ok(notes.some(n=>n.id==='c'));
 const copied=notes.find(n=>!['a','c'].includes(n.id));assert.equal(copied.start,2.5);assert.equal(copied.duration,.25);assert.equal(copied.velocity,.7);assert.equal(copied.mute,true);assert.equal(copied.channel,9);
 h.undo();assert.deepEqual(h.session.tracks,before);
});
test('copy clips to a shorter destination and refuses the final bar',()=>{
 const session={tempo:120,meter:4,meterChanges:[{bar:2,numerator:2,denominator:4}]};
 const r={id:'r',start:0,duration:3,notes:[{id:'a',pitch:36,channel:9,start:.75,duration:.5,velocity:1},{id:'b',pitch:38,channel:9,start:1.5,duration:.1,velocity:1}]};
 const cmds=copyDrumBar(r,session,0);assert.equal(cmds.length,1);assert.equal(cmds[0].values.start,2.75);assert.equal(cmds[0].values.duration,.25);
 assert.throws(()=>copyDrumBar(r,session,1),/no following bar/);
});
test('copying an empty source clears only drum hits in the following bar',()=>{
 const r={id:'r',start:0,duration:4,notes:[{id:'b',channel:9,start:2},{id:'c',channel:0,start:2},{id:'d',channel:9,start:4}]};
 assert.deepEqual(copyDrumBar(r,{tempo:120,meter:4},0),[{op:'note.delete',target:'b'}]);
});

test('validated command rejects invalid targets and bar values atomically',()=>{
 const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'midi',instrument:'drumKit'}},{op:'region.add',target:'t',values:{id:'r',duration:4}}]);const before=structuredClone(h.session);
 for(const bar of [0,1.5,3,100])assert.throws(()=>h.execute([{op:'region.copyDrumBar',target:'r',values:{bar}}]));
 assert.deepEqual(h.session,before);
 h.execute([{op:'track.set',target:'t',values:{instrument:'sine'}}]);assert.throws(()=>h.execute([{op:'region.copyDrumBar',target:'r',values:{bar:1}}]),/drum-kit/);
});
