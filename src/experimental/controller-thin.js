import {z} from 'zod';
const options=z.object({type:z.enum(['controlChange','pitchBend']),parameter:z.number().int().min(0).max(127).default(0),channel:z.number().int().min(0).max(15).default(0),tolerance:z.number().int().min(0).max(16383).default(0),start:z.number().finite().nonnegative().default(0),end:z.number().finite().nonnegative().optional()}).strict();
export function thinControllerPlan(region,values){
 const v=options.parse(values),end=v.end??region.duration,max=v.type==='pitchBend'?16383:127;
 if(end>region.duration||end<v.start)throw Error('Choose a thinning range inside the region.');
 if(v.tolerance>max)throw Error('Tolerance exceeds this controller’s value range.');
 if(v.type==='pitchBend'&&v.parameter!==0)throw Error('Pitch bend uses parameter 0.');
 if(v.type==='controlChange'&&![1,2,4,7,10,11,64,71,74].includes(v.parameter))throw Error('Choose a supported continuous controller or sustain. RPN and mode messages cannot be thinned.');
 if(v.parameter===64&&v.type==='controlChange'&&v.tolerance!==0)throw Error('Sustain thinning supports exact duplicates only.');
 const matches=e=>e.channel===v.channel&&e.type===v.type&&(v.type==='pitchBend'||e.parameter===v.parameter)&&e.start>=v.start&&e.start<=end;
 const ordered=[...region.events].sort((a,b)=>a.start-b.start),selected=ordered.filter(matches),counts=new Map();for(const e of selected)counts.set(e.start,(counts.get(e.start)||0)+1);
 const removed=new Set();let previous=null,maxDeviation=0;
 for(const e of ordered){
  if(e.channel===v.channel&&e.type==='controlChange'&&e.parameter===121)previous=null;
  if(!matches(e))continue;
  const boundary=e===selected[0]||e===selected.at(-1)||counts.get(e.start)>1||(!(v.type==='controlChange'&&v.parameter===64)&&(e.value===0||e.value===max))||(v.type==='pitchBend'&&e.value===8192);
  const difference=previous===null?Infinity:Math.abs(e.value-previous);
  if(boundary||difference>v.tolerance){previous=e.value;continue;}
  removed.add(e.id);maxDeviation=Math.max(maxDeviation,difference);
 }
 return {events:region.events.filter(e=>!removed.has(e.id)),removed:removed.size,total:selected.length,maxDeviation};
}
export function controllerThinView(lane){return `<details class="daw-controller-thin"><summary>Thin controller data</summary><form data-controller-thin><label>Maximum value difference<input name="tolerance" type="number" min="0" max="${lane.id==='sustain'?0:lane.max}" step="1" value="0" required></label><output data-thin-preview></output><button>Thin this lane</button></form><p class="muted">Zero removes exact repeats. Larger values allow that much difference from the original held controller value. Keeps first/last points, coincident events, endpoints and centered bends. Sustain supports exact repeats only. Other lanes and notes stay unchanged.</p></details>`;}
export function bindControllerThin(root,{region,lane,channel,execute,guard}){
 const form=root.querySelector('[data-controller-thin]');if(!form)return;const button=form.querySelector('button'),preview=form.querySelector('output');
 const values=()=>({type:lane.type,parameter:lane.parameter,channel,tolerance:form.elements.tolerance.value.trim()?Number(form.elements.tolerance.value):NaN});
 const update=()=>{try{const plan=thinControllerPlan(region,values());preview.textContent=`Remove ${plan.removed} of ${plan.total} events · maximum value difference ${plan.maxDeviation}.`;button.disabled=!plan.removed;}catch(error){preview.textContent=error.message;button.disabled=true;}};
 form.oninput=update;form.onsubmit=guard(event=>{event.preventDefault();update();if(!button.disabled)execute([{op:'event.thin',target:region.id,values:values()}],'Thinned MIDI controller data');});update();
}
