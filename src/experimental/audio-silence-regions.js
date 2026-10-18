import {stemSession,routedTail} from './routing.js';
import {effectTail} from './effects.js';
import {silenceOptionsSchema} from './audio-silence.js';
import {z} from 'zod';
import {duplicateTrack} from './duplicate-track.js';
import {trimmedRegion} from './region-edit.js';
const rangesSchema=z.array(z.object({start:z.number().finite().nonnegative(),end:z.number().finite().positive()}).strict()).min(1).max(1000);
export function silenceRegionSource(session,regionId,{preview=false}={}){
 const track=session.tracks.find(t=>t.regions.some(r=>r.id===regionId)),region=track?.regions.find(r=>r.id===regionId);
 if(track?.kind!=='audio'||!region?.assetId)throw Error('Select an audio region with a source file.');
 if(track.protected&&!preview)throw Error('Unprotect the track before removing silence.');
 if(region.mute)throw Error('Unmute the region before removing silence.');
 if(session.tracks.length>=128&&!preview)throw Error('Removing silence needs room for a new audio track.');
 return {track,region};
}
export function silenceRegionTrack(session,regionId,values,options={}){
 const {ranges:json,edgeFade}=z.object({edgeFade:z.number().finite().min(0).max(.1).default(0),ranges:z.string().max(100000)}).strict().parse(values),ranges=rangesSchema.parse(JSON.parse(json)),{track,region}=silenceRegionSource(session,regionId,options);
 let previous=0;for(const range of ranges){if(range.end<=range.start||range.start<previous||range.end>region.duration)throw Error('Retained ranges must be ordered, non-overlapping and inside the region.');previous=range.end;}
 if(ranges.length===1&&ranges[0].start===0&&ranges[0].end===region.duration)throw Error('No silence to remove at these settings.');
 const copy=duplicateTrack(track,{name:region.name.slice(0,180)+' stripped',includeRegions:false});
 copy.regions=ranges.map((range,i)=>{
  const trimmed=trimmedRegion(region,region.start+range.start,region.start+range.end),keepIn=range.start===0,keepOut=range.end===region.duration;
  let fadeIn=keepIn?Math.min(region.fadeIn,trimmed.duration):0,fadeOut=keepOut?Math.min(region.fadeOut,trimmed.duration-fadeIn):0;
  const available=Math.max(0,trimmed.duration-fadeIn-fadeOut),newEdges=Number(!keepIn)+Number(!keepOut),cutFade=newEdges?Math.min(edgeFade,available/newEdges):0;
  if(!keepIn)fadeIn=cutFade;if(!keepOut)fadeOut=cutFade;
  return {...structuredClone(region),...trimmed,id:crypto.randomUUID(),name:region.name.slice(0,180)+' '+(i+1),notes:[],events:[],fadeIn,fadeOut,fadeInShape:keepIn?region.fadeInShape:'linear',fadeOutShape:keepOut?region.fadeOutShape:'linear'};
 });
 for(const r of copy.regions)delete r.takeGroup;
 return {track:copy,sourceTrackId:track.id};
}

export function silenceAudition(session,preview){
 if(!preview||preview.sessionId!==session.id||preview.revision!==session.revision)throw Error('The session changed. Preview silence removal again.');
 const {track:source,region}=silenceRegionSource(session,preview.regionId,{preview:true});if(source.mute)throw Error('Unmute the source track before listening.');
 const {track}=silenceRegionTrack(session,preview.regionId,{ranges:JSON.stringify(preview.ranges),edgeFade:preview.settings.edgeFade??0},{preview:true});
 const snapshot=structuredClone(session);snapshot.tracks.find(t=>t.id===source.id).regions.find(r=>r.id===region.id).mute=true;
 snapshot.tracks.push(track);const document=stemSession(snapshot,track);document.loopEnabled=false;document.metronomeEnabled=false;
 return {kind:'audioRange',silencePreview:true,document,position:region.start,end:Math.min(86400,region.start+region.duration+routedTail(document,track)+effectTail(document.masterEffects,document.masterAutomationMode==='off')),label:'Listening to silence removal. Project unchanged.'};
}

export function silenceRegionsView(region,kind,busy,preview,playing=false){
 if(!region||kind!=='audio')return '';
 const valid=preview?.regionId===region.id,settings=valid?preview.settings:{edgeFade:.005,thresholdDb:-40,minimumGap:.1,preRoll:.01,postRoll:.05},ranges=valid?preview.ranges:null,noChange=ranges?.length===1&&ranges[0].start===0&&ranges[0].end===region.duration;
 return `<details data-strip-silence-panel ${valid?'open':''}><summary>Strip silence</summary><form data-strip-silence>${[['thresholdDb','Threshold · dBFS',-120,0,.5],['minimumGap','Minimum quiet gap · seconds',.001,60,.001],['preRoll','Keep before sound · seconds',0,10,.001],['postRoll','Keep after sound · seconds',0,10,.001],['edgeFade','Fade new cuts · seconds',0,.1,.001]].map(([name,label,min,max,step])=>`<label>${label}<input name="${name}" type="number" min="${min}" max="${max}" step="${step}" value="${settings[name]??0}" required></label>`).join('')}<button ${busy||region.mute?'disabled':''}>Preview silence removal</button></form>${ranges?`<div data-silence-preview><p>${noChange?'No silence to remove at these settings.':ranges.length?`${ranges.length} retained regions`:'No sound above this threshold. Original kept.'}</p><svg role="img" aria-label="Retained audio ranges; gaps will be removed" viewBox="0 0 1000 32" width="100%" height="32"><rect width="1000" height="32" fill="currentColor" opacity=".1"/>${ranges.map(r=>`<rect x="${r.start/region.duration*1000}" y="3" width="${(r.end-r.start)/region.duration*1000}" height="26" fill="currentColor"/>`).join('')}</svg><button data-listen-silence ${busy||!ranges.length||noChange?'disabled':''}>${playing?'Stop silence preview':'Listen to cuts'}</button><button data-apply-silence ${busy||!ranges.length||noChange?'disabled':''}>Apply silence removal</button></div>`:''}<p class="muted">Analyzes source audio before fades, gain and effects. Quiet gaps stay in their timeline positions. Creates a new track and mutes the original region; no source audio is deleted. New cuts receive adjustable linear fades, shortened to fit small regions. Existing outer fades stay intact. Zero disables new fades; source samples remain unchanged.</p></details>`;
}

export const silenceActionSchema=z.object({operation:z.enum(['preview','apply','audition']),regionId:z.string().min(1).max(100).nullable(),settings:silenceOptionsSchema}).strict();
export function prepareSilenceAction(session,value,context){
 const action=silenceActionSchema.parse(value);
 if(!context||context.sessionId!==session.id||context.revision!==session.revision)throw Error('Silence context does not match the session.');
 const {region}=silenceRegionSource(session,action.regionId??context.regionId,{preview:action.operation!=='apply'});
 return {...action,regionId:region.id};
}
