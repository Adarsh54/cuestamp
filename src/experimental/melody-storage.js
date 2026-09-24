import {z} from 'zod';
import {melodySettingsSchema} from './audio-melody.js';
const pitch=z.number().int().min(0).max(127),start=z.number().finite().nonnegative().max(120),duration=z.number().finite().min(.001).max(120),velocity=z.number().finite().min(0).max(1);
const patch=z.object({pitch:pitch.optional(),start:start.optional(),duration:duration.optional(),velocity:velocity.optional(),excluded:z.boolean().optional()}).strict();
export const savedMelodySchema=z.object({version:z.literal(1),source:z.object({assetId:z.string().min(1).max(100),offset:z.number().finite().nonnegative().max(86400),duration:z.number().finite().positive().max(120),reverse:z.boolean()}).strict(),settings:melodySettingsSchema,notes:z.array(z.object({pitch,start,duration,velocity,cents:z.number().finite().min(-100).max(100),confidence:z.number().finite().min(0).max(1)}).strict()).min(1).max(4000),edits:z.record(z.string().regex(/^(0|[1-9]\d{0,3})$/),patch)}).strict().superRefine((v,ctx)=>{
 let end=0;for(const n of v.notes){if(n.start<end-1e-8||n.start+n.duration>v.source.duration+1e-8)ctx.addIssue({code:'custom',message:'Measured melody notes must be ordered and inside the source span.'});end=n.start+n.duration;}
 for(const [key,edit] of Object.entries(v.edits)){const original=v.notes[Number(key)];if(!original){ctx.addIssue({code:'custom',message:'Correction refers to a missing measured note.'});continue;}const n={...original,...edit};if(n.start+n.duration>v.source.duration+1e-8)ctx.addIssue({code:'custom',message:'Corrected melody note exceeds the source span.'});}
});
const sourceOf=region=>({assetId:region.assetId,offset:region.offset,duration:region.duration,reverse:region.reverse});
export function savedMelodyMatches(track,region){return track?.kind==='audio'&&Boolean(region?.melodyDraft)&&Object.entries(sourceOf(region)).every(([key,value])=>region.melodyDraft.source[key]===value);}
export function pruneSavedMelodies(session){for(const track of session.tracks)for(const region of track.regions)if(region.melodyDraft&&!savedMelodyMatches(track,region))delete region.melodyDraft;}
export function melodySaveCommand(session,analysis){
 if(!analysis||analysis.sessionId!==session.id||analysis.revision!==session.revision)throw Error('The melody draft changed. Analyze it again.');
 if(!analysis.notes?.length)throw Error('No measured notes to save.');
 const track=session.tracks.find(t=>t.regions.some(r=>r.id===analysis.regionId)),region=track?.regions.find(r=>r.id===analysis.regionId);
 if(track?.kind!=='audio'||!region?.assetId)throw Error('Choose an audio region with a source file.');
 const saved=savedMelodySchema.parse({version:1,source:sourceOf(region),settings:analysis.settings,notes:analysis.notes,edits:analysis.edits??{}});
 return {op:'region.saveMelody',target:region.id,values:{json:JSON.stringify(saved)}};
}
export function setSavedMelody(track,region,values){const v=z.object({json:z.string().max(2000000)}).strict().parse(values),saved=savedMelodySchema.parse(JSON.parse(v.json));if(!savedMelodyMatches(track,{...region,melodyDraft:saved}))throw Error('Saved melody must match this audio source span.');region.melodyDraft=saved;}
export function restoreMelodyDraft(session,region){const track=session.tracks.find(t=>t.regions.some(r=>r.id===region?.id));if(!savedMelodyMatches(track,region))return null;const saved=savedMelodySchema.parse(region.melodyDraft);return {sessionId:session.id,revision:session.revision,regionId:region.id,token:crypto.randomUUID(),settings:structuredClone(saved.settings),notes:structuredClone(saved.notes),edits:structuredClone(saved.edits),saved:true};}
