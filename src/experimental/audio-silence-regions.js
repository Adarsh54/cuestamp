import {silenceOptionsSchema} from './audio-silence.js';
import {z} from 'zod';
import {duplicateTrack} from './duplicate-track.js';
import {trimmedRegion} from './region-edit.js';
const rangesSchema=z.array(z.object({start:z.number().finite().nonnegative(),end:z.number().finite().positive()}).strict()).min(1).max(1000);
export function silenceRegionSource(session,regionId){
 const track=session.tracks.find(t=>t.regions.some(r=>r.id===regionId)),region=track?.regions.find(r=>r.id===regionId);
 if(track?.kind!=='audio'||!region?.assetId)throw Error('Select an audio region with a source file.');
 if(track.protected)throw Error('Unprotect the track before removing silence.');
 if(region.mute)throw Error('Unmute the region before removing silence.');
 if(session.tracks.length>=128)throw Error('Removing silence needs room for a new audio track.');
 return {track,region};
}
export function silenceRegionTrack(session,regionId,values){
 const {ranges:json}=z.object({ranges:z.string().max(100000)}).strict().parse(values),ranges=rangesSchema.parse(JSON.parse(json)),{track,region}=silenceRegionSource(session,regionId);
 let previous=0;for(const range of ranges){if(range.end<=range.start||range.start<previous||range.end>region.duration)throw Error('Retained ranges must be ordered, non-overlapping and inside the region.');previous=range.end;}
 if(ranges.length===1&&ranges[0].start===0&&ranges[0].end===region.duration)throw Error('No silence to remove at these settings.');
 const copy=duplicateTrack(track,{name:region.name.slice(0,180)+' stripped',includeRegions:false});
 copy.regions=ranges.map((range,i)=>{const trimmed=trimmedRegion(region,region.start+range.start,region.start+range.end);return {...structuredClone(region),...trimmed,id:crypto.randomUUID(),name:region.name.slice(0,180)+' '+(i+1),notes:[],events:[],fadeIn:range.start===0?Math.min(region.fadeIn,trimmed.duration):0,fadeOut:range.end===region.duration?Math.min(region.fadeOut,trimmed.duration-(range.start===0?Math.min(region.fadeIn,trimmed.duration):0)):0};});
 for(const r of copy.regions)delete r.takeGroup;
 return {track:copy,sourceTrackId:track.id};
}

export function silenceRegionsView(region,kind,busy,preview){
 if(!region||kind!=='audio')return '';
 const valid=preview?.regionId===region.id,settings=valid?preview.settings:{thresholdDb:-40,minimumGap:.1,preRoll:.01,postRoll:.05},ranges=valid?preview.ranges:null,noChange=ranges?.length===1&&ranges[0].start===0&&ranges[0].end===region.duration;
 return `<details data-strip-silence-panel ${valid?'open':''}><summary>Strip silence</summary><form data-strip-silence>${[['thresholdDb','Threshold · dBFS',-120,0,.5],['minimumGap','Minimum quiet gap · seconds',.001,60,.001],['preRoll','Keep before sound · seconds',0,10,.001],['postRoll','Keep after sound · seconds',0,10,.001]].map(([name,label,min,max,step])=>`<label>${label}<input name="${name}" type="number" min="${min}" max="${max}" step="${step}" value="${settings[name]}" required></label>`).join('')}<button ${busy||region.mute?'disabled':''}>Preview silence removal</button></form>${ranges?`<div data-silence-preview><p>${noChange?'No silence to remove at these settings.':ranges.length?`${ranges.length} retained regions`:'No sound above this threshold. Original kept.'}</p><svg role="img" aria-label="Retained audio ranges; gaps will be removed" viewBox="0 0 1000 32" width="100%" height="32"><rect width="1000" height="32" fill="currentColor" opacity=".1"/>${ranges.map(r=>`<rect x="${r.start/region.duration*1000}" y="3" width="${(r.end-r.start)/region.duration*1000}" height="26" fill="currentColor"/>`).join('')}</svg><button data-apply-silence ${busy||!ranges.length||noChange?'disabled':''}>Apply silence removal</button></div>`:''}<p class="muted">Analyzes source audio before fades, gain and effects. Quiet gaps stay in their timeline positions. Creates a new track and mutes the original region; no source audio is deleted. Keep some sound before and after each cut to avoid abrupt edges.</p></details>`;
}

export const silenceActionSchema=z.object({operation:z.enum(['preview','apply']),regionId:z.string().min(1).max(100).nullable(),settings:silenceOptionsSchema}).strict();
export function prepareSilenceAction(session,value,context){
 const action=silenceActionSchema.parse(value);
 if(!context||context.sessionId!==session.id||context.revision!==session.revision)throw Error('Silence context does not match the session.');
 const {region}=silenceRegionSource(session,action.regionId??context.regionId);
 return {...action,regionId:region.id};
}
