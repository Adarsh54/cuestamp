import {samplerSourceRange} from './sampler-source-range.js';
import {sampleZoneLevel,connectSampleZone,sampleGroupDestination} from './sampler-zone-voice.js';
import {createPitchBendState} from './pitch-bend-state.js';
import {pitchBendRangeSchema} from './pitch-bend.js';
import {samplerPlaybackRate} from './sampler-tuning.js';
import {createSamplerFilter} from './sampler-filter.js';
import {samplerEnvelope,scheduleSamplerEnvelope,heldEnvelopeAt} from './sampler-envelope.js';
import {samplerLoop} from './sampler.js';
import {drumBuffer} from './drums.js';
// Live audition is independent of capture: count-in notes sound but are not saved.
export function createLiveMidiMonitor(context, {destination=context.destination,maxVoices=64,instrument='triangle',pitchBendRange=2,sampleBuffer=null,sampleResolver=null,sampleRoot=60,sampleStart=0,sampleEnd=null,sampleTune=0,sampleFineTune=0,sampleLoop:loopEnabled=false,sampleLoopStart=0,sampleLoopEnd=null,sampleAttack=.005,sampleDecay=0,sampleSustain=1,sampleRelease=.02,sampleFilterType='off',sampleFilterCutoff=20000,sampleFilterResonance=0,sampleFilterKeyTrack=0}={}) {
 if(!Number.isInteger(maxVoices)||maxVoices<1||maxVoices>128)throw Error('Live MIDI supports 1–128 voices.');
 pitchBendRange=pitchBendRangeSchema.parse(pitchBendRange);
 if(!['triangle','sine','square','sawtooth','drumKit','sampler'].includes(instrument))throw Error('Unsupported monitor instrument.');
 if(instrument==='sampler'&&!sampleBuffer&&!sampleResolver)throw Error('Assign a sampler source before monitoring MIDI.');
 const loop=instrument==='sampler'&&!sampleResolver?samplerLoop(sampleBuffer,{sampleStart,sampleEnd,sampleLoop:loopEnabled,sampleLoopStart,sampleLoopEnd}):null;
 const envelope=samplerEnvelope({sampleAttack,sampleDecay,sampleSustain,sampleRelease});
 const voices=new Set(),channels=new Map(),groups=new Map();let disposed=false;
 function channel(id){if(!channels.has(id)){const gain=context.createGain(),pan=context.createStereoPanner();gain.connect(pan);pan.connect(destination);channels.set(id,{gain,pan,volume:1,expression:1,bendState:createPitchBendState(pitchBendRange),sustain:false,sostenuto:false});update(channels.get(id));}return channels.get(id);}
 function update(c){c.gain.gain.setValueAtTime(c.volume*c.expression,context.currentTime);}
 function destroy(v){voices.delete(v);v.osc.disconnect();v.gain.disconnect();v.filter?.disconnect();v.zonePan?.disconnect();}
 function release(v,immediate=false){if(v.released&&!immediate)return;v.released=true;const now=context.currentTime;if(immediate){v.gain.gain.cancelScheduledValues(now);v.gain.gain.setValueAtTime(0,now);v.osc.stop(now);destroy(v);}else{const duration=v.sampler?v.envelope.release:.03;const value=v.level*(v.sampler?heldEnvelopeAt(Math.max(0,now-v.startedAt),v.envelope):Math.min(1,Math.max(0,now-v.startedAt)/.008));v.gain.gain.cancelScheduledValues(now);v.gain.gain.setValueAtTime(value,now);if(duration)v.gain.gain.linearRampToValueAtTime(0,now+duration);else v.gain.gain.setValueAtTime(0,now);v.osc.stop(now+duration+.005);}}
 function push(data){
  if(disposed||!data||data.length<2)return;const status=data[0],kind=status&0xf0,id=status&15,a=data[1],b=data[2];
  if(status<0x80||status>=0xf0||a>127||a<0||([0x80,0x90,0xb0,0xe0].includes(kind)&&(!Number.isInteger(b)||b<0||b>127)))return;
  const c=channel(id),matching=()=>[...voices].filter(v=>v.channel===id);
  if(kind===0x90&&b){
   const layers=instrument==='sampler'&&sampleResolver?sampleResolver({pitch:a,velocity:b/127}):[null],group={};
   for(const layer of layers){
   while(voices.size>=maxVoices)release(voices.values().next().value,true);
   const voiceEnvelope=layer?samplerEnvelope({sampleAttack,sampleDecay,sampleSustain,sampleRelease,...layer}):envelope;
   const drum=instrument==='drumKit',sampler=instrument==='sampler',osc=(drum||sampler)?context.createBufferSource():context.createOscillator(),gain=context.createGain(),now=context.currentTime;
   if(drum){osc.buffer=drumBuffer(context,a);gain.gain.value=b/127;}else if(sampler){osc.buffer=layer?.buffer??sampleBuffer;Object.assign(osc,layer?samplerLoop(layer.buffer,layer):loop);osc.playbackRate.value=samplerPlaybackRate(a,layer?.sampleRoot??sampleRoot,{sampleTune,sampleFineTune,...(layer??{})});osc.detune.value=c.bendState.cents;scheduleSamplerEnvelope(gain.gain,now,0,Infinity,b/127*sampleZoneLevel(layer??{}),voiceEnvelope);}else{osc.type=instrument;osc.frequency.value=440*2**((a-69)/12);osc.detune.value=c.bendState.cents;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(b/127*.18,now+.008);}
   const filter=sampler?createSamplerFilter(context,{sampleFilterType,sampleFilterCutoff,sampleFilterResonance,sampleFilterKeyTrack,...(layer??{})},a,layer?.sampleRoot??sampleRoot):null;if(filter)osc.connect(filter).connect(gain);else osc.connect(gain);const zonePan=connectSampleZone(context,gain,sampleGroupDestination(context,c.gain,layer??{},groups,id),layer??{});const v={startedAt:now,level:b/127*(sampler?sampleZoneLevel(layer??{}):.18),envelope:voiceEnvelope,zonePan,group,osc,gain,filter,drum,sampler,channel:id,pitch:a,held:true,released:false};voices.add(v);osc.onended=()=>destroy(v);if(sampler){const range=samplerSourceRange(osc.buffer,layer??{sampleStart,sampleEnd});if(osc.loop||range.end===osc.buffer.duration)osc.start(0,range.start);else osc.start(0,range.start,range.end-range.start);}else osc.start();}

  }else if(kind===0x80||(kind===0x90&&!b)){
   const v=matching().find(v=>v.pitch===a&&v.held);if(v)for(const layer of matching().filter(n=>n.group===v.group)){layer.held=false;if(!c.sustain&&!layer.sostenuto&&!layer.drum)release(layer);}
  }else if(kind===0xe0){c.bendState.push({type:'pitchBend',value:a|(b<<7)});for(const v of matching())if(!v.drum)v.osc.detune.setValueAtTime(c.bendState.cents,context.currentTime);
  }else if(kind===0xb0){
   if(c.bendState.push({type:'controlChange',parameter:a,value:b}))for(const v of matching())if(!v.drum)v.osc.detune.setValueAtTime(c.bendState.cents,context.currentTime);
   if(a===7){c.volume=b/127;update(c);}if(a===11){c.expression=b/127;update(c);}
   if(a===10)c.pan.pan.setValueAtTime((b-64)/(b<64?64:63),context.currentTime);
   if(a===64){c.sustain=b>=64;if(!c.sustain)for(const v of matching())if(!v.held&&!v.sostenuto&&!v.drum)release(v);}
   if(a===66){const down=b>=64;if(down&&!c.sostenuto)for(const v of matching())if(v.held&&!v.released&&!v.drum)v.sostenuto=true;c.sostenuto=down;if(!down)for(const v of matching()){v.sostenuto=false;if(!v.held&&!c.sustain&&!v.drum)release(v);}}
   if(a===120)for(const v of matching())release(v,true);
   if(a===123)for(const v of matching()){v.held=false;if(!c.sustain&&!v.sostenuto&&!v.drum)release(v);}
   if(a===121){c.expression=1;c.sustain=false;c.sostenuto=false;update(c);for(const v of matching()){v.sostenuto=false;if(!v.drum)v.osc.detune.setValueAtTime(c.bendState.cents,context.currentTime);if(!v.held&&!v.sostenuto&&!v.drum)release(v);}}
  }
 }
 return {push,get voiceCount(){return voices.size;},stop(){if(disposed)return;disposed=true;for(const v of [...voices])release(v,true);for(const c of channels.values()){c.gain.disconnect();c.pan.disconnect();}channels.clear();for(const node of groups.values())node.disconnect();groups.clear();}};
}
