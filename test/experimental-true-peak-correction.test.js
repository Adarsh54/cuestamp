import test from 'node:test';import assert from 'node:assert/strict';import {correctTruePeakBuffer} from '../src/experimental/true-peak-correction.js';
test('offline correction preserves compliant audio and does not mutate its source',()=>{
 const source=Float32Array.from({length:4096},(_,i)=>.1*Math.sin(i*.13)),before=new Float32Array(source),result=correctTruePeakBuffer([source],48000);assert.deepEqual(source,before);assert.deepEqual(result.channels[0],source);assert.equal(result.iterations,0);assert.equal(result.maximumReductionDb,0);assert.notEqual(result.channels[0],source);
});
test('correction attenuates linked stereo peaks and verifies its combined finite-filter ceiling',()=>{
 for(const rate of [44100,48000,96000])for(const phase of [0,Math.PI/4,Math.PI/2]){
  const source=Float32Array.from({length:2048},(_,i)=>1.2*Math.sin(Math.PI/2*i+phase)),right=source.map(v=>-v*.5),r=correctTruePeakBuffer([source,right],rate,{ceilingDb:-1});assert.ok(r.after.peaksDbtp.every(p=>p<=-1));assert.ok(r.maximumReductionDb>0);for(let i=0;i<source.length;i++)assert.equal(r.channels[1][i],r.channels[0][i]*-.5);
 }
});
test('localized correction returns near unity away from a transient and handles edge peaks',()=>{
 const source=new Float32Array(48000).fill(.05);source[24000]=2;const r=correctTruePeakBuffer([source],48000,{releaseMs:5});assert.ok(Math.abs(r.channels[0][1000]-.05)<1e-7);assert.ok(Math.abs(r.channels[0][47000]-.05)<1e-7);assert.ok(r.channels[0][24000]<1);assert.ok(r.after.peaksDbtp[0]<=-1);
 for(const edge of [0,2047]){const input=new Float32Array(2048);input[edge]=4;const out=correctTruePeakBuffer([input],48000);assert.ok(out.after.peaksDbtp[0]<=-1);}
});
test('bounded correction handles deterministic noise and reports any whole-buffer fallback',()=>{
 for(let seed=1;seed<=8;seed++){let state=seed;const source=Float32Array.from({length:4096},()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return 6*(state/2**32-.5);});const r=correctTruePeakBuffer([source],48000,{ceilingDb:-6,maxIterations:1,attackMs:0,releaseMs:1});assert.equal(r.iterations,1);assert.ok(r.fallbackGain>0&&r.fallbackGain<=1);assert.ok(r.after.peaksDbtp[0]<=-6);assert.ok(r.channels[0].every(Number.isFinite));}
});
test('correction rejects invalid parameters, channel shapes, and nonfinite source data',()=>{
 const source=Float32Array.of(.1);for(const options of [{ceilingDb:1},{attackMs:-1},{releaseMs:0},{maxIterations:0},{maxIterations:1.5}])assert.throws(()=>correctTruePeakBuffer([source],48000,options));assert.throws(()=>correctTruePeakBuffer([Float32Array.of(NaN)],48000));assert.throws(()=>correctTruePeakBuffer([source,new Float32Array(2)],48000));
});
