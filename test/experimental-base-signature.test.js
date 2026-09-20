import test from 'node:test';import assert from 'node:assert/strict';import {newSession,SessionHistory} from '../src/experimental/session.js';import {writeMidi,readMidi} from '../src/experimental/midi.js';import {stepSequencerView} from '../src/experimental/drums.js';
test('base denominator persists and exports without changing musical content',()=>{
 const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:8}},{op:'note.add',target:'r',values:{start:1,duration:1}}]);const before=structuredClone(h.session);
 h.execute([{op:'session.set',values:{meter:6,meterDenominator:8}}]);assert.deepEqual(h.session.tracks,before.tracks);assert.equal(new SessionHistory(JSON.parse(JSON.stringify(h.session))).session.meterDenominator,8);
 const midi=readMidi(writeMidi(h.session).buffer);assert.equal(midi.timeSignatures[0].denominator,8);assert.equal(midi.timeSignatures[0].numerator,6);h.undo();assert.equal(h.session.meterDenominator,4);
 for(const meterDenominator of [0,3,128])assert.throws(()=>h.execute([{op:'session.set',values:{meterDenominator}}]));
});
test('drum sequencer uses correct steps per bar and bounds long bar selectors',()=>{
 const r={start:0,duration:6,notes:[]};const html=stepSequencerView(r,{tempo:120,meter:6,meterDenominator:8},0,100);
 assert.equal((html.match(/data-step-pitch=/g)||[]).length,72);assert.match(html,/repeat\(12,28px\)/);
 const small=stepSequencerView(r,{tempo:120,meter:3,meterDenominator:32},0,100);assert.match(small,/Each step is a 1\/32 note/);assert.match(small,/repeat\(3,28px\)/);
 const long=stepSequencerView({...r,duration:86400},{tempo:300,meter:1,meterDenominator:64},0,100);assert.match(long,/data-bar-one-based/);assert.ok(long.length<10000);
});
