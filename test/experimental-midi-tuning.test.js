import test from 'node:test';import assert from 'node:assert/strict';
import {createPitchBendState,pitchBendTimeline} from '../src/experimental/pitch-bend-state.js';
import {chasedEvents,schedulePitchBend} from '../src/experimental/midi-events.js';
import {samplerOffset} from '../src/experimental/sampler.js';
import {newSession,applyCommands} from '../src/experimental/session.js';
import {writeMidi,readMidi} from '../src/experimental/midi.js';
const cc=(parameter,value,start=0)=>({type:'controlChange',channel:0,parameter,value,start});
const select=n=>[cc(101,0),cc(100,n)];
const send=(s,events)=>{for(const e of events)s.push(e);};
test('fine and coarse tuning compose with bend; fine data is 14-bit and coarse ignores LSB',()=>{
 const s=createPitchBendState();send(s,[...select(1),cc(6,96),cc(38,0),...select(2),cc(6,76),cc(38,127)]);assert.equal(s.tuningCents,1250);s.push({type:'pitchBend',value:16383});assert.equal(s.cents,1450);
 send(s,[...select(1),cc(6,0),cc(38,0),...select(2),cc(6,64)]);assert.equal(s.tuningCents,-100);
 send(s,[...select(1),cc(6,127),cc(38,127)]);assert.equal(s.tuningCents,8191*100/8192);
});
test('relative tuning uses one fine unit or one semitone, saturates, and reset preserves tuning',()=>{
 const s=createPitchBendState();send(s,[...select(1),cc(96,127)]);assert.equal(s.tuningCents,100/8192);s.push(cc(97,0));assert.equal(s.tuningCents,0);
 send(s,[cc(6,127),cc(38,127),cc(96,0)]);assert.equal(s.tuningCents,8191*100/8192);
 send(s,[cc(6,0),cc(38,0),cc(97,0),...select(2),cc(6,127),cc(96,0)]);assert.equal(s.tuningCents,6200);
 send(s,[cc(6,0),cc(97,0)]);assert.equal(s.tuningCents,-6500);
 s.push(cc(121,0));assert.equal(s.cents,-6500);s.push(cc(6,64));assert.equal(s.cents,-6500);
 send(s,[...select(1),cc(99,0),cc(6,64)]);assert.equal(s.cents,-6500);
});
test('trim, scheduling and sampler seek preserve tuning without a pitch wheel event',()=>{
 const events=[...select(2),cc(6,76,.5),...select(1).map(e=>({...e,start:.75})),cc(6,96,1)];
 assert.equal(pitchBendTimeline(chasedEvents(events,1.2)).at(-1).cents,1250);
 const calls=[];schedulePitchBend({detune:{setValueAtTime:(...a)=>calls.push(a)}},events,.8,10,2);assert.deepEqual(calls,[[1200,10],[1250,10.2]]);
 assert.ok(Math.abs(samplerOffset({pitch:60,start:0},60,events,1.5)-(.5+1+.5*2**(1250/1200)))<1e-12);
});
test('MIDI export retains tuning but resets the next region to equal temperament',()=>{
 const s=applyCommands(newSession(),[{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:1}},{op:'note.add',target:'r',values:{pitch:69,start:0,duration:1}},...[...select(2),cc(6,76)].map(values=>({op:'event.add',target:'r',values})),{op:'region.add',target:'t',values:{id:'r2',start:2,duration:1}},{op:'note.add',target:'r2',values:{pitch:69,start:0,duration:1}}]);
 const curve=pitchBendTimeline(readMidi(writeMidi(s).buffer).tracks[0].events);assert.equal(curve.findLast(p=>p.time<2).cents,1200);assert.equal(curve.at(-1).cents,0);
});
