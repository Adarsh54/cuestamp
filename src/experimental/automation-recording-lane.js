export const sendAutomationTarget=(sourceId,busId)=>JSON.stringify(['send',sourceId,busId]);
// Resolve the actual owner of recorded channel or send automation. Send IDs are
// destination bus IDs, so the source track is always part of their identity.
export function recordingAutomationLane(session,target,parameter,busId){
 if(!['gainDb','pan'].includes(parameter))throw Error('Choose volume or pan automation.');
 const track=session.tracks.find(t=>t.id===target);
 if(target!==session.id&&(!track||track.kind==='video'))throw Error('Choose a mixer track, bus or Master for automation recording.');
 let owner,points,fallback;
 if(busId!==undefined){
  if(!track)throw Error('A send recording needs its source track and destination bus.');
  if(parameter!=='gainDb')throw Error('Sends support volume automation only.');
  owner=track.sends.find(s=>s.busId===busId);if(!owner)throw Error('Send automation destination not found on this source track.');
  points=owner.automation;fallback=owner.gainDb;
 }else if(target===session.id){owner=session;points=session.masterAutomation;fallback=parameter==='gainDb'?session.masterDb:session.masterPan;}
 else{owner=track;points=track.automation;fallback=track[parameter];}
 return {owner,track,points,fallback,min:parameter==='pan'?-1:-96,max:parameter==='pan'?1:12};
}
