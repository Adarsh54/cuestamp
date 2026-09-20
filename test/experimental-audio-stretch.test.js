import test from 'node:test';import assert from 'node:assert/strict';
import {stretchAudioChannels,validateAudioStretch} from '../src/experimental/audio-stretch.js';
const rate=48000,tone=(frequency,duration=1)=>Float32Array.from({length:rate*duration},(_,i)=>Math.sin(2*Math.PI*frequency*i/rate)*.5);
const frequency=data=>{let n=0;const start=Math.round(data.length*.2),end=Math.round(data.length*.8);for(let i=start+1;i<end;i++)if(data[i-1]<=0&&data[i]>0)n++;return n*rate/(end-start);};
test('stretch changes duration while preserving mono pitch, finite output and source samples',()=>{
 const input=tone(440),before=input.slice();for(const ratio of [.5,.75,1,1.5,2]){const progress=[],out=stretchAudioChannels([input],rate,ratio,p=>progress.push(p));assert.equal(out[0].length,Math.round(input.length*ratio));assert.ok(Math.abs(frequency(out[0])-440)<5);assert.ok(out[0].every(Number.isFinite));assert.equal(progress.at(-1),1);assert.ok(progress.every((p,i)=>!i||p>=progress[i-1]));}assert.deepEqual(input,before);
});
test('stereo stays aligned and isolated; silent channels remain silent',()=>{
 const left=tone(440),right=left.map(v=>-v),out=stretchAudioChannels([left,right],rate,1.5);for(let i=0;i<out[0].length;i++)assert.ok(out[0][i]===-out[1][i]);
 const monoSide=stretchAudioChannels([left,new Float32Array(left.length)],rate,.75);assert.ok(monoSide[1].every(v=>v===0));
});
test('unity is an exact independent copy and invalid or oversized sources reject',()=>{
 const input=tone(440,.1),out=stretchAudioChannels([input],rate,1);assert.deepEqual(out[0],input);assert.notEqual(out[0],input);
 for(const ratio of [0,.49,2.01,NaN])assert.throws(()=>stretchAudioChannels([input],rate,ratio));assert.throws(()=>stretchAudioChannels([input,new Float32Array(5)],rate,1));assert.throws(()=>stretchAudioChannels([new Float32Array([NaN])],rate,1));assert.throws(()=>validateAudioStretch({sampleRate:192000,frames:192000*600,channels:2,ratio:2}));
});
