import {scheduleTrackVoices,validateTrackSources} from './audio-voices.js';
import {createEffectMeters} from './compressor-meter.js';
import {effectParameters} from './effect-automation.js';
import {sendAutomationTarget} from './automation-recording-lane.js';
import {createLiveAutomation} from './automation-live.js';
import {effectiveAutomationSession} from './automation-mode.js';
import {createLevelMeters} from './meters.js';
import {audibleSources,createRoutedTailReader,validateRouting} from './routing.js';
import {connectEffects,scheduleAutomation,effectTail} from './effects.js';
export function sessionDuration(session){
 const tail=createRoutedTailReader(session);let end=1;
 for(const track of session.tracks){
  if(!track.regions.length)continue;let lastEnd=-Infinity;
  for(const region of track.regions)lastEnd=Math.max(lastEnd,region.start+region.duration);
  end=Math.max(end,lastEnd+tail(track));
 }
 return end+effectTail(session.masterEffects,session.masterAutomationMode==='off');
}
export function scheduleSession(context,session,buffers,position=0,options={}){
 if(options.endPosition!==undefined&&(!Number.isFinite(options.endPosition)||options.endPosition<=position||options.endPosition>86400))throw Error('Playback end must follow the start within the timeline.');
 session=effectiveAutomationSession(session);validateRouting(session);const active=audibleSources(session);for(const track of active)validateTrackSources(track,buffers);
 const effectMeters=options.meters?createEffectMeters():null,registerMeter=effectMeters?(effect,node)=>effectMeters.add(effect,node):undefined;
 const effectLanes=new Map(),register=(effect,parameter,param,transform,exponential)=>{
  const key=`${effect.id}:${parameter}`,spec=effectParameters[effect.kind][parameter];
  if(!effectLanes.has(key))effectLanes.set(key,{points:structuredClone(effect.automation||[]),fallback:effect[parameter],min:spec.min,max:spec.max,bindings:[]});
  effectLanes.get(key).bindings.push({param,transform,exponential});
 };
 const nodes=[],base=options.baseTime??context.currentTime+.025,master=context.createGain(),masterGain=context.createGain(),masterPan=context.createStereoPanner();scheduleAutomation(masterGain.gain,session.masterAutomation||[],'gainDb',position,base,session.masterDb);scheduleAutomation(masterPan.pan,session.masterAutomation||[],'pan',position,base,session.masterPan||0);connectEffects(context,master,session.masterEffects,nodes,{position,base,tempo:session.tempo,tempoChanges:session.tempoChanges,register,registerMeter}).connect(masterGain);masterGain.connect(masterPan);if(options.endPosition!==undefined){const gate=context.createGain();gate.gain.setValueAtTime(0,context.currentTime);gate.gain.setValueAtTime(1,base);gate.gain.setValueAtTime(0,base+options.endPosition-position);masterPan.connect(gate).connect(options.destination??context.destination);nodes.push(gate);}else masterPan.connect(options.destination??context.destination);nodes.push(master,masterGain,masterPan);
 const meters=options.meters?createLevelMeters(context):null;meters?.add(session.id,masterPan,{startTime:base});
 const channels=new Map(),sendNodes=new Map();
 for(const track of session.tracks.filter(t=>t.kind!=='video')){const input=context.createGain(),gain=context.createGain(),pan=context.createStereoPanner();const preFader=connectEffects(context,input,track.effects,nodes,{position,base,tempo:session.tempo,tempoChanges:session.tempoChanges,register:track.mute?undefined:register,registerMeter});preFader.connect(gain);if(track.mute)gain.gain.value=0;else scheduleAutomation(gain.gain,track.automation||[],'gainDb',position,base,track.gainDb);scheduleAutomation(pan.pan,track.automation||[],'pan',position,base,track.pan);gain.connect(pan);nodes.push(input,gain,pan);channels.set(track.id,{input,preFader,gain,pan});meters?.add(track.id,pan);}
 for(const track of session.tracks.filter(t=>t.kind!=='video')){const {pan,gain,preFader}=channels.get(track.id);pan.connect(track.output?channels.get(track.output).input:master);for(const send of track.sends||[]){const amount=context.createGain();sendNodes.set(sendAutomationTarget(track.id,send.busId),amount);if(track.mute)amount.gain.value=0;else scheduleAutomation(amount.gain,send.automation||[],'gainDb',position,base,send.gainDb);(send.tap==='preFader'?preFader:send.tap==='postFader'?gain:pan).connect(amount).connect(channels.get(send.busId).input);nodes.push(amount);}}
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
  const track=audibleSources({...session,tracks:session.tracks.map(t=>t.id===trackId?{...t,regions}:t)}).find(t=>t.id===trackId);if(!track)throw Error('This track is muted or excluded by solo.');
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
  collectVoices();const current=voices.get(trackId);
  for(const entry of retired)if(entry.trackId===trackId){entry.when=Math.min(entry.when,when);entry.group.silenceAt(entry.when);}
  if(current){const stopTime=current.stopping?Math.min(current.when,when):when;current.group.silenceAt(stopTime);retired.add({...current,when:stopTime});voices.set(trackId,{...current,when:stopTime,queued:true,stopping:true});}
  return {trackId,when};
 };
 const lanes=new Map(effectLanes);
 const addLane=(id,parameter,param,points,fallback)=>lanes.set(`${id}:${parameter}`,{param,points:structuredClone(points||[]),fallback});
 addLane(session.id,'gainDb',masterGain.gain,session.masterAutomation,session.masterDb);
 addLane(session.id,'pan',masterPan.pan,session.masterAutomation,session.masterPan||0);
 for(const track of session.tracks.filter(t=>t.kind!=='video'&&!t.mute)){
  const channel=channels.get(track.id);
  addLane(track.id,'gainDb',channel.gain.gain,track.automation,track.gainDb);
  addLane(track.id,'pan',channel.pan.pan,track.automation,track.pan);
  for(const send of track.sends||[]){const id=sendAutomationTarget(track.id,send.busId);addLane(id,'gainDb',sendNodes.get(id).gain,send.automation,send.gainDb);}
 }
 const automation=createLiveAutomation({context,base,position,lanes});
 return {base,meters,automation,replaceTrackRegions,stopTrackRegions,collectVoices,readEffectMeters:()=>effectMeters?.read(),stop(){if(stopped)return;stopped=true;for(const {group} of voices.values())group.stop();for(const {group} of retired)group.stop();voices.clear();retired.clear();effectMeters?.stop();automation.stop();meters?.stop();for(const node of nodes){try{node.stop?.();}catch{}node.disconnect();}}};
}
export {encodeWav} from './wav.js';
