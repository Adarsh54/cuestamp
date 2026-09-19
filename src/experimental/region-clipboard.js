import {z} from 'zod';
import {selectedRegions} from './region-selection.js';
export const MAX_REGION_CLIPBOARD=10*1024*1024;
export function copyRegionClipboard(session,ids){
 const wanted=new Set(selectedRegions(session,ids).map(r=>r.id)),entries=session.tracks.flatMap(track=>track.regions.filter(r=>wanted.has(r.id)).map(region=>({trackId:track.id,kind:track.kind,region:structuredClone(region)}))),data=JSON.stringify({version:1,sessionId:session.id,entries});
 if(new TextEncoder().encode(data).byteLength>MAX_REGION_CLIPBOARD)throw Error('This selection exceeds the 10 MB region clipboard limit. Copy fewer regions.');return {data,count:entries.length,sessionId:session.id};
}
export function pastedRegions(session,values,regionSchema){
 const v=z.object({data:z.string().max(MAX_REGION_CLIPBOARD),position:z.number().finite().min(0).max(86400)}).strict().parse(values);
 if(new TextEncoder().encode(v.data).byteLength>MAX_REGION_CLIPBOARD)throw Error('This selection exceeds the 10 MB region clipboard limit.');
 const clipboard=z.object({version:z.literal(1),sessionId:z.string(),entries:z.array(z.object({trackId:z.string(),kind:z.enum(['audio','midi','video']),region:regionSchema}).strict()).min(1).max(1000)}).strict().parse(JSON.parse(v.data));
 if(clipboard.sessionId!==session.id)throw Error('The region clipboard belongs to another session. Copy regions from this session first.');
 if(new Set(clipboard.entries.map(e=>e.region.id)).size!==clipboard.entries.length)throw Error('Clipboard regions must be distinct.');
 const anchor=Math.min(...clipboard.entries.map(e=>e.region.start)),counts=new Map();
 for(const entry of clipboard.entries){const track=session.tracks.find(t=>t.id===entry.trackId);if(!track||track.kind!==entry.kind)throw Error('An original destination track is missing or has changed type. Undo that track change before pasting.');counts.set(track.id,(counts.get(track.id)||0)+1);if(track.regions.length+counts.get(track.id)>1000)throw Error('Pasting would exceed the 1,000-region track limit.');if(v.position+entry.region.start-anchor>86400)throw Error('Pasted region starts must stay within 86,400 seconds.');}
 return clipboard.entries.map(({trackId,region})=>({trackId,region:{...region,id:crypto.randomUUID(),start:v.position+region.start-anchor,notes:region.notes.map(n=>({...n,id:crypto.randomUUID()})),events:region.events.map(e=>({...e,id:crypto.randomUUID()}))}}));
}
export function regionClipboardView(count,clipboard,busy){return `<div class="daw-region-clipboard" role="group" aria-label="Region clipboard"><button data-region-copy ${!count||busy?'disabled':''}>Copy regions</button><button data-region-cut ${!count||busy?'disabled':''}>Cut regions</button><button data-region-paste ${!clipboard||busy?'disabled':''}>Paste at playhead</button><small>${clipboard?`${clipboard.count} ${clipboard.count===1?'region':'regions'} copied`:'Select regions to copy or cut'}</small></div>`;}
