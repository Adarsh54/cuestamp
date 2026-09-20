import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,SessionHistory} from '../src/experimental/session.js';import {writeMidi,readMidi} from '../src/experimental/midi.js';
test('project key persists and exports without transposing or retiming music',()=>{
 const h=new SessionHistory(newSession());assert.equal(h.session.keySignature,null);h.execute([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:4}},{op:'note.add',target:'r',values:{pitch:60,start:1,duration:1}}]);const tracks=structuredClone(h.session.tracks);
 h.execute([{op:'key.set',values:{sharps:-3,mode:'minor'}}]);assert.deepEqual(h.session.tracks,tracks);const restored=new SessionHistory(JSON.parse(JSON.stringify(h.session)));assert.deepEqual(restored.session.keySignature,{sharps:-3,mode:'minor'});assert.deepEqual(readMidi(writeMidi(restored.session).buffer).keySignatures,[{sharps:-3,mode:'minor',beat:0,time:0}]);
 h.execute([{op:'key.clear'}]);assert.equal(readMidi(writeMidi(h.session).buffer).keySignatures.length,0);h.undo();assert.equal(h.session.keySignature.sharps,-3);h.redo();assert.equal(h.session.keySignature,null);
});
test('invalid key edits reject atomically',()=>{
 const h=new SessionHistory(newSession()),before=structuredClone(h.session);
 for(const keySignature of [{sharps:8,mode:'major'},{sharps:-8,mode:'minor'},{sharps:1.5,mode:'major'},{sharps:0,mode:'dorian'},{sharps:0,mode:'major',transpose:true}])assert.throws(()=>h.execute([{op:'session.set',values:{title:'Changed'}},{op:'key.set',values:keySignature}]));assert.deepEqual(h.session,before);
});
