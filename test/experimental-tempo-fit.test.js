import test from 'node:test';import assert from 'node:assert/strict';
import {fitTempoPlan} from '../src/experimental/tempo-fit.js';
import {compileTempoMap} from '../src/experimental/tempo-map.js';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
const source=()=>applyCommands(newSession(),[{op:'tempo.add',values:{id:'slow',beat:4,bpm:60}},{op:'tempo.add',values:{id:'fast',beat:8,bpm:180}}]);
test('fit tempo fixes range start and target endpoint while preserving tempo ratios and later BPM',()=>{
 const s=source(),old=compileTempoMap(s),plan=fitTempoPlan(s,{startBeat:2,endBeat:8,targetTime:11}),next=compileTempoMap(plan);assert.equal(plan.factor,.5);assert.equal(next.timeAtBeat(2),1);assert.equal(next.timeAtBeat(8),11);assert.equal(next.tempoAtBeat(3),60);assert.equal(next.tempoAtBeat(5),30);assert.equal(next.tempoAtBeat(8),180);assert.equal(plan.tempoChanges.find(p=>p.id==='slow').beat,4);assert.ok(Math.abs(next.timeAtBeat(12)-old.timeAtBeat(12)-5)<1e-10);
});
test('fit command retimes MIDI, keeps video and markers fixed, and supports undo',()=>{
 const h=new SessionHistory(applyCommands(source(),[{op:'track.add',values:{id:'m',kind:'midi'}},{op:'region.add',target:'m',values:{id:'r',duration:10}},{op:'note.add',target:'r',values:{pitch:60,start:1,duration:.5}},{op:'note.add',target:'r',values:{pitch:60,start:7,duration:.5}},{op:'track.add',values:{id:'v',kind:'video'}},{op:'region.add',target:'v',values:{id:'video',duration:10}},{op:'marker.add',values:{name:'Hit',time:12}}]));const before=structuredClone(h.session);h.execute([{op:'tempo.fit',values:{startBeat:0,endBeat:8,targetTime:12}}]);assert.equal(h.session.tracks[0].regions[0].notes[0].start,2);assert.equal(h.session.tracks[0].regions[0].notes[1].start,13);assert.deepEqual(h.session.tracks[1],before.tracks[1]);assert.deepEqual(h.session.markers,before.markers);h.undo();assert.deepEqual(h.session,{...before,revision:h.session.revision});
});
test('fit rejects impossible tempos and invalid endpoints atomically; unchanged endpoint keeps tempo data',()=>{
 const h=new SessionHistory(source()),before=structuredClone(h.session);for(const values of [{startBeat:2,endBeat:8,targetTime:1},{startBeat:8,endBeat:4,targetTime:10},{startBeat:0,endBeat:8,targetTime:.1},{startBeat:0,endBeat:8,targetTime:1000}]){assert.throws(()=>h.execute([{op:'tempo.fit',values}]));assert.deepEqual(h.session,before);}
 const plan=fitTempoPlan(before,{startBeat:0,endBeat:8,targetTime:6});assert.equal(plan.changed,0);assert.deepEqual(plan.tempoChanges,before.tempoChanges);
});
