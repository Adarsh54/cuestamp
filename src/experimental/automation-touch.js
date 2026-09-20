import {createAutomationCapture} from './automation-capture.js';

// One user-controlled fader at a time. Captured edits go through the same
// revision-checked command engine as manual and agent edits.
export function createTouchRecording({getState,commit}){
 let active=null;
 function cancel(){const gesture=active;active=null;if(!gesture)return;gesture.capture.cancel();try{gesture.playback.automation.cancel(gesture.target,gesture.parameter);}catch{}}
 function verify(gesture,state){if(state.playback!==gesture.playback||state.epoch!==gesture.epoch||state.session.id!==gesture.sessionId||state.session.revision!==gesture.revision)throw Error('Playback or the project changed during automation recording.');}
 function finish(){
  const gesture=active;if(!gesture)return false;
  try{
   const state=getState();verify(gesture,state);
   if(state.position<=gesture.start){cancel();return false;}
   const samples=gesture.capture.finish(state.position);
   const command={op:'automation.record',target:gesture.target,values:{parameter:gesture.parameter,samples:JSON.stringify(samples),returnSeconds:.1}};
   commit(command,gesture.revision);
   // Keep playback's source curve in sync for another touch during the return.
   const updated=getState().session,owner=gesture.target===updated.id?{automation:updated.masterAutomation,gainDb:updated.masterDb,pan:updated.masterPan}:updated.tracks.find(t=>t.id===gesture.target);
   gesture.playback.automation.replace(gesture.target,gesture.parameter,owner.automation,owner[gesture.parameter]);
   gesture.playback.automation.release(gesture.target,gesture.parameter,.1);
   active=null;return true;
  }catch(error){cancel();throw error;}
 }
 return {
  get active(){return Boolean(active);},finish,cancel,
  input(target,parameter,value){
   let state=getState();if(active&&(active.target!==target||active.parameter!==parameter)){finish();state=getState();}
   try{
    if(!state.playback||state.playback.loop||state.playback.compPreview||!state.playback.automation)throw Error('Touch recording needs normal playback with Cycle off.');
    const owner=target===state.session.id?{automationMode:state.session.masterAutomationMode,automationMuted:state.session.masterAutomationMuted}:state.session.tracks.find(t=>t.id===target);
    if(!owner||owner.kind==='video'||owner.mute||owner.protected)throw Error('Choose an unmuted, unprotected mixer channel.');
    if(owner.automationMode==='off'||owner.automationMuted?.includes(parameter))throw Error('Enable Read for this automation lane before recording Touch.');
    if(active)verify(active,state);
    if(!active){const capture=createAutomationCapture({start:state.position,value,min:parameter==='pan'?-1:-96,max:parameter==='pan'?1:12});active={target,parameter,capture,start:state.position,playback:state.playback,epoch:state.epoch,sessionId:state.session.id,revision:state.session.revision};}
    else active.capture.push(state.position,value);
    state.playback.automation.set(target,parameter,value);
   }catch(error){cancel();throw error;}
  },
 };
}
