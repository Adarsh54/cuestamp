import {z} from 'zod';
import {selectedRegions} from './region-selection.js';
const options=z.object({regionIds:z.string().min(1).max(101000)}).strict();
export function markersFromRegions(session,values){
 const {regionIds}=options.parse(values),regions=selectedRegions(session,regionIds.split(','));
 const seen=new Set(session.markers.map(m=>JSON.stringify([m.time,m.name]))),markers=[];
 for(const region of [...regions].sort((a,b)=>a.start-b.start)){
  const name=region.name.trim()||'Marker',key=JSON.stringify([region.start,name]);
  if(seen.has(key))continue;seen.add(key);markers.push({id:crypto.randomUUID(),name,time:region.start});
 }
 if(!markers.length)throw Error('These regions already have matching markers.');
 if(session.markers.length+markers.length>1000)throw Error('Creating these markers would exceed the 1,000-marker limit.');
 return markers;
}
