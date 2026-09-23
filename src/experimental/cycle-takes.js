import {z} from 'zod';
import {duplicateTrack} from './duplicate-track.js';
import {trimmedRegion} from './region-edit.js';
const settings=z.object({duration:z.number().finite().min(.01).max(600),start:z.number().finite().min(0).max(86400),edgeFade:z.number().finite().min(0).max(.1).default(.005)}).strict();
export function cycleTakesPlan(session,regionId,values){
 const v=settings.parse(values),source=session.tracks.find(t=>t.regions.some(r=>r.id===regionId)),region=source?.regions.find(r=>r.id===regionId);
 if(source?.kind!=='audio'||!region?.assetId)throw Error('Choose an audio recording with source media.');
 if(source.protected)throw Error('Unprotect the track before splitting takes.');
 if(region.mute)throw Error('Select an audible recording before splitting takes.');
 if(session.tracks.length>=128)throw Error('Take splitting needs room for another track.');
 const ratio=region.duration/v.duration,rounded=Math.round(ratio),exact=Math.abs(ratio-rounded)<1e-9,count=exact?rounded:Math.ceil(ratio),complete=exact?rounded:Math.floor(ratio);
 if(count<2||count>64)throw Error('Choose a pass duration that produces between 2 and 64 takes.');
 if(v.start+Math.min(region.duration,v.duration)>86400)throw Error('Takes exceed the timeline limit.');
 return {source,region,...v,count,complete,selectedIndex:Math.max(0,complete-1)};
}
export function createCycleTakes(session,regionId,values){
 const plan=cycleTakesPlan(session,regionId,values),copy=duplicateTrack(plan.source,{name:plan.region.name.slice(0,185)+' takes',includeRegions:false}),groupId=crypto.randomUUID();copy.mute=false;
 copy.regions=Array.from({length:plan.count},(_,index)=>{
  const from=plan.region.start+index*plan.duration,to=Math.min(plan.region.start+plan.region.duration,from+plan.duration),trim=trimmedRegion(plan.region,from,to),id=crypto.randomUUID(),fade=Math.min(plan.edgeFade,trim.duration/2);
  return {...structuredClone(plan.region),...trim,id,start:plan.start,name:`Take ${index+1}${index>=plan.complete?' (partial)':''}`,mute:index!==plan.selectedIndex,fadeIn:fade,fadeOut:fade,fadeInShape:'linear',fadeOutShape:'linear',takeGroup:{id:groupId,takeId:id,name:copy.name}};
 });
 session.tracks.splice(session.tracks.indexOf(plan.source)+1,0,copy);plan.region.mute=true;return copy;
}
export function cycleTakesView(session,region,kind){
 if(kind!=='audio'||!region?.assetId)return '';
 return `<details class="daw-cycle-takes"><summary>Split recording into takes</summary><p class="muted">For a continuous recording of repeated passes. Each pass becomes an aligned take on a new track. The original stays available and is muted.</p><form data-cycle-takes><label>Pass duration · seconds<input name="duration" type="number" min=".01" max="600" step="any" value="${session.loopEnd-session.loopStart}" required></label><label>Place takes at · seconds<input name="start" type="number" min="0" max="86400" step="any" value="${session.loopStart}" required></label><label>Edge fade · seconds<input name="edgeFade" type="number" min="0" max=".1" step="any" value=".005" required></label><button>Split into takes</button></form><small>Splits from the selected region’s beginning. Keeps a partial final pass; selects the last complete take. Supports up to 64 takes.</small></details>`;
}
export function bindCycleTakes(root,{region,execute,guard,onCreated=()=>{}}){const form=root.querySelector('[data-cycle-takes]');if(!form)return;form.onsubmit=guard(event=>{event.preventDefault();execute([{op:'region.cycleTakes',target:region.id,values:Object.fromEntries(['duration','start','edgeFade'].map(key=>[key,form.elements[key].value===''?NaN:Number(form.elements[key].value)]))}],'Split continuous recording into takes');onCreated();});}
