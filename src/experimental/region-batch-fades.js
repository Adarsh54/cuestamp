import {z} from 'zod';
import {selectedRegions} from './region-selection.js';
const options=z.object({regionIds:z.string().min(1).max(101000),fadeIn:z.number().finite().min(0).max(86400),fadeOut:z.number().finite().min(0).max(86400),shape:z.enum(['linear','equalPower']).default('linear'),fit:z.enum(['reject','scale']).default('reject')}).strict();
export function batchRegionFades(session,values){
 const v=options.parse(values),regions=selectedRegions(session,v.regionIds.split(','));
 const audioIds=new Set(session.tracks.filter(t=>t.kind==='audio').flatMap(t=>t.regions.map(r=>r.id)));
 if(regions.some(r=>!audioIds.has(r.id)))throw Error('Batch audio fades require only audio regions.');
 return regions.map(r=>{let fadeIn=v.fadeIn,fadeOut=v.fadeOut;const total=fadeIn+fadeOut;
  if(total>r.duration){if(v.fit==='reject')throw Error('Fades exceed a selected clip’s length. Shorten them or choose Scale to fit.');fadeIn=r.duration*(fadeIn/total);fadeOut=r.duration-fadeIn;}
  return {id:r.id,values:{fadeIn,fadeOut,fadeInShape:v.shape,fadeOutShape:v.shape}};
 });
}
export function selectedAudioIds(session,ids){const audio=new Set(session.tracks.filter(t=>t.kind==='audio').flatMap(t=>t.regions.map(r=>r.id)));return ids.filter(id=>audio.has(id));}
export function batchFadesView(session,ids,disabled=false){const audio=selectedAudioIds(session,ids);return ids.length>1&&audio.length?`<form data-batch-fades class="daw-region-group"><strong>Fades · ${audio.length} selected audio clips</strong><label>Fade in · seconds<input name="fadeIn" type="number" min="0" max="86400" step="any" value="0.01" required></label><label>Fade out · seconds<input name="fadeOut" type="number" min="0" max="86400" step="any" value="0.01" required></label><label>Curve<select name="shape"><option value="linear">Linear</option><option value="equalPower">Equal power</option></select></label><label>Short clips<select name="fit"><option value="reject">Require fades to fit</option><option value="scale">Scale to fit</option></select></label><button ${disabled?'disabled':''}>Apply audio fades</button><small>Replaces both fades on selected audio clips. Zero removes a fade. Scale to fit reduces both lengths proportionally for short clips. MIDI and video selections stay unchanged.</small></form>`:'';}
export function bindBatchFades(root,{session,ids,execute,guard,blocked=()=>false}){const form=root.querySelector('[data-batch-fades]');if(!form)return;form.onsubmit=guard(event=>{event.preventDefault();if(blocked())throw Error('Finish the current operation before applying fades.');const data=new FormData(form);execute([{op:'regions.fades',values:{regionIds:selectedAudioIds(session,ids).join(','),fadeIn:Number(data.get('fadeIn')),fadeOut:Number(data.get('fadeOut')),shape:data.get('shape'),fit:data.get('fit')}}],'Applied selected audio fades');});}
