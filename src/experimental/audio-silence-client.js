import {silenceOptionsSchema} from './audio-silence.js';
export async function analyzeAudioSilence(buffer,options,{signal,onProgress=()=>{}}={}){
 options=silenceOptionsSchema.parse(options);signal?.throwIfAborted();
 if(buffer.numberOfChannels<1||buffer.numberOfChannels>2||buffer.length/buffer.sampleRate>600||buffer.length*buffer.numberOfChannels*4>250*1024*1024)throw Error('Analyze up to 10 minutes of mono or stereo audio within 250 MB of PCM.');
 const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i).slice());
 return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./audio-silence.worker.js',import.meta.url),{type:'module'}),cleanup=()=>{worker.terminate();signal?.removeEventListener('abort',abort);},fail=error=>{cleanup();reject(error);},abort=()=>fail(new DOMException('Silence analysis canceled.','AbortError'));
  signal?.addEventListener('abort',abort,{once:true});worker.onerror=e=>fail(new Error(e.message||'Silence analysis failed.'));
  worker.onmessage=({data})=>{if(data.error)return fail(new Error(data.error));if(data.ranges){cleanup();resolve(data.ranges);}else try{onProgress(data.progress);}catch(error){fail(error);}};
  try{worker.postMessage({channels,sampleRate:buffer.sampleRate,options},channels.map(c=>c.buffer));}catch(error){fail(error);}
 });
}
