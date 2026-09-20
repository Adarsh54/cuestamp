import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {writeMidi,encodeMidiImport} from '../src/experimental/midi.js';
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
