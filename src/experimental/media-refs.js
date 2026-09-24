import {pruneSavedMelodies} from './melody-storage.js';
import {samplesForNote} from './sampler-articulations.js';
import {renderingSources} from './routing.js';
const presetTracks=session=>(session.samplerPresets??[]).map(p=>p.settings);
export const referencedAssets=session=>[...new Set([...session.tracks,...presetTracks(session)].flatMap(t=>[t.sampleAssetId,...(t.sampleArticulations||[]).map(a=>a.assetId),...(t.sampleZones||[]).map(z=>z.assetId),...(t.regions??[]).map(r=>r.assetId)]).filter(Boolean))];
export const audibleAssets=session=>[...new Set(renderingSources(session).flatMap(t=>t.kind==='audio'?t.regions.map(r=>r.assetId):t.kind==='midi'&&t.instrument==='sampler'?t.regions.flatMap(r=>r.notes.filter(n=>!n.mute&&n.velocity>0).flatMap(n=>samplesForNote(t,n).map(s=>s.sampleAssetId))):[]).filter(Boolean))];
export function remapAssets(session,mapping){pruneSavedMelodies(session);for(const track of [...session.tracks,...presetTracks(session)]){if(track.sampleAssetId)track.sampleAssetId=mapping.get(track.sampleAssetId);for(const a of track.sampleArticulations||[])a.assetId=mapping.get(a.assetId);for(const z of track.sampleZones||[])z.assetId=mapping.get(z.assetId);for(const region of track.regions??[])if(region.assetId){region.assetId=mapping.get(region.assetId);if(region.melodyDraft)region.melodyDraft.source.assetId=region.assetId;}}}
