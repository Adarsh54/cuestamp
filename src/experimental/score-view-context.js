import {z} from 'zod';
import {scoreTracks} from './musicxml.js';
export const scoreViewContextSchema=z.object({sessionId:z.string().min(1).max(100),revision:z.number().int().nonnegative(),scope:z.enum(['region','arrangement']),regionId:z.string().min(1).max(100).nullable(),trackIds:z.array(z.string().min(1).max(100)).min(1).max(128),pitchMode:z.enum(['written','concert'])}).strict();
export function validateScoreViewContext(session,context){
 if(context===undefined)return;
 scoreViewContextSchema.parse(context);
 if(context.sessionId!==session.id||context.revision!==session.revision)throw Error('The score view is from a different session revision.');
 const eligible=scoreTracks(session),ids=new Set(context.trackIds);
 if(ids.size!==context.trackIds.length||context.trackIds.some(id=>!eligible.some(t=>t.id===id)))throw Error('Score parts are no longer available.');
 if(context.scope==='region'){
  if(context.trackIds.length!==1||!eligible.find(t=>t.id===context.trackIds[0])?.regions.some(r=>r.id===context.regionId))throw Error('The score region does not belong to its part.');
 }else if(context.regionId!==null)throw Error('An arrangement score cannot specify a single region.');
}
export function captureScoreView(root,session,track,region){
 const panel=root?.querySelector('[data-score-preview]');if(!panel?.open||panel.querySelector('[data-score-status]')?.textContent!=='Score preview ready.')return undefined;
 const scope=panel.querySelector('[data-score-scope]')?.value,pitchMode=panel.querySelector('[data-score-pitch-view]')?.value;
 const context={sessionId:session.id,revision:session.revision,scope,pitchMode,regionId:scope==='region'?region?.id??null:null,trackIds:scope==='region'?[track?.id]:[...panel.querySelectorAll('[data-score-part]:checked')].map(input=>input.value)};
 try{validateScoreViewContext(session,context);return context;}catch{return undefined;}
}
