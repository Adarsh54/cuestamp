import {createMixerReadback} from './mixer-readback.js';
import {createAutomationCapture} from './automation-capture.js';

// Captured edits use the same revision-checked commands as manual/agent edits.
// Latch keeps several lanes live until Stop; the resulting batch is one undo.
export function createTouchRecording({getState,commit,getMode=()=> 'touch'}){
 let writeTarget=null;
 const active=new Map(),key=(target,parameter)=>`${target}:${parameter}`;
 function cancel(){writeTarget=null;const gestures=[...active.values()];active.clear();for(const g of gestures){g.capture.cancel();try{g.playback.automation.cancel(g.target,g.parameter);}catch{}}}
 function verify(g,state){if(state.playback!==g.playback||state.epoch!==g.epoch||state.session.id!==g.sessionId||state.session.revision!==g.revision)throw Error('Playback or the project changed during automation recording.');}
 function finish(gestures=[...active.values()]){
  if(!gestures.length)return false;
  try{
   const state=getState();for(const g of active.values())verify(g,state);
   const valid=gestures.filter(g=>state.position>g.start);
   const commands=valid.map(g=>({op:'automation.record',target:g.target,values:{parameter:g.parameter,samples:JSON.stringify(g.capture.finish(state.position)),returnSeconds:.1}}));
   if(commands.length)commit(commands,state.session.revision);
   const updated=getState().session;
   for(const g of gestures){
    if(valid.includes(g)){
     const owner=g.target===updated.id?{automation:updated.masterAutomation,gainDb:updated.masterDb,pan:updated.masterPan}:updated.tracks.find(t=>t.id===g.target);
     g.playback.automation.replace(g.target,g.parameter,owner.automation,owner[g.parameter]);g.playback.automation.release(g.target,g.parameter,.1);
    }else{g.capture.cancel();g.playback.automation.cancel(g.target,g.parameter);}
    active.delete(key(g.target,g.parameter));
   }
   for(const g of active.values())g.revision=updated.revision;
   return commands.length>0;
  }catch(error){cancel();throw error;}
 }
 function release(target,parameter){
  const g=active.get(key(target,parameter));if(!g)return false;
  if(g.mode==='touch')return finish([g]);
  try{const state=getState();verify(g,state);g.capture.push(state.position,g.value);g.released=true;return false;}catch(error){cancel();throw error;}
 }
 const api={
  get active(){return active.size>0;},get count(){return active.size;},value(target,parameter){return active.get(key(target,parameter))?.value;},finish,cancel,release,
  beforePaint(){
   // A latch remains deliberately held across channel selection and repaint.
   if(['latch','write'].includes(getMode())){try{for(const g of active.values())release(g.target,g.parameter);}catch{cancel();}}else cancel();
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
  input(target,parameter,value){
   let state=getState();const mode=getMode(),id=key(target,parameter);
   if(mode==='write'&&target!==writeTarget)throw Error('Write is recording the channel selected when playback started. Stop to choose another channel.');
   if(mode==='touch'&&active.size&&!active.has(id)){finish();state=getState();}
   try{
    if(!['touch','latch','write'].includes(mode))throw Error('Choose Touch, Latch or Write recording.');
    if(!state.playback||state.playback.loop||state.playback.compPreview||!state.playback.automation)throw Error('Automation recording needs normal playback with Cycle off.');
    const owner=target===state.session.id?{automationMode:state.session.masterAutomationMode,automationMuted:state.session.masterAutomationMuted}:state.session.tracks.find(t=>t.id===target);
    if(!owner||owner.kind==='video'||owner.mute||owner.protected)throw Error('Choose an unmuted, unprotected mixer channel.');
    if(owner.automationMode==='off'||owner.automationMuted?.includes(parameter))throw Error('Enable Read for this automation lane before recording.');
    for(const g of active.values())verify(g,state);
    let g=active.get(id);
    if(!g){
     if(active.size>=100)throw Error('Stop this automation pass before recording more than 100 lanes.');
     const capture=createAutomationCapture({start:state.position,value,min:parameter==='pan'?-1:-96,max:parameter==='pan'?1:12});
     g={target,parameter,capture,value,mode,released:false,start:state.position,playback:state.playback,epoch:state.epoch,sessionId:state.session.id,revision:state.session.revision};active.set(id,g);
    }else{
     // Holding after release must not become a long slope toward the next move.
     const last=g.capture.points.at(-1);if(g.released&&state.position>last.time)g.capture.push(Math.max(last.time,state.position-1e-6),g.value);
     g.capture.push(state.position,value);g.value=value;g.released=false;
    }
    state.playback.automation.set(target,parameter,value);
   }catch(error){cancel();throw error;}
  },
 };
 return api;
}
