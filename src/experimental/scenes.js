import {z} from 'zod';
const ident=z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),name=z.string().trim().min(1).max(100);
export const sceneSchema=z.object({id:ident,name,cells:z.array(z.object({regionId:ident,loop:z.boolean().default(true)}).strict()).max(128).default([])}).strict();
export function validateScenes(session){
 if(!session.scenes?.length)return;
 const regions=new Map(session.tracks.flatMap(track=>track.regions.map(region=>[region.id,{track,region}]))),sceneIds=new Set();
 for(const scene of session.scenes||[]){
  if(sceneIds.has(scene.id))throw Error('Scene IDs must be unique.');sceneIds.add(scene.id);const tracks=new Set();
  for(const cell of scene.cells){const source=regions.get(cell.regionId);if(!source||!['audio','midi'].includes(source.track.kind))throw Error('Scene cells must reference existing audio or MIDI regions.');if(tracks.has(source.track.id))throw Error('A scene can contain only one clip per track.');tracks.add(source.track.id);}
 }
}
// Removing a source removes its scene references in the same undo step.
export function pruneSceneReferences(session){if(!session.scenes?.length)return;const ids=new Set(session.tracks.flatMap(t=>t.regions.map(r=>r.id)));for(const scene of session.scenes)scene.cells=scene.cells.filter(cell=>ids.has(cell.regionId));}
export function editScene(session,op,target,values){
 if(op==='scene.add'){
  const v=z.object({id:ident.optional(),name,regionIds:z.string().max(13000).optional()}).strict().parse(values);
  if(session.scenes.length>=64)throw Error('A project can contain up to 64 scenes.');
  const ids=v.regionIds===undefined?[]:v.regionIds.split(',');if(new Set(ids).size!==ids.length)throw Error('Scene clip IDs must be distinct.');
  session.scenes.push(sceneSchema.parse({id:v.id??crypto.randomUUID(),name:v.name,cells:ids.map(regionId=>({regionId,loop:true}))}));validateScenes(session);return;
 }
 const scene=session.scenes.find(s=>s.id===target);if(!scene)throw Error('Scene not found.');
 if(op==='scene.rename'){const v=z.object({name}).strict().parse(values);scene.name=v.name;}
 else if(op==='scene.delete'){z.object({}).strict().parse(values);session.scenes=session.scenes.filter(s=>s.id!==target);}
 else if(op==='scene.move'){const v=z.object({index:z.number().int().min(0).max(63)}).strict().parse(values);if(v.index>=session.scenes.length)throw Error('Choose an existing scene position.');session.scenes.splice(session.scenes.indexOf(scene),1);session.scenes.splice(v.index,0,scene);}
 else if(op==='scene.cell.set'){
  const v=z.object({regionId:ident,loop:z.boolean().default(true)}).strict().parse(values),track=session.tracks.find(t=>t.regions.some(r=>r.id===v.regionId));
  if(!track||!['audio','midi'].includes(track.kind))throw Error('Choose an audio or MIDI region for this scene.');
  const own=new Set(track.regions.map(r=>r.id)),index=scene.cells.findIndex(c=>own.has(c.regionId));if(index<0)scene.cells.push(v);else scene.cells[index]=v;
 }else if(op==='scene.cell.delete'){const v=z.object({regionId:ident}).strict().parse(values);if(!scene.cells.some(c=>c.regionId===v.regionId))throw Error('Scene cell not found.');scene.cells=scene.cells.filter(c=>c.regionId!==v.regionId);}
 else throw Error('Unknown scene operation.');
 validateScenes(session);
}
