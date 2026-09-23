import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import {truePeakStatistics} from '../src/experimental/audio-true-peak.js';
const tone=(rate,frequency,phase=Math.PI/4)=>Float32Array.from({length:rate},(_,i)=>.9*Math.sin(2*Math.PI*frequency*i/rate+phase)*Math.min(1,i/100,(rate-1-i)/100));
test('inter-sample overs exceed the sample peak and agree with independent FFmpeg estimates',()=>{
 for(const rate of [44100,48000,96000])for(const frequency of [1000,rate/4]){
  const source=tone(rate,frequency),result=truePeakStatistics([source],rate),sample=20*Math.log10(source.reduce((p,v)=>Math.max(p,Math.abs(v)),0));
  assert.ok(result.peaksDbtp[0]>=sample);
  if(frequency===rate/4)assert.ok(result.peaksDbtp[0]-sample>2.5);
  const reference=spawnSync(ffmpeg,['-hide_banner','-f','f32le','-ar',String(rate),'-ac','1','-i','pipe:0','-af','ebur128=peak=true','-f','null','-'],{input:Buffer.from(source.buffer),maxBuffer:4*1024*1024});
  assert.equal(reference.status,0,reference.stderr.toString());
  const matches=[...reference.stderr.toString().matchAll(/Peak:\s*(-?[\d.]+) dBFS/g)],db=Number(matches.at(-1)?.[1]);
  assert.ok(Number.isFinite(db));assert.ok(Math.abs(db-result.peaksDbtp[0])<.3,`${rate}/${frequency}: ${result.peaksDbtp[0]} vs ${db}`);
 }
});
test('true-peak includes original samples, independent channels and the entire FIR tail',()=>{
 const source=Float32Array.of(1,-1),a=truePeakStatistics([source],48000).peaksDbtp[0],padded=new Float32Array(100);padded.set(source,40);
 assert.ok(a>=0);assert.equal(truePeakStatistics([padded],48000).peaksDbtp[0],a);
 const stereo=truePeakStatistics([source,source.map(v=>-.5*v)],48000);assert.ok(Math.abs(stereo.peaksDbtp[1]-a-20*Math.log10(.5))<1e-9);
 assert.deepEqual(truePeakStatistics([new Float32Array(10)],48000),{oversample:4,peaksDbtp:[null]});
 assert.throws(()=>truePeakStatistics([Float32Array.of(NaN)],48000),/non-finite/);
 assert.throws(()=>truePeakStatistics([source,new Float32Array(1)],48000),/matching/);
});
