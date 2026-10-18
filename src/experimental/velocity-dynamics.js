import {z} from 'zod';
import {selectedMidiNotes} from './note-selection.js';
const options=z.object({threshold:z.number().finite().min(0).max(1).default(80/127),ratio:z.number().finite().min(.25).max(20).default(2),knee:z.number().finite().min(0).max(64/127).default(0),makeup:z.number().finite().min(-1).max(1).default(0),noteId:z.string().optional(),noteIds:z.string().max(2020000).optional()}).strict();
export function velocityDynamicsEdits(region,values){
 const s=options.parse(values),notes=selectedMidiNotes(region,s);if(!notes.length)throw Error('Add or select notes first.');
 return notes.map(note=>{const x=note.velocity;if(x===0)return {id:note.id,velocity:0};const d=x-s.threshold;let y=x;
  if(s.knee>0&&Math.abs(d)<s.knee/2)y=x+(1/s.ratio-1)*(d+s.knee/2)**2/(2*s.knee);
  else if(d>=s.knee/2)y=s.threshold+d/s.ratio;
  return {id:note.id,velocity:Math.max(Math.min(x,1/127),Math.min(1,y+s.makeup))};
 });
}
const state=settings=>settings.velocityDynamics??={threshold:80,ratio:2,knee:0,makeup:0,scope:'region'};
export function velocityDynamicsView(settings){const s=state(settings);const number=(name,label,min,max,step)=>`<label>${label}<input name="${name}" type="number" min="${min}" max="${max}" step="${step}" value="${Number.isFinite(s[name])?s[name]:''}" required></label>`;return `<details class="daw-velocity-dynamics"><summary>Velocity dynamics · compress / expand</summary><form data-velocity-dynamics class="button-row"><label>Apply to<select name="scope"><option value="region" ${s.scope==='region'?'selected':''}>All notes in region</option><option value="selected" ${s.scope==='selected'?'selected':''}>Selected notes</option></select></label>${number('threshold','Threshold · MIDI velocity',0,127,1)}${number('ratio','Ratio · above 1 compresses',.25,20,.25)}${number('knee','Soft knee · MIDI steps',0,64,1)}${number('makeup','Makeup · MIDI steps',-127,127,1)}<button>Apply velocity dynamics</button></form><output data-dynamics-preview aria-live="polite"></output><p class="muted">Compression reduces differences above the threshold; ratios below 1 expand them. Soft knee smooths the transition. Makeup shifts all chosen sounding notes afterward. Silent notes stay silent. This edits note-on velocities; Undo before comparing another setting.</p></details>`;}
export function bindVelocityDynamics(root,{region,settings,execute,guard}){
 const form=root.querySelector('[data-velocity-dynamics]');if(!form)return;const s=state(settings),button=form.querySelector('button'),preview=root.querySelector('[data-dynamics-preview]');
 const values=()=>({threshold:s.threshold/127,ratio:s.ratio,knee:s.knee/127,makeup:s.makeup/127,...(s.scope==='selected'?{noteIds:(settings.selectedIds||[]).join(',')}:{})});
 const update=()=>{for(const key of ['threshold','ratio','knee','makeup'])s[key]=form.elements[key].value===''?NaN:Number(form.elements[key].value);s.scope=form.elements.scope.value;try{if(!form.checkValidity())throw Error('Enter valid dynamics settings.');if(s.scope==='selected'&&!settings.selectedIds?.length)throw Error('Select notes in the piano roll first.');const edits=velocityDynamicsEdits(region,values()),byId=new Map(region.notes.map(n=>[n.id,n])),changed=edits.filter(e=>Math.abs(e.velocity-byId.get(e.id).velocity)>1e-9).length;preview.textContent=`${changed} of ${edits.length} notes will change.`;button.disabled=!changed;}catch(e){preview.textContent=e.message;button.disabled=true;}};
 form.oninput=update;form.onchange=update;form.onsubmit=guard(e=>{e.preventDefault();update();if(!button.disabled)execute([{op:'notes.velocityDynamics',target:region.id,values:values()}],'Applied MIDI velocity dynamics');});update();
}
