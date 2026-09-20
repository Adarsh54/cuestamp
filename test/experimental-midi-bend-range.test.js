import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {createPitchBendState} from '../src/experimental/pitch-bend-state.js';
import {midiBendRangePlan} from '../src/experimental/midi-bend-range.js';
const cc=(parameter,value,start=0)=>({id:crypto.randomUUID(),type:'controlChange',parameter,value,start,channel:0});
const state=events=>{const s=createPitchBendState();for(const e of [...events].sort((a,b)=>a.start-b.start))s.push(e);return s;};
const source=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:4}},{op:'note.add',target:'r',values:{start:0,duration:4,pitch:60}},{op:'event.add',target:'r',values:{type:'pitchBend',start:0,value:16383}}]);
test('range command changes a held bend without changing notes or resetting the wheel, and undoes atomically',()=>{
 const h=new SessionHistory(source()),before=structuredClone(h.session);h.execute([{op:'midi.bendRange',target:'r',values:{start:1,channel:0,range:12.345}}]);const r=h.session.tracks[0].regions[0];assert.equal(r.events.length,7);assert.equal(state(r.events).cents,1235);assert.deepEqual(r.notes,before.tracks[0].regions[0].notes);assert.deepEqual(r.events[0],before.tracks[0].regions[0].events[0]);h.undo();assert.deepEqual(h.session,{...before,revision:h.session.revision});
});
test('restores the active RPN or NRPN selection so later raw data writes retain their destination',()=>{
 for(const select of [[[101,0],[100,1]],[[99,5],[98,9]],[[101,0],[100,0]]]){
  const events=select.map(([p,v])=>cc(p,v));events.push(cc(6,24,2));const plan=midiBendRangePlan({duration:4,events},{start:1,range:12});assert.deepEqual(plan.events.slice(-2).map(e=>[e.parameter,e.value]),select);
  assert.equal(state([...events,...plan.events]).range,select[1][1]===0?24:12);
 }
});
test('same-time changes apply after existing events, channel isolation and protected/invalid edits are atomic',()=>{
 const r={duration:4,events:[cc(101,0,1),cc(100,0,1),cc(6,5,1),{...cc(6,24,1),channel:1}]};const plan=midiBendRangePlan(r,{start:1,range:12});assert.equal(plan.before,5);assert.equal(state([...r.events.filter(e=>e.channel===0),...plan.events]).range,12);
 const h=new SessionHistory(source()),before=structuredClone(h.session);for(const values of [{start:4,range:12},{start:-1,range:12},{start:1,range:97},{start:1,range:12,channel:16},{start:1,range:12,extra:true}]){assert.throws(()=>h.execute([{op:'midi.bendRange',target:'r',values}]));assert.deepEqual(h.session,before);}
 h.execute([{op:'track.set',target:'t',values:{protected:true}}]);const protectedSession=structuredClone(h.session);assert.throws(()=>h.execute([{op:'midi.bendRange',target:'r',values:{start:1,range:12}}]),/Unprotect/);assert.deepEqual(h.session,protectedSession);
});
