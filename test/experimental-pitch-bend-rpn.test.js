import test from 'node:test';import assert from 'node:assert/strict';
import {createPitchBendState,pitchBendTimeline} from '../src/experimental/pitch-bend-state.js';
import {chasedEvents,schedulePitchBend} from '../src/experimental/midi-events.js';
import {samplerOffset} from '../src/experimental/sampler.js';
const cc=(parameter,value,start=0)=>({type:'controlChange',channel:0,parameter,value,start});
const bend=(value,start=0)=>({type:'pitchBend',channel:0,parameter:0,value,start});
const select=[cc(101,0),cc(100,0)];
test('RPN sensitivity changes an already bent note; null and NRPN selection disable data entry',()=>{
 const s=createPitchBendState();s.push(bend(16383));assert.equal(s.cents,200);for(const e of [...select,cc(6,12),cc(38,50)])s.push(e);assert.equal(s.cents,1250);
 for(const e of [cc(101,127),cc(100,127),cc(6,24)])s.push(e);assert.equal(s.range,12.5);
 for(const e of [...select,cc(99,0),cc(6,48)])s.push(e);assert.equal(s.range,12.5);
 for(const e of [...select,cc(6,127),cc(38,127)])s.push(e);assert.ok(Math.abs(s.cents-12827)<1e-8);
 s.push(cc(121,0));assert.equal(s.cents,0);assert.equal(s.range,128.27);s.push(cc(6,2));assert.equal(s.range,128.27);
});
test('playback chases range and bends while sampler seeks integrate range changes',()=>{
 const events=[bend(16383),...select,cc(6,12,1),cc(101,127,1.1),cc(100,127,1.1)];
 assert.equal(samplerOffset({pitch:60,start:0},60,events,2),2**(2/12)+2);
 const calls=[];schedulePitchBend({detune:{setValueAtTime:(...a)=>calls.push(a)}},events,.5,10,2);assert.deepEqual(calls,[[200,10],[1200,10.5]]);
 assert.equal(pitchBendTimeline(chasedEvents(events,1.5)).at(-1).cents,1200);
});
test('splits preserve ordered RPN selections, repeated data writes and resets',()=>{
 const events=[...select,cc(6,12,.1),cc(121,0,.2),cc(6,24,.3),bend(16383,.4),cc(101,127,.5),cc(100,127,.5)];
 const expected=pitchBendTimeline(events).at(-1).cents;assert.equal(expected,1200);assert.equal(pitchBendTimeline(chasedEvents(events,1)).at(-1).cents,expected);
 const reset=[...events,cc(121,0,.7)];assert.equal(pitchBendTimeline(chasedEvents(reset,1)).at(-1).cents,0);
});
