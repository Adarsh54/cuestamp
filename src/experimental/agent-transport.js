import {z} from 'zod';
const position=z.number().finite().min(0).max(1000000000);
export const transportStateSchema=z.object({sessionId:z.string().min(1).max(100),revision:z.number().int().nonnegative(),epoch:z.number().int().nonnegative(),position,playing:z.boolean(),mode:z.enum(['stopped','arrangement','cycle','audioRange','regionSelection','scene','comp','warp','preview']).optional()}).strict();
export const transportActionSchema=z.object({operation:z.enum(['play','pause','stop','seek']),position:z.number().finite().min(0).max(86400).nullable()}).strict().superRefine((v,ctx)=>{
 if(v.operation==='seek'&&v.position===null)ctx.addIssue({code:'custom',message:'Seek requires an absolute timeline position.'});
 if(['pause','stop'].includes(v.operation)&&v.position!==null)ctx.addIssue({code:'custom',message:'Pause and stop do not accept a position.'});
});
export function validateTransportState(value,session){
 if(value===undefined)return;const state=transportStateSchema.parse(value);
 if(state.sessionId!==session.id||state.revision!==session.revision)throw Error('Transport state does not match the session.');
 if(state.mode!==undefined&&((!state.playing&&state.mode!=='stopped')||(state.playing&&state.mode==='stopped')))throw Error('Playback mode does not match the transport state.');
 if(state.mode==='cycle'&&!session.loopEnabled)throw Error('Cycle playback requires an enabled cycle range.');return state;
}
// Decoding/context resume may outlive cancellation; never let their late result
// start playback. The underlying promise remains observed after the race ends.
export function transportWait(promise,signal){
 if(!signal)return promise;
 return new Promise((resolve,reject)=>{
  const abort=()=>{cleanup();reject(signal.reason||new Error('Transport canceled.'));},cleanup=()=>signal.removeEventListener('abort',abort);
  Promise.resolve(promise).then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});
  if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
 });
}
export function transportSummary(operation,state){
 const time=state.position.toFixed(2)+' s';
 const labels={scene:'Scene audition',cycle:'Cycle playback',audioRange:'Audio range audition',regionSelection:'Selected clip audition',comp:'Comp audition',warp:'Warp preview',preview:'Preview playback'};
 if(state.playing&&labels[state.mode])return `${labels[state.mode]} at ${time}.`;
 return state.playing?`Playing from ${time}.`:operation==='stop'?`Stopped at ${time}.`:operation==='seek'?`Playhead at ${time}. Playback paused.`:`Paused at ${time}.`;
}

export function transportPlaybackMode(playback){
 if(!playback)return 'stopped';
 if(playback.scenePreview)return 'scene';
 if(playback.warpPreview)return 'warp';
 if(playback.selectionPreview)return 'regionSelection';
 if(playback.rangePreview)return 'audioRange';
 if(playback.compPreview)return 'comp';
 if(playback.preview)return 'preview';
 return playback.loop?'cycle':'arrangement';
}
