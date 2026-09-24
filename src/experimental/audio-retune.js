import {pitchAudioChannels} from './audio-pitch.js';
import {validateAudioRetune} from './audio-retune-options.js';
export function retuneAudioChannels(channels,sampleRate,corrections,onProgress=()=>{}){
 const frames=channels[0]?.length;corrections=validateAudioRetune({sampleRate,frames,channels:channels.length,corrections});
 if(channels.some(c=>!(c instanceof Float32Array)||c.length!==frames))throw Error('Audio channels must contain equal-length Float32 data.');
 for(const channel of channels)for(const value of channel)if(!Number.isFinite(value))throw Error('Audio contains non-finite samples.');
 const output=channels.map(c=>c.slice()),padding=Math.round(sampleRate*.1),edge=Math.max(1,Math.round(sampleRate*.005));onProgress(0);
 for(const [index,correction] of corrections.entries()){
  const start=Math.round(correction.start*sampleRate),end=Math.min(frames,Math.round(correction.end*sampleRate));
  if(end>start&&correction.semitones!==0){
   // Include context for the processor but write only the requested span.
   const from=Math.max(0,start-padding),to=Math.min(frames,end+padding),input=channels.map(c=>c.slice(from,to)),shifted=pitchAudioChannels(input,sampleRate,correction.semitones),fade=Math.min(edge,Math.floor((end-start)/2));
   for(let i=start;i<end;i++){const wet=fade?Math.min(1,(i-start)/fade,(end-1-i)/fade):1;for(let c=0;c<output.length;c++)output[c][i]=channels[c][i]*(1-wet)+shifted[c][i-from]*wet;}
  }
  onProgress((index+1)/corrections.length);
 }
 return output;
}
