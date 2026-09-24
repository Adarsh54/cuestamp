import {prepareSessionEffects} from './noise-gate.js';
import {scheduleMetronome} from './metronome.js';
import {scheduleSession} from './audio-engine.js';
export function scheduleRecordingPlayback(context,session,buffers,position,captureTime,cycleBuffer){
 if(cycleBuffer){const source=context.createBufferSource();source.buffer=cycleBuffer;source.loop=true;source.connect(context.destination);source.start(captureTime);let stopped=false;return {stop(){if(stopped)return;stopped=true;source.stop();source.disconnect();}};}
 if(!session?.recordWithPlayback)return {stop(){}};
 // This output graph is separate from the microphone capture worklet.
 // Recordings are linear takes; the transport's cycle setting does not repeat them.
 return scheduleSession(context,session,buffers,position,{baseTime:captureTime});
}

export async function renderRecordingCycle(session,buffers,sampleRate,periodFrames){
 if(!session.recordWithPlayback&&!session.metronomeRecordEnabled)return null;
 const context=new OfflineAudioContext(2,periodFrames,sampleRate);
 if(session.recordWithPlayback)await prepareSessionEffects(context,session);
 if(session.recordWithPlayback)scheduleSession(context,session,buffers,session.loopStart,{baseTime:0});
 scheduleMetronome(context,{...session,metronomeEnabled:session.metronomeRecordEnabled},{position:session.loopStart,baseTime:0,duration:periodFrames/sampleRate});
 return context.startRendering();
}
