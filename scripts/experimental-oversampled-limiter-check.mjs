import {correctTruePeakBuffer} from '../src/experimental/true-peak-correction.js';
// Diagnostic only: this candidate is deliberately not exposed as a true-peak mode.
import {spawnSync} from 'node:child_process';import ffmpeg from 'ffmpeg-static';
import {FourTimesInterpolator,FourTimesDecimator,oversamplingLatencyFrames} from '../src/experimental/oversampling.js';
import {LookaheadLimiter} from '../src/experimental/limiter-dsp.js';import {truePeakStatistics} from '../src/experimental/audio-true-peak.js';
const rate=48000,n=48000,ceilingDb=-1,parameters={gainDb:Float32Array.of(0),ceilingDb:Float32Array.of(ceilingDb),release:Float32Array.of(.1)};
let seed=42;const fixtures={
 quarterNyquist:i=>1.2*Math.sin(Math.PI/2*i+Math.PI/4),
 twoTones:i=>2*Math.sin(2*Math.PI*997*i/rate)+2*Math.sin(2*Math.PI*17011*i/rate),
 isolatedImpulse:i=>i===24000?8:0,
 squareBursts:i=>i%4000<2000?(i%4<2?4:-4):0,
 noise:()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return 8*(seed/2**32-.5);}
};
const results=[];for(const [name,signal]of Object.entries(fixtures)){
 const limiter=new LookaheadLimiter(rate*4,5),frames=n+oversamplingLatencyFrames+limiter.latencyFrames/4+128,up=new FourTimesInterpolator(1),down=new FourTimesDecimator(1),input=Float64Array.from({length:frames},(_,i)=>i<n?signal(i):0),output=new Float32Array(frames),started=performance.now();
 for(let i=0;i<frames;i+=128){const count=Math.min(128,frames-i),high=new Float64Array(count*4),limited=new Float64Array(count*4);up.process([input.subarray(i,i+count)],[high]);limiter.process([high],[limited],parameters);down.process([limited],[output.subarray(i,i+count)]);}
 const wallMs=performance.now()-started,samplePeakDb=20*Math.log10(output.reduce((peak,v)=>Math.max(peak,Math.abs(v)),0)),estimatedPeakDbtp=truePeakStatistics([output],rate).peaksDbtp[0];
 const reference=spawnSync(ffmpeg,['-hide_banner','-f','f32le','-ar',String(rate),'-ac','1','-i','pipe:0','-af','ebur128=peak=true','-f','null','-'],{input:Buffer.from(output.buffer),maxBuffer:4*1024*1024});if(reference.status!==0)throw Error(reference.stderr.toString());const matches=[...reference.stderr.toString().matchAll(/Peak:\s*(-?[\d.]+) dBFS/g)],ffmpegPeakDbtp=Number(matches.at(-1)?.[1]);if(!Number.isFinite(ffmpegPeakDbtp))throw Error('Missing independent peak measurement');
 const corrected=correctTruePeakBuffer([output],rate,{ceilingDb});const correctedReference=spawnSync(ffmpeg,['-hide_banner','-f','f32le','-ar',String(rate),'-ac','1','-i','pipe:0','-af','ebur128=peak=true','-f','null','-'],{input:Buffer.from(corrected.channels[0].buffer),maxBuffer:4*1024*1024});if(correctedReference.status!==0)throw Error(correctedReference.stderr.toString());const correctedMatches=[...correctedReference.stderr.toString().matchAll(/Peak:\s*(-?[\d.]+) dBFS/g)],correctedFfmpegDbtp=Number(correctedMatches.at(-1)?.[1]);if(!Number.isFinite(correctedFfmpegDbtp))throw Error('Missing corrected reference measurement');
 const denseReference=spawnSync(ffmpeg,['-hide_banner','-f','f32le','-ar',String(rate),'-ac','1','-i','pipe:0','-af','aresample=192000','-f','f32le','pipe:1'],{input:Buffer.from(corrected.channels[0].buffer),maxBuffer:16*1024*1024});if(denseReference.status!==0)throw Error(denseReference.stderr.toString());let exactPeak=0;for(let i=0;i<denseReference.stdout.length;i+=4)exactPeak=Math.max(exactPeak,Math.abs(denseReference.stdout.readFloatLE(i)));const ffmpegResampledDbtp=20*Math.log10(exactPeak);
 const reconstructionChecks=[];if(name==='noise')for(const filterSize of [16,32,64,128,512])for(const filterType of ['kaiser','blackman_nuttall']){const ref=spawnSync(ffmpeg,['-hide_banner','-f','f32le','-ar',String(rate),'-ac','1','-i','pipe:0','-af',`aresample=192000:filter_size=${filterSize}:filter_type=${filterType}`,'-f','f32le','pipe:1'],{input:Buffer.from(corrected.channels[0].buffer),maxBuffer:16*1024*1024});if(ref.status!==0)throw Error(ref.stderr.toString());let peak=0,index=0;for(let i=0;i<ref.stdout.length;i+=4){const v=Math.abs(ref.stdout.readFloatLE(i));if(v>peak){peak=v;index=i/4;}}reconstructionChecks.push({filterSize,filterType,peakDbtp:20*Math.log10(peak),time:index/192000});}
 if(ffmpegResampledDbtp>ceilingDb+.001||reconstructionChecks.some(row=>row.peakDbtp>ceilingDb+.001))throw Error(`Independent reconstruction ceiling failed for ${name}`);
 results.push({name,reconstructionChecks,ceilingDb,samplePeakDb,estimatedPeakDbtp,ffmpegPeakDbtp,wallMs,corrected:{peakDbtp:corrected.after.peaksDbtp[0],ffmpegDbtp:correctedFfmpegDbtp,ffmpegResampledDbtp,iterations:corrected.iterations,fallbackGain:corrected.fallbackGain,maximumReductionDb:corrected.maximumReductionDb}});
}
console.log(JSON.stringify({description:'4x resampling + existing limiter + downsampling candidate; NOT a production true-peak guarantee',results},null,2));
