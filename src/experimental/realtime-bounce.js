import {transportWait} from './agent-transport.js';
import {scheduleSession} from './audio-engine.js';
import {prepareSessionEffects} from './noise-gate.js';
import {writeWavStream} from './wav-stream.js';
import {realtimeWavFormat} from './realtime-bounce-plan.js';
export async function renderRealtimeWav(plan,buffers,settings,sink,{signal,onProgress=()=>{}}={}){
 let context,node,graph,waiting,failed,watchdog,done=false,previous=false;const queue=[];
 const fail=error=>{failed=error;waiting?.();waiting=null;};
 const abort=()=>{fail(signal.reason);};
 try{
  const {format,options}=realtimeWavFormat(plan,settings);signal?.throwIfAborted();
  context=new AudioContext({sampleRate:format.sampleRate,sinkId:{type:'none'}});await transportWait(context.suspend(),signal);
  await transportWait(prepareSessionEffects(context,plan.entries[0].document),signal);const {default:url}=await transportWait(import('./stream-capture.worklet.js?worker&url'),signal);await transportWait(context.audioWorklet.addModule(url),signal);signal?.throwIfAborted();
  const startFrame=Math.ceil((context.currentTime+.05)*format.sampleRate/128)*128;
  node=new AudioWorkletNode(context,'cuestamp-stream-capture',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit',processorOptions:{startFrame,endFrame:startFrame+format.frames}});
  node.port.onmessage=({data})=>{if(data.error)fail(Error(data.error));if(data.pcm)queue.push(data.pcm);if(data.done)done=true;waiting?.();waiting=null;};node.onprocessorerror=()=>fail(Error('Audio capture failed. Export canceled.'));
  node.connect(context.destination); // Processor emits silence; only its PCM port is recorded.
  graph=scheduleSession(context,plan.entries[0].document,buffers,plan.position,{baseTime:startFrame/format.sampleRate,destination:node});
  let ready;const destinationReady=new Promise(resolve=>ready=resolve);
  const chunks={async *[Symbol.asyncIterator](){ready();while(true){if(previous){node.port.postMessage('ack');previous=false;}if(failed)throw failed;signal?.throwIfAborted();if(queue.length){previous=true;yield queue.shift();continue;}if(done)return;await new Promise(resolve=>waiting=resolve);}}};
  signal?.addEventListener('abort',abort,{once:true});
  // Observe write failures immediately, including while resume awaits browser activation.
  const writing=writeWavStream(format,chunks,sink,{...options,signal,onProgress});writing.catch(fail);
  // Finish the initial file write before starting the audio clock.
  await Promise.race([destinationReady,writing]);signal?.throwIfAborted();
  let lastClock=context.currentTime,lastAdvance=performance.now();watchdog=setInterval(()=>{if(context.currentTime>lastClock){lastClock=context.currentTime;lastAdvance=performance.now();}else if(performance.now()-lastAdvance>5000)fail(Error('The browser audio clock stopped. Keep this tab active and retry the export.'));},1000);
  const resumed=context.resume();await Promise.race([resumed,writing]);signal?.throwIfAborted();return await writing;
 }catch(error){fail(error);try{await sink.abort(error);}catch{}throw error;}
 finally{clearInterval(watchdog);signal?.removeEventListener('abort',abort);graph?.stop();if(node){node.port.postMessage('stop');node.port.onmessage=null;node.port.close();node.disconnect();}if(context&&context.state!=='closed')await context.close();}
}
