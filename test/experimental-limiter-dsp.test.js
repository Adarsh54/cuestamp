import test from 'node:test';import assert from 'node:assert/strict';import {LookaheadLimiter} from '../src/experimental/limiter-dsp.js';
const params=(gainDb=0,ceilingDb=-1,release=.1)=>({gainDb:Float32Array.of(gainDb),ceilingDb:Float32Array.of(ceilingDb),release:Float32Array.of(release)});
function render(input,{rate=48000,lookahead=5,parameters=params(),block=128}={}){
 const limiter=new LookaheadLimiter(rate,lookahead),length=input[0].length+limiter.latencyFrames,output=[new Float32Array(length),new Float32Array(length)];
 for(let start=0;start<length;start+=block){const end=Math.min(length,start+block),source=input.map(data=>{const values=new Float32Array(end-start);values.set(data.subarray(start,Math.min(end,data.length)));return values;}),p=Object.fromEntries(Object.entries(parameters).map(([key,values])=>[key,values.length===1?values:Float32Array.from({length:end-start},(_,i)=>values[Math.min(start+i,values.length-1)])]));limiter.process(source,output.map(data=>data.subarray(start,end)),p);}
 return {output,limiter};
}
test('limiter preserves below-ceiling stereo audio with exactly its declared latency',()=>{
 for(const rate of [44100,48000,96000])for(const lookahead of [0,1,5,20]){const input=[Float32Array.from({length:4000},(_,i)=>Math.sin(i*.2)*.1),Float32Array.from({length:4000},(_,i)=>Math.cos(i*.1)*.2)],{output,limiter}=render(input,{rate,lookahead});assert.equal(limiter.latencyFrames,Math.round(rate*lookahead/1000));for(let c=0;c<2;c++){assert.ok(output[c].slice(0,limiter.latencyFrames).every(v=>v===0));assert.deepEqual(output[c].slice(limiter.latencyFrames),input[c]);}}
});
test('isolated transients and sustained overload stay below the sample ceiling without changing stereo balance',()=>{
 for(const lookahead of [0,1,5,20]){const input=[new Float32Array(12000),new Float32Array(12000)];input[0][0]=8;input[0][3000]=-16;input[0].fill(4,6000,9000);input[1]=input[0].map(v=>v*.25);const {output}=render(input,{lookahead,parameters:params(6,-3)}),ceiling=10**(-3/20);assert.ok(output[0].some(v=>Math.abs(v)>.5));for(let i=0;i<output[0].length;i++){assert.ok(Math.abs(output[0][i])<=ceiling+1e-7);assert.equal(output[1][i],output[0][i]*.25);}}
});
test('lookahead gain reduction ramps ahead of a transient rather than stepping at its peak',()=>{
 const input=[new Float32Array(3000).fill(.1)];input[0][1000]=4;const {output,limiter}=render(input,{lookahead:5,parameters:params(0,0)}),n=limiter.latencyFrames;
 assert.equal(output[0][999],Math.fround(.1));assert.ok(output[0][1000]<.1);assert.ok(output[0][1000+n-1]<output[0][1000]);assert.ok(Math.abs(output[0][1000+n]-1)<1e-6);
});
test('automation binds drive and ceiling to the delayed source sample across block boundaries',()=>{
 let seed=123;const n=20000,signal=Float32Array.from({length:n},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed/2**32-.5)*8;}),parameters={gainDb:Float32Array.from({length:n},(_,i)=>i%121<60?12:-6),ceilingDb:Float32Array.from({length:n},(_,i)=>i%97<48?-12:-1),release:Float32Array.of(.02)};
 const {output,limiter}=render([signal,signal.map(v=>-v*.5)],{parameters,block:37});for(let i=0;i<n;i++)assert.ok(Math.abs(output[0][i+limiter.latencyFrames])<=10**(parameters.ceilingDb[i]/20)+1e-7,`sample ${i}`);
 const other=render([signal,signal.map(v=>-v*.5)],{parameters,block:128});assert.deepEqual(other.output,output);
});
test('release recovers gradually and processing state stays bounded on long runs',()=>{
 const input=new Float32Array(48000).fill(.1);input[0]=8;const {output,limiter}=render([input],{parameters:params(0,0,.05)}),n=limiter.latencyFrames;
 assert.ok(output[0][n+1000]<output[0][n+5000]);assert.ok(Math.abs(output[0].at(-1)-.1)<1e-6);assert.ok(limiter.count<=limiter.size);assert.equal(limiter.audio[0].length,241);
});
test('invalid lookahead/rates reject and nonfinite source samples cannot poison the limiter',()=>{
 for(const args of [[0,5],[48000,-1],[48000,21],[48000,NaN]])assert.throws(()=>new LookaheadLimiter(...args));const {output}=render([Float32Array.of(NaN,Infinity,-Infinity,.1)]);assert.ok(output[0].every(Number.isFinite));assert.equal(output[0].at(-1),Math.fround(.1));
});
