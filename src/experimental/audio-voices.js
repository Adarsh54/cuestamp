import {samplesForNote} from './sampler-articulations.js';
import {compileMidiControllers} from './midi-controller-timeline.js';
import {scheduleRegionEnvelope} from './region-fades.js';
import {samplerRelease} from './sampler-envelope.js';
import {scheduleSampler,samplerLoop} from './sampler.js';
import {scheduleDrum} from './drums.js';
import {scheduleMidiChannel,schedulePitchBend} from './midi-events.js';
const linear=db=>10**(db/20);
export function validateTrackSources(track,buffers){
 if(track.kind==='audio')for(const r of track.regions){const buffer=buffers.get(r.assetId);if(!buffer)throw Error(`Missing audio: ${r.name}. Re-import the file.`);if(r.offset+r.duration>buffer.duration+.01)throw Error(`Region exceeds its source: ${r.name}`);}
 if(track.kind==='midi'&&track.instrument==='sampler'){const sources=new Map();for(const r of track.regions)for(const n of r.notes)if(!n.mute&&n.velocity>0){for(const settings of samplesForNote(track,n))sources.set(JSON.stringify([settings.sampleAssetId,settings.sampleLoop,settings.sampleLoopStart,settings.sampleLoopEnd]),settings);}for(const settings of sources.values()){if(!buffers.has(settings.sampleAssetId))throw Error(`Missing sampler source for ${track.name}. Assign the required sample.`);samplerLoop(buffers.get(settings.sampleAssetId),settings);}}
}
// Voices feed a persistent mixer input. Their gate is independent of track
// effects, so replacing a clip does not restart bus state or other instruments.
export function scheduleTrackVoices(context,track,buffers,input,position,base){
 validateTrackSources(track,buffers);
 const nodes=[],gate=context.createGain();gate.gain.value=0;gate.connect(input);nodes.push(gate);let stopped=false;
 const stop=()=>{if(stopped)return;stopped=true;for(const node of nodes){try{node.stop?.();}catch{}node.disconnect();}};
 try{
  for(const r of track.regions){const relative=Math.max(0,position-r.start),length=r.duration-relative;if(length+samplerRelease(track)<=0)continue;const when=base+Math.max(0,r.start-position),regionGain=context.createGain(),level=linear(r.gainDb);regionGain.connect(gate);nodes.push(regionGain);scheduleRegionEnvelope(regionGain.gain,r,relative,when,level);
   if(track.kind==='midi'){const channels=new Map(),streams=new Map();for(const event of r.events||[]){const channel=event.channel||0;if(!streams.has(channel))streams.set(channel,[]);streams.get(channel).push(event);}const compiled=new Map();for(const note of r.notes){if(note.mute)continue;const channel=note.channel||0;if(!compiled.has(channel))compiled.set(channel,compileMidiControllers(streams.get(channel)||[],track.pitchBendRange));const timeline=compiled.get(channel),events=timeline.events,end=timeline.sustainedEnd(note,r.duration);if(!channels.has(channel))channels.set(channel,scheduleMidiChannel(context,regionGain,events,relative,when,nodes,timeline));if(track.instrument==='sampler'){for(const settings of samplesForNote(track,note))scheduleSampler(context,channels.get(channel),buffers.get(settings.sampleAssetId),settings.sampleRoot,note,events,relative,when,end,nodes,settings,timeline.pitch,timeline.pitchIntegral);continue;}if(track.instrument==='drumKit'){scheduleDrum(context,channels.get(channel),note,relative,when,r.duration,nodes);continue;}const localStart=note.start-relative,remaining=end-note.start+Math.min(0,localStart);if(remaining<=0||note.velocity===0)continue;const osc=context.createOscillator(),amp=context.createGain(),start=when+Math.max(0,localStart);osc.type=track.instrument;osc.frequency.value=440*2**((note.pitch-69)/12);schedulePitchBend(osc,events,Math.max(relative,note.start),start,end,track.pitchBendRange,timeline.pitch);amp.gain.setValueAtTime(0,start);amp.gain.linearRampToValueAtTime(note.velocity*.18,start+Math.min(.008,remaining/3));amp.gain.setValueAtTime(note.velocity*.18,start+Math.max(Math.min(.008,remaining/3),remaining-.02));amp.gain.linearRampToValueAtTime(0,start+remaining);osc.connect(amp).connect(channels.get(channel));osc.start(start);osc.stop(start+remaining);nodes.push(osc,amp);}}
   else{let buffer=buffers.get(r.assetId);if(!buffer)throw Error(`Missing audio: ${r.name}. Re-import the file.`);if(r.offset+r.duration>buffer.duration+.01)throw Error(`Region exceeds its source: ${r.name}`);let offset=r.offset+relative;if(r.reverse){const reversed=context.createBuffer(buffer.numberOfChannels,Math.ceil(r.duration*buffer.sampleRate),buffer.sampleRate);for(let c=0;c<buffer.numberOfChannels;c++){const input=buffer.getChannelData(c),output=reversed.getChannelData(c);for(let i=0;i<output.length;i++)output[i]=input[Math.floor((r.offset+r.duration)*buffer.sampleRate)-1-i]||0;}buffer=reversed;offset=relative;}const source=context.createBufferSource();source.buffer=buffer;source.connect(regionGain);source.start(when,offset,length);nodes.push(source);}
  }

 }catch(error){stop();throw error;}
 return {open(when){gate.gain.setValueAtTime(1,when);},cutAt(when){gate.gain.setValueAtTime(0,when);},silenceAt(when){gate.gain.cancelScheduledValues(when);gate.gain.setValueAtTime(0,when);},stop};
}
