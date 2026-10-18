import {createProcessingLatencyPlan} from './processing-latency.js';
import {scheduleTrackVoices,validateTrackSources} from './audio-voices.js';
import {createEffectMeters} from './compressor-meter.js';
import {effectParameters} from './effect-automation.js';
import {sendAutomationTarget} from './automation-recording-lane.js';
import {createLiveAutomation} from './automation-live.js';
import {effectiveAutomationSession} from './automation-mode.js';
import {createLevelMeters} from './meters.js';
import {renderingSources,createRoutedTailReader,validateRouting} from './routing.js';
import {connectEffects,scheduleAutomation as scheduleMixerAutomation,automationValue,effectTail} from './effects.js';
// Newly created mixer nodes must start at the seek value even when a sample
// boundary rounds just before the scheduled automation event (e.g. 221/44100).
// This initializer is deliberately not used for rescheduling live parameters.
function scheduleAutomation(param,points,parameter,position,base,fallback){const value=automationValue(points,parameter,position,fallback);param.value=parameter==='gainDb'?10**(value/20):value;scheduleMixerAutomation(param,points,parameter,position,base,fallback);}
export function sessionDuration(session){
 const tail=createRoutedTailReader(session);let end=1;
 for(const track of session.tracks){
  if(!track.regions.length)continue;let lastEnd=-Infinity;
  for(const region of track.regions)lastEnd=Math.max(lastEnd,region.start+region.duration);
  end=Math.max(end,lastEnd+tail(track));
 }
 return end+effectTail(session.masterEffects,session.masterAutomationMode==='off',session);
}
export function scheduleSession(context,session,buffers,position=0,options={}){
 if(options.endPosition!==undefined&&(!Number.isFinite(options.endPosition)||options.endPosition<=position||options.endPosition>86400))throw Error('Playback end must follow the start within the timeline.');
 session=effectiveAutomationSession(session);validateRouting(session);const active=renderingSources(session),detectorOnly=new Set(active.filter(t=>t.sidechainOnly).map(t=>t.id));for(const track of active)validateTrackSources(track,buffers);
 // Callers opt in and use outputBase for audible clocks or trim render latency.
 const latency=options.compensateLatency?createProcessingLatencyPlan(session,context.sampleRate,{compressorFrames:options.compressorLatencyFrames}):null;
 const trackTiming=new Map(latency?.tracks.map(row=>[row.id,row])||[]),channelOffset=id=>latency?(trackTiming.get(id)?.outputFrames||0)/context.sampleRate:0;
 const masterOffset=latency?.seconds||0;
 const routeDelays=new Map(latency?.routes.map(row=>[`${row.kind}:${row.from}:${row.to??''}`,row.delayFrames/context.sampleRate])||[]);
 const detectorDelays=new Map(latency?.sidechains.map(row=>[row.effectId,row.delayFrames/context.sampleRate])||[]);
 if([...routeDelays.values(),...detectorDelays.values()].some(seconds=>seconds>180))throw Error('Processing latency exceeds the supported delay length.');
 const effectMeters=options.meters?createEffectMeters():null,registerMeter=effectMeters?(effect,node)=>effectMeters.add(effect,node):undefined;
 const effectLanes=new Map(),register=(effect,parameter,param,transform,exponential,latencySeconds=0)=>{
  const key=`${effect.id}:${parameter}`,spec=effectParameters[effect.kind][parameter];
  if(!effectLanes.has(key))effectLanes.set(key,{points:structuredClone(effect.automation||[]),fallback:effect[parameter],min:spec.min,max:spec.max,bindings:[]});
  effectLanes.get(key).bindings.push({param,transform,exponential,latencySeconds});
 };
 const sidechains=[],registerSidechain=(id,node,effectId)=>sidechains.push({id,node,effectId});
 const nodes=[],base=options.baseTime??context.currentTime+.025,master=context.createGain(),masterGain=context.createGain(),masterPan=context.createStereoPanner(),outputBase=base+masterOffset;const connect=(source,destination,seconds=0)=>{if(seconds){const delay=context.createDelay(Math.max(1,seconds));delay.delayTime.value=seconds;source.connect(delay).connect(destination);nodes.push(delay);}else source.connect(destination);};scheduleAutomation(masterGain.gain,session.masterAutomation||[],'gainDb',position,outputBase,session.masterDb);scheduleAutomation(masterPan.pan,session.masterAutomation||[],'pan',position,outputBase,session.masterPan||0);connectEffects(context,master,session.masterEffects,nodes,{timing:latency?.master.effects,position,base,tempo:session.tempo,tempoChanges:session.tempoChanges,register,registerMeter,registerSidechain}).connect(masterGain);masterGain.connect(masterPan);if(options.endPosition!==undefined){const gate=context.createGain();gate.gain.setValueAtTime(0,context.currentTime);gate.gain.setValueAtTime(1,outputBase);gate.gain.setValueAtTime(0,outputBase+options.endPosition-position);masterPan.connect(gate).connect(options.destination??context.destination);nodes.push(gate);}else masterPan.connect(options.destination??context.destination);nodes.push(master,masterGain,masterPan);
 const meters=options.meters?createLevelMeters(context):null;meters?.add(session.id,masterPan,{startTime:outputBase});
 const channels=new Map(),sendNodes=new Map();
 for(const track of session.tracks.filter(t=>t.kind!=='video')){const input=context.createGain(),gain=context.createGain(),pan=context.createStereoPanner();const preFader=connectEffects(context,input,track.effects,nodes,{timing:trackTiming.get(track.id)?.effects,position,base,tempo:session.tempo,tempoChanges:session.tempoChanges,register:track.mute?undefined:register,registerMeter,registerSidechain});preFader.connect(gain);if(track.mute||detectorOnly.has(track.id))gain.gain.value=0;else scheduleAutomation(gain.gain,track.automation||[],'gainDb',position,base+channelOffset(track.id),track.gainDb);scheduleAutomation(pan.pan,track.automation||[],'pan',position,base+channelOffset(track.id),track.pan);gain.connect(pan);nodes.push(input,gain,pan);channels.set(track.id,{input,preFader,gain,pan});meters?.add(track.id,pan);}
 for(const track of session.tracks.filter(t=>t.kind!=='video')){const {pan,gain,preFader}=channels.get(track.id);connect(pan,track.output?channels.get(track.output).input:master,routeDelays.get(`output:${track.id}:${track.output||''}`));for(const send of track.sends||[]){const amount=context.createGain();sendNodes.set(sendAutomationTarget(track.id,send.busId),amount);if(track.mute||detectorOnly.has(track.id))amount.gain.value=0;else scheduleAutomation(amount.gain,send.automation||[],'gainDb',position,base+channelOffset(track.id),send.gainDb);(send.tap==='preFader'?preFader:send.tap==='postFader'?gain:pan).connect(amount);connect(amount,channels.get(send.busId).input,routeDelays.get(`send:${track.id}:${send.busId}`));nodes.push(amount);}}
 for(const {id,node,effectId} of sidechains)connect(channels.get(id).input,node,detectorDelays.get(effectId));
 const voices=new Map(),retired=new Set();let stopped=false;
 for(const track of active){const group=scheduleTrackVoices(context,track,buffers,channels.get(track.id).input,position,base);group.open(base);voices.set(track.id,{trackId:track.id,group,when:base,queued:false});}
 const collectVoices=()=>{for(const entry of retired)if(context.currentTime>=entry.when){entry.group.stop();retired.delete(entry);const current=voices.get(entry.trackId);if(current?.group===entry.group&&current.stopping)voices.delete(entry.trackId);}};
 const replaceTrackRegions=(trackId,regions,{when,position:clipPosition=0,duration}={})=>{
  if(stopped)throw Error('Playback has stopped.');
  if(!Number.isFinite(when)||when<=context.currentTime||!Number.isFinite(clipPosition)||clipPosition<0)throw Error('Choose a future audio-clock time and a nonnegative clip position.');
  if(options.endPosition!==undefined&&when>=base+options.endPosition-position)throw Error('The playback window ends before this clip can launch.');
  if(duration!==undefined&&(!Number.isFinite(duration)||duration<=0||duration>600))throw Error('Choose a clip playback duration up to 600 seconds.');
  if(!Array.isArray(regions)||regions.length>10000)throw Error('Choose at most 10,000 clip repetitions.');
  const source=session.tracks.find(t=>t.id===trackId&&['audio','midi'].includes(t.kind));if(!source)throw Error('Choose an audio or MIDI track.');
  const track=renderingSources({...session,tracks:session.tracks.map(t=>t.id===trackId?{...t,regions}:t)}).find(t=>t.id===trackId);if(!track)throw Error('This track is neither audible nor an active sidechain source.');
  collectVoices();const previous=voices.get(trackId);if(previous?.queued&&previous.when>context.currentTime)throw Error('This track already has a pending clip launch or stop.');
  const group=scheduleTrackVoices(context,track,buffers,channels.get(trackId).input,clipPosition,when);
  if(context.currentTime>=when){group.stop();throw Error('Clip preparation missed its launch time. Try again.');}
  group.open(when);if(duration!==undefined)group.cutAt(when+duration);if(previous){previous.group.cutAt(when);retired.add({...previous,when});}voices.set(trackId,{trackId,group,when,queued:true});return {trackId,when};
 };
 const stopTrackRegions=(trackId,{when}={})=>{
  if(stopped)throw Error('Playback has stopped.');
  if(!Number.isFinite(when)||when<=context.currentTime)throw Error('Choose a future audio-clock stop time.');
  if(options.endPosition!==undefined&&when>=base+options.endPosition-position)throw Error('Playback ends before the requested cell stop.');
  if(!session.tracks.some(t=>t.id===trackId&&['audio','midi'].includes(t.kind)))throw Error('Choose an audio or MIDI track.');
  collectVoices();stopVoices(trackId,when);return {trackId,when};
 };
 const stopVoices=(trackId,when)=>{const current=voices.get(trackId);
  for(const entry of retired)if(entry.trackId===trackId){entry.when=Math.min(entry.when,when);entry.group.silenceAt(entry.when);}
  if(current){const stopTime=current.stopping?Math.min(current.when,when):when;current.group.silenceAt(stopTime);retired.add({...current,when:stopTime});voices.set(trackId,{...current,when:stopTime,queued:true,stopping:true});}
 };
 const stopAllRegions=({when}={})=>{
  if(stopped)throw Error('Playback has stopped.');
  if(!Number.isFinite(when)||when<=context.currentTime)throw Error('Choose a future audio-clock stop time.');
  if(options.endPosition!==undefined&&when>=base+options.endPosition-position)throw Error('Playback ends before the requested clip stop.');
  collectVoices();const ids=new Set([...voices.keys(),...Array.from(retired,e=>e.trackId)]);
  for(const id of ids)stopVoices(id,when);
  return {when};
 };
 const lanes=new Map(effectLanes);
 const addLane=(id,parameter,param,points,fallback,latencySeconds=0)=>lanes.set(`${id}:${parameter}`,{param,points:structuredClone(points||[]),fallback,latencySeconds});
 addLane(session.id,'gainDb',masterGain.gain,session.masterAutomation,session.masterDb,masterOffset);
 addLane(session.id,'pan',masterPan.pan,session.masterAutomation,session.masterPan||0,masterOffset);
 for(const track of session.tracks.filter(t=>t.kind!=='video'&&!t.mute&&!detectorOnly.has(t.id))){
  const channel=channels.get(track.id);
  addLane(track.id,'gainDb',channel.gain.gain,track.automation,track.gainDb,channelOffset(track.id));
  addLane(track.id,'pan',channel.pan.pan,track.automation,track.pan,channelOffset(track.id));
  for(const send of track.sends||[]){const id=sendAutomationTarget(track.id,send.busId);addLane(id,'gainDb',sendNodes.get(id).gain,send.automation,send.gainDb,channelOffset(track.id));}
 }
 const automation=createLiveAutomation({context,base,position,lanes});
 return {base,outputBase,latencyFrames:latency?.totalFrames||0,meters,automation,replaceTrackRegions,stopTrackRegions,stopAllRegions,collectVoices,readEffectMeters:()=>effectMeters?.read(),resetEffectMeters:id=>effectMeters?.reset(id),stop(){if(stopped)return;stopped=true;for(const {group} of voices.values())group.stop();for(const {group} of retired)group.stop();voices.clear();retired.clear();effectMeters?.stop();automation.stop();meters?.stop();for(const node of nodes){try{node.stop?.();}catch{}node.disconnect();}}};
}
export {encodeWav} from './wav.js';
