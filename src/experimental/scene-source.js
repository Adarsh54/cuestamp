import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
// Stable across JSON imports and property insertion order. This is a content
// comparison, not authentication or a checksum of the original media bytes.
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export function sceneSourceSignature(session,sceneId){
 const scene=session.scenes.find(s=>s.id===sceneId);if(!scene)throw Error('A recorded scene no longer exists.');
 const regions=new Map(session.tracks.flatMap(track=>track.regions.map(region=>[region.id,{track,region}])));
 const cells=scene.cells.map(cell=>{
  const source=regions.get(cell.regionId);if(!source)throw Error('A recorded source clip no longer exists.');
  const {name,start,takeGroup,attackMarkers,...content}=source.region;
  return {regionId:cell.regionId,loop:cell.loop,trackId:source.track.id,kind:source.track.kind,content};
 }).sort((a,b)=>a.regionId<b.regionId?-1:a.regionId>b.regionId?1:0);
 return bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(canonical({version:1,cells})))));
}
