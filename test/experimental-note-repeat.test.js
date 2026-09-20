import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {compileTempoMap} from '../src/experimental/tempo-map.js';
const fixture=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:4}},{op:'note.add',target:'r',values:{id:'a',start:2,duration:.5,pitch:60,channel:2,mute:true}},{op:'note.add',target:'r',values:{id:'b',start:2.5,duration:.5,pitch:64}},{op:'event.add',target:'r',values:{id:'cc',start:2,type:'controlChange',parameter:11,value:80}},{op:'tempo.add',values:{beat:8,bpm:60}}]);
test('phrase repeats follow beats across tempo changes and extend only when requested',()=>{
 const s=fixture(),h=new SessionHistory(s),r=s.tracks[0].regions[0];h.execute([{op:'notes.repeat',target:'r',values:{count:3,extend:true}}]);
 const next=h.session.tracks[0].regions[0],map=compileTempoMap(h.session);assert.equal(next.notes.length,8);assert.equal(next.duration,8);
 for(let i=0;i<4;i++)for(let j=0;j<2;j++){const n=next.notes[i*2+j],original=r.notes[j];assert.equal(map.beatAtTime(n.start),map.beatAtTime(original.start)+i*2);assert.equal(map.beatAtTime(n.start+n.duration)-map.beatAtTime(n.start),1);assert.equal(n.mute,original.mute);assert.equal(n.channel,original.channel);}
 assert.equal(new Set(next.notes.map(n=>n.id)).size,8);assert.deepEqual(next.events,r.events);
 h.undo();assert.deepEqual(h.session.tracks,s.tracks);h.redo();assert.equal(h.session.tracks[0].regions[0].notes.length,8);
});
test('seconds mode, explicit note selection and filtering retain legacy absolute timing',()=>{
 const s=fixture(),next=applyCommands(s,[{op:'notes.repeat',target:'r',values:{count:2,seconds:1,extend:true,filter:JSON.stringify({pitchMin:60,pitchMax:60})}}]).tracks[0].regions[0];
 assert.deepEqual(next.notes.slice(2).map(n=>[n.pitch,n.start,n.duration]),[[60,3,.5],[60,4,.5]]);
 assert.equal(next.notes[0].id,'a');assert.equal(next.notes[1].id,'b');
});
test('repeat failures are atomic and protected tracks reject repetitions',()=>{
 const s=fixture(),before=structuredClone(s);
 for(const values of [{count:3},{count:0},{count:101},{count:1,beats:0},{count:1,seconds:1,beats:1},{count:1,noteIds:'missing'},{count:1,extend:'yes'},{count:100,beats:432000,extend:true}])assert.throws(()=>applyCommands(s,[{op:'notes.repeat',target:'r',values}]));
 assert.throws(()=>applyCommands(s,[{op:'track.set',target:'t',values:{protected:true}},{op:'notes.repeat',target:'r',values:{count:1}}]),/Unprotect/);assert.deepEqual(s,before);
 const full=structuredClone(s);full.tracks[0].regions[0].notes=Array.from({length:20000},(_,i)=>({...s.tracks[0].regions[0].notes[0],id:'n'+i}));assert.throws(()=>applyCommands(full,[{op:'notes.repeat',target:'r',values:{noteId:'n0',count:1}}]),/20,000/);
});
test('the agent repeats a selected motif with the same validated command',async()=>{
 const {planDawEdit}=await import('../server/daw-agent.js'),session=fixture(),commands=[{op:'notes.repeat',target:'r',values:{noteIds:'a,b',count:3,extend:true}}];
 const result=await planDawEdit({session,instruction:'Repeat these two notes three times, extending the region',selectedNoteIds:['a','b']},{provider:'openai',key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Repeated motif',commands})}]})})});
 assert.equal(applyCommands(session,result.commands,result.revision).tracks[0].regions[0].notes.length,8);
});
