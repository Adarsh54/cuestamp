import test from 'node:test';import assert from 'node:assert/strict';
import {constantTempoPlan} from '../src/experimental/tempo-constant.js';
import {compileTempoMap} from '../src/experimental/tempo-map.js';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
const source=()=>applyCommands(newSession(),[{op:'tempo.add',values:{id:'slow',beat:4,bpm:60}},{op:'tempo.add',values:{id:'fast',beat:8,bpm:180}},{op:'tempo.add',values:{id:'after',beat:20,bpm:100}}]);
test('constant tempo uses duration-weighted BPM and preserves all downstream beat times',()=>{
 const s=source(),old=compileTempoMap(s),plan=constantTempoPlan(s,{startBeat:0,endBeat:8}),next=compileTempoMap(plan);assert.equal(plan.bpm,80);assert.equal(plan.duration,6);assert.equal(next.tempoAtBeat(7),80);assert.equal(next.tempoAtBeat(8),180);assert.equal(plan.tempoChanges[0].id,'fast');
 for(let beat=8;beat<100;beat+=.17)assert.ok(Math.abs(next.timeAtBeat(beat)-old.timeAtBeat(beat))<1e-10);
});
test('boundaries inside tempo spans preserve the range start and end, with later IDs retained',()=>{
 const s=source(),old=compileTempoMap(s),plan=constantTempoPlan(s,{startBeat:2,endBeat:10}),next=compileTempoMap(plan);assert.ok(Math.abs(next.timeAtBeat(2)-old.timeAtBeat(2))<1e-12);assert.ok(Math.abs(next.timeAtBeat(10)-old.timeAtBeat(10))<1e-12);assert.equal(plan.tempoChanges.at(-1).id,'after');assert.equal(next.tempoAtBeat(10),180);
});
test('constant tempo retimes only musical interior positions, with undo and fixed video',()=>{
 const h=new SessionHistory(applyCommands(source(),[{op:'track.add',values:{id:'m',kind:'midi'}},{op:'region.add',target:'m',values:{id:'r',duration:10}},{op:'note.add',target:'r',values:{id:'inside',pitch:60,start:1,duration:.5}},{op:'note.add',target:'r',values:{id:'later',pitch:60,start:7,duration:.5}},{op:'track.add',values:{id:'v',kind:'video'}},{op:'region.add',target:'v',values:{id:'video',start:0,duration:10}}]));const before=structuredClone(h.session);h.execute([{op:'tempo.constant',values:{startBeat:0,endBeat:8}}]);const notes=h.session.tracks[0].regions[0].notes;assert.equal(notes[0].start,1.5);assert.ok(Math.abs(notes[1].start-7)<1e-10);assert.deepEqual(h.session.tracks[1],before.tracks[1]);h.undo();assert.deepEqual(h.session,{...before,revision:h.session.revision});
});
test('invalid ranges reject atomically and a constant passage keeps its exact BPM',()=>{
 const h=new SessionHistory(source()),before=structuredClone(h.session);for(const values of [{startBeat:8,endBeat:8},{startBeat:-1,endBeat:4},{startBeat:0,endBeat:432000}]){assert.throws(()=>h.execute([{op:'tempo.constant',values}]));assert.deepEqual(h.session,before);}
 const unchanged=source(),plan=constantTempoPlan(unchanged,{startBeat:5,endBeat:6});assert.equal(plan.bpm,60);assert.deepEqual(plan.tempoChanges,unchanged.tempoChanges);assert.equal(plan.tempo,unchanged.tempo);
});
