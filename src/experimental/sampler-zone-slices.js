import {samplerZoneSchema} from './sampler-zones.js';
export function samplerSlicePlan(track,draft,markers,startKey,buffer){
 const zone=samplerZoneSchema.parse(draft);
 if(track?.kind!=='midi'||!track.sampleZones?.some(z=>z.id===zone.id))throw Error('Save this sample zone before creating slices.');
 if(!Number.isInteger(startKey)||startKey<0||startKey>127)throw Error('Choose a starting MIDI key from 0 to 127.');
 const rate=buffer.sampleRate,start=Math.ceil(zone.sourceStart*rate-1e-8),end=Math.floor((zone.sourceEnd??buffer.duration)*rate+1e-8);
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>buffer.length||end<=start)throw Error('Choose a sample portion inside the source.');
 if(!Array.isArray(markers)||markers.some(t=>!Number.isFinite(t)||t<0||t>buffer.duration))throw Error('Detect valid source attacks first.');
 const cuts=[...new Set(markers.map(t=>Math.round(t*rate)).filter(f=>f>start&&f<end))].sort((a,b)=>a-b);
 if(!cuts.length)throw Error('No attacks inside the sample selection. Adjust the selection or detection.');
 const edges=[start,...cuts,end],count=edges.length-1;
 if(startKey+count>128)throw Error('There are not enough MIDI keys after the starting key.');
 if(track.sampleZones.length-1+count>128)throw Error('An instrument can contain up to 128 sample zones.');
 const zones=edges.slice(0,-1).map((frame,i)=>samplerZoneSchema.parse({...zone,id:crypto.randomUUID(),name:`${zone.name.slice(0,85)} · Slice ${i+1}`,sourceStart:frame/rate,sourceEnd:edges[i+1]/rate,root:startKey+i,keyLow:startKey+i,keyHigh:startKey+i,loop:false,loopStart:0,loopEnd:null}));
 return {zones,commands:[{op:'samplerZone.delete',target:track.id,values:{id:zone.id}},{op:'samplerZone.addMany',target:track.id,values:{zones:JSON.stringify(zones)}}]};
}
