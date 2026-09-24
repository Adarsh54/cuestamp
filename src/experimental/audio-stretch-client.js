import {validateAudioRetune} from './audio-retune-options.js';
import {audioWarpPlan} from './audio-warp-options.js';
import {validateAudioPitch} from './audio-pitch-options.js';
import {validateAudioStretch} from './audio-stretch-options.js';
// Worker input is copied; cancellation never detaches or changes the source audio.
export async function renderAudioStretch(buffer,ratio,{signal,onProgress=()=>{}}={}){
 validateAudioStretch({sampleRate:buffer.sampleRate,frames:buffer.length,channels:buffer.numberOfChannels,ratio});
 return renderAudioWorker(buffer,{ratio},{signal,onProgress});
}
export async function renderAudioRetune(buffer,corrections,{signal,onProgress=()=>{}}={}){validateAudioRetune({sampleRate:buffer.sampleRate,frames:buffer.length,channels:buffer.numberOfChannels,corrections});return renderAudioWorker(buffer,{mode:'retune',corrections},{signal,onProgress});}
export async function renderAudioPitch(buffer,semitones,{signal,onProgress=()=>{}}={}){
 validateAudioPitch({sampleRate:buffer.sampleRate,frames:buffer.length,channels:buffer.numberOfChannels,semitones});
 return renderAudioWorker(buffer,{semitones,mode:'pitch'},{signal,onProgress});
}
export async function renderAudioWarp(buffer,anchors,{signal,onProgress=()=>{}}={}){
 audioWarpPlan({sampleRate:buffer.sampleRate,frames:buffer.length,channels:buffer.numberOfChannels,anchors});return renderAudioWorker(buffer,{mode:'warp',anchors},{signal,onProgress});
}
function renderAudioWorker(buffer,options,{signal,onProgress}){
 if(signal?.aborted)throw new DOMException('Audio rendering canceled.','AbortError');
 const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i).slice());
 return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./audio-stretch.worker.js',import.meta.url),{type:'module'}),cleanup=()=>{worker.terminate();signal?.removeEventListener('abort',abort);},fail=error=>{cleanup();reject(error);},abort=()=>fail(new DOMException('Audio rendering canceled.','AbortError'));
  signal?.addEventListener('abort',abort,{once:true});worker.onerror=event=>fail(new Error(event.message||'Audio rendering failed.'));
  worker.onmessage=({data})=>{if(data.error)return fail(new Error(data.error));if(data.channels){cleanup();resolve(data.channels);}else try{onProgress(data.progress);}catch(error){fail(error);}};
  try{worker.postMessage({channels,sampleRate:buffer.sampleRate,...options},channels.map(c=>c.buffer));}catch(error){fail(error);}
 });
}
