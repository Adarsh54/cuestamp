import {z} from 'zod';
import {compileTempoMap} from './tempo-map.js';
const options=z.object({factor:z.number().finite().positive().max(16),startBeat:z.number().finite().min(0).max(432000).optional(),endBeat:z.number().finite().positive().max(432000).optional()}).strict();
export function scaleTempoPlan(session,values){
 const v=options.parse(values),ranged=v.startBeat!==undefined||v.endBeat!==undefined;
 if(ranged&&(v.startBeat===undefined||v.endBeat===undefined||v.endBeat<=v.startBeat))throw Error('Provide both start and end beats, with end after start.');
 const old=compileTempoMap(session),start=ranged?v.startBeat:0,end=ranged?v.endBeat:Infinity;
 if(v.factor===1)return {tempo:session.tempo,tempoChanges:structuredClone(session.tempoChanges||[]),changed:0};
 const scaled=bpm=>{const result=bpm*v.factor;if(result<20||result>300)throw Error('Scaling would move a tempo outside 20–300 BPM. Choose a smaller change.');return result;};
 const points=old.points.map(p=>({...p,bpm:p.beat>=start&&p.beat<end?scaled(p.bpm):p.bpm}));
 if(!points.some(p=>p.beat===start))points.push({id:crypto.randomUUID(),beat:start,bpm:scaled(old.tempoAtBeat(start))});
 if(ranged&&!points.some(p=>p.beat===end))points.push({id:crypto.randomUUID(),beat:end,bpm:old.tempoAtBeat(end)});
 points.sort((a,b)=>a.beat-b.beat);
 const timing={tempo:points[0].bpm,tempoChanges:points.slice(1).map(({beat,bpm,id})=>({beat,bpm,id:id??crypto.randomUUID()}))};
 const next=compileTempoMap(timing),changed=points.filter(p=>p.beat>=start&&p.beat<end).length;
 return {...timing,changed,...(ranged?{previousDuration:old.timeAtBeat(end)-old.timeAtBeat(start),duration:next.timeAtBeat(end)-next.timeAtBeat(start)}:{})};
}
export function tempoScaleView(){return `<details data-tempo-scale-panel><summary>Scale existing tempo</summary><form data-tempo-scale class="daw-cycle"><label>Scope<select name="scope"><option value="all">Whole project</option><option value="range">Beat range</option></select></label><label>Tempo · %<input name="percent" type="number" min=".001" max="1600" step="any" value="110" required></label><label>Start beat<input name="startBeat" type="number" min="1" step="any" value="1" required disabled></label><label>End beat<input name="endBeat" type="number" min="1" step="any" value="17" required disabled></label><output data-tempo-scale-preview></output><button>Scale tempo</button></form><p class="muted">100% keeps the tempo, 110% makes it 10% faster, and 50% halves it. Preserves relative tempo changes. A beat range restores the original tempo at its end. Tempo-following MIDI keeps its musical positions; audio, video, markers and automation retain seconds.</p></details>`;}
export function bindTempoScale(root,{session,execute,guard}){
 const form=root.querySelector('[data-tempo-scale]');if(!form)return;const f=form.elements,button=form.querySelector('button'),preview=form.querySelector('output');
 const read=name=>f[name].value.trim()?Number(f[name].value):NaN;
 const values=()=>({factor:read('percent')/100,...(f.scope.value==='range'?{startBeat:read('startBeat')-1,endBeat:read('endBeat')-1}:{})});
 const update=()=>{f.startBeat.disabled=f.endBeat.disabled=f.scope.value!=='range';try{const plan=scaleTempoPlan(session,values());preview.textContent=`${plan.changed} tempo points change.${plan.duration!==undefined?` Passage duration: ${plan.previousDuration.toFixed(2)} → ${plan.duration.toFixed(2)} seconds.`:''}`;button.disabled=!plan.changed;}catch(error){preview.textContent=error.message;button.disabled=true;}};
 form.oninput=update;form.onchange=update;form.onsubmit=guard(event=>{event.preventDefault();update();if(!button.disabled)execute([{op:'tempo.scale',values:values()}],'Scaled existing tempo');});update();
}
