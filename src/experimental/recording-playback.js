import {createProcessingLatencyPlan} from './processing-latency.js';
import {renderOfflineSession} from './offline-render.js';
import {scheduleSession} from './audio-engine.js';
export function recordingPlaybackLatency(session,sampleRate,cycleBuffer){
 return session?.recordWithPlayback&&!cycleBuffer?createProcessingLatencyPlan(session,sampleRate).seconds:0;
}
export function scheduleRecordingPlayback(context,session,buffers,position,captureTime,cycleBuffer){
 if(cycleBuffer){const source=context.createBufferSource();source.buffer=cycleBuffer;source.loop=true;source.connect(context.destination);source.start(captureTime);let stopped=false;return {stop(){if(stopped)return;stopped=true;source.stop();source.disconnect();}};}
 if(!session?.recordWithPlayback)return {stop(){}};
 // This output graph is separate from the microphone capture worklet.
 // Recordings are linear takes; the transport's cycle setting does not repeat them.
 const latency=recordingPlaybackLatency(session,context.sampleRate),baseTime=captureTime-latency;
 if(latency&&baseTime<context.currentTime)throw Error('Preparing backing tracks missed the recording start. Retry recording.');
 const graph=scheduleSession(context,session,buffers,position,{baseTime,compensateLatency:true});
 if(latency&&baseTime<context.currentTime){graph.stop();throw Error('Preparing backing tracks missed the recording start. Retry recording.');}
 return graph;
}

export async function renderRecordingCycle(session,buffers,sampleRate,periodFrames,{signal}={}){
 if(!session.recordWithPlayback&&!session.metronomeRecordEnabled)return null;
 const document={...session,metronomeEnabled:session.metronomeRecordEnabled,...(!session.recordWithPlayback?{id:'recording-click',tracks:[],masterEffects:[],masterAutomation:[],masterDb:0,masterPan:0}: {})};
 return renderOfflineSession(document,buffers,{position:session.loopStart,duration:periodFrames/sampleRate,sampleRate,frameCount:periodFrames,metronome:true,signal});
}
