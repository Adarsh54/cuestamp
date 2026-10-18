import {truePeakCorrectionSettings} from './true-peak-correction.js';
// One worker per request makes cancellation immediate even during synchronous DSP.
// Copy source PCM before transfer; the editor retains ownership of its AudioBuffer.
export async function correctTruePeakAudio(buffer,settings={}, {signal,onProgress=()=>{}}={}){
 signal?.throwIfAborted();settings=truePeakCorrectionSettings(settings);
 if(!buffer||![44100,48000,96000].includes(buffer.sampleRate)||![1,2].includes(buffer.numberOfChannels)||!Number.isInteger(buffer.length)||buffer.length<1||buffer.length*buffer.numberOfChannels*4>32*1024*1024)throw Error('Offline correction accepts matching mono/stereo audio at 44.1, 48 or 96 kHz within 32 MiB of PCM.');
 const channels=Array.from({length:buffer.numberOfChannels},(_,c)=>{const data=buffer.getChannelData(c);if(!(data instanceof Float32Array)||data.length!==buffer.length)throw Error('Audio channel length does not match the buffer.');return data.slice();});
 signal?.throwIfAborted();
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./true-peak-correction.worker.js',import.meta.url),{type:'module'});let settled=false;
  const cleanup=()=>{worker.onmessage=worker.onerror=worker.onmessageerror=null;worker.terminate();signal?.removeEventListener('abort',abort);};
  const fail=error=>{if(settled)return;settled=true;cleanup();reject(error);},abort=()=>fail(signal?.reason||new DOMException('True-peak correction canceled.','AbortError'));
  worker.onerror=event=>fail(Error(event.message||'True-peak correction worker failed.'));worker.onmessageerror=()=>fail(Error('True-peak correction returned an unreadable result.'));
  worker.onmessage=({data})=>{if(settled)return;if(data?.type==='error')return fail(Error(data.error));if(data?.type==='progress'){try{onProgress(data.progress);}catch(error){fail(error);}return;}if(data?.type!=='result')return fail(Error('Unexpected true-peak correction worker response.'));settled=true;cleanup();resolve(data.result);};
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)return abort();
  try{worker.postMessage({channels,sampleRate:buffer.sampleRate,settings},channels.map(channel=>channel.buffer));}catch(error){fail(error);}
 });
}
