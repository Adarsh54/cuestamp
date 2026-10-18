import {createBouncePlan} from './bounce-plan.js';
export function createMovieExportPlan(session,regionId){
 const candidates=session.tracks.filter(t=>t.kind==='video'&&!t.mute).flatMap(track=>track.regions.filter(r=>!r.mute).map(region=>({track,region})));
 const selected=regionId?candidates.find(x=>x.region.id===regionId):candidates.length===1?candidates[0]:null;
 if(!selected)throw Error('Select one unmuted video region to export with the session mix.');
 const {region}=selected;if(region.reverse)throw Error('Reversed video export is not supported yet. Turn off Reverse before exporting.');
 if(!region.assetId)throw Error('The video source is missing. Re-import it.');
 const document=structuredClone(session);document.loopStart=region.start;document.loopEnd=region.start+region.duration;
 const audio=createBouncePlan(document,{mode:'range'});
 return {audio,regionId:region.id,assetId:region.assetId,offset:region.offset,duration:region.duration,name:region.name||session.title};
}
