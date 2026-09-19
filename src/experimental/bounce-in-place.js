import {createBouncePlan} from './bounce-plan.js';
import {duplicateTrack} from './duplicate-track.js';
import {z} from 'zod';
export function regionBouncePlan(session,regionId){
 const source=session.tracks.find(t=>t.regions.some(r=>r.id===regionId)),region=source?.regions.find(r=>r.id===regionId);
 if(!region||!['audio','midi'].includes(source.kind))throw Error('Select an audio or MIDI region to bounce in place.');
 if(region.mute)throw Error('Unmute the region before bouncing it in place.');
 if(session.tracks.length>=128)throw Error('Bouncing in place needs room for a new audio track.');
 const document=structuredClone(session),track=document.tracks.find(t=>t.id===source.id);
 // Print only instrument/region/insert processing. The destination retains the
 // channel fader, pan, automation and routing, so they are applied exactly once.
 track.gainDb=0;track.pan=0;track.automation=[];track.sends=[];track.output=null;track.mute=false;track.solo=false;
 document.tracks=[track];document.masterDb=0;document.masterPan=0;document.masterAutomation=[];document.masterEffects=[];
 const plan=createBouncePlan(document,{mode:'region',regionId,masterMode:'bypass'});
 return {...plan,sourceTrackId:source.id,sourceRegionId:region.id,start:region.start,name:region.name.slice(0,185)+' bounced'};
}
const commitOptions=z.object({assetId:z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),duration:z.number().finite().positive().max(600.001)}).strict();
export function bouncedRegionTrack(session,regionId,values){
 const v=commitOptions.parse(values),plan=regionBouncePlan(session,regionId),source=session.tracks.find(t=>t.id===plan.sourceTrackId);
 // A rendered frame can extend the requested duration by at most one sample.
 if(v.duration+1e-9<plan.duration||v.duration-plan.duration>1/44100+1e-9)throw Error('The bounced duration does not match this region. Render it again.');
 const track=duplicateTrack(source,{name:plan.name,includeRegions:false});track.kind='audio';track.sampleAssetId=null;track.effects=[];
 track.regions=[{id:crypto.randomUUID(),name:plan.name,assetId:v.assetId,start:plan.start,offset:0,duration:v.duration,gainDb:0,fadeIn:0,fadeOut:0,fadeInShape:'linear',fadeOutShape:'linear',reverse:false,mute:false,notes:[],events:[]}];
 return {track,sourceTrackId:source.id};
}
export function bounceInPlaceView(region,kind,busy){return region&&['audio','midi'].includes(kind)?`<section class="daw-bounce-in-place"><h4>Render to audio</h4><button data-bounce-in-place ${busy||region.mute?'disabled':''}>Bounce in place</button><p class="muted">Creates an audio track below this one and mutes the original region. Instruments, region edits and insert effects are baked in; volume, pan, sends and routing stay editable. Includes effect tails. Undo restores the original.</p></section>`:'';}

export const bounceRegionActionSchema=z.object({regionId:z.string().min(1).max(100).nullable(),sampleRate:z.union([z.literal(44100),z.literal(48000),z.literal(96000)]).nullable()}).strict();
export function prepareRegionBounce(session,value,context){const action=bounceRegionActionSchema.parse(value);if(!context||context.sessionId!==session.id||context.revision!==session.revision)throw Error('Bounce context does not match the session.');const sampleRate=action.sampleRate??context.settings.sampleRate;if(![44100,48000,96000].includes(sampleRate))throw Error('Choose a supported sample rate.');const plan=regionBouncePlan(session,action.regionId??context.regionId);validateRegionBounceSize(plan,sampleRate);return {plan,sampleRate};}

export function validateRegionBounceSize(plan,sampleRate){if(Math.ceil(plan.duration*sampleRate)*8+56>250*1024*1024)throw Error('The bounced audio would exceed the 250 MB playback limit. Choose a lower sample rate or a shorter region.');}
