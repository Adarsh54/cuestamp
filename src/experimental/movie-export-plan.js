import {createBouncePlan} from './bounce-plan.js';
export function createMovieExportPlan(session,regionId){
 const candidates=session.tracks.filter(t=>t.kind==='video'&&!t.mute).flatMap(track=>track.regions.filter(r=>!r.mute).map(region=>({track,region})));
 const selected=regionId?candidates.find(x=>x.region.id===regionId):candidates.length===1?candidates[0]:null;
 if(!selected)throw Error('Select one unmuted video region to export with the session mix.');
 const {region}=selected;
 if(!region.assetId)throw Error('The video source is missing. Re-import it.');
 const document=structuredClone(session);document.loopStart=region.start;document.loopEnd=region.start+region.duration;
 const audio=createBouncePlan(document,{mode:'range'});
 return {audio,reverse:Boolean(region.reverse),frameRate:session.frameRate,regionId:region.id,assetId:region.assetId,offset:region.offset,duration:region.duration,name:region.name||session.title};
}

export function createMovieTimelinePlan(session){
 const picture={frameRate:session.frameRate,tracks:structuredClone(session.tracks.filter(t=>t.kind==='video'&&!t.mute))};
 for(const track of picture.tracks)track.regions=track.regions.filter(r=>!r.mute);
 const regions=picture.tracks.flatMap(t=>t.regions);
 if(!regions.length)throw Error('Add an unmuted video region before exporting the video arrangement.');
 if(regions.some(r=>!r.assetId))throw Error('A video source is missing. Re-import it.');
 const duration=Math.max(...regions.map(r=>r.start+r.duration)),document=structuredClone(session);document.loopStart=0;document.loopEnd=duration;
 const audio=createBouncePlan(document,{mode:'range'});
 // First visible clip defines output dimensions; stable ordering matches preview priority.
 const assetIds=[...new Set([...regions].sort((a,b)=>a.start-b.start).map(r=>r.assetId))];
 return {audio,picture,assetIds,duration,frameRate:session.frameRate,name:session.title};
}
