import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,SessionHistory} from '../src/experimental/session.js';
import {conversationTurn} from '../src/experimental/agent-conversation.js';
import {planDawEdit} from '../server/daw-agent.js';
const setup=()=>{const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:8}},{op:'note.add',target:'r',values:{id:'n',pitch:60,start:1,duration:1}}]);return h;};
const delta=(before,after)=>conversationTurn({before,after,instruction:'Set up the score',summary:'Updated score settings',outcome:'applied'});
test('conversation records additions, edits and removals of musical maps and key',()=>{
 const h=setup(),before=structuredClone(h.session);h.execute([{op:'key.set',values:{sharps:-3,mode:'minor'}},{op:'meter.add',values:{id:'m',bar:3,numerator:6,denominator:8}},{op:'tempo.add',values:{id:'p',beat:8,bpm:90}},{op:'section.add',values:{id:'s',name:'Verse',start:0,end:4}}]);
 const added=delta(before,h.session);for(const [entity,id] of [['project key',h.session.id],['tempo change','p'],['time signature','m'],['section','s']])assert.ok(added.changes.some(c=>c.entity===entity&&c.id===id&&c.before===null&&c.after));
 const middle=structuredClone(h.session);h.execute([{op:'key.set',values:{sharps:2,mode:'major'}},{op:'meter.set',target:'m',values:{bar:4}},{op:'tempo.set',target:'p',values:{bpm:100}}]);const edited=delta(middle,h.session);assert.deepEqual(edited.changes.find(c=>c.entity==='project key').before,{sharps:-3,mode:'minor'});assert.equal(edited.changes.find(c=>c.id==='m').after.bar,4);
 const final=structuredClone(h.session);h.execute([{op:'key.clear'},{op:'meter.delete',target:'m'},{op:'tempo.delete',target:'p'},{op:'section.delete',target:'s'}]);const removed=delta(final,h.session);for(const entity of ['project key','tempo change','time signature','section'])assert.ok(removed.changes.some(c=>c.entity===entity&&c.after===null));
 assert.ok(!removed.changes.some(c=>c.entity==='session'&&'keySignature' in (c.before??{})));
});
test('agent receives score state and previous changes, validates scale edits, and leaves source untouched',async()=>{
 const h=setup(),before=structuredClone(h.session);h.execute([{op:'key.set',values:{sharps:-3,mode:'minor'}},{op:'meter.add',values:{id:'m',bar:3,numerator:6,denominator:8}}]);const turn=delta(before,h.session),snapshot=structuredClone(h.session);let request;
 const commands=[{op:'notes.diatonicTranspose',target:'r',values:{useProjectKey:true,steps:2,noteIds:'n'}}];
 const options={provider:'openai',key:'test',model:'test',fetchImpl:async(_,init)=>{request=JSON.parse(init.body);return {ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Moved the selected note up a third in C minor',commands})}]})};}};
 const plan=await planDawEdit({session:h.session,selection:'r',selectedNoteIds:['n'],instruction:'Move the selected note up a third in that key',conversation:[turn]},options);
 const payload=JSON.parse(request.input.at(-1).content);assert.deepEqual(payload.session.keySignature,{sharps:-3,mode:'minor'});assert.equal(payload.session.meterChanges[0].bar,3);assert.deepEqual(payload.conversation,[turn]);assert.deepEqual(h.session,snapshot);
 h.execute(plan.commands,plan.revision);assert.equal(h.session.tracks[0].regions[0].notes[0].pitch,63);h.undo();assert.equal(h.session.tracks[0].regions[0].notes[0].pitch,60);
});
test('agent rejects invalid score edits and protected pitch changes before returning a plan',async()=>{
 const h=setup();h.execute([{op:'key.set',values:{sharps:0,mode:'major'}},{op:'track.set',target:'t',values:{protected:true}}]);const before=structuredClone(h.session);
 for(const commands of [[{op:'key.set',values:{sharps:8,mode:'major'}}],[{op:'meter.add',values:{bar:1,numerator:6,denominator:8}}],[{op:'notes.diatonicTranspose',target:'r',values:{useProjectKey:true,steps:2}}]]){
  await assert.rejects(planDawEdit({session:h.session,instruction:'Edit the score'},{provider:'openai',key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Edit',commands})}]})})}));assert.deepEqual(h.session,before);
 }
});
