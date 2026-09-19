import test from 'node:test';import assert from 'node:assert/strict';
import {SessionHistory} from '../src/experimental/session.js';
import {historyContext,applyHistoryAction} from '../src/experimental/agent-history.js';
import {planDawEdit} from '../server/daw-agent.js';
const call=args=>({type:'function_call',name:'navigate_history',arguments:JSON.stringify(args)});
const adapter=(calls,inspect=()=>{})=>({key:'test',model:'test',fetchImpl:async(_,options)=>{inspect(JSON.parse(options.body));return {ok:true,json:async()=>({output:calls})};}});
const fixture=()=>{const h=new SessionHistory();h.execute([{op:'session.set',values:{title:'First'}}]);h.execute([{op:'session.set',values:{title:'Second'}}]);return h;};
test('history actions use existing stacks, validate full count atomically and remain redoable',()=>{
 const h=fixture(),context=historyContext(h),before=structuredClone(h.session);assert.throws(()=>applyHistoryAction(h,{operation:'undo',steps:3},context),/Only 2/);assert.deepEqual(h.session,before);
 assert.equal(applyHistoryAction(h,{operation:'undo',steps:2},context),'Undid 2 edits.');assert.equal(h.session.title,'Untitled session');assert.equal(h.session.revision,before.revision+2);assert.equal(h.future.length,2);assert.equal(h.past.length,0);
 assert.equal(applyHistoryAction(h,{operation:'redo',steps:1},historyContext(h)),'Redid 1 edit.');assert.equal(h.session.title,'First');assert.equal(h.future.length,1);
 assert.throws(()=>applyHistoryAction(h,{operation:'undo',steps:1},context),/does not match/);
 h.execute([{op:'session.set',values:{title:'New branch'}}]);assert.equal(h.future.length,0);assert.throws(()=>applyHistoryAction(h,{operation:'redo',steps:1},historyContext(h)),/Only 0/);
 for(const value of [{operation:'clear',steps:1},{operation:'undo',steps:0},{operation:'undo',steps:1.5},{operation:'undo',steps:101},{operation:'undo',steps:1,target:'track'}])assert.throws(()=>applyHistoryAction(h,value,historyContext(h)));
});
test('history tool is capability gated, session bound, strict and separate from edits',async()=>{
 const h=fixture(),input={instruction:'Undo twice',session:h.session,allowHistory:true,historyContext:historyContext(h)};let sent;const result=await planDawEdit(input,adapter([call({operation:'undo',steps:2})],body=>sent=body));assert.equal(result.action,'history');assert.deepEqual(result.commands,[]);assert.equal(h.session.title,'Second');const tool=sent.tools.find(t=>t.name==='navigate_history');assert.equal(tool.strict,true);assert.equal(tool.parameters.additionalProperties,false);assert.deepEqual(tool.parameters.required,['operation','steps']);assert.deepEqual(JSON.parse(sent.input[1].content).historyContext,input.historyContext);
 await assert.rejects(planDawEdit({...input,allowHistory:false},adapter([call({operation:'undo',steps:1})])),/Unexpected/);
 for(const historyContext of [undefined,{...input.historyContext,revision:999}])await assert.rejects(planDawEdit({...input,historyContext},adapter([])),{status:400});
 await assert.rejects(planDawEdit(input,adapter([call({operation:'redo',steps:1})])),/Only 0/);
 await assert.rejects(planDawEdit(input,adapter([call({operation:'undo',steps:1}),call({operation:'redo',steps:1})])),/Unexpected/);
});
