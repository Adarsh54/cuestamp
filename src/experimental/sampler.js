import {pitchBendTimeline} from './pitch-bend-state.js';
import {samplerPlaybackRate} from './sampler-tuning.js';
import {createSamplerFilter} from './sampler-filter.js';
import {samplerEnvelope,scheduleSamplerEnvelope} from './sampler-envelope.js';
import {schedulePitchBend} from './midi-events.js';
export function samplerOffset(note,root,events,at,settings={}){
 const rate=samplerPlaybackRate(note.pitch,root,settings),points=pitchBendTimeline(events,settings.pitchBendRange);let previous=note.start,cents=points.findLast(p=>p.time<=previous)?.cents??0,offset=0;
 for(const point of points.filter(p=>p.time>previous&&p.time<at)){offset+=(point.time-previous)*rate*2**(cents/1200);previous=point.time;cents=point.cents;}
 return offset+Math.max(0,at-previous)*rate*2**(cents/1200);
}
export function samplerLoop(buffer,{sampleLoop=false,sampleLoopStart=0,sampleLoopEnd=null}={}){
 if(!sampleLoop)return {loop:false};
 const end=sampleLoopEnd??buffer.duration;
 if(!Number.isFinite(sampleLoopStart)||!Number.isFinite(end)||sampleLoopStart<0||end>buffer.duration||end-sampleLoopStart+Number.EPSILON*Math.max(1,buffer.duration)<1/buffer.sampleRate)throw Error('Sampler loop points must span at least one sample and stay inside the source file.');
 return {loop:true,loopStart:sampleLoopStart,loopEnd:end};
}
export function loopedSampleOffset(offset,loop){return loop.loop&&offset>=loop.loopEnd?loop.loopStart+(offset-loop.loopStart)%(loop.loopEnd-loop.loopStart):offset;}
export function scheduleSampler(context,destination,buffer,root,note,events,relative,when,end,nodes,settings={}){
 const envelope=samplerEnvelope(settings),at=Math.max(note.start,relative),remaining=end+envelope.release-at;if(remaining<=0||note.velocity===0)return;
 const loop=samplerLoop(buffer,settings),offset=loopedSampleOffset(samplerOffset(note,root,events,at,settings),loop);if(offset>=buffer.duration)return;
 const source=context.createBufferSource(),amp=context.createGain(),start=when+Math.max(0,note.start-relative);source.buffer=buffer;Object.assign(source,loop);source.playbackRate.value=samplerPlaybackRate(note.pitch,root,settings);schedulePitchBend(source,events,at,start,end+envelope.release,settings.pitchBendRange);
 scheduleSamplerEnvelope(amp.gain,start,at-note.start,end-note.start,note.velocity,envelope);const filter=createSamplerFilter(context,settings,note.pitch,root);if(filter){source.connect(filter).connect(amp);nodes.push(filter);}else source.connect(amp);amp.connect(destination);source.start(start,offset);source.stop(start+remaining);nodes.push(source,amp);
}
