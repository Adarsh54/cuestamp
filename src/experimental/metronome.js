import {compileMeterMap} from './meter-map.js';
import {compileTempoMap} from './tempo-map.js';
// One reusable bar keeps playback bounded even in long sessions. Correct the
// playback rate for frame rounding so the repeated bar never accumulates drift.
export function clickBar(tempo,meter,sampleRate){
 if(!Number.isFinite(tempo)||tempo<20||tempo>300||!Number.isInteger(meter)||meter<1||meter>32||!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>192000)throw Error('Invalid metronome timing.');
 const duration=60/tempo*meter,frames=Math.round(duration*sampleRate),samples=new Float32Array(frames);
 for(let beat=0;beat<meter;beat++){
  const start=Math.round(beat*frames/meter),length=Math.min(Math.round(.04*sampleRate),frames-start),accent=beat===0;
  for(let i=0;i<length;i++){const t=i/sampleRate,envelope=Math.min(1,t/.001)*Math.max(0,1-i/length)**3;samples[start+i]=Math.sin(2*Math.PI*(accent?1320:880)*t)*envelope*(accent?1:.6);}
 }
 return {samples,duration};
}
export function scheduleMetronome(context,session,{position=0,baseTime=context.currentTime+.025,duration=Infinity}={}){
 if(!session.metronomeEnabled||duration<=0)return {stop(){}};
 if(session.tempoChanges?.length||session.meterChanges?.length||(session.meterDenominator??4)!==4)return scheduleMappedMetronome(context,session,{position,baseTime,duration});
 const bar=clickBar(session.tempo,session.meter,context.sampleRate),buffer=context.createBuffer(1,bar.samples.length,context.sampleRate);
 buffer.copyToChannel(bar.samples,0);
 const source=context.createBufferSource(),gain=context.createGain(),rate=buffer.duration/bar.duration;
 source.buffer=buffer;source.loop=true;source.playbackRate.value=rate;
 gain.gain.value=10**((session.metronomeDb??-18)/20);
 source.connect(gain).connect(context.destination);
 source.start(baseTime,((position%bar.duration+bar.duration)%bar.duration)*rate);
 if(Number.isFinite(duration))source.stop(baseTime+duration);
 let stopped=false;
 return {stop(){if(stopped)return;stopped=true;try{source.stop();}catch{}source.disconnect();gain.disconnect();}};
}
// Two padded pulse buffers are shared by every tempo segment. Loops use their
// own period, avoiding a node per beat or a full bar allocation per tempo point.
export function scheduleMappedMetronome(context,session,{position=0,baseTime=context.currentTime+.025,duration=Infinity}={}){
 const map=compileTempoMap(session),signatures=compileMeterMap(session),meter=session.meter,rate=context.sampleRate;
 if(!Number.isInteger(meter)||meter<1||meter>32||!Number.isFinite(position)||!Number.isFinite(baseTime)||!(duration>0)||!Number.isFinite(rate)||rate<8000||rate>192000)throw Error('Invalid metronome timing.');
 const points=[...new Set([...map.points.map(p=>p.beat),...signatures.points.map(p=>p.beat)])].sort((a,b)=>a-b).map(beat=>{const signature=signatures.signatureAtBeat(beat),unit=4/signature.denominator;return {beat,time:map.timeAtBeat(beat),bpm:map.tempoAtBeat(beat),origin:signature.beat,strides:[unit,unit*signature.numerator]};});
 const end=position+duration,slowest=Math.min(...map.points.map(p=>p.bpm)),strides=[Math.max(...points.map(p=>p.strides[0])),Math.max(...points.map(p=>p.strides[1]))],pulse=Math.min(.04,...points.map(p=>60/p.bpm*p.strides[0])),bufferRate=60/slowest*strides[1]>48?8000:rate,length=Math.round(pulse*bufferRate),gain=context.createGain(),sources=[];
 gain.gain.value=10**((session.metronomeDb??-18)/20);gain.connect(context.destination);
 const buffers=strides.map((stride,index)=>{const buffer=context.createBuffer(1,Math.ceil(60/slowest*stride*bufferRate),bufferRate),samples=buffer.getChannelData(0);for(let i=0;i<length;i++){const t=i/bufferRate,envelope=Math.min(1,t/.001)*Math.max(0,1-i/length)**3,normal=Math.sin(2*Math.PI*880*t)*envelope*.6;samples[i]=index?Math.sin(2*Math.PI*1320*t)*envelope-normal:normal;}return buffer;});
 const add=(buffer,start,offset,stop,period)=>{const source=context.createBufferSource();source.buffer=buffer;if(period){source.loop=true;source.loopEnd=Math.round(period*bufferRate)/bufferRate;source.playbackRate.value=source.loopEnd/period;}source.connect(gain);sources.push(source);source.start(baseTime+(start-position),offset);if(Number.isFinite(stop))source.stop(baseTime+(stop-position));};
 try{
  // Preserve the tail of a click when seeking into it, even across a tempo point.
  const beat=map.beatAtTime(position),signature=signatures.signatureAtBeat(beat),unit=4/signature.denominator,index=Math.floor((beat-signature.beat)/unit+1e-10),previousBeat=signature.beat+index*unit,previousTime=map.timeAtBeat(previousBeat),offset=position-previousTime;
  if(offset>1e-10&&offset<pulse){add(buffers[0],position,offset,Math.min(end,previousTime+pulse));if(index%signature.numerator===0)add(buffers[1],position,offset,Math.min(end,previousTime+pulse));}
  for(let i=0;i<points.length;i++){
   const point=points[i],start=Math.max(position,i?point.time:-Infinity),finish=Math.min(end,points[i+1]?.time??Infinity);if(finish<=start)continue;
   for(const [index,stride] of point.strides.entries()){
    const firstBeat=point.origin+Math.ceil((map.beatAtTime(start)-point.origin)/stride-1e-10)*stride,firstTime=map.timeAtBeat(firstBeat);if(firstTime>=finish-1e-10)continue;
    const lastBeat=Number.isFinite(finish)?point.origin+(Math.ceil((map.beatAtTime(finish)-point.origin)/stride-1e-10)-1)*stride:Infinity;
    const stop=Number.isFinite(lastBeat)?Math.min(end,map.timeAtBeat(lastBeat)+pulse):Infinity;
    add(buffers[index],firstTime,0,stop,60/point.bpm*stride);
   }
  }
 }catch(error){for(const source of sources){try{source.stop();}catch{}source.disconnect();}gain.disconnect();throw error;}
 let stopped=false;return {stop(){if(stopped)return;stopped=true;for(const source of sources){try{source.stop();}catch{}source.disconnect();}gain.disconnect();}};
}
export function metronomeView(session){return `<form class="daw-cycle" data-metronome-form><label class="daw-click-toggle"><input name="enabled" type="checkbox" ${session.metronomeEnabled?'checked':''}> Metronome during playback</label><label class="daw-click-toggle"><input name="recordEnabled" type="checkbox" ${session.metronomeRecordEnabled?'checked':''}> During recording</label><label>Time signature · beats per bar<input name="meter" type="number" min="1" max="16" step="1" value="${session.meter}"></label><label>Beat value<select name="denominator">${[1,2,4,8,16,32,64].map(d=>`<option value="${d}" ${d===(session.meterDenominator??4)?'selected':''}>1/${d} note</option>`).join('')}</select></label><label>Count-in<select name="countIn">${[0,1,2].map(bars=>`<option value="${bars}" ${bars===(session.countInBars??0)?'selected':''}>${bars?bars+' bar'+(bars===1?'':'s'):'Off'}</option>`).join('')}</select></label><label>Click level · dB<input name="level" type="number" min="-60" max="0" step="1" value="${session.metronomeDb??-18}"></label><button type="submit">Apply metronome</button><small>Excluded from captured audio and exports. Use headphones while recording to prevent microphone bleed.</small></form><div class="daw-recording-options"><label><input data-recording-playback type="checkbox" ${session.recordWithPlayback?'checked':''}> Play arrangement while recording</label><label><input data-midi-monitor type="checkbox" ${session.midiMonitorEnabled?'checked':''}> Hear MIDI while recording</label><small>Takes use the chosen audio or MIDI destination. Recording runs once; Cycle does not repeat takes. Audio punch can limit microphone capture.</small></div><form class="daw-cycle" data-audio-monitor-form><label><input name="enabled" type="checkbox" ${session.audioMonitorEnabled?'checked':''}> Hear microphone while recording</label><label>Monitor level · dB<input name="level" type="number" min="-60" max="0" step="1" value="${session.audioMonitorDb??-18}"></label><button>Apply microphone monitoring</button><small>Use headphones to avoid feedback. Includes count-in; monitor level does not change the saved audio. Mute monitor is available during the take.</small></form>`;}
export function bindMetronome(root,{execute,guard}){const monitorForm=root.querySelector('[data-audio-monitor-form]');monitorForm.onsubmit=guard(e=>{e.preventDefault();execute([{op:'session.set',values:{audioMonitorEnabled:monitorForm.elements.enabled.checked,audioMonitorDb:Number(monitorForm.elements.level.value)}}],'Updated microphone monitoring');});root.querySelector('[data-midi-monitor]').onchange=guard(e=>execute([{op:'session.set',values:{midiMonitorEnabled:e.target.checked}}],'Updated MIDI monitoring'));root.querySelector('[data-recording-playback]').onchange=guard(e=>execute([{op:'session.set',values:{recordWithPlayback:e.target.checked}}],'Updated recording playback'));const form=root.querySelector('[data-metronome-form]');form.onsubmit=guard(e=>{e.preventDefault();execute([{op:'session.set',values:{metronomeEnabled:form.elements.enabled.checked,metronomeRecordEnabled:form.elements.recordEnabled.checked,metronomeDb:Number(form.elements.level.value),countInBars:Number(form.elements.countIn.value),meter:Number(form.elements.meter.value),meterDenominator:Number(form.elements.denominator.value)}}],'Updated metronome');});}

export function scheduleRecordingClick(context,session,position,timing){
 return scheduleMetronome(context,{...session,metronomeEnabled:Boolean(session?.metronomeRecordEnabled||timing.countInSeconds)},{position:position-timing.countInSeconds,baseTime:timing.clickTime,duration:timing.countInSeconds+(session?.metronomeRecordEnabled?600:0)});
}
