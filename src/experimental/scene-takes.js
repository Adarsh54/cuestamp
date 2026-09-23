import {z} from 'zod';
import {scenePerformanceSchema,scenePerformanceView,availableScenePerformance} from './scene-performance.js';
export const takeSchema=z.object({id:z.string().min(1).max(100),name:z.string().trim().min(1).max(100),createdAt:z.string().datetime(),performance:scenePerformanceSchema,placements:z.number().int().nonnegative().default(0)}).strict();
const librarySchema=z.object({version:z.literal(1),selectedId:z.string().nullable(),selectedBySession:z.record(z.string(),z.string()).default({}),takes:z.array(takeSchema).max(32)}).strict().refine(v=>new Set(v.takes.map(t=>t.id)).size===v.takes.length,'Take IDs must be unique.');
export const sceneTakeBundleSchema=z.object({selectedId:z.string().min(1).max(100).nullable(),takes:z.array(takeSchema).max(32)}).strict();
export function validateSceneTakeBundle(value,sessionId){const bundle=sceneTakeBundleSchema.parse(value??{selectedId:null,takes:[]});if(bundle.takes.some(t=>t.performance.sessionId!==sessionId)||new Set(bundle.takes.map(t=>t.id)).size!==bundle.takes.length||bundle.selectedId&&!bundle.takes.some(t=>t.id===bundle.selectedId))throw Error('Archived takes do not match their project or selection.');return bundle;}
export class SceneTakes {
 constructor(storage,key){this.epoch=0;this.storage=storage;this.key=key+':scene-takes';this.legacyKey=key+':scene-performance';this.data={version:1,selectedId:null,selectedBySession:{},takes:[]};this.saved=true;this.loadError=null;
  let raw,legacy;try{raw=storage.getItem(this.key);legacy=raw?null:storage.getItem(this.legacyKey);}catch{this.saved=false;return;}
  try{if(raw)this.data=librarySchema.parse(JSON.parse(raw));else if(legacy){const performance=scenePerformanceSchema.parse(JSON.parse(legacy));this.add(performance,'Recovered performance');if(this.saved)try{storage.removeItem(this.legacyKey);}catch{}}}catch(error){this.loadError='Saved scene takes could not be loaded. Existing device data has been preserved.';}
 }
 persist(){if(this.loadError)throw Error(this.loadError);this.epoch++;try{this.storage.setItem(this.key,JSON.stringify(this.data));this.saved=true;}catch{this.saved=false;}}
 list(sessionId){return this.data.takes.filter(t=>t.performance.sessionId===sessionId);}
 selected(sessionId){const list=this.list(sessionId);return list.find(t=>t.id===(this.data.selectedBySession[sessionId]??this.data.selectedId))??list.at(-1);}
 mergeCloud(value,sessionId,apply=false){
  if(this.loadError)throw Error(this.loadError);const bundle=validateSceneTakeBundle(value,sessionId),incoming=new Map(bundle.takes.map(t=>[t.id,t])),others=this.data.takes.filter(t=>t.performance.sessionId!==sessionId),result=[...bundle.takes];
  if(others.some(t=>incoming.has(t.id)))throw Error('Account take IDs conflict with another local project.');
  const identity=t=>JSON.stringify({createdAt:t.createdAt,events:t.performance.events.map(({sourceSignature,...event})=>event)});
  for(const local of this.list(sessionId)){const remote=incoming.get(local.id);if(!remote){result.push(structuredClone(local));continue;}
   if(identity(local)===identity(remote)&&local.name===remote.name){remote.placements=Math.max(remote.placements,local.placements);continue;}
   const copy=structuredClone(local);copy.id=crypto.randomUUID();copy.name=local.name.slice(0,86)+' (device copy)';if(identity(local)===identity(remote))copy.performance=structuredClone(remote.performance);result.push(copy);
  }
  if(others.length+result.length>32)throw Error('Opening this project would exceed the 32-take device limit. Discard unneeded takes first.');
  if(apply){this.data.takes=[...others,...result];if(bundle.selectedId){this.data.selectedId=bundle.selectedId;this.data.selectedBySession[sessionId]=bundle.selectedId;}this.persist();}
  return result;
 }
 exportBundle(sessionId){if(this.loadError)throw Error(this.loadError);return validateSceneTakeBundle({selectedId:this.selected(sessionId)?.id??null,takes:this.list(sessionId)},sessionId);}
 checkImport(bundle,sessionId){if(this.loadError)throw Error(this.loadError);const parsed=validateSceneTakeBundle(bundle,sessionId);if(this.data.takes.length+parsed.takes.length>32)throw Error('Discard unneeded takes before importing: this archive would exceed the 32-take device limit.');if(parsed.takes.some(t=>this.data.takes.some(existing=>existing.id===t.id)))throw Error('An imported take ID already exists.');return parsed;}
 importBundle(bundle,sessionId){const parsed=this.checkImport(bundle,sessionId);this.data.takes.push(...parsed.takes);if(parsed.selectedId){this.data.selectedId=parsed.selectedId;this.data.selectedBySession[sessionId]=parsed.selectedId;}this.persist();}
 assertCanRecord(){if(this.loadError)throw Error(this.loadError);if(this.data.takes.length>=32)throw Error('Discard an unneeded scene take before recording more than 32 takes on this device.');}
 add(performance,name){this.assertCanRecord();performance=scenePerformanceSchema.parse(performance);const list=this.list(performance.sessionId);let n=1;while(list.some(t=>t.name===`Take ${n}`))n++;const take=takeSchema.parse({id:crypto.randomUUID(),name:name??`Take ${n}`,createdAt:new Date().toISOString(),performance,placements:0});this.data.takes.push(take);this.data.selectedId=take.id;this.data.selectedBySession[performance.sessionId]=take.id;this.persist();return take;}
 select(id,sessionId){if(!this.list(sessionId).some(t=>t.id===id))throw Error('Choose a take from this project.');this.data.selectedId=id;this.data.selectedBySession[sessionId]=id;this.persist();}
 rename(id,name,sessionId){const take=this.list(sessionId).find(t=>t.id===id);if(!take)throw Error('Take not found.');take.name=takeSchema.shape.name.parse(name);this.persist();}
 discard(id,sessionId){if(!this.list(sessionId).some(t=>t.id===id))throw Error('Take not found.');this.data.takes=this.data.takes.filter(t=>t.id!==id);if(this.data.selectedId===id)this.data.selectedId=null;if(this.data.selectedBySession[sessionId]===id)delete this.data.selectedBySession[sessionId];this.persist();}
 placed(performance,takeId){if(this.loadError)return;const canonical=JSON.stringify(scenePerformanceSchema.parse(performance));const matches=this.data.takes.filter(t=>JSON.stringify(t.performance)===canonical),take=matches.find(t=>t.id===(takeId??this.selected(performance.sessionId)?.id))??matches[0];if(take)take.placements++;this.persist();}
}
export function sceneTakesView(library,session,disabled,esc,playingTakeId=null){
 if(library.loadError)return `<section class="daw-scenes"><p role="alert">${esc(library.loadError)}</p></section>`;
 const selected=library.selected(session.id),off=disabled?'disabled':'',other=library.data.takes.filter(t=>t.performance.sessionId!==session.id);
 const otherView=other.length?`<details><summary>Other project takes · ${other.length}</summary><p>These recordings belong to other projects and cannot be placed here.</p><ul>${other.map(t=>`<li>${esc(t.name)} · ${esc(new Date(t.createdAt).toLocaleString())} <button type="button" data-scene-take-discard="${esc(t.id)}" aria-label="Discard ${esc(t.name)} from another project" ${off}>Discard take</button></li>`).join('')}</ul></details>`:'';
 if(!selected)return otherView?`<section class="daw-scenes">${otherView}</section>`:'';
 const header=`<form data-scene-takes><label>Recorded takes<select name="takeId" ${off}>${library.list(session.id).map(t=>`<option value="${esc(t.id)}" ${t.id===selected.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label><label>Take name<input name="name" value="${esc(selected.name)}" maxlength="100" required ${off}></label><button ${off}>Rename take</button><button type="button" data-scene-take-preview ${off||!availableScenePerformance(session,selected.performance)?'disabled':''}>Preview take</button>${playingTakeId?`<button type="button" data-scene-take-stop ${off}>Stop take preview</button>`:''}<small>Recorded ${esc(new Date(selected.createdAt).toLocaleString())}${selected.placements?' · Previously placed in arrangement':''}. Takes stay available until you discard them.</small>${library.saved?'':'<p role="alert">Device storage failed. These takes are only in memory; keep this page open.</p>'}</form>`;
 return scenePerformanceView(selected.performance,session,disabled,header+otherView);
}
