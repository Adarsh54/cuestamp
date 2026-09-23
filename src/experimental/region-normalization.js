import {z} from 'zod';
export const regionNormalizationSettings=z.object({mode:z.enum(['peak','rms']),targetDb:z.number().finite().min(-60).max(0),ceilingDb:z.number().finite().min(-60).max(0)}).strict();
export function normalizationSource(session,regionId){const track=session.tracks.find(t=>t.regions.some(r=>r.id===regionId)),region=track?.regions.find(r=>r.id===regionId);if(track?.kind!=='audio'||!region?.assetId)throw Error('Select an audio region with a source file.');if(track.protected)throw Error('Unprotect the track before normalizing.');return region;}
const measuredDb=z.number().finite().min(-1000).max(1000).nullable();
export const regionLevelSchema=z.object({sessionId:z.string(),revision:z.number().int().nonnegative(),regionId:z.string(),peakDb:measuredDb,rmsDb:measuredDb}).strict();
export function regionNormalizationPlan(session,measurement,settings){
 const m=regionLevelSchema.parse(measurement),v=regionNormalizationSettings.parse(settings);
 if(m.sessionId!==session.id||m.revision!==session.revision)throw Error('The region changed. Measure again before normalizing.');
 const region=normalizationSource(session,m.regionId);
 if(m.peakDb===null||m.rmsDb===null)throw Error('Silent audio cannot be normalized.');
 if(m.rmsDb>m.peakDb+1e-6)throw Error('Invalid region level measurement.');
 const requested=v.targetDb-(v.mode==='peak'?m.peakDb:m.rmsDb),gainDb=v.mode==='rms'?Math.min(requested,v.ceilingDb-m.peakDb):requested;
 if(gainDb< -96||gainDb>12)throw Error('The target needs region gain outside −96 to +12 dB. Choose a closer target.');
 return {regionId:region.id,gainDb,deltaDb:gainDb-region.gainDb,peakDb:m.peakDb+gainDb,rmsDb:m.rmsDb+gainDb,limited:gainDb<requested-1e-9};
}
export function regionLevelsFromChannels(session,regionId,channels){
 if(!channels.length)throw Error('No measured channels.');
 const peak=Math.max(...channels.map(c=>c.peakDb??-Infinity)),power=channels.reduce((sum,c)=>sum+(c.rmsDb===null?0:10**(c.rmsDb/10)),0)/channels.length;
 return regionLevelSchema.parse({sessionId:session.id,revision:session.revision,regionId,peakDb:Number.isFinite(peak)?peak:null,rmsDb:power?10*Math.log10(power):null});
}
const format=v=>v===null?'Silence':v.toFixed(2)+' dBFS';
export function regionNormalizationView(region,kind,busy,measurement){if(!region||kind!=='audio')return '';return `<details data-region-normalization><summary>Normalize region gain</summary><button data-measure-region ${busy?'disabled':''}>Measure region</button>${measurement?`<p>Source peak ${format(measurement.peakDb)} · RMS ${format(measurement.rmsDb)}</p><form data-normalize-region><label>Method<select name="mode"><option value="peak">Sample peak</option><option value="rms">Average level · RMS</option></select></label><label>Target · dBFS<input name="targetDb" type="number" min="-60" max="0" step="any" value="-1" required></label><label>RMS peak ceiling · dBFS<input name="ceilingDb" type="number" min="-60" max="0" step="any" value="-1" required></label><output data-region-normalize-plan></output><button ${busy?'disabled':''}>Apply region gain</button></form>`:''}<p class="muted">Measures the trimmed source before region gain, fades, effects and mixing. Changes only region gain; source audio stays intact. RMS is not LUFS, and sample peaks are not true peaks. The ceiling applies to RMS normalization before later processing.</p></details>`;}
export function bindRegionNormalization(root,{session,measurement,run,guard,busy}){const form=root.querySelector('[data-normalize-region]');if(!form)return;const settings=()=>Object.fromEntries(['mode','targetDb','ceilingDb'].map(k=>[k,k==='mode'?form.elements[k].value:form.elements[k].value.trim()?Number(form.elements[k].value):NaN]));
 const update=()=>{form.elements.ceilingDb.disabled=form.elements.mode.value==='peak';try{const p=regionNormalizationPlan(session,measurement,settings());form.querySelector('output').textContent=`Region gain ${p.gainDb.toFixed(2)} dB · peak ${p.peakDb.toFixed(2)} dBFS · RMS ${p.rmsDb.toFixed(2)} dBFS${p.limited?' · Limited by peak ceiling':''}`;form.querySelector('button').disabled=busy||Math.abs(p.deltaDb)<1e-6;}catch(error){form.querySelector('output').textContent=error.message;form.querySelector('button').disabled=true;}};
 form.oninput=update;form.elements.mode.onchange=()=>{form.elements.targetDb.value=form.elements.mode.value==='rms'?'-18':'-1';update();};form.onsubmit=guard(e=>{e.preventDefault();run(regionNormalizationPlan(session,measurement,settings()));});update();
}
export const regionNormalizationActionSchema=z.object({operation:z.enum(['measure','apply']),regionId:z.string().min(1).max(100).nullable(),settings:regionNormalizationSettings}).strict();
export function prepareRegionNormalization(session,value,context){const action=regionNormalizationActionSchema.parse(value);if(!context||context.sessionId!==session.id||context.revision!==session.revision)throw Error('Normalization context does not match the session.');const region=normalizationSource(session,action.regionId??context.regionId);return {...action,regionId:region.id};}
