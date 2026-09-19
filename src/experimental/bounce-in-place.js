import {audibleAssets} from './media-refs.js';
import {routedTail} from './routing.js';
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
export function trackBouncePlan(session,trackId){
 const source=session.tracks.find(t=>t.id===trackId);
 if(!source||!['audio','midi'].includes(source.kind))throw Error('Select an audio or instrument track to bounce in place.');
 if(source.mute)throw Error('Unmute the track before bouncing it in place.');
 if(session.tracks.length>=128)throw Error('Bouncing in place needs room for a new audio track.');
 const document=structuredClone(session),track=document.tracks.find(t=>t.id===source.id);track.regions=track.regions.filter(r=>!r.mute);
 if(!track.regions.length)throw Error('Add an unmuted region before bouncing this track.');
 track.gainDb=0;track.pan=0;track.automation=[];track.sends=[];track.output=null;track.mute=false;track.solo=false;
 document.tracks=[track];document.masterDb=0;document.masterPan=0;document.masterAutomation=[];document.masterEffects=[];
 const start=Math.min(...track.regions.map(r=>r.start)),duration=Math.max(...track.regions.map(r=>r.start+r.duration))+routedTail(document,track)-start,name=source.name.slice(0,185)+' bounced';
 if(duration>600)throw Error('Experimental offline bounce currently supports up to 10 minutes.');
 return {title:session.title,position:start,duration,entries:[{name:name+'.wav',document}],zip:false,assets:audibleAssets(document),sourceTrackId:source.id,start,name,trackBounce:true};
}
const commitOptions=z.object({assetId:z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),duration:z.number().finite().positive().max(600.001)}).strict();
export function bouncedRegionTrack(session,regionId,values){return bouncedTrack(session,regionBouncePlan(session,regionId),values);}
export function bouncedWholeTrack(session,trackId,values){return bouncedTrack(session,trackBouncePlan(session,trackId),values);}
function bouncedTrack(session,plan,values){
 const v=commitOptions.parse(values),source=session.tracks.find(t=>t.id===plan.sourceTrackId);
 // A rendered frame can extend the requested duration by at most one sample.
 if(v.duration+1e-9<plan.duration||v.duration-plan.duration>1/44100+1e-9)throw Error('The bounced duration does not match the source. Render it again.');
 const track=duplicateTrack(source,{name:plan.name,includeRegions:false});track.kind='audio';track.sampleAssetId=null;track.effects=[];
 track.regions=[{id:crypto.randomUUID(),name:plan.name,assetId:v.assetId,start:plan.start,offset:0,duration:v.duration,gainDb:0,fadeIn:0,fadeOut:0,fadeInShape:'linear',fadeOutShape:'linear',reverse:false,mute:false,notes:[],events:[]}];
 return {track,sourceTrackId:source.id};
}
export function bounceInPlaceView(region,kind,busy){return region&&['audio','midi'].includes(kind)?`<section class="daw-bounce-in-place"><h4>Render to audio</h4><button data-bounce-in-place ${busy||region.mute?'disabled':''}>Bounce in place</button><p class="muted">Creates an audio track below this one and mutes the original region. Instruments, region edits and insert effects are baked in; volume, pan, sends and routing stay editable. Includes effect tails. Undo restores the original.</p></section>`:'';}

export const bounceRegionActionSchema=z.object({regionId:z.string().min(1).max(100).nullable(),sampleRate:z.union([z.literal(44100),z.literal(48000),z.literal(96000)]).nullable()}).strict();
export function prepareRegionBounce(session,value,context){const action=bounceRegionActionSchema.parse(value);if(!context||context.sessionId!==session.id||context.revision!==session.revision)throw Error('Bounce context does not match the session.');const sampleRate=action.sampleRate??context.settings.sampleRate;if(![44100,48000,96000].includes(sampleRate))throw Error('Choose a supported sample rate.');const plan=regionBouncePlan(session,action.regionId??context.regionId);validateRegionBounceSize(plan,sampleRate);return {plan,sampleRate};}

export function validateRegionBounceSize(plan,sampleRate){if(Math.ceil(plan.duration*sampleRate)*8+56>250*1024*1024)throw Error('The bounced audio would exceed the 250 MB playback limit. Choose a lower sample rate or a shorter source range.');}

export function trackBounceInPlaceView(track,busy){return track&&['audio','midi'].includes(track.kind)?`<section class="daw-track-bounce-in-place"><h4>Render entire track</h4><button data-track-bounce-in-place ${busy||track.mute||!track.regions.some(r=>!r.mute)?'disabled':''}>Bounce track in place</button><p class="muted">Combines all unmuted regions into one stereo audio file, including gaps, instruments and insert effects. Creates a new audio track and mutes this source track. Volume, pan, automation, sends and output routing stay editable. Originals remain available; one undo restores them. Uses the export sample rate and 32-bit float, without normalization.</p></section>`:'';}
export const bounceTrackActionSchema=z.object({trackId:z.string().min(1).max(100),sampleRate:z.union([z.literal(44100),z.literal(48000),z.literal(96000)]).nullable()}).strict();
export function prepareTrackBounce(session,value,context){const action=bounceTrackActionSchema.parse(value);if(!context||context.sessionId!==session.id||context.revision!==session.revision)throw Error('Bounce context does not match the session.');const sampleRate=action.sampleRate??context.settings.sampleRate;if(![44100,48000,96000].includes(sampleRate))throw Error('Choose a supported sample rate.');const plan=trackBouncePlan(session,action.trackId);validateRegionBounceSize(plan,sampleRate);return {plan,sampleRate};}
