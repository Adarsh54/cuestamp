import {formatSessionTimecode,parseSessionTimecode} from './timecode.js';
import {z} from 'zod';
import {compileTempoMap} from './tempo-map.js';
import {scaleTempoPlan} from './tempo-scale.js';
const options=z.object({startBeat:z.number().finite().min(0).max(432000),endBeat:z.number().finite().positive().max(432000),targetTime:z.number().finite().positive().max(86400).optional(),targetTimecode:z.string().min(1).max(100).optional()}).strict();
export function fitTempoPlan(session,values){
 const v=options.parse(values);if((v.targetTime===undefined)===(v.targetTimecode===undefined))throw Error('Provide exactly one endpoint: seconds or timecode.');if(v.targetTimecode!==undefined)v.targetTime=parseSessionTimecode(v.targetTimecode,session);if(v.endBeat<=v.startBeat)throw Error('End beat must follow start beat.');
 const old=compileTempoMap(session),startTime=old.timeAtBeat(v.startBeat),previousEnd=old.timeAtBeat(v.endBeat);
 if(v.targetTime<=startTime)throw Error('The target time must follow the passage start.');
 if(previousEnd>86400)throw Error('Choose a passage within the 24-hour timeline.');
 const factor=(previousEnd-startTime)/(v.targetTime-startTime),plan=scaleTempoPlan(session,{startBeat:v.startBeat,endBeat:v.endBeat,factor}),next=compileTempoMap(plan);
 if(Math.abs(next.timeAtBeat(v.endBeat)-v.targetTime)>1e-8)throw Error('Cannot fit this endpoint accurately.');
 return {...plan,factor,startTime,previousEnd,targetTime:v.targetTime,shift:v.targetTime-previousEnd};
}
export function tempoFitView(){return `<details data-tempo-fit-panel><summary>Fit music to a timestamp</summary><form data-tempo-fit class="daw-cycle"><label>Start beat<input name="startBeat" type="number" min="1" step="any" value="1" required></label><label>End beat<input name="endBeat" type="number" min="1" step="any" value="17" required></label><label>Target marker<select name="marker"><option value="">Enter a time</option></select></label><label>Endpoint format<select name="targetFormat"><option value="seconds">Seconds</option><option value="timecode">Timecode</option></select></label><label>Target endpoint<input name="targetTime" type="text" value="10" required></label><output></output><button>Fit tempo</button></form><p class="muted">Keeps the start time fixed and scales the passage’s existing tempos so its end beat lands at the chosen timestamp. Tempo-following MIDI keeps beat positions; later MIDI shifts by the duration difference. Original BPM resumes at the end beat. Audio, video, markers and automation stay at their existing times.</p></details>`;}
export function bindTempoFit(root,{session,execute,guard}){
 const form=root.querySelector('[data-tempo-fit]');if(!form)return;const f=form.elements,button=form.querySelector('button'),output=form.querySelector('output');
 for(const marker of session.markers){const option=document.createElement('option');option.value=marker.id;option.textContent=`${marker.name} · ${marker.time.toFixed(3)} s`;f.marker.append(option);}
 let previousFormat='seconds',exactTarget=null;
 const read=k=>f[k].value.trim()?Number(f[k].value):NaN,endpoint=()=>{const marker=session.markers.find(m=>m.id===f.marker.value);if(marker)return {targetTime:marker.time};if(exactTarget!==null)return {targetTime:exactTarget};return f.targetFormat.value==='timecode'?{targetTimecode:f.targetTime.value.trim()}:{targetTime:read('targetTime')};},values=()=>({startBeat:read('startBeat')-1,endBeat:read('endBeat')-1,...endpoint()});

 const update=()=>{try{const plan=fitTempoPlan(session,values());output.textContent=`Endpoint ${plan.previousEnd.toFixed(3)} → ${plan.targetTime.toFixed(3)} s · tempos ×${plan.factor.toFixed(4)} · later MIDI shifts ${plan.shift.toFixed(3)} s.`;button.disabled=!plan.changed;}catch(error){output.textContent=error.message;button.disabled=true;}};
 f.targetFormat.onchange=()=>{try{const time=exactTarget??(previousFormat==='timecode'?parseSessionTimecode(f.targetTime.value.trim(),session):read('targetTime'));if(!Number.isFinite(time)||time<0||time>86400)throw Error('Enter a valid endpoint before changing format.');exactTarget=time;f.targetTime.value=f.targetFormat.value==='timecode'?formatSessionTimecode(time,session):String(time);previousFormat=f.targetFormat.value;update();}catch(error){f.targetFormat.value=previousFormat;output.textContent=error.message;}};f.marker.onchange=()=>{const marker=session.markers.find(m=>m.id===f.marker.value);if(marker){exactTarget=marker.time;f.targetTime.value=f.targetFormat.value==='timecode'?formatSessionTimecode(marker.time,session):String(marker.time);}update();};f.targetTime.oninput=()=>{f.marker.value='';exactTarget=null;};form.oninput=update;
 form.onsubmit=guard(e=>{e.preventDefault();update();if(!button.disabled)execute([{op:'tempo.fit',values:values()}],'Fitted music to timestamp');});update();
}
