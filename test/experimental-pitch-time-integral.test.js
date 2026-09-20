import test from 'node:test';import assert from 'node:assert/strict';
import {compilePitchTimeIntegral} from '../src/experimental/pitch-time-integral.js';
import {compileMidiControllers} from '../src/experimental/midi-controller-timeline.js';
import {samplerOffset} from '../src/experimental/sampler.js';
const reference=(points,start,end)=>{let total=0;for(let i=0;i<points.length;i++){const a=Math.max(start,points[i].time),b=Math.min(end,points[i+1]?.time??end);if(b>a)total+=(b-a)*2**(points[i].cents/1200);}return total;};
test('indexed pitch integration agrees with piecewise integration across boundaries and seeks',()=>{
 const points=Array.from({length:513},(_,i)=>({time:i*.017,cents:(i*7919%2400)-1200})),integrate=compilePitchTimeIntegral(points);
 for(let i=0;i<500;i++){const start=(i*37%1000)/100,end=start+(i*17%100)/100;assert.ok(Math.abs(integrate(start,end)-reference(points,start,end))<1e-12);}assert.equal(integrate(2,2),0);assert.equal(integrate(3,2),0);
});
test('short low-pitch seeks retain precision after large earlier integrals',()=>{
 const points=[{time:0,cents:19000},{time:80000,cents:-6500},{time:80001,cents:0}],integrate=compilePitchTimeIntegral(points),start=80000.5,end=start+.00001;
 assert.equal(integrate(start,end),(end-start)*2**(-6500/1200));assert.equal(integrate(80002,80003),1);
});
test('sampler uses the shared integral without changing offsets or its own tuning',()=>{
 const events=Array.from({length:1000},(_,i)=>({type:'pitchBend',value:i*997%16384,start:i*.01})),compiled=compileMidiControllers(events,12),settings={pitchBendRange:12,sampleTune:3,sampleFineTune:25},note={pitch:67,start:.123};
 for(const at of [.123,.2,3,9,12]){const plain=samplerOffset(note,60,events,at,settings,compiled.pitch),indexed=samplerOffset(note,60,events,at,settings,compiled.pitch,compiled.pitchIntegral);assert.ok(Math.abs(plain-indexed)<1e-10);}
});
