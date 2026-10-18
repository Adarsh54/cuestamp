import test from 'node:test';import assert from 'node:assert/strict';import {TruePeakMeter} from '../src/experimental/true-peak-meter.js';
const source=()=>Float32Array.from({length:5003},(_,i)=>.9*Math.sin(2*Math.PI*i/4+Math.PI/4));
test('true-peak detection is independent of block boundaries and flushes its final interpolation tail',()=>{
 const audio=source(),reference=new TruePeakMeter(1);reference.process([audio]);const expected=reference.finish();
 for(const size of [1,7,128,511]){const meter=new TruePeakMeter(1);for(let i=0;i<audio.length;i+=size)meter.process([audio.subarray(i,i+size)]);assert.deepEqual(meter.finish(),expected);assert.deepEqual(meter.finish(),expected);assert.throws(()=>meter.pushFrame(0),/finished/);assert.throws(()=>meter.process([new Float32Array(0)]),/finished/);}
 assert.ok(expected.peaksDbtp[0]>20*Math.log10(Math.max(...audio))+2.5);
 const edge=new TruePeakMeter(1);edge.process([Float32Array.of(1,-1)]);const end=edge.finish(),padded=new TruePeakMeter(1);padded.process([Float32Array.from([0,0,0,1,-1,...Array(30).fill(0)])]);assert.deepEqual(padded.finish(),end);
});
test('window reset retains filter history and stereo readings remain independent',()=>{
 const audio=source(),meter=new TruePeakMeter(2),whole=new TruePeakMeter(2);whole.process([audio,audio.map(v=>v*.5)]);const expected=whole.finish();let peaks=[-Infinity,-Infinity];
 for(let i=0;i<audio.length;i+=128){const block=audio.subarray(i,i+128);meter.process([block,block.map(v=>v*.5)]);const reading=meter.read({reset:true});peaks=peaks.map((peak,c)=>Math.max(peak,reading.peaksDbtp[c]??-Infinity));}
 const tail=meter.finish();peaks=peaks.map((peak,c)=>Math.max(peak,tail.peaksDbtp[c]??-Infinity));assert.deepEqual(peaks,expected.peaksDbtp);assert.ok(Math.abs(peaks[0]-peaks[1]-20*Math.log10(2))<1e-12);
});
test('malformed blocks reject atomically; silence yields null instead of negative infinity',()=>{
 const meter=new TruePeakMeter(2);assert.deepEqual(meter.read(),{oversample:4,peaksDbtp:[null,null]});assert.throws(()=>meter.process([Float32Array.of(.5,NaN),Float32Array.of(0,0)]),/non-finite/);assert.deepEqual(meter.read().peaksDbtp,[null,null]);assert.throws(()=>meter.process([new Float32Array(1)]),/matching/);assert.deepEqual(meter.finish().peaksDbtp,[null,null]);assert.throws(()=>new TruePeakMeter(3));
});
