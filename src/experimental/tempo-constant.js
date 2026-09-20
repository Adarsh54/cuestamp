import {z} from 'zod';
import {compileTempoMap} from './tempo-map.js';
const options=z.object({startBeat:z.number().finite().min(0).max(432000),endBeat:z.number().finite().positive().max(432000)}).strict();
export function constantTempoPlan(session,values){
 const v=options.parse(values);if(v.endBeat<=v.startBeat)throw Error('End beat must follow start beat.');
 const old=compileTempoMap(session),startTime=old.timeAtBeat(v.startBeat),endTime=old.timeAtBeat(v.endBeat);
 if(endTime>86400||endTime<=startTime)throw Error('Choose a representable passage within the 24-hour timeline.');
 const inside=old.points.filter(p=>p.beat>v.startBeat&&p.beat<v.endBeat),duration=endTime-startTime;
 if(!inside.length)return {tempo:session.tempo,tempoChanges:structuredClone(session.tempoChanges),bpm:old.tempoAtBeat(v.startBeat),duration,endTime,removed:0};
 const bpm=inside.length?60*(v.endBeat-v.startBeat)/duration:old.tempoAtBeat(v.startBeat);
 const point=(beat,bpm)=>({beat,bpm,id:old.points.find(p=>p.beat===beat)?.id??crypto.randomUUID()});
 const points=[...old.points.filter(p=>p.beat<v.startBeat),point(v.startBeat,bpm),point(v.endBeat,old.tempoAtBeat(v.endBeat)),...old.points.filter(p=>p.beat>v.endBeat)];
 const timing={tempo:points[0].bpm,tempoChanges:points.slice(1).map(({beat,bpm,id})=>({beat,bpm,id}))};
 const next=compileTempoMap(timing);if(Math.abs(next.timeAtBeat(v.endBeat)-endTime)>1e-8)throw Error('This range cannot preserve its endpoint accurately.');
 return {...timing,bpm,duration,endTime,removed:inside.length};
}
export function tempoConstantView(){return `<details data-tempo-constant-panel><summary>Make tempo constant</summary><form data-tempo-constant class="daw-cycle"><label>Start beat<input name="startBeat" type="number" min="1" step="any" value="1" required></label><label>End beat<input name="endBeat" type="number" min="1" step="any" value="17" required></label><output data-tempo-constant-preview></output><button>Make tempo constant</button></form><p class="muted">Calculates one BPM for the passage while preserving its total duration and endpoint. Removes interior tempo changes and restores the original tempo at the end. MIDI within the passage shifts to keep its beat positions; later music and fixed-time audio/video keep their positions.</p></details>`;}
export function bindTempoConstant(root,{session,execute,guard}){
 const form=root.querySelector('[data-tempo-constant]');if(!form)return;const f=form.elements,button=form.querySelector('button'),preview=form.querySelector('output');
 const values=()=>Object.fromEntries(['startBeat','endBeat'].map(k=>[k,f[k].value.trim()?Number(f[k].value)-1:NaN]));
 const update=()=>{try{const plan=constantTempoPlan(session,values());preview.textContent=`${plan.bpm.toFixed(6)} BPM · ${plan.removed} interior changes removed · duration stays ${plan.duration.toFixed(3)} s · endpoint ${plan.endTime.toFixed(3)} s.`;button.disabled=!plan.removed;}catch(error){preview.textContent=error.message;button.disabled=true;}};
 form.oninput=update;form.onsubmit=guard(event=>{event.preventDefault();update();if(!button.disabled)execute([{op:'tempo.constant',values:values()}],'Made passage tempo constant; endpoint preserved');});update();
}
