import {z} from 'zod';
const midi=z.number().int().min(0).max(127);
const mappingSchema=z.object({mode:z.enum(['roots','chromatic','velocity']),zoneIds:z.string().max(16000),low:midi,high:midi}).strict();
// Root mapping keeps existing performance layers independent. Identical roots
// remain layers instead of arbitrarily assigning one sample an empty range.
export function automapSamplerZones(zones,values){
 const v=mappingSchema.parse(values);let ids;try{ids=JSON.parse(v.zoneIds);}catch{throw Error('Choose sample zones as a JSON list of IDs.');}
 ids=z.array(z.string().min(1).max(100)).min(1).max(128).parse(ids);
 if(new Set(ids).size!==ids.length)throw Error('Choose each sample zone once.');
 if(v.low>v.high||v.mode==='velocity'&&v.low<1)throw Error('Choose a valid mapping range.');
 const selected=ids.map(id=>{const zone=zones.find(z=>z.id===id);if(!zone)throw Error('A selected sample zone no longer exists.');return zone;});
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
    for(const zone of bucket){const i=roots.indexOf(zone.root);changes.set(zone.id,{keyLow:i?Math.floor((roots[i-1]+zone.root)/2)+1:v.low,keyHigh:i<roots.length-1?Math.floor((zone.root+roots[i+1])/2):v.high});}
   }else{
    const count=v.high-v.low+1;if(bucket.length>count)throw Error('There are more zones than available velocities.');
    bucket.forEach((zone,i)=>changes.set(zone.id,{velocityLow:v.low+Math.floor(i*count/bucket.length),velocityHigh:v.low+Math.floor((i+1)*count/bucket.length)-1}));
   }
  }
 }
 return zones.map(zone=>changes.has(zone.id)?{...zone,...changes.get(zone.id)}:zone);
}
export function samplerAutomapView(zones,esc){if(!zones.length)return '';return `<form data-sampler-automap><fieldset><legend>Map multiple zones</legend><label>Mapping<select name="mode"><option value="roots">Spread by root pitch</option><option value="chromatic">Consecutive keys</option><option value="velocity">Velocity layers</option></select></label><div class="button-row"><label>From<input name="low" type="number" min="0" max="127" value="0" required></label><label>Through<input name="high" type="number" min="0" max="127" value="127" required></label></div><div class="button-row"><button type="button" data-map-select="all">Select all</button><button type="button" data-map-select="none">Clear selection</button></div><div class="daw-map-zone-list">${zones.map(z=>`<label><input type="checkbox" name="zoneIds" value="${esc(z.id)}" checked> ${esc(z.name)}</label>`).join('')}</div><p class="muted" data-map-help></p><small class="muted">Only selected zones change. Unselected zones can still overlap.</small><button>Map selected zones</button></fieldset></form>`;}
export function bindSamplerAutomap(root,{track,execute,guard}){const form=root.querySelector('[data-sampler-automap]');if(!form)return;const f=form.elements,mode=f.namedItem('mode'),low=f.namedItem('low'),high=f.namedItem('high');const explain=()=>{form.querySelector('[data-map-help]').textContent=mode.value==='roots'?'Fill the key range around existing roots. Each group, articulation and velocity range is mapped separately; equal roots stay layered.':mode.value==='chromatic'?'Assign one key per selected zone in the order shown. Root pitch moves with it so each sample plays at its original pitch.':'Divide velocities evenly in the order shown, separately for each group, articulation and key range. Sample roots stay unchanged.';};mode.onchange=()=>{low.min=mode.value==='velocity'?'1':'0';low.value=mode.value==='velocity'?'1':'0';high.value='127';explain();};explain();for(const button of form.querySelectorAll('[data-map-select]'))button.onclick=()=>{for(const input of form.querySelectorAll('[name=zoneIds]'))input.checked=button.dataset.mapSelect==='all';};form.onsubmit=guard(e=>{e.preventDefault();const ids=[...form.querySelectorAll('[name=zoneIds]:checked')].map(input=>input.value);execute([{op:'samplerZone.automap',target:track.id,values:{mode:mode.value,zoneIds:JSON.stringify(ids),low:Number(low.value),high:Number(high.value)}}],'Mapped sample zones');});}
