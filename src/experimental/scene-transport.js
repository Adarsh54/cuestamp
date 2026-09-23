import {compileTempoMap} from './tempo-map.js';
import {compileMeterMap} from './meter-map.js';
import {scheduleSession} from './audio-engine.js';
export function sceneSwitchTime(session,position,quantization){
 if(!Number.isFinite(position)||position<0)throw Error('Choose a valid scene clock position.');
 if(quantization==='immediate')return position;
 if(!['beat','bar'].includes(quantization))throw Error('Choose immediate, beat or bar scene switching.');
 const tempo=compileTempoMap(session),meter=compileMeterMap(session),beat=tempo.beatAtTime(position),at=meter.positionAtBeat(beat),signature=meter.signatureAtBar(at.bar);
 const boundary=quantization==='bar'||at.beat===signature.numerator?meter.barStart(at.bar+1):meter.beatAtPosition(at.bar,at.beat+1);
 return tempo.timeAtBeat(boundary);
}
// Both graphs are scheduled against AudioContext time. A JS tick updates UI and
// releases old nodes, but never determines the audible switch boundary.
export function startSceneTransport(context,preview,buffers,{schedule=scheduleSession}={}){
 const base=context.currentTime+.1,session=preview.document;
 let current,pending=null,stopped=false,stoppedAt=null;const launches=[];
 function prepare(plan,when){
  const output=context.createGain();output.gain.value=0;output.connect(context.destination);
  let graph;
  try{graph=schedule(context,plan.document,buffers,0,{baseTime:when,endPosition:plan.end,meters:true,destination:output});if(context.currentTime>=when)throw Error('Preparing the scene missed its launch boundary. Try again.');}
  catch(error){graph?.stop();output.disconnect();throw error;}
  return {plan,when,output,graph,stop(){graph.stop();output.disconnect();}};
 }
 current=prepare(preview,base);launches.push({sceneId:preview.sceneId,...(preview.sourceSignature?{sourceSignature:preview.sourceSignature}:{}),start:0,duration:preview.end});current.output.gain.setValueAtTime(1,base);
 const transport={base,position:0,preview:true,recordPerformance:Boolean(preview.recordPerformance),scenePreview:preview.sceneId,
  performance(){const end=Math.max(0,(stoppedAt??context.currentTime)-base);return {sessionId:session.id,revision:session.revision,events:launches.flatMap((event,i)=>{const duration=Math.min(event.duration,end-event.start,(launches[i+1]?.start??Infinity)-event.start);return duration>1e-6?[{...event,duration}]:[];})};},
  get endPosition(){return (pending||current).when-base+(pending||current).plan.end;},
  get meters(){return current.graph.meters;},get automation(){return current.graph.automation;},readEffectMeters:()=>current.graph.readEffectMeters?.(),
  advance(){current.graph.collectVoices?.();if(!pending||context.currentTime<pending.when)return null;current.stop();current=pending;pending=null;transport.scenePreview=current.plan.sceneId;return current.plan;},
  launchCell({plan,trackId,quantization,regions}){
   if(stopped)throw Error('Start scene playback before launching a cell.');
   if(transport.recordPerformance)throw Error('Cell launching is not yet supported during scene performance recording.');
   transport.advance();if(pending)throw Error('Wait for the queued scene before launching a cell.');
   const position=sceneSwitchTime(session,Math.max(0,context.currentTime-base)+.1,quantization),when=base+position;
   if(when>=current.when+current.plan.end)throw Error('The scene ends before this cell can launch. Start a longer audition.');
   current.graph.replaceTrackRegions(trackId,regions,{when,duration:plan.end});return {position,trackId};
  },
  queue(plan,quantization){
   if(stopped)throw Error('Start scene playback before cueing another scene.');transport.advance();
   if(launches.length>=100)throw Error('Stop and save this performance before launching more than 100 scenes.');
   if(pending)throw Error('A scene is already queued. Wait for its launch or stop playback.');
   const position=sceneSwitchTime(session,Math.max(0,context.currentTime-base)+.1,quantization),when=base+position;
   if(when>=current.when+current.plan.end)throw Error('The current audition ends before that boundary. Start a longer audition first.');
   if(position+plan.end>86400)throw Error('Scene playback exceeds the timeline.');
   const next=prepare(plan,when);
   current.output.gain.setValueAtTime(0,when);next.output.gain.setValueAtTime(1,when);pending=next;launches.push({sceneId:plan.sceneId,...(plan.sourceSignature?{sourceSignature:plan.sourceSignature}:{}),start:position,duration:plan.end});
   return {position,sceneId:plan.sceneId};
  },
  stop(){if(stopped)return;stopped=true;stoppedAt=context.currentTime;current.stop();pending?.stop();pending=null;}
 };
 return transport;
}
