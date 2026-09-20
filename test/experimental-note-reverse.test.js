import test from 'node:test';import assert from 'node:assert/strict';import {SessionHistory,newSession} from '../src/experimental/session.js';import {reverseNoteEdits} from '../src/experimental/note-reverse.js';
const fixture=()=>{const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:8}},...[{id:'a',start:1,duration:.5,pitch:60,channel:0},{id:'b',start:2,duration:1,pitch:64,channel:1},{id:'c',start:4,duration:2,pitch:67,channel:2}].map(values=>({op:'note.add',target:'r',values})),{op:'event.add',target:'r',values:{id:'cc',type:'controlChange',start:2,parameter:64,value:127,channel:0}}]);return h;};
const region=h=>h.session.tracks[0].regions[0];
test('phrase reversal mirrors intervals, preserves attributes/events, is involutive and undoable',()=>{const h=fixture(),before=structuredClone(region(h));h.execute([{op:'notes.reverse',target:'r'}]);assert.deepEqual(region(h).notes.map(n=>n.start),[5.5,4,1]);for(let i=0;i<3;i++)assert.deepEqual({...region(h).notes[i],start:before.notes[i].start},before.notes[i]);assert.deepEqual(region(h).events,before.events);h.execute([{op:'notes.reverse',target:'r'}]);assert.deepEqual(region(h),before);h.undo();assert.deepEqual(region(h).notes.map(n=>n.start),[5.5,4,1]);h.redo();assert.deepEqual(region(h),before);});
test('region and selection bounds preserve unselected notes and reject invalid batches atomically',()=>{const h=fixture();h.execute([{op:'notes.reverse',target:'r',values:{bounds:'region',noteIds:'a,c'}}]);assert.deepEqual(region(h).notes.map(n=>n.start),[6.5,2,2]);const before=structuredClone(h.session);for(const values of [{bounds:'bad'},{noteIds:''},{noteIds:'a,a'},{noteIds:'missing'},{noteId:'a',noteIds:'c'},{other:true}]){assert.throws(()=>h.execute([{op:'session.set',values:{title:'bad'}},{op:'notes.reverse',target:'r',values}]));assert.deepEqual(h.session,before);}assert.throws(()=>reverseNoteEdits({duration:1,notes:[]}));});
test('musical reversal mirrors beat intervals across tempo changes and reverses back',async()=>{
 const {compileTempoMap}=await import('../src/experimental/tempo-map.js');
 const h=fixture();h.execute([{op:'tempo.add',values:{id:'slow',beat:8,bpm:60}}]);const before=structuredClone(region(h)),map=compileTempoMap(h.session);
 const start=map.beatAtTime(Math.min(...before.notes.map(n=>n.start))),end=map.beatAtTime(Math.max(...before.notes.map(n=>n.start+n.duration)));
 h.execute([{op:'notes.reverse',target:'r',values:{timing:'beats'}}]);
 region(h).notes.forEach((n,i)=>{const a=before.notes[i];assert.equal(map.beatAtTime(n.start),start+end-map.beatAtTime(a.start+a.duration));assert.equal(map.beatAtTime(n.start+n.duration)-map.beatAtTime(n.start),map.beatAtTime(a.start+a.duration)-map.beatAtTime(a.start));assert.equal(n.id,a.id);assert.equal(n.channel,a.channel);});
 assert.ok(region(h).notes.some((n,i)=>n.duration!==before.notes[i].duration));assert.deepEqual(region(h).events,before.events);
 h.execute([{op:'notes.reverse',target:'r',values:{timing:'beats'}}]);assert.deepEqual(region(h),before);
 h.undo();assert.notDeepEqual(region(h).notes,before.notes);h.redo();assert.deepEqual(region(h),before);
});
test('mapped reversal supports offbeat region origins and only changes selected notes',async()=>{
 const {regionBeatTiming}=await import('../src/experimental/tempo-map.js');
 const h=fixture();h.execute([{op:'region.move',target:'r',values:{trackId:'t',start:1.25}},{op:'tempo.add',values:{beat:8,bpm:90}}]);
 const before=structuredClone(region(h)),clock=regionBeatTiming(before,h.session),end=clock.beatAtTime(before.duration);
 h.execute([{op:'notes.reverse',target:'r',values:{timing:'beats',bounds:'region',noteIds:'a,c'}}]);
 assert.deepEqual(region(h).notes[1],before.notes[1]);
 for(const i of [0,2])assert.ok(Math.abs(clock.beatAtTime(region(h).notes[i].start)-(end-clock.beatAtTime(before.notes[i].start+before.notes[i].duration)))<1e-9);
 const saved=structuredClone(h.session);assert.throws(()=>h.execute([{op:'notes.reverse',target:'r',values:{timing:'bad'}}]));assert.deepEqual(h.session,saved);
 assert.throws(()=>h.execute([{op:'track.set',target:'t',values:{protected:true}},{op:'notes.reverse',target:'r',values:{timing:'beats'}}]),/Unprotect/);
});
test('musical reversal rejects stretched notes beyond the duration limit',()=>{
 const r={start:0,duration:15000,notes:[{id:'n',start:0,duration:1000}]},timing={tempo:120,tempoChanges:[{beat:5000,bpm:20}]};
 assert.throws(()=>reverseNoteEdits(r,{bounds:'region',timing:'beats'},timing),/valid lengths/);
 assert.throws(()=>reverseNoteEdits(r,{timing:'beats'}),/session timing/);
});
