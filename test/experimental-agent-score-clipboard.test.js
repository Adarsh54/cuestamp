import test from 'node:test';import assert from 'node:assert/strict';
import {SessionHistory} from '../src/experimental/session.js';import {planDawEdit} from '../server/daw-agent.js';
const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:8}}]);
const session=h.session,scoreClipboard={sessionId:session.id,revision:session.revision,token:crypto.randomUUID(),count:2},options={regionId:'r',beat:4,timing:'beats',extend:false};
const call=value=>({type:'function_call',name:'paste_score_notes',arguments:JSON.stringify(value)});
const adapter=(calls,inspect=()=>{})=>({key:'test',model:'test',fetchImpl:async(_,o)=>{inspect(JSON.parse(o.body));return {ok:true,json:async()=>({output:calls})};}});
test('score clipboard paste tool exposes summary only and validates target without mutating document',async()=>{
 let sent;const before=structuredClone(session),result=await planDawEdit({session,instruction:'Paste copied notes into r at beat offset 4',scoreClipboard},adapter([call(options)],body=>sent=body));
 assert.equal(result.action,'paste_score_notes');assert.equal(result.scoreClipboardToken,scoreClipboard.token);assert.deepEqual(result.options,options);assert.deepEqual(result.commands,[]);assert.deepEqual(session,before);
 const tool=sent.tools.find(t=>t.name==='paste_score_notes');assert.equal(tool.strict,true);assert.equal(tool.parameters.additionalProperties,false);assert.deepEqual(tool.parameters.required,['regionId','beat','timing','extend']);assert.deepEqual(JSON.parse(sent.input[1].content).scoreClipboard,scoreClipboard);
});
test('score paste rejects unobserved clipboard, stale context, continuations and invalid actions',async()=>{
 const input={session,instruction:'Paste',scoreClipboard};
 await assert.rejects(planDawEdit({...input,scoreClipboard:undefined},adapter([call(options)])),/Unexpected/);
 await assert.rejects(planDawEdit({...input,scoreClipboard:{...scoreClipboard,revision:99}},adapter([])),{status:400});
 await assert.rejects(planDawEdit({...input,editingContinuation:true},adapter([call(options)])),/Continuation/);
 for(const bad of [{...options,regionId:'missing'},{...options,beat:-1},{...options,timing:'guess'},{...options,extra:1}])await assert.rejects(planDawEdit(input,adapter([call(bad)])));
 await assert.rejects(planDawEdit(input,adapter([call(options),call(options)])),/Unexpected/);
});
test('agent copy/cut resolves observed notes and is capability gated',async()=>{
 const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:4}},{op:'note.add',target:'r',values:{id:'n',pitch:60,duration:1}}]);
 const session=h.session,scoreCopy={sessionId:session.id,revision:session.revision,epoch:0},input={session,scoreCopy,instruction:'Cut the selected score notes',selectedNoteIds:['n']},options={operation:'cut',regionId:'r',noteIds:null},copyCall=value=>({type:'function_call',name:'copy_score_notes',arguments:JSON.stringify(value)});
 let sent;const result=await planDawEdit(input,adapter([copyCall(options)],body=>sent=body));assert.deepEqual(result.options.noteIds,['n']);assert.equal(result.action,'copy_score_notes');assert.equal(result.scoreCopyEpoch,0);assert.equal(session.tracks[0].regions[0].notes.length,1);assert.equal(sent.tools.find(t=>t.name==='copy_score_notes').strict,true);
 await assert.rejects(planDawEdit({...input,scoreCopy:undefined},adapter([copyCall(options)])),/Unexpected/);
 await assert.rejects(planDawEdit({...input,selectedNoteIds:[]},adapter([copyCall(options)])),/distinct/);
 await assert.rejects(planDawEdit(input,adapter([copyCall({...options,noteIds:['missing']})])),/belong/);
 await assert.rejects(planDawEdit({...input,scoreCopy:{...scoreCopy,revision:999}},adapter([])),{status:400});
});
