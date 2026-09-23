import {hardwareCaptureDuration} from './hardware-recording.js';
import {cycleRecordingFrames} from './cycle-recording.js';
import {audioRecordingWindow} from './audio-punch.js';
import {createRecordingChannels,validateRecordingChannels} from './recording-channels.js';
import {createInputMonitor} from './input-monitor.js';
import {scheduleRecordingPlayback,renderRecordingCycle} from './recording-playback.js';
import {recordingTiming} from './recording-timing.js';
import {scheduleRecordingClick} from './metronome.js';
import {encodeWav} from './audio-engine.js';
export async function startRecording({signal,deviceId,inputChannels='stereo',session=null,buffers=new Map(),position=0,externalPlayback=null,onProgress=()=>{},onLimit=()=>{}}={}){
 if(signal?.aborted)throw Error('Recording canceled.');
 const window=audioRecordingWindow(session,position);position=window.playbackStart;
 validateRecordingChannels(inputChannels);
 if(!navigator.mediaDevices?.getUserMedia||!globalThis.AudioWorkletNode)throw Error('Microphone recording requires a browser with AudioWorklet support and HTTPS.');
 let stream,context,node,source,timer,click,backing,monitor,channelRoute,closed=false,resolveStop;const chunks=[];let frames=0,channels=0,peak=0,limitReached=false,failure=null,ready=false;
 const cleanup=()=>{externalPlayback?.stop();monitor?.stop();channelRoute?.stop();backing?.stop();click?.stop();clearInterval(timer);stream?.getTracks().forEach(t=>t.stop());source?.disconnect();node?.disconnect();if(context&&context.state!=='closed')context.close().catch(()=>{});};
 const failExternal=error=>{if(closed||failure)return;failure=new Error(`Hardware recording stopped: ${error instanceof Error?error.message:'External MIDI playback failed.'} No take was saved.`);cleanup();if(ready)onLimit();};
 const cancel=()=>{closed=true;resolveStop?.();cleanup();};signal?.addEventListener('abort',cancel,{once:true});
 try{
  stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:inputChannels==='right'?{min:2,ideal:2}:{ideal:2},...(deviceId?{deviceId:{exact:deviceId}}:{})},video:false});if(signal?.aborted)throw Error('Recording canceled.');
  validateRecordingChannels(inputChannels,stream.getAudioTracks()[0]?.getSettings?.().channelCount);
  context=new AudioContext();await context.audioWorklet.addModule(new URL('./recording-worklet.js',import.meta.url));await context.resume();if(signal?.aborted)throw Error('Recording canceled.');
  const cycleFrames=cycleRecordingFrames(window,context.sampleRate),cycleBuffer=cycleFrames?await renderRecordingCycle(session,buffers,context.sampleRate,cycleFrames.period):null;if(signal?.aborted)throw Error('Recording canceled.');
  const startExternal=externalPlayback?await externalPlayback.prepare({onFailure:failExternal}):null;if(signal?.aborted)throw Error('Recording canceled.');
  const captureDuration=externalPlayback?(hardwareCaptureDuration(startExternal.duration,externalPlayback.options)??window.duration):window.duration;
  const timing=recordingTiming(session,context.currentTime+(externalPlayback ? .1 : 0),context.sampleRate,position),startFrame=timing.startFrame+Math.round((window.start-position)*context.sampleRate),captureTime=startFrame/context.sampleRate,endFrame=startFrame+(cycleFrames?.maxFrames??Math.max(1,Math.round(captureDuration*context.sampleRate)));
  node=new AudioWorkletNode(context,'cuestamp-capture',{processorOptions:{startFrame,endFrame},...(inputChannels!=='stereo'?{channelCount:1,channelCountMode:'explicit',channelInterpretation:'discrete'}:{})});source=context.createMediaStreamSource(stream);
  node.port.onmessage=({data})=>{if(data.done){resolveStop?.();return;}if(data.limit){if(!closed&&!limitReached){limitReached=true;onLimit();}return;}if(closed||!data.pcm)return;const length=data.pcm[0].length;if(frames+length>context.sampleRate*600){if(!limitReached){limitReached=true;onLimit();}return;}channels=Math.max(channels,data.pcm.length);frames+=length;chunks.push(data.pcm);peak=0;for(const channel of data.pcm)for(const sample of channel)peak=Math.max(peak,Math.abs(sample));};
  channelRoute=createRecordingChannels(context,source,inputChannels);channelRoute.output.connect(node).connect(context.destination);monitor=createInputMonitor(context,channelRoute.output,{enabled:session?.audioMonitorEnabled??false,levelDb:session?.audioMonitorDb??-18});click=scheduleRecordingClick(context,cycleFrames?{...session,metronomeRecordEnabled:false}:session,position,timing);backing=cycleFrames&&!cycleBuffer?{stop(){}}:scheduleRecordingPlayback(context,session,buffers,position,timing.captureTime,cycleBuffer);if(startExternal)startExternal(performance.now()+(timing.captureTime-context.currentTime)*1000);timer=setInterval(()=>onProgress({seconds:frames/context.sampleRate,peak,countInRemaining:Math.max(0,captureTime-context.currentTime),punch:window.punch,pass:cycleFrames?Math.floor(frames/cycleFrames.period)+1:undefined,timelinePosition:position+(cycleFrames?Math.max(0,context.currentTime-timing.captureTime)%(cycleFrames.period/context.sampleRate):Math.max(0,context.currentTime-timing.captureTime))}),100);
  if(failure)throw failure;ready=true;
  return {cancel,cycleDuration:cycleFrames?cycleFrames.period/context.sampleRate:undefined,get monitorEnabled(){return monitor.enabled;},setMonitoring(enabled){monitor.set(enabled);},get countingIn(){return !failure&&context.currentTime<captureTime;},async stop(){if(failure){closed=true;signal?.removeEventListener('abort',cancel);throw failure;}if(closed)throw Error('Recording has already ended.');externalPlayback?.stop();monitor?.stop();click?.stop();backing?.stop();try{await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Recording could not be finalized.')),3000);resolveStop=()=>{clearTimeout(timeout);resolve();};node.port.postMessage('stop');});if(closed)throw Error('Recording canceled.');closed=true;if(!frames)throw Error('No microphone audio was captured.');const buffer=context.createBuffer(channels,frames,context.sampleRate);let offset=0;for(const chunk of chunks){for(let c=0;c<channels;c++)buffer.getChannelData(c).set(chunk[c]||chunk[0],offset);offset+=chunk[0].length;}return new File([encodeWav(buffer)],`Take ${new Date().toISOString().replace(/[:.]/g,'-')}.wav`,{type:'audio/wav'});}finally{signal?.removeEventListener('abort',cancel);cleanup();}}};
 }catch(error){signal?.removeEventListener('abort',cancel);cleanup();throw error;}
}
