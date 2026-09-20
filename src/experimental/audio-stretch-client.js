import {validateAudioStretch} from './audio-stretch-options.js';
// Worker input is copied; cancellation never detaches or changes the source audio.
export async function renderAudioStretch(buffer,ratio,{signal,onProgress=()=>{}}={}){
 validateAudioStretch({sampleRate:buffer.sampleRate,frames:buffer.length,channels:buffer.numberOfChannels,ratio});
 if(signal?.aborted)throw new DOMException('Audio stretching canceled.','AbortError');
 const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i).slice());
 return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./audio-stretch.worker.js',import.meta.url),{type:'module'}),cleanup=()=>{worker.terminate();signal?.removeEventListener('abort',abort);},fail=error=>{cleanup();reject(error);},abort=()=>fail(new DOMException('Audio stretching canceled.','AbortError'));
  signal?.addEventListener('abort',abort,{once:true});worker.onerror=event=>fail(new Error(event.message||'Audio stretching failed.'));
  worker.onmessage=({data})=>{if(data.error)return fail(new Error(data.error));if(data.channels){cleanup();resolve(data.channels);}else try{onProgress(data.progress);}catch(error){fail(error);}};
  try{worker.postMessage({channels,sampleRate:buffer.sampleRate,ratio},channels.map(c=>c.buffer));}catch(error){fail(error);}
 });
}
