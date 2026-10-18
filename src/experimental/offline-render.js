import {createProcessingLatencyPlan} from './processing-latency.js';
import {scheduleSession} from './audio-engine.js';
import {prepareSessionEffects} from './noise-gate.js';
import {transportWait} from './agent-transport.js';

// Return a native AudioBuffer so bounced regions remain playable by BufferSource.
// Render the delayed ending as well, then remove only processing latency; echoes
// and reverb remain part of the caller's requested duration.
export async function renderOfflineSession(session,buffers,{position=0,duration,sampleRate,signal}={}){
 signal?.throwIfAborted();
 if(!Number.isFinite(position)||position<0||!Number.isFinite(duration)||duration<=0||duration>600)throw Error('Choose an offline render range up to 10 minutes.');
 const latency=createProcessingLatencyPlan(session,sampleRate),frames=Math.max(1,Math.ceil(duration*sampleRate));
 const context=new OfflineAudioContext(2,frames+latency.totalFrames,sampleRate);let graph;
 try{
  await transportWait(prepareSessionEffects(context,session),signal);signal?.throwIfAborted();
  graph=scheduleSession(context,session,buffers,position,{baseTime:0,compensateLatency:true});
  const rendered=await transportWait(context.startRendering(),signal);signal?.throwIfAborted();
  if(!latency.totalFrames)return rendered;
  const result=context.createBuffer(2,frames,sampleRate);
  for(let c=0;c<2;c++)result.copyToChannel(rendered.getChannelData(c).subarray(latency.totalFrames,latency.totalFrames+frames),c);
  return result;
 }finally{graph?.stop();}
}
