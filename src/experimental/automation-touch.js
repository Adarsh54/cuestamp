import {recordingAutomationLane,sendAutomationTarget} from './automation-recording-lane.js';
import {createMixerReadback} from './mixer-readback.js';
import {createAutomationCapture} from './automation-capture.js';

// Captured edits use the same revision-checked commands as manual/agent edits.
// Latch keeps several lanes live until Stop; the resulting batch is one undo.
export function createTouchRecording({getState,commit,getMode=()=> 'touch'}){
 let writeTarget=null;
 const active=new Map(),key=(target,parameter,busId)=>`${busId===undefined?target:sendAutomationTarget(target,busId)}:${parameter}`;
 function cancel(){writeTarget=null;const gestures=[...active.values()];active.clear();for(const g of gestures){g.capture.cancel();try{g.playback.automation.cancel(g.liveTarget,g.parameter);}catch{}}}
 function verify(g,state){if(state.playback!==g.playback||state.epoch!==g.epoch||state.session.id!==g.sessionId||state.session.revision!==g.revision)throw Error('Playback or the project changed during automation recording.');}
 function finish(gestures=[...active.values()]){
  if(!gestures.length)return false;
  try{
   const state=getState();for(const g of active.values())verify(g,state);
   const valid=gestures.filter(g=>state.position>g.start);
   const commands=valid.map(g=>({op:g.mode.startsWith('trim')?'automation.trimRecord':'automation.record',target:g.target,values:{parameter:g.parameter,...(g.busId===undefined?{}:{busId:g.busId}),samples:JSON.stringify(g.capture.finish(state.position)),returnSeconds:.1}}));
   if(commands.length)commit(commands,state.session.revision);
   const updated=getState().session;
   for(const g of gestures){
    if(valid.includes(g)){
     const {points,fallback}=recordingAutomationLane(updated,g.target,g.parameter,g.busId);
     g.playback.automation.replace(g.liveTarget,g.parameter,points,fallback);if(g.mode.startsWith('trim'))g.playback.automation.resume(g.liveTarget,g.parameter);else g.playback.automation.release(g.liveTarget,g.parameter,.1);
    }else{g.capture.cancel();g.playback.automation.cancel(g.liveTarget,g.parameter);}
    active.delete(key(g.target,g.parameter,g.busId));
   }
   for(const g of active.values())g.revision=updated.revision;
   return commands.length>0;
  }catch(error){cancel();throw error;}
 }
 function release(target,parameter,busId){
  const g=active.get(key(target,parameter,busId));if(!g)return false;
  if(['touch','trimTouch'].includes(g.mode))return finish([g]);
  try{const state=getState();verify(g,state);g.capture.push(state.position,g.value);g.released=true;return false;}catch(error){cancel();throw error;}
 }
 const api={
  get active(){return active.size>0;},get count(){return active.size;},value(target,parameter,busId){return active.get(key(target,parameter,busId))?.value;},finish,cancel,release,
  beforePaint(){
   // A latch remains deliberately held across channel selection and repaint.
   if(['latch','write','trimLatch'].includes(getMode())){try{for(const g of active.values())release(g.target,g.parameter,g.busId);}catch{cancel();}}else cancel();
  },
  beginWrite(target){
   if(getMode()!=='write')return false;
   if(active.size)throw Error('Finish the active automation pass before starting Write.');
   const state=getState(),read=createMixerReadback(state.session);writeTarget=target;
   try{
    for(const parameter of ['gainDb','pan']){api.input(target,parameter,read(target,parameter,state.position));api.release(target,parameter);}
    return true;
   }catch(error){cancel();throw error;}
  },
  input(target,parameter,value,busId){
   let state=getState();const mode=getMode(),id=key(target,parameter,busId);
   if(mode==='write'&&(target!==writeTarget||busId!==undefined))throw Error('Write is recording the channel selected when playback started. Stop to choose another channel.');
   if(['touch','trimTouch'].includes(mode)&&active.size&&!active.has(id)){finish();state=getState();}
   try{
    if(!['touch','latch','write','trimTouch','trimLatch'].includes(mode))throw Error('Choose Touch, Latch or Write recording.');
    if(!state.playback||state.playback.loop||state.playback.compPreview||!state.playback.automation)throw Error('Automation recording needs normal playback with Cycle off.');
    const lane=recordingAutomationLane(state.session,target,parameter,busId),channel=lane.track;
    const owner=busId!==undefined?lane.owner:target===state.session.id?{automationMode:state.session.masterAutomationMode,automationMuted:state.session.masterAutomationMuted}:lane.owner;
    if(lane.effect&&(!owner.enabled||(owner.sync&&parameter==='rate')))throw Error('Enable this effect and disable tempo sync before recording its free rate.');
    if(lane.effect&&!channel&&state.session.masterAutomationMode==='off')throw Error('Enable Master Read before recording effect automation.');
    if(channel?.mute||channel?.protected)throw Error('Choose an unmuted, unprotected mixer channel.');
    if(channel?.automationMode==='off'||owner.automationMode==='off'||owner.automationMuted?.includes(parameter))throw Error('Enable Read for this automation lane and its parent before recording.');
    for(const g of active.values())verify(g,state);
    let g=active.get(id);
    if(!g){
     if(active.size>=100)throw Error('Stop this automation pass before recording more than 100 lanes.');
     const capture=createAutomationCapture({start:state.position,value,min:mode.startsWith('trim')?-(lane.max-lane.min):lane.min,max:mode.startsWith('trim')?lane.max-lane.min:lane.max});
     g={target,parameter,busId,liveTarget:busId===undefined?target:sendAutomationTarget(target,busId),capture,value,mode,released:false,start:state.position,playback:state.playback,epoch:state.epoch,sessionId:state.session.id,revision:state.session.revision};active.set(id,g);
    }else{
     // Holding after release must not become a long slope toward the next move.
     const last=g.capture.points.at(-1);if(g.released&&state.position>last.time)g.capture.push(Math.max(last.time,state.position-1e-6),g.value);
     g.capture.push(state.position,value);g.value=value;g.released=false;
    }
    state.playback.automation[mode.startsWith('trim')?'trim':'set'](g.liveTarget,parameter,value);
   }catch(error){cancel();throw error;}
  },
 };
 return api;
}
