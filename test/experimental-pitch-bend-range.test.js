import test from 'node:test';import assert from 'node:assert/strict';
import {pitchBendCents} from '../src/experimental/pitch-bend.js';
import {samplerOffset} from '../src/experimental/sampler.js';
import {schedulePitchBend} from '../src/experimental/midi-events.js';
import {newSession,SessionHistory} from '../src/experimental/session.js';
test('pitch bend uses configurable symmetric endpoints and preserves legacy default',()=>{
 assert.equal(pitchBendCents(0),-200);assert.equal(pitchBendCents(16383),200);assert.equal(pitchBendCents(8192,96),0);assert.equal(pitchBendCents(0,12),-1200);assert.equal(pitchBendCents(16383,2.5),250);assert.equal(pitchBendCents(16383,0),0);
 for(const range of [-1,97,NaN])assert.throws(()=>pitchBendCents(0,range));
 const calls=[],osc={detune:{setValueAtTime:(...args)=>calls.push(args)}};schedulePitchBend(osc,[{type:'pitchBend',start:0,value:16383},{type:'pitchBend',start:2,value:0}],1,10,3,12);assert.deepEqual(calls,[[1200,10],[-1200,11]]);
});
test('sampler seek integrates configured bends with tuning rather than restarting its source',()=>{
 const note={pitch:60,start:0},events=[{type:'pitchBend',start:1,value:16383}];assert.equal(samplerOffset(note,60,events,2,{pitchBendRange:12}),3);assert.equal(samplerOffset(note,60,events,2,{pitchBendRange:0}),2);assert.equal(samplerOffset(note,60,events,2,{pitchBendRange:12,sampleTune:12}),6);
});
test('range persists, undoes and copies with instrument settings',()=>{
 const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'a',kind:'midi'}},{op:'track.add',values:{id:'b',kind:'midi'}}]);assert.equal(h.session.tracks[0].pitchBendRange,2);h.execute([{op:'track.set',target:'a',values:{pitchBendRange:12}}]);h.undo();assert.equal(h.session.tracks[0].pitchBendRange,2);h.redo();assert.equal(h.session.tracks[0].pitchBendRange,12);
 h.execute([{op:'track.copySettings',target:'b',values:{sourceId:'a',instrument:true}}]);assert.equal(h.session.tracks[1].pitchBendRange,12);assert.equal(new SessionHistory(JSON.parse(JSON.stringify(h.session))).session.tracks[0].pitchBendRange,12);
 const before=structuredClone(h.session);assert.throws(()=>h.execute([{op:'track.set',target:'a',values:{pitchBendRange:97}}]));assert.deepEqual(h.session,before);
});
