import {compileTempoMap} from './tempo-map.js';
export function recordingTiming(session,now,sampleRate,position=0){
 const beats=(session?.countInBars??0)*(session?.meter??4),map=session?.tempoChanges?.length?compileTempoMap(session):null;
 const countInSeconds=map?position-map.timeAtBeat(map.beatAtTime(position)-beats):(session?.countInBars??0)*(session?.meter??4)*60/(session?.tempo??120);
 const clickTime=Math.ceil((now+.025)*sampleRate)/sampleRate;
 const startFrame=Math.ceil((clickTime+countInSeconds)*sampleRate);
 return {clickTime,startFrame,captureTime:startFrame/sampleRate,countInSeconds};
}
