import {meterGrid} from './meter-grid.js';
import {compileTempoMap} from './tempo-map.js';
export function recordingTiming(session,now,sampleRate,position=0){
 const beats=(session?.countInBars??0)*(session?.meter??4),map=session?.tempoChanges?.length?compileTempoMap(session):null;
 const signatureGrid=meterGrid(session??{},'bar');
 const countInSeconds=signatureGrid?position-signatureGrid.timeAt(signatureGrid.atTime(position)-(session?.countInBars??0)):map?position-map.timeAtBeat(map.beatAtTime(position)-beats):(session?.countInBars??0)*(session?.meter??4)*60/(session?.tempo??120);
 const clickTime=Math.ceil((now+.025)*sampleRate)/sampleRate;
 const startFrame=Math.ceil((clickTime+countInSeconds)*sampleRate);
 return {clickTime,startFrame,captureTime:startFrame/sampleRate,countInSeconds};
}
