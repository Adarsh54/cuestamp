import {transferProjectSection} from './section-transfer.js';
import {deleteProjectTime} from './delete-time.js';
function pair(session,target,otherId){const a=session.sections.find(s=>s.id===target),b=session.sections.find(s=>s.id===otherId);if(!a||!b||a===b)throw Error('Choose two different existing arrangement sections.');return [a,b];}
export function swapProjectSections(session,target,otherId){
 const ordered=pair(session,target,otherId).sort((a,b)=>a.start-b.start),left={...ordered[0]},right={...ordered[1]};
 // First bring the later section forward. Then move the original earlier
 // section past the intervening material. Adjacent sections need only step one.
 transferProjectSection(session,{mode:'move',start:right.start,end:right.end,position:left.start});
 const shifted=session.sections.find(s=>s.id===left.id);
 if(Math.abs(shifted.end-right.end)>1e-9)transferProjectSection(session,{mode:'move',start:shifted.start,end:shifted.end,position:right.end});
}
export function replaceProjectSection(session,target,otherId){
 const [a,b]=pair(session,target,otherId),removed={...a},sourceId=b.id,sourceDuration=b.end-b.start;
 const ranges=['loop','audioPunch','midiPunch'].filter(prefix=>session[prefix+'Start']===a.start&&session[prefix+'End']===a.end).map(prefix=>({prefix,enabled:session[prefix+'Enabled']}));
 deleteProjectTime(session,{start:a.start,end:a.end});
 const source=session.sections.find(s=>s.id===sourceId);
 transferProjectSection(session,{mode:'copy',start:source.start,end:source.end,position:removed.start});
 // A cycle/punch range matching the replaced section selects the replacement.
 for(const {prefix,enabled} of ranges){session[prefix+'Start']=removed.start;session[prefix+'End']=removed.start+sourceDuration;session[prefix+'Enabled']=enabled;}
}
