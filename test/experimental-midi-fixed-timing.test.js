import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory,sessionSchema} from '../src/experimental/session.js';
import {writeMidi,readMidi,encodeMidiImport} from '../src/experimental/midi.js';
const source=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'t',kind:'midi'}},...['fixed','follow'].flatMap(id=>[{op:'region.add',target:'t',values:{id,start:1,duration:3,...(id==='fixed'?{tempoFollow:false}:{})}},{op:'note.add',target:id,values:{pitch:69,start:.5,duration:.5}},{op:'event.add',target:id,values:{type:'pitchBend',start:1,value:9000}},{op:'region.set',target:id,values:{fadeIn:.1,fadeOut:.2}}])]);
test('fixed MIDI keeps every time value under each tempo operation while musical MIDI follows',()=>{
 const commands=[{op:'session.set',values:{tempo:60}},{op:'tempo.add',values:{beat:2,bpm:60}},{op:'tempo.scale',values:{factor:.5}},{op:'tempo.ramp',values:{startBeat:0,endBeat:8,fromBpm:60,toBpm:100,step:1}},{op:'tempo.fit',values:{startBeat:0,endBeat:8,targetTime:8}}];
 for(const command of commands){const s=source(),next=applyCommands(s,[command]);assert.deepEqual(next.tracks[0].regions[0],s.tracks[0].regions[0]);assert.notEqual(next.tracks[0].regions[1].duration,s.tracks[0].regions[1].duration);}
});
test('toggling timing does not move content; reenabling follows from its current time and undo persists',()=>{
 const h=new SessionHistory(source());h.execute([{op:'session.set',values:{tempo:60}}]);const before=structuredClone(h.session);h.execute([{op:'region.set',target:'fixed',values:{tempoFollow:true}}]);assert.deepEqual(h.session.tracks[0].regions[0],{...before.tracks[0].regions[0],tempoFollow:true});h.execute([{op:'session.set',values:{tempo:120}}]);assert.equal(h.session.tracks[0].regions[0].start,.5);h.undo();h.undo();assert.deepEqual(h.session,{...before,revision:h.session.revision});assert.equal(sessionSchema.parse(JSON.parse(JSON.stringify(h.session))).tracks[0].regions[0].tempoFollow,false);
});
test('fixed mode survives duplication, rejects mixed joins, and MIDI export retains audible seconds',()=>{
 let s=source();assert.throws(()=>applyCommands(s,[{op:'region.joinMidi',target:'fixed',values:{regionIds:'follow'}}]),/same tempo-following/);
 s=applyCommands(s,[{op:'region.duplicate',target:'fixed',values:{start:5}}]);assert.equal(s.tracks[0].regions[2].tempoFollow,false);
 s=applyCommands(s,[{op:'session.set',values:{tempo:60}}]);const midi=readMidi(writeMidi(s).buffer);assert.ok(midi.tracks[0].notes.some(n=>Math.abs(n.start-1.5)<1e-8));assert.ok(midi.tracks[0].notes.some(n=>Math.abs(n.start-5.5)<1e-8));
});
test('adopting imported tempo respects fixed existing regions and protection still rejects property changes',()=>{
 const s=source(),file=applyCommands(newSession(),[{op:'session.set',values:{tempo:60}},{op:'track.add',values:{id:'file',kind:'midi'}},{op:'region.add',target:'file',values:{id:'file-r',duration:2}},{op:'note.add',target:'file-r',values:{pitch:60,start:0,duration:1}}]);
 const next=applyCommands(s,[{op:'midi.import',values:{data:encodeMidiImport(writeMidi(file).buffer),tempoMode:'adopt'}}]);assert.deepEqual(next.tracks[0].regions[0],s.tracks[0].regions[0]);assert.equal(next.tracks[0].regions[1].start,2);
 const protectedSession=applyCommands(s,[{op:'track.set',target:'t',values:{protected:true}}]);assert.throws(()=>applyCommands(protectedSession,[{op:'region.set',target:'fixed',values:{tempoFollow:true}}]),/Unprotect/);
});
