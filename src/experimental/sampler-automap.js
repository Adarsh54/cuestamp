import {filenameMapPlan} from './sampler-filename-map.js';
import {z} from 'zod';
const midi=z.number().int().min(0).max(127);
const mappingSchema=z.object({mode:z.enum(['roots','chromatic','velocity']),zoneIds:z.string().max(16000),low:midi,high:midi,roots:z.string().max(20000).optional()}).strict();
// Root mapping keeps existing performance layers independent. Identical roots
// remain layers instead of arbitrarily assigning one sample an empty range.
export function automapSamplerZones(zones,values){
 const v=mappingSchema.parse(values);let ids;try{ids=JSON.parse(v.zoneIds);}catch{throw Error('Choose sample zones as a JSON list of IDs.');}
 ids=z.array(z.string().min(1).max(100)).min(1).max(128).parse(ids);
 if(new Set(ids).size!==ids.length)throw Error('Choose each sample zone once.');
 if(v.low>v.high||v.mode==='velocity'&&v.low<1)throw Error('Choose a valid mapping range.');
 let overrides=new Map();if(v.roots!==undefined){if(v.mode!=='roots')throw Error('Root overrides require root-pitch mapping.');let rows;try{rows=JSON.parse(v.roots);}catch{throw Error('Invalid root mapping JSON.');}rows=z.array(z.object({id:z.string().min(1).max(100),root:midi}).strict()).max(128).parse(rows);overrides=new Map(rows.map(row=>[row.id,row.root]));if(rows.length!==ids.length||overrides.size!==ids.length||ids.some(id=>!overrides.has(id)))throw Error('Supply exactly one root for every selected zone.');}
 const selected=ids.map(id=>{const zone=zones.find(z=>z.id===id);if(!zone)throw Error('A selected sample zone no longer exists.');return overrides.has(id)?{...zone,root:overrides.get(id)}:zone;});
 const changes=new Map(),buckets=new Map();
 if(v.mode==='chromatic'){
  if(selected.length>v.high-v.low+1)throw Error('There are more zones than available keys.');
  selected.forEach((zone,i)=>changes.set(zone.id,{keyLow:v.low+i,keyHigh:v.low+i,root:v.low+i}));
 }else{
  for(const zone of selected){const key=JSON.stringify(v.mode==='roots'?[zone.groupId,zone.articulationId,zone.velocityLow,zone.velocityHigh]:[zone.groupId,zone.articulationId,zone.keyLow,zone.keyHigh]);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(zone);}
  for(const bucket of buckets.values()){
   if(v.mode==='roots'){
    const roots=[...new Set(bucket.map(z=>z.root))].sort((a,b)=>a-b);
    if(roots.some(root=>root<v.low||root>v.high))throw Error('The key range must include every selected root note.');
    for(const zone of bucket){const i=roots.indexOf(zone.root);changes.set(zone.id,{...(overrides.has(zone.id)?{root:zone.root}:{}),keyLow:i?Math.floor((roots[i-1]+zone.root)/2)+1:v.low,keyHigh:i<roots.length-1?Math.floor((zone.root+roots[i+1])/2):v.high});}
   }else{
    const count=v.high-v.low+1;if(bucket.length>count)throw Error('There are more zones than available velocities.');
    bucket.forEach((zone,i)=>changes.set(zone.id,{velocityLow:v.low+Math.floor(i*count/bucket.length),velocityHigh:v.low+Math.floor((i+1)*count/bucket.length)-1}));
   }
  }
 }
 return zones.map(zone=>changes.has(zone.id)?{...zone,...changes.get(zone.id)}:zone);
}
export function samplerAutomapView(zones,esc){if(!zones.length)return '';return `<form data-sampler-automap><fieldset><legend>Map multiple zones</legend><label>Mapping<select name="mode"><option value="roots">Spread by root pitch</option><option value="filenames">Read roots from filenames</option><option value="chromatic">Consecutive keys</option><option value="velocity">Velocity layers</option></select></label><label data-filename-convention hidden>Octave convention<select name="middleC"><option value="4">C4 = MIDI 60</option><option value="3">C3 = MIDI 60</option></select></label><output data-filename-roots hidden aria-live="polite"></output><div class="button-row"><label>From<input name="low" type="number" min="0" max="127" value="0" required></label><label>Through<input name="high" type="number" min="0" max="127" value="127" required></label></div><div class="button-row"><button type="button" data-map-select="all">Select all</button><button type="button" data-map-select="none">Clear selection</button></div><div class="daw-map-zone-list">${zones.map(z=>`<label><input type="checkbox" name="zoneIds" value="${esc(z.id)}" checked> ${esc(z.name)}</label>`).join('')}</div><p class="muted" data-map-help></p><small class="muted">Only selected zones change. Unselected zones can still overlap.</small><button>Map selected zones</button></fieldset></form>`;}
export function bindSamplerAutomap(root,{track,files,execute,guard}){
 const form=root.querySelector('[data-sampler-automap]');if(!form)return;const f=form.elements,mode=f.namedItem('mode'),low=f.namedItem('low'),high=f.namedItem('high'),middleC=f.namedItem('middleC'),output=form.querySelector('[data-filename-roots]');
 const ids=()=>[...form.querySelectorAll('[name=zoneIds]:checked')].map(input=>input.value),options=()=>({trackId:track.id,zoneIds:ids(),middleC:Number(middleC.value),low:Number(low.value),high:Number(high.value)});
 const preview=()=>{output.hidden=mode.value!=='filenames';if(output.hidden)return;try{const plan=filenameMapPlan(track,files,options());output.textContent=plan.rows.map(r=>`${r.filename} → MIDI ${r.root}`).join('\n');output.dataset.valid='true';}catch(error){output.textContent=error.message;output.dataset.valid='false';}};
 const explain=()=>{form.querySelector('[data-filename-convention]').hidden=mode.value!=='filenames';form.querySelector('[data-map-help]').textContent=mode.value==='roots'?'Fill the key range around existing roots. Each group, articulation and velocity range is mapped separately; equal roots stay layered.':mode.value==='filenames'?'Read note labels such as C4, F#3 or midi60 from the original filenames, then spread by root pitch. Check the interpreted MIDI notes above before applying.':mode.value==='chromatic'?'Assign one key per selected zone in the order shown. Root pitch moves with it so each sample plays at its original pitch.':'Divide velocities evenly in the order shown, separately for each group, articulation and key range. Sample roots stay unchanged.';preview();};
 mode.onchange=()=>{low.min=mode.value==='velocity'?'1':'0';low.value=mode.value==='velocity'?'1':'0';high.value='127';explain();};explain();
 form.addEventListener('input',preview);form.addEventListener('change',preview);
 for(const button of form.querySelectorAll('[data-map-select]'))button.onclick=()=>{for(const input of form.querySelectorAll('[name=zoneIds]'))input.checked=button.dataset.mapSelect==='all';preview();};
 form.onsubmit=guard(e=>{e.preventDefault();const commands=mode.value==='filenames'?filenameMapPlan(track,files,options()).commands:[{op:'samplerZone.automap',target:track.id,values:{mode:mode.value,zoneIds:JSON.stringify(ids()),low:Number(low.value),high:Number(high.value)}}];execute(commands,'Mapped sample zones');});
}
