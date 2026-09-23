import {z} from 'zod';
import {orderedSelectedRegions} from './region-selection.js';
const options=z.object({regionIds:z.string().min(1).max(101000),position:z.number().finite().min(0).max(86400).optional(),gap:z.number().finite().min(0).max(86400).default(0),order:z.enum(['timeline','selection']).default('timeline')}).strict();
export function sequencedRegions(session,values){
 const v=options.parse(values),regions=orderedSelectedRegions(session,v.regionIds.split(','),v.order);
 let position=v.position??Math.min(...regions.map(r=>r.start));
 return regions.map(region=>{const start=position;if(start>86400)throw Error('Sequencing would place a region beyond the 24-hour start limit.');position+=region.duration+v.gap;return {id:region.id,start};});
}
export function regionSequenceView(ids,disabled=false){return ids.length>1?`<form data-region-sequence class="daw-region-group"><strong>Sequence selected regions</strong><label>Order<select name="order"><option value="timeline">Timeline order</option><option value="selection">Selection order</option></select></label><label>Begin at<select name="anchor"><option value="earliest">Earliest selected region</option><option value="playhead">Playhead</option></select></label><label>Gap · seconds<input name="gap" type="number" min="0" max="86400" step="any" value="0" required></label><button ${disabled?'disabled':''}>Sequence regions</button><small>Place clips end to end across their existing tracks. Timeline ties use track order. Selection order follows the order you selected clips. Unselected clips and track automation stay in place.</small></form>`:'';}
export function bindRegionSequence(root,{ids,getPosition,execute,guard,blocked=()=>false}){
 const form=root.querySelector('[data-region-sequence]');if(!form)return;
 form.onsubmit=guard(event=>{event.preventDefault();if(blocked())throw Error('Finish the current operation before sequencing regions.');const data=new FormData(form);execute([{op:'regions.sequence',values:{regionIds:ids.join(','),gap:Number(data.get('gap')),order:data.get('order'),...(data.get('anchor')==='playhead'?{position:getPosition()}: {})}}],'Sequenced selected regions');});
}
