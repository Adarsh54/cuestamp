import {z} from 'zod';
const marker=z.object({name:z.string().max(200),time:z.number().finite().min(0).max(86400)}).strict();
export function importedMarkers(session,values){
 const v=z.object({markers:z.string().max(1024*1024),start:z.number().finite().min(0).max(86400).default(0)}).strict().parse(values);
 const source=z.array(marker).max(1000).parse(JSON.parse(v.markers)),seen=new Set(session.markers.map(m=>JSON.stringify([m.time,m.name]))),result=[];
 for(const m of source){const time=m.time+v.start;if(time>86400)throw Error('Imported marker exceeds the 24-hour timeline.');const key=JSON.stringify([time,m.name]);if(seen.has(key))continue;seen.add(key);result.push({id:crypto.randomUUID(),name:m.name,time});}
 if(session.markers.length+result.length>1000)throw Error('Import would exceed the 1,000-marker limit.');return result;
}
