import {warpedRegionTrack} from './audio-warp-region.js';
import {audioRangeAudition} from './audio-range-audition.js';
export function warpAuditionPlan(session,regionId,values){const {track}=warpedRegionTrack(session,regionId,values),snapshot=structuredClone(session),region=track.regions[0];snapshot.tracks.push(track);const preview=audioRangeAudition(snapshot,{regionId:region.id,start:region.start,end:region.start+region.duration});return {...preview,warpPreview:true,label:'Playing warp preview. Project unchanged.'};}
