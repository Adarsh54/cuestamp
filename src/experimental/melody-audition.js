import {retunedRegionTrack} from './melody-retune-plan.js';
import {audioRangeAudition} from './audio-range-audition.js';
import {sessionDuration} from './audio-engine.js';
function audition(session,region,mode){const preview=audioRangeAudition(session,{regionId:region.id,start:region.start,end:region.start+region.duration});return {...preview,end:Math.min(86400,sessionDuration(preview.document)),melodyPreview:mode,label:`Playing ${mode==='tuned'?'tuned':'original'} melody preview. Project unchanged.`};}
export function originalMelodyAudition(session,analysis){if(!analysis||analysis.sessionId!==session.id||analysis.revision!==session.revision)throw Error('The melody draft changed. Analyze it again.');const region=session.tracks.filter(t=>t.kind==='audio').flatMap(t=>t.regions).find(r=>r.id===analysis.regionId);if(!region)throw Error('Select the source audio region.');return audition(session,region,'original');}
export function tunedMelodyAudition(session,regionId,values){const {track}=retunedRegionTrack(session,regionId,values,{preview:true}),snapshot=structuredClone(session);snapshot.tracks.push(track);return audition(snapshot,track.regions[0],'tuned');}
