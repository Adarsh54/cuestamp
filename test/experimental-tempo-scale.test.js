import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {compileTempoMap} from '../src/experimental/tempo-map.js';
import {scaleTempoPlan} from '../src/experimental/tempo-scale.js';
const source=()=>applyCommands(newSession(),[{op:'tempo.add',values:{id:'a',beat:4,bpm:80}},{op:'tempo.add',values:{id:'b',beat:12,bpm:100}}]);
test('global scaling preserves ratios and point IDs and scales every beat time inversely',()=>{
 const s=source(),plan=scaleTempoPlan(s,{factor:1.5}),old=compileTempoMap(s),next=compileTempoMap(plan);assert.deepEqual(plan.tempoChanges.map(p=>[p.id,p.bpm]),[['a',120],['b',150]]);for(let beat=0;beat<40;beat+=.37)assert.ok(Math.abs(next.timeAtBeat(beat)-old.timeAtBeat(beat)/1.5)<1e-10);
});
test('range scaling inserts boundaries and restores original outside tempo exactly',()=>{
 const s=source(),plan=scaleTempoPlan(s,{factor:.5,startBeat:2,endBeat:10}),old=compileTempoMap(s),next=compileTempoMap(plan);
 for(let beat=0;beat<30;beat+=.125)assert.equal(next.tempoAtBeat(beat),old.tempoAtBeat(beat)*(beat>=2&&beat<10?.5:1));assert.equal(plan.duration,plan.previousDuration*2);assert.equal(plan.tempoChanges.find(p=>p.beat===4).id,'a');assert.equal(plan.tempoChanges.find(p=>p.beat===12).id,'b');
 assert.deepEqual(scaleTempoPlan(s,{factor:1}).tempoChanges,s.tempoChanges);
});
test('scale command retimes MIDI but preserves audio and supports undo',()=>{
 const h=new SessionHistory(applyCommands(source(),[{op:'track.add',values:{id:'m',kind:'midi'}},{op:'region.add',target:'m',values:{id:'r',start:2,duration:4}},{op:'note.add',target:'r',values:{pitch:60,start:1,duration:1}},{op:'track.add',values:{id:'audio',kind:'audio'}},{op:'region.add',target:'audio',values:{id:'ar',start:2,duration:4}}])),before=structuredClone(h.session);h.execute([{op:'tempo.scale',values:{factor:2}}]);assert.equal(h.session.tracks[0].regions[0].start,1);assert.equal(h.session.tracks[0].regions[0].notes[0].start,.5);assert.deepEqual(h.session.tracks[1],before.tracks[1]);h.undo();assert.deepEqual(h.session,{...before,revision:h.session.revision});
});
test('invalid factors, incomplete ranges and excessive boundary points are atomic',()=>{
 const h=new SessionHistory(source()),before=structuredClone(h.session);for(const values of [{factor:0},{factor:4},{factor:.01},{factor:2,startBeat:4},{factor:2,startBeat:8,endBeat:4}]){assert.throws(()=>h.execute([{op:'tempo.scale',values}]));assert.deepEqual(h.session,before);}
 const full={...newSession(),tempoChanges:Array.from({length:256},(_,i)=>({id:`p${i}`,beat:i+1,bpm:120}))};assert.throws(()=>scaleTempoPlan(full,{factor:1.1,startBeat:.5,endBeat:2.5}),/256/);
});
