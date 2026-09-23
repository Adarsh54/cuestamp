import {createEffectMeters} from './compressor-meter.js';
import {compileMidiControllers} from './midi-controller-timeline.js';
import {effectParameters} from './effect-automation.js';
import {sendAutomationTarget} from './automation-recording-lane.js';
import {createLiveAutomation} from './automation-live.js';
import {effectiveAutomationSession} from './automation-mode.js';
import {scheduleRegionEnvelope} from './region-fades.js';
import {samplerRelease} from './sampler-envelope.js';
import {scheduleSampler,samplerLoop} from './sampler.js';
import {createLevelMeters} from './meters.js';
import {scheduleDrum} from './drums.js';
import {scheduleMidiChannel,schedulePitchBend} from './midi-events.js';
import {audibleSources,routedTail,validateRouting} from './routing.js';
import {connectEffects,scheduleAutomation,effectTail} from './effects.js';
export const sessionDuration=session=>Math.max(1,...session.tracks.flatMap(t=>t.regions.map(r=>r.start+r.duration+routedTail(session,t))))+effectTail(session.masterEffects,session.masterAutomationMode==='off');
const linear=db=>10**(db/20);
export function scheduleSession(context,session,buffers,position=0,options={}){
 if(options.endPosition!==undefined&&(!Number.isFinite(options.endPosition)||options.endPosition<=position||options.endPosition>86400))throw Error('Playback end must follow the start within the timeline.');
 session=effectiveAutomationSession(session);validateRouting(session);const active=audibleSources(session);for(const t of active.filter(t=>t.kind==='audio'))for(const r of t.regions){const buffer=buffers.get(r.assetId);if(!buffer)throw Error(`Missing audio: ${r.name}. Re-import the file.`);if(r.offset+r.duration>buffer.duration+.01)throw Error(`Region exceeds its source: ${r.name}`);}
 for(const t of active.filter(t=>t.kind==='midi'&&t.instrument==='sampler'&&t.regions.some(r=>r.notes.some(n=>!n.mute&&n.velocity>0)))){if(!buffers.has(t.sampleAssetId))throw Error(`Missing sampler source for ${t.name}. Assign an audio sample.`);samplerLoop(buffers.get(t.sampleAssetId),t);}
 const effectMeters=options.meters?createEffectMeters():null,registerMeter=effectMeters?(effect,node)=>effectMeters.add(effect,node):undefined;
 const effectLanes=new Map(),register=(effect,parameter,param,transform,exponential)=>{
  const key=`${effect.id}:${parameter}`,spec=effectParameters[effect.kind][parameter];
  if(!effectLanes.has(key))effectLanes.set(key,{points:structuredClone(effect.automation||[]),fallback:effect[parameter],min:spec.min,max:spec.max,bindings:[]});
  effectLanes.get(key).bindings.push({param,transform,exponential});
 };
 const nodes=[],base=options.baseTime??context.currentTime+.025,master=context.createGain(),masterGain=context.createGain(),masterPan=context.createStereoPanner();scheduleAutomation(masterGain.gain,session.masterAutomation||[],'gainDb',position,base,session.masterDb);scheduleAutomation(masterPan.pan,session.masterAutomation||[],'pan',position,base,session.masterPan||0);connectEffects(context,master,session.masterEffects,nodes,{position,base,tempo:session.tempo,tempoChanges:session.tempoChanges,register,registerMeter}).connect(masterGain);masterGain.connect(masterPan);if(options.endPosition!==undefined){const gate=context.createGain();gate.gain.setValueAtTime(0,context.currentTime);gate.gain.setValueAtTime(1,base);gate.gain.setValueAtTime(0,base+options.endPosition-position);masterPan.connect(gate).connect(context.destination);nodes.push(gate);}else masterPan.connect(context.destination);nodes.push(master,masterGain,masterPan);
 const meters=options.meters?createLevelMeters(context):null;meters?.add(session.id,masterPan,{startTime:base});
 const channels=new Map(),sendNodes=new Map();
 for(const track of session.tracks.filter(t=>t.kind!=='video')){const input=context.createGain(),gain=context.createGain(),pan=context.createStereoPanner();const preFader=connectEffects(context,input,track.effects,nodes,{position,base,tempo:session.tempo,tempoChanges:session.tempoChanges,register:track.mute?undefined:register,registerMeter});preFader.connect(gain);if(track.mute)gain.gain.value=0;else scheduleAutomation(gain.gain,track.automation||[],'gainDb',position,base,track.gainDb);scheduleAutomation(pan.pan,track.automation||[],'pan',position,base,track.pan);gain.connect(pan);nodes.push(input,gain,pan);channels.set(track.id,{input,preFader,gain,pan});meters?.add(track.id,pan);}
 for(const track of session.tracks.filter(t=>t.kind!=='video')){const {pan,gain,preFader}=channels.get(track.id);pan.connect(track.output?channels.get(track.output).input:master);for(const send of track.sends||[]){const amount=context.createGain();sendNodes.set(sendAutomationTarget(track.id,send.busId),amount);if(track.mute)amount.gain.value=0;else scheduleAutomation(amount.gain,send.automation||[],'gainDb',position,base,send.gainDb);(send.tap==='preFader'?preFader:send.tap==='postFader'?gain:pan).connect(amount).connect(channels.get(send.busId).input);nodes.push(amount);}}
 for(const track of active){const {input}=channels.get(track.id);
  for(const r of track.regions){const relative=Math.max(0,position-r.start),length=r.duration-relative;if(length+samplerRelease(track)<=0)continue;const when=base+Math.max(0,r.start-position),regionGain=context.createGain(),level=linear(r.gainDb);regionGain.connect(input);nodes.push(regionGain);scheduleRegionEnvelope(regionGain.gain,r,relative,when,level);
   if(track.kind==='midi'){const channels=new Map(),streams=new Map();for(const event of r.events||[]){const channel=event.channel||0;if(!streams.has(channel))streams.set(channel,[]);streams.get(channel).push(event);}const compiled=new Map();for(const note of r.notes){if(note.mute)continue;const channel=note.channel||0;if(!compiled.has(channel))compiled.set(channel,compileMidiControllers(streams.get(channel)||[],track.pitchBendRange));const timeline=compiled.get(channel),events=timeline.events,end=timeline.sustainedEnd(note,r.duration);if(!channels.has(channel))channels.set(channel,scheduleMidiChannel(context,regionGain,events,relative,when,nodes,timeline));if(track.instrument==='sampler'){scheduleSampler(context,channels.get(channel),buffers.get(track.sampleAssetId),track.sampleRoot,note,events,relative,when,end,nodes,track,timeline.pitch,timeline.pitchIntegral);continue;}if(track.instrument==='drumKit'){scheduleDrum(context,channels.get(channel),note,relative,when,r.duration,nodes);continue;}const localStart=note.start-relative,remaining=end-note.start+Math.min(0,localStart);if(remaining<=0||note.velocity===0)continue;const osc=context.createOscillator(),amp=context.createGain(),start=when+Math.max(0,localStart);osc.type=track.instrument;osc.frequency.value=440*2**((note.pitch-69)/12);schedulePitchBend(osc,events,Math.max(relative,note.start),start,end,track.pitchBendRange,timeline.pitch);amp.gain.setValueAtTime(0,start);amp.gain.linearRampToValueAtTime(note.velocity*.18,start+Math.min(.008,remaining/3));amp.gain.setValueAtTime(note.velocity*.18,start+Math.max(Math.min(.008,remaining/3),remaining-.02));amp.gain.linearRampToValueAtTime(0,start+remaining);osc.connect(amp).connect(channels.get(channel));osc.start(start);osc.stop(start+remaining);nodes.push(osc,amp);}}
   else{let buffer=buffers.get(r.assetId);if(!buffer)throw Error(`Missing audio: ${r.name}. Re-import the file.`);if(r.offset+r.duration>buffer.duration+.01)throw Error(`Region exceeds its source: ${r.name}`);let offset=r.offset+relative;if(r.reverse){const reversed=context.createBuffer(buffer.numberOfChannels,Math.ceil(r.duration*buffer.sampleRate),buffer.sampleRate);for(let c=0;c<buffer.numberOfChannels;c++){const input=buffer.getChannelData(c),output=reversed.getChannelData(c);for(let i=0;i<output.length;i++)output[i]=input[Math.floor((r.offset+r.duration)*buffer.sampleRate)-1-i]||0;}buffer=reversed;offset=relative;}const source=context.createBufferSource();source.buffer=buffer;source.connect(regionGain);source.start(when,offset,length);nodes.push(source);}
  }
 }
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
 return {base,meters,automation,readEffectMeters:()=>effectMeters?.read(),stop(){effectMeters?.stop();automation.stop();meters?.stop();for(const node of nodes){try{node.stop?.();}catch{}node.disconnect();}}};
}
export {encodeWav} from './wav.js';
