import {regionBeatTiming} from './tempo-map.js';
export const scoreDisplayGrids={off:0,quarter:1,eighth:.5,sixteenth:.25,thirtysecond:.125,eighthTriplet:1/3,sixteenthTriplet:1/6};
export function scoreDisplayTiming(session,mode='off'){
 if(!Object.hasOwn(scoreDisplayGrids,mode))throw Error('Choose a supported score display grid.');
 const grid=scoreDisplayGrids[mode];if(!grid)return session;
 return {...session,tracks:session.tracks.map(track=>track.kind!=='midi'?track:{...track,regions:track.regions.map(region=>{
  const timing=regionBeatTiming(region,session),limit=timing.beatAtTime(region.duration),lastStart=Math.max(0,(Math.ceil((limit-1e-9)/grid)-1)*grid);
  return {...region,notes:region.notes.map(note=>{
   const start=Math.min(lastStart,Math.max(0,Math.round(timing.beatAtTime(note.start)/grid)*grid));
   const end=Math.min(limit,Math.max(start+grid,Math.round(timing.beatAtTime(note.start+note.duration)/grid)*grid));
   const seconds=timing.timeAtBeat(start);return {...note,start:seconds,duration:Math.max(.000001,timing.timeAtBeat(end)-seconds)};
  })};
 })})};
}
export const scoreDisplayTimingView=()=>`<label>Display grid<select data-score-display-grid><option value="off">Performed timing</option><option value="quarter">Quarter notes</option><option value="eighth">Eighth notes</option><option value="sixteenth">Sixteenth notes</option><option value="thirtysecond">Thirty-second notes</option><option value="eighthTriplet">Eighth-note triplets</option><option value="sixteenthTriplet">Sixteenth-note triplets</option></select></label>`;
