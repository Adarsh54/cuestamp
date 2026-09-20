import {Stretch} from '@soundtouchjs/core';
import {validateAudioStretch} from './audio-stretch-options.js';
export {validateAudioStretch} from './audio-stretch-options.js';
// Offline WSOLA: change duration without changing playback sample rate or pitch.
// Call inside a worker for application use; progress measures input consumed.
export function stretchAudioChannels(channels,sampleRate,ratio,onProgress=()=>{}){
 const frames=channels[0]?.length,outputFrames=validateAudioStretch({sampleRate,frames,channels:channels.length,ratio});
 if(channels.some(c=>!(c instanceof Float32Array)||c.length!==frames))throw Error('Audio channels must contain equal-length Float32 data.');
 for(const c of channels)for(const value of c)if(!Number.isFinite(value))throw Error('Audio contains non-finite samples.');
 if(ratio===1){onProgress(1);return channels.map(c=>c.slice());}
 const processor=new Stretch({sampleRate,createBuffers:true});processor.tempo=1/ratio;
 return renderProcessedChannels(processor,channels,sampleRate,outputFrames,onProgress);
}

// Shared bounded offline drain for the core stereo processors.
export function renderProcessedChannels(processor,channels,sampleRate,outputFrames,onProgress){
 const frames=channels[0].length;
 const output=channels.map(()=>new Float32Array(outputFrames)),chunk=4096,input=new Float32Array(chunk*2),scratch=new Float32Array(chunk*2);let cursor=0,written=0;
 // The public processor has no flush API. Bounded silence drains its final
 // overlap windows; crop to the requested frame count rather than exporting padding.
 while(written<outputFrames){
  if(cursor>frames+sampleRate)throw Error('The time-stretch processor did not finish its output.');
  input.fill(0);const count=Math.min(chunk,Math.max(0,frames-cursor));for(let i=0;i<count;i++){input[i*2]=channels[0][cursor+i];input[i*2+1]=(channels[1]??channels[0])[cursor+i];}
  processor.inputBuffer.putSamples(input,0,chunk);processor.process();cursor+=chunk;
  while(processor.outputBuffer.frameCount&&written<outputFrames){const n=Math.min(chunk,processor.outputBuffer.frameCount,outputFrames-written);processor.outputBuffer.extract(scratch,0,n);processor.outputBuffer.receive(n);for(let i=0;i<n;i++){output[0][written+i]=scratch[i*2];if(output[1])output[1][written+i]=scratch[i*2+1];}written+=n;}
  onProgress(Math.min(.99,cursor/frames));
 }
 processor.clear();onProgress(1);return output;
}
