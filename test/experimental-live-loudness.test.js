import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveLoudness} from '../src/experimental/live-loudness-core.js';
import {integratedLoudness} from '../src/experimental/audio-loudness.js';
test('continuous momentary and short-term windows agree with offline weighting',()=>{
 for(const rate of [44100,48000,96000]){
  const meter=new LiveLoudness(rate),data=Float32Array.from({length:rate*4},(_,i)=>.1*Math.sin(2*Math.PI*1000*i/rate));
  for(let i=0;i<data.length;i++){meter.push(data[i],-data[i]);if(i===Math.round(rate*.4)-2)assert.equal(meter.read().momentaryLufs,null);if(i===rate*3-2)assert.equal(meter.read().shortTermLufs,null);}
  const offline=integratedLoudness([data,data],rate),actual=meter.read();assert.ok(Math.abs(actual.shortTermLufs-offline.dynamics.shortTermMaxLufs)<.01);assert.ok(Math.abs(actual.momentaryLufs-offline.dynamics.momentaryMaxLufs)<.01);
 }
});
test('continuous readings follow changed level and new meters start empty',()=>{
 const rate=48000,meter=new LiveLoudness(rate);
 for(let i=0;i<rate*4;i++)meter.push(.1*Math.sin(2*Math.PI*1000*i/rate),0);const first=meter.read();
 for(let i=0;i<rate*4;i++)meter.push(.01*Math.sin(2*Math.PI*1000*i/rate),0);const second=meter.read();assert.ok(Math.abs(first.shortTermLufs-second.shortTermLufs-20)<.01);assert.ok(Math.abs(first.momentaryLufs-second.momentaryLufs-20)<.01);
 for(let i=0;i<rate*4;i++)meter.push(0,0);assert.deepEqual(meter.read(),{momentaryLufs:null,shortTermLufs:null});
 assert.deepEqual(new LiveLoudness(rate).read(),{momentaryLufs:null,shortTermLufs:null});
});
