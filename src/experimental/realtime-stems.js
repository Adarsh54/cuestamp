import {renderRealtimeWav} from './realtime-bounce.js';
import {realtimeStemJobs} from './realtime-bounce-plan.js';
export async function saveRealtimeStems(plan,buffers,settings,directory,{signal,onProgress=()=>{},render=renderRealtimeWav}={}){
 const jobs=realtimeStemJobs(plan,settings),title=plan.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').trim().slice(0,80)||'Mix';
 const folderName=title+' stems '+new Date().toISOString().replace(/[:.]/g,'-')+' '+crypto.randomUUID().slice(0,8);let folder,current=null,completed=0;
 try{signal?.throwIfAborted();folder=await directory.getDirectoryHandle(folderName,{create:true});
  for(const job of jobs){signal?.throwIfAborted();current=job.name;const handle=await folder.getFileHandle(current,{create:true}),sink=await handle.createWritable();
   await render(job.plan,buffers,settings,sink,{signal,onProgress:progress=>onProgress({folderName,name:job.name,completed,total:jobs.length,progress})});completed++;current=null;onProgress({folderName,name:job.name,completed,total:jobs.length,progress:1});
  }return {folderName,completed};
 }catch(error){let incomplete=false;if(folder&&current)await folder.removeEntry(current).catch(error=>{if(error.name!=='NotFoundError')incomplete=true;});if(folder&&!completed)await directory.removeEntry(folderName,{recursive:true}).then(()=>{incomplete=false;},error=>{incomplete=error.name!=='NotFoundError';});const failure=new Error(`${error.name==='AbortError'?'Stem export canceled':error.message}. ${completed?`${completed} completed stem(s) remain in ${folderName}.`:'No completed stems were saved.'}${incomplete?` Could not remove unfinished files from ${folderName}.`:''}`,{cause:error});failure.name=error.name;failure.completed=completed;failure.folderName=folderName;throw failure;}
}
