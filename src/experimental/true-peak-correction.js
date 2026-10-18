import {FourTimesInterpolator} from './oversampling.js';
import {TruePeakMeter} from './true-peak-meter.js';
import {truePeakStatistics} from './audio-true-peak.js';
// Check both the broadcast-style four-phase detector and a denser reconstruction.
// Neither finite filter establishes an exact continuous-time/DAC peak bound.
function measure(channels,required,target){
 const count=channels.length,frames=channels[0].length,up=new FourTimesInterpolator(count,{quality:'analysis'}),upAgain=new FourTimesInterpolator(count),itu=new TruePeakMeter(count),input=Array.from({length:count},()=>new Float64Array(128)),high=Array.from({length:count},()=>new Float64Array(512)),dense=Array.from({length:count},()=>new Float64Array(2048)),maxima=new Float64Array(count);
 for(let offset=0;offset<frames+528;offset+=128){
  for(let c=0;c<count;c++){input[c].fill(0);input[c].set(channels[c].subarray(offset,Math.min(frames,offset+128)));}
  up.process(input,high);upAgain.process(high,dense);
  for(let i=0;i<128;i++){
   const peaks=itu.pushFrame(input[0][i],input[1]?.[i]??input[0][i]);let level=0;
   for(let c=0;c<count;c++){let peak=peaks[c];for(let phase=0;phase<16;phase++)peak=Math.max(peak,Math.abs(dense[c][i*16+phase]));maxima[c]=Math.max(maxima[c],peak);level=Math.max(level,peak);}
   if(required&&level>target){const correction=target/level;for(let j=Math.max(0,offset+i-528);j<=Math.min(offset+i,frames-1);j++)required[j]=Math.min(required[j],correction);}
  }
 }
 return {method:'combined-4x-ITU-and-16x-FIR',peaksDbtp:Array.from(maxima,p=>p?20*Math.log10(p):null)};
}
// Offline prototype. A streaming version must revalidate windows across emitted
// block boundaries; independently correcting chunks is NOT equivalent to this.
export function correctTruePeakBuffer(channels,sampleRate,{ceilingDb=-1,attackMs=2,releaseMs=20,maxIterations=6}={}){
 if(!Number.isFinite(ceilingDb)||ceilingDb< -24||ceilingDb>0||!Number.isFinite(attackMs)||attackMs<0||attackMs>20||!Number.isFinite(releaseMs)||releaseMs<1||releaseMs>1000||!Number.isInteger(maxIterations)||maxIterations<1||maxIterations>12)throw Error('Invalid true-peak correction settings.');
 if(!Array.isArray(channels)||!channels[0]?.length||channels.reduce((n,c)=>n+(c?.byteLength||0),0)>32*1024*1024)throw Error('Offline correction prototype accepts up to 32 MiB of PCM.');
 truePeakStatistics(channels,sampleRate);const before=measure(channels),frames=channels[0].length,output=channels.map(c=>new Float32Array(c)),gains=new Float64Array(frames).fill(1),required=new Float64Array(frames),ceiling=10**(ceilingDb/20),target=ceiling*(1-1e-6),attack=attackMs?Math.exp(-1/(attackMs*.001*sampleRate)):0,release=Math.exp(-1/(releaseMs*.001*sampleRate));
 const peak=stats=>Math.max(0,...stats.peaksDbtp.map(db=>db===null?0:10**(db/20)));let measured=before,iterations=0,fallbackGain=1;
 while(peak(measured)>ceiling&&iterations<maxIterations){
  required.fill(1);measure(output,required,target);
  // Spread attenuation smoothly around every affected interpolation support.
  for(let i=frames-2;i>=0;i--)required[i]=Math.min(required[i],1+(required[i+1]-1)*attack);
  for(let i=1;i<frames;i++)required[i]=Math.min(required[i],1+(required[i-1]-1)*release);
  for(let i=0;i<frames;i++){gains[i]*=required[i];for(let c=0;c<channels.length;c++)output[c][i]=channels[c][i]*gains[i];}
  iterations++;measured=measure(output);
 }
 // Gain changes alter cancellation in the reconstruction filter. Re-measure;
 // bounded iteration can fall back to uniform scaling of the complete buffer.
 // This fallback cannot be applied retroactively to already-emitted live audio.
 if(peak(measured)>ceiling){fallbackGain=target/peak(measured);for(let i=0;i<frames;i++){gains[i]*=fallbackGain;for(const channel of output)channel[i]*=fallbackGain;}measured=measure(output);}
 if(peak(measured)>ceiling)throw Error('True-peak correction could not verify its output ceiling.');
 let minimumGain=1;for(const gain of gains)minimumGain=Math.min(minimumGain,gain);
 return {channels:output,before,after:measured,iterations,fallbackGain,maximumReductionDb:Math.max(0,-20*Math.log10(minimumGain))};
}
