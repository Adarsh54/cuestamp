import test from 'node:test';import assert from 'node:assert/strict';
import {midiTuningPlan} from '../src/experimental/midi-tuning.js';
import {pitchBendTimeline} from '../src/experimental/pitch-bend-state.js';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
const source=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:4}},{op:'note.add',target:'r',values:{start:0,duration:4,pitch:69}},{op:'event.add',target:'r',values:{type:'pitchBend',start:0,value:16383}}]);
test('tuning editor command preserves notes and bend state, quantizes fine tuning, and supports undo',()=>{
 const h=new SessionHistory(source()),before=structuredClone(h.session);h.execute([{op:'midi.tuning',target:'r',values:{start:1,channel:0,semitones:12,cents:50}}]);const r=h.session.tracks[0].regions[0];assert.equal(r.events.length,9);assert.deepEqual(r.notes,before.tracks[0].regions[0].notes);assert.deepEqual(r.events[0],before.tracks[0].regions[0].events[0]);assert.equal(pitchBendTimeline(r.events).at(-1).cents,1450);h.undo();assert.deepEqual(h.session,{...before,revision:h.session.revision});
 for(const cents of [-100,-.001,0,.001,100]){const plan=midiTuningPlan({duration:4,events:[]},{start:0,semitones:0,cents});assert.ok(Math.abs(plan.cents-cents)<=100/8192);assert.equal(pitchBendTimeline(plan.events).at(-1).cents,plan.cents);}
});
test('tuning change restores active parameter selection and leaves other channels alone',()=>{
 const events=[[99,4],[98,7]].map(([parameter,value])=>({type:'controlChange',parameter,value,start:0,channel:3}));const plan=midiTuningPlan({duration:4,events},{start:1,channel:3,semitones:-12,cents:-50});assert.ok(plan.events.every(e=>e.channel===3));assert.deepEqual(plan.events.slice(-2).map(e=>[e.parameter,e.value]),[[99,4],[98,7]]);assert.equal(plan.total,-1250);
 const reset=midiTuningPlan({duration:4,events:plan.events},{start:2,channel:3,semitones:0,cents:0});assert.equal(reset.before,-1250);assert.equal(pitchBendTimeline([...plan.events,...reset.events]).at(-1).cents,0);
});
test('invalid tuning values, audio targets and protected contents reject without partial events',()=>{
 const h=new SessionHistory(source()),before=structuredClone(h.session),valid={start:0,semitones:0,cents:0};for(const override of [{start:4},{start:-1},{semitones:64},{semitones:-65},{semitones:.5},{cents:101},{channel:16},{cents:NaN},{extra:1}]){assert.throws(()=>h.execute([{op:'midi.tuning',target:'r',values:{...valid,...override}}]));assert.deepEqual(h.session,before);}
 h.execute([{op:'track.set',target:'t',values:{protected:true}}]);const protectedSession=structuredClone(h.session);assert.throws(()=>h.execute([{op:'midi.tuning',target:'r',values:valid}]),/Unprotect/);assert.deepEqual(h.session,protectedSession);
 const audio=applyCommands(newSession(),[{op:'track.add',values:{id:'a',kind:'audio'}},{op:'region.add',target:'a',values:{id:'ar'}}]);assert.throws(()=>applyCommands(audio,[{op:'midi.tuning',target:'ar',values:valid}]),/MIDI/);
});
