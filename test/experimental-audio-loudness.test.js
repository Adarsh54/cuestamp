import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import {integratedLoudness,kWeighting} from '../src/experimental/audio-loudness.js';
const tone=(rate,seconds=4,amplitude=.1)=>Float32Array.from({length:Math.round(rate*seconds)},(_,i)=>amplitude*Math.sin(2*Math.PI*1000*i/rate));
test('K weighting reproduces published 48 kHz coefficients',()=>{
 const filters=kWeighting(48000),expected=[[1.53512485958697,-2.69169618940638,1.19839281085285,-1.69065929318241,.73248077421585],[1,-2,1,-1.99004745483398,.99007225036621]];
 filters.forEach((f,i)=>[...f.b,...f.a].forEach((v,j)=>assert.ok(Math.abs(v-expected[i][j])<1e-11)));
});
test('independent FFmpeg oracle agrees for mono/stereo and gated material across render rates',()=>{
 for(const rate of [44100,48000,96000])for(const count of [1,2]){
  const source=tone(rate,5);for(let i=0;i<source.length;i++)if(i>rate*3)source[i]*=.001;
  const channels=Array.from({length:count},(_,c)=>source.map(v=>c?-v:v)),pcm=Buffer.alloc(source.length*count*4);
  for(let i=0;i<source.length;i++)for(let c=0;c<count;c++)pcm.writeFloatLE(channels[c][i],(i*count+c)*4);
  const result=spawnSync(ffmpeg,['-hide_banner','-f','f32le','-ar',String(rate),'-ac',String(count),'-i','pipe:0','-af','ebur128','-f','null','-'],{input:pcm,maxBuffer:4*1024*1024});
  assert.equal(result.status,0,result.stderr?.toString());
  const matches=[...result.stderr.toString().matchAll(/I:\s*(-?[\d.]+) LUFS/g)],reference=Number(matches.at(-1)?.[1]);
  assert.ok(Number.isFinite(reference));const actual=integratedLoudness(channels,rate);
  assert.ok(Math.abs(actual.integratedLufs-reference)<.11,`${rate}/${count}: ${actual.integratedLufs} vs ${reference}`);
 }
});
test('silence, short clips, low level gating, channel power and invalid samples',()=>{
 assert.equal(integratedLoudness([new Float32Array(48000)],48000).integratedLufs,null);
 assert.equal(integratedLoudness([tone(48000,.399)],48000).blocks,0);
 assert.equal(integratedLoudness([tone(48000,.4)],48000).blocks,1);
 assert.equal(integratedLoudness([tone(48000,1,1e-5)],48000).integratedLufs,null);
 const source=tone(48000),mono=integratedLoudness([source],48000),stereo=integratedLoudness([source,source.map(v=>-v)],48000);
 assert.ok(Math.abs(stereo.integratedLufs-mono.integratedLufs-10*Math.log10(2))<1e-9);
 assert.throws(()=>integratedLoudness([new Float32Array([NaN])],48000),/non-finite/);
 assert.throws(()=>integratedLoudness([source,new Float32Array(1)],48000),/matching/);
});
