import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
// Stable across JSON imports and property insertion order. This is a content
// comparison, not authentication or a checksum of the original media bytes.
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export function createSceneSourceReader(session){
 const scenes=new Map(session.scenes.map(s=>[s.id,s])),regions=new Map(session.tracks.flatMap(track=>track.regions.map(region=>[region.id,{track,region}])));
 return (sceneId,trackId)=>{
  const scene=scenes.get(sceneId);if(!scene)throw Error('A recorded scene no longer exists.');
  const selected=trackId===undefined?scene.cells:scene.cells.filter(cell=>regions.get(cell.regionId)?.track.id===trackId);
  if(trackId!==undefined&&!selected.length)throw Error('A recorded cell no longer exists on its track.');
  const cells=selected.map(cell=>{
   const source=regions.get(cell.regionId);if(!source)throw Error('A recorded source clip no longer exists.');
   const {name,start,takeGroup,attackMarkers,...content}=source.region;
   return {regionId:cell.regionId,loop:cell.loop,trackId:source.track.id,kind:source.track.kind,content};
  }).sort((a,b)=>a.regionId<b.regionId?-1:a.regionId>b.regionId?1:0);
  return bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(canonical({version:1,cells})))));
 };
}
export function sceneSourceSignature(session,sceneId,trackId){return createSceneSourceReader(session)(sceneId,trackId);}
