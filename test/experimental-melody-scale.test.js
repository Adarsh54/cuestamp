import test from 'node:test';
import assert from 'node:assert/strict';
import {SessionHistory} from '../src/experimental/session.js';
import {updateMelodyDraft,melodyDraftContext,melodyDraftNotes} from '../src/experimental/melody-draft.js';
import {planDawEdit} from '../server/daw-agent.js';
const setup=()=>{const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'audio'}},{op:'region.add',target:'t',values:{id:'r',assetId:'a',duration:2}}]);return {h,a:{token:crypto.randomUUID(),sessionId:h.session.id,revision:h.session.revision,regionId:'r',notes:Array.from({length:130},()=>({pitch:61,start:0,duration:1,velocity:.8,cents:12,confidence:.9})),edits:{1:{excluded:true},2:{fineCents:25}}}};};
const action={operation:'scale',edits:[],scale:{root:0,mode:'major'}};
test('scale correction covers all pages, skips exclusions, respects fine target and preserves measurements',()=>{
 const {h,a}=setup(),before=structuredClone(a),next=updateMelodyDraft(h.session,a,action),notes=melodyDraftNotes(next);
 assert.equal(notes[0].pitch,60);assert.equal(notes[1].pitch,61);assert.equal(notes[2].pitch,62);assert.equal(notes[2].fineCents,0);assert.equal(notes[129].pitch,60);
 assert.deepEqual(a,before);assert.notEqual(next.token,a.token);assert.equal(next.saved,false);
 for(const bad of [{...action,scale:null},{...action,scale:{root:12,mode:'major'}},{...action,operation:'save'}])assert.throws(()=>updateMelodyDraft(h.session,a,bad));
 assert.throws(()=>updateMelodyDraft(h.session,next,action,melodyDraftContext(h.session,a)),/changed/);
});
test('agent scale action carries captured draft identity and strict nullable options',async()=>{
 const {h,a}=setup();let request;const result=await planDawEdit({session:h.session,instruction:'Tune this draft to C major',melodyDraft:melodyDraftContext(h.session,a)},{key:'test',model:'test',fetchImpl:async(_,init)=>{request=JSON.parse(init.body);return {ok:true,json:async()=>({output:[{type:'function_call',name:'edit_melody_draft',arguments:JSON.stringify(action)}]})};}});
 assert.deepEqual(result.options,action);assert.equal(result.draftToken,a.token);assert.deepEqual(result.commands,[]);
 const schema=request.tools.find(t=>t.name==='edit_melody_draft').parameters;assert.ok(schema.required.includes('scale'));
});
