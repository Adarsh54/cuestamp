import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {readMidi,writeMidi,encodeMidiImport} from '../src/experimental/midi.js';
import {applyMidiImportKey} from '../src/experimental/midi-import-key.js';
const source=()=>applyCommands(newSession(),[{op:'key.set',values:{sharps:-3,mode:'minor'}},{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',start:0,duration:4}},{op:'note.add',target:'r',values:{pitch:60,start:0,duration:1,velocity:.8}}]);
const command=(s,values={})=>({op:'midi.import',values:{data:encodeMidiImport(writeMidi(s).buffer),...values}});
test('opening key adoption preserves pitches, supports undo and round-trip persistence',()=>{
 const h=new SessionHistory(newSession());h.execute([command(source(),{keyMode:'opening',start:3})]);assert.deepEqual(h.session.keySignature,{sharps:-3,mode:'minor'});assert.equal(h.session.tracks[0].regions[0].notes[0].pitch,60);assert.deepEqual(new SessionHistory(JSON.parse(JSON.stringify(h.session))).session.keySignature,h.session.keySignature);h.undo();assert.equal(h.session.keySignature,null);
});
test('default import preserves project key; invalid or missing opening key rejects atomically',()=>{
 const h=new SessionHistory(applyCommands(newSession(),[{op:'key.set',values:{sharps:2,mode:'major'}}]));h.execute([command(source())]);assert.equal(h.session.keySignature.sharps,2);const before=structuredClone(h.session);
 assert.throws(()=>h.execute([command(source(),{keyMode:'bad'})]),/opening key/);
 const noKey=source();noKey.keySignature=null;assert.throws(()=>h.execute([command(noKey,{keyMode:'opening'})]),/no opening key/);assert.deepEqual(h.session,before);
});
test('key-only imports create no tracks and later changes never substitute for an opening key',()=>{
 const s=newSession();s.keySignature={sharps:4,mode:'major'};const result=applyCommands(newSession(),[command(s,{keyMode:'opening'})]);assert.deepEqual(result.keySignature,s.keySignature);assert.equal(result.tracks.length,0);
 assert.throws(()=>applyMidiImportKey(s,{keySignatures:[{beat:4,sharps:0,mode:'minor'}]},'opening'),/no opening key/);
});

test('full key import follows source performance, destination beats, or adopted tempo with undo',()=>{
 const src=source();src.tempo=60;src.keyChanges=[{id:'source-key',beat:4,sharps:1,mode:'major'}];
 for(const [tempoMode,expectedBeat]of [['performance',12],['follow',8],['adopt',8]]){
  const h=new SessionHistory(applyCommands(newSession(),[{op:'key.set',values:{sharps:0,mode:'major'}},{op:'keyChange.add',values:{id:'earlier',beat:2,sharps:-1,mode:'major'}},{op:'keyChange.add',values:{id:'later',beat:20,sharps:5,mode:'minor'}}]));const before=structuredClone(h.session);
  h.execute([command(src,{keyMode:'adopt',tempoMode,start:2})]);assert.deepEqual(h.session.keySignature,before.keySignature);assert.deepEqual(h.session.keyChanges.map(p=>[p.beat,p.sharps]),[[2,-1],[4,-3],[expectedBeat,1]]);h.undo();assert.deepEqual(h.session,{...before,revision:h.session.revision});
 }
});
test('key-only modulation imports retain unknown opening and preserve keys before first signature',()=>{
 const src=newSession();src.keyChanges=[{id:'late',beat:4,sharps:3,mode:'minor'}];
 const h=new SessionHistory(applyCommands(newSession(),[{op:'keyChange.add',values:{id:'keep',beat:2,sharps:1,mode:'major'}},{op:'keyChange.add',values:{id:'replace',beat:8,sharps:-1,mode:'major'}}]));
 h.execute([command(src,{keyMode:'adopt',tempoMode:'follow'})]);assert.equal(h.session.keySignature,null);assert.deepEqual(h.session.keyChanges.map(p=>[p.beat,p.sharps]),[[2,1],[4,3]]);assert.equal(h.session.tracks.length,0);
});
test('adopting keys with changing tempo uses the same mapped positions as imported notes',()=>{
 const src=source();src.tempo=60;src.tempoChanges=[{id:'speed',beat:2,bpm:120}];src.keyChanges=[{id:'key',beat:4,sharps:2,mode:'major'}];src.tracks[0].regions[0].notes[0].start=3;
 for(const tempoMode of ['performance','follow','adopt']){
  const result=applyCommands(newSession(),[command(src,{keyMode:'adopt',tempoMode})]);const imported=result.tracks[0].regions[0];
  const map=readMidi(writeMidi(result).buffer);assert.equal(map.keySignatures[1].time,imported.start+imported.notes[0].start);
 }
});

test('failed key adoption rolls back notes, tempo, and keys together',()=>{
 const h=new SessionHistory(newSession()),before=structuredClone(h.session),missing=source();missing.keySignature=null;
 assert.throws(()=>h.execute([command(missing,{keyMode:'adopt',tempoMode:'adopt'})]),/no key signatures/);assert.deepEqual(h.session,before);
 const late=newSession();late.tempo=300;late.keyChanges=[{id:'far',beat:100,sharps:0,mode:'major'}];
 assert.throws(()=>h.execute([command(late,{keyMode:'adopt',start:86399})]),/24-hour/);assert.deepEqual(h.session,before);
 const crowded=newSession();crowded.keyChanges=Array.from({length:256},(_,i)=>({id:`k${i}`,beat:i+1,sharps:0,mode:'major'}));const full=new SessionHistory(crowded),snapshot=structuredClone(full.session);
 assert.throws(()=>full.execute([command(source(),{keyMode:'adopt',start:200})]),/256/);assert.deepEqual(full.session,snapshot);
});
