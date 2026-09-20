import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands} from '../src/experimental/session.js';
import {writeMidi,readMidi} from '../src/experimental/midi.js';
import {pitchBendTimeline} from '../src/experimental/pitch-bend-state.js';
import {bendRangeEvents} from '../src/experimental/midi-bend-export.js';
const setup=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'t',kind:'midi',pitchBendRange:12}},{op:'region.add',target:'t',values:{id:'r',start:1,duration:2}},{op:'note.add',target:'r',values:{pitch:60,start:0,duration:1,channel:3}},{op:'event.add',target:'r',values:{type:'pitchBend',channel:3,start:0,value:16383}}]);
test('export encodes custom bend ranges before original bends, preserving channel and note timing',()=>{
 const s=setup(),before=structuredClone(s),m=readMidi(writeMidi(s).buffer),t=m.tracks[0];assert.equal(t.notes[0].start,1);assert.equal(t.notes[0].channel,3);assert.ok(t.events.every(e=>e.channel===3));assert.deepEqual(t.events.slice(0,6).map(e=>[e.parameter,e.value]),[[101,0],[100,0],[6,12],[38,0],[101,127],[100,127]]);assert.equal(pitchBendTimeline(t.events).at(-1).cents,1200);assert.deepEqual(s,before);
});
test('source RPN events override generated initialization and later regions reset sensitivity and bend',()=>{
 const commands=[[101,0],[100,0],[6,24]].map(([parameter,value])=>({op:'event.add',target:'r',values:{type:'controlChange',channel:3,parameter,value,start:0}}));
 const s=applyCommands(setup(),[...commands,{op:'region.add',target:'t',values:{id:'later',start:4,duration:2}},{op:'note.add',target:'later',values:{pitch:60,start:0,duration:1,channel:3}}]);
 const t=readMidi(writeMidi(s).buffer).tracks[0],curve=pitchBendTimeline(t.events);assert.equal(curve.findLast(p=>p.time<4).cents,2400);assert.equal(curve.at(-1).cents,0);
});
test('fractional ranges round to cents and zero remains explicitly disabled',()=>{
 for(const [range,expected]of [[2.345,235],[0,0],[96,9600]]){const events=[...bendRangeEvents(range,0),{type:'pitchBend',value:16383,start:0}];assert.ok(Math.abs(pitchBendTimeline(events).at(-1).cents-expected)<1e-8);}
});
test('muted tracks and regions do not introduce bend setup unless requested',()=>{
 const s=setup();s.tracks[0].regions[0].mute=true;assert.equal(readMidi(writeMidi(s).buffer).tracks.length,0);assert.equal(readMidi(writeMidi(s,{includeMuted:true}).buffer).tracks[0].events.length,8);
});
