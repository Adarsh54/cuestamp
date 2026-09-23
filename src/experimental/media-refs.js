import {sampleForNote} from './sampler-articulations.js';
import {audibleSources} from './routing.js';
export const referencedAssets=session=>[...new Set(session.tracks.flatMap(t=>[t.sampleAssetId,...(t.sampleArticulations||[]).map(a=>a.assetId),...t.regions.map(r=>r.assetId)]).filter(Boolean))];
export const audibleAssets=session=>[...new Set(audibleSources(session).flatMap(t=>t.kind==='audio'?t.regions.map(r=>r.assetId):t.kind==='midi'&&t.instrument==='sampler'?t.regions.flatMap(r=>r.notes.filter(n=>!n.mute&&n.velocity>0).map(n=>sampleForNote(t,n).sampleAssetId)):[]).filter(Boolean))];
export function remapAssets(session,mapping){for(const track of session.tracks){if(track.sampleAssetId)track.sampleAssetId=mapping.get(track.sampleAssetId);for(const a of track.sampleArticulations||[])a.assetId=mapping.get(a.assetId);for(const region of track.regions)if(region.assetId)region.assetId=mapping.get(region.assetId);}}
