import test from 'node:test';import assert from 'node:assert/strict';
import {compileMidiControllers,upperMidiTime} from '../src/experimental/midi-controller-timeline.js';
import {controllerValue,sustainedEnd,schedulePitchBend} from '../src/experimental/midi-events.js';
import {pitchBendTimeline} from '../src/experimental/pitch-bend-state.js';
import {samplerOffset} from '../src/experimental/sampler.js';
const events=()=>Array.from({length:400},(_,i)=>({type:'controlChange',parameter:[7,11,10,64,121][i%5],start:Math.floor(i/3)/20,value:i*37%128,channel:0})).reverse();
test('compiled channel values match direct evaluation for unsorted and coincident events',()=>{
 const input=events(),before=structuredClone(input),compiled=compileMidiControllers(input);for(let time=0;time<8;time+=.037){const level=compiled.levels[upperMidiTime(compiled.levels,time)-1],pan=controllerValue(input,'controlChange',10,time,64);assert.equal(level.gain,controllerValue(input,'controlChange',7,time,127)/127*controllerValue(input,'controlChange',11,time,127)/127);assert.equal(level.pan,(pan-64)/(pan<64?64:63));const note={start:time,duration:.12};assert.equal(compiled.sustainedEnd(note,10),sustainedEnd(note,input,10));}assert.deepEqual(input,before);
});
test('compiled pitch data preserves scheduled detune and sampler seek integration',()=>{
 const input=[{type:'pitchBend',value:16383,start:0},...[[101,0],[100,0],[6,12],[100,1],[6,96]].map(([parameter,value],i)=>({type:'controlChange',parameter,value,start:i*.1}))],compiled=compileMidiControllers(input,2);assert.deepEqual(compiled.pitch,pitchBendTimeline(input,2));
 for(const start of [0,.15,.4,.8]){const old=[],cached=[];schedulePitchBend({detune:{setValueAtTime:(...a)=>old.push(a)}},input,start,10,1,2);schedulePitchBend({detune:{setValueAtTime:(...a)=>cached.push(a)}},input,start,10,1,2,compiled.pitch);assert.deepEqual(cached,old);const note={pitch:60,start:0};assert.equal(samplerOffset(note,60,input,start),samplerOffset(note,60,input,start,{},compiled.pitch));}
});
test('dense channel streams are compiled once and support the full event and note limits',()=>{
 const input=Array.from({length:20000},(_,i)=>({type:'controlChange',parameter:i%2?11:64,value:i%128,start:i/1000})),compiled=compileMidiControllers(input);for(let i=0;i<20000;i++){const note={start:i/1000,duration:.01},end=compiled.sustainedEnd(note,30);assert.ok(end>=note.start+note.duration&&end<=30);}assert.ok(compiled.levels.length<=10001);
});
