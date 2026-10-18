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
 results.push({name,ceilingDb,samplePeakDb,estimatedPeakDbtp,ffmpegPeakDbtp,wallMs});
}
console.log(JSON.stringify({description:'4x resampling + existing limiter + downsampling candidate; NOT a production true-peak guarantee',results},null,2));
