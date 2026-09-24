import {prepareSessionEffects} from './noise-gate.js';
import {audibleSources} from './routing.js';
import {audibleAssets} from './media-refs.js';
import {scheduleSession,sessionDuration} from './audio-engine.js';
export function scoreNoteAuditionPlan(session,{regionId,noteId}){
 const track=session.tracks.find(t=>t.kind==='midi'&&t.regions.some(r=>r.id===regionId)),region=track?.regions.find(r=>r.id===regionId),note=region?.notes.find(n=>n.id===noteId);
 if(!note)throw Error('Choose an existing score note.');
 if(note.mute||note.velocity===0||region.mute||!audibleSources(session).some(t=>t.id===track.id))return null;
 const document=structuredClone(session),duration=Math.min(.5,note.duration,region.duration-note.start),position=region.start+note.start;
 if(duration<=0)return null;
 for(const t of document.tracks)t.regions=t.id===track.id?[{...structuredClone(region),notes:[{...structuredClone(note),duration}],duration:note.start+duration,fadeIn:0,fadeOut:0}]:[];
 document.metronomeEnabled=false;document.loopEnabled=false;
 return {document,position,end:Math.min(86400,position+4,sessionDuration(document)),assets:audibleAssets(document)};
}
export function createScoreNoteAudition({getSession,getContext,loadAsset,buffers,blocked=()=>false,connected=()=>true,notify=()=>{},schedule=scheduleSession,setTimer=setTimeout,clearTimer=clearTimeout}){
 let epoch=0,playback=null,timer=null;
 const stop=()=>{epoch++;if(timer!==null)clearTimer(timer);timer=null;playback?.stop();playback=null;notify('');};
 async function play(reference){
  stop();if(blocked()||!connected())return;
  const session=getSession(),revision=session.revision,plan=scoreNoteAuditionPlan(session,reference);if(!plan){notify('This note is muted or not audible in the current mix.');return;}
  const current=epoch,valid=()=>current===epoch&&connected()&&!blocked()&&getSession()===session&&getSession().revision===revision;
  try{
   if(plan.assets.length)notify('Loading note audition…');
   for(const id of plan.assets){await loadAsset(id);if(!valid())return;}
   const context=await getContext();await prepareSessionEffects(context,plan.document);if(!valid())return;
   playback=schedule(context,plan.document,buffers,plan.position,{endPosition:plan.end});
   notify('Auditioning note');timer=setTimer(()=>{if(current===epoch){stop();notify('');}},(plan.end-plan.position+.1)*1000);
  }catch(error){if(current===epoch){stop();notify(error.message||'Unable to audition this note.');}}
 }
 return {play,stop};
}
