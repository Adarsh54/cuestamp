import {compileTempoMap} from './tempo-map.js';
// A rest in an arrangement may cover empty timeline or overlapping regions. Never guess its destination.
export function scoreRestDraft(session,{trackId,regionId,scope,beat,beats}){
 if(!Number.isFinite(beat)||beat<0||!Number.isFinite(beats)||beats<=0)return null;
 const track=session.tracks.find(t=>t.id===trackId);if(track?.kind!=='midi')return null;
 const tempo=compileTempoMap(session),region=track.regions.find(r=>r.id===regionId);
 if(scope!=='arrangement'&&!region)return null;
 const origin=scope==='arrangement'?0:tempo.beatAtTime(region.start),time=tempo.timeAtBeat(origin+beat);
 const candidates=scope==='arrangement'?track.regions.filter(r=>time>=r.start-1e-9&&time<r.start+r.duration-1e-9):[region];
 if(candidates.length!==1)return null;
 const destination=candidates[0],start=Math.max(0,time-destination.start),end=Math.min(destination.start+destination.duration,tempo.timeAtBeat(origin+beat+Math.min(1,beats))),duration=end-time;
 if(duration<.001)return null;
 return {regionId:destination.id,note:{pitch:60,start,duration,velocity:.8}};
}
