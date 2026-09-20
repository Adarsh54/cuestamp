import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory,sessionSchema} from '../src/experimental/session.js';
import {planDawEdit} from '../server/daw-agent.js';
const add=(id,name,start,end)=>({op:'section.add',values:{id,name,start,end}});
const fixture=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:8}},{op:'note.add',target:'r',values:{id:'n',start:0,duration:8}},add('verse','Verse',0,4),add('chorus','Chorus',4,8)]);
const bounds=s=>s.sections.map(s=>[s.name,s.start,s.end]).sort((a,b)=>a[1]-b[1]);
test('section metadata validates bounds, overlaps and globally unique IDs without changing content',()=>{
 const s=fixture(),out=applyCommands(s,[{op:'section.set',target:'verse',values:{name:'  Intro  ',end:3}},{op:'section.delete',target:'chorus'}]);assert.deepEqual(out.tracks,s.tracks);assert.deepEqual(bounds(out),[['Intro',0,3]]);
 for(const command of [add('overlap','Bad',2,5),add('empty','Bad',3,3),add('n','Collision',9,10),add('space',' ',9,10),{op:'section.set',target:'verse',values:{end:5}},{op:'section.delete',target:'missing'}])assert.throws(()=>applyCommands(s,[command]));assert.equal(s.sections.length,2);assert.deepEqual(sessionSchema.parse(newSession()).sections,[]);
});
test('insertion splits crossing labels; deletion closes their ranges and removes contained labels',()=>{
 const s=fixture(),insert=applyCommands(s,[{op:'session.insertTime',values:{position:2,duration:1}}]);assert.deepEqual(bounds(insert),[['Verse',0,2],['Verse',3,5],['Chorus',5,9]]);assert.equal(insert.sections[0].id,'verse');assert.notEqual(insert.sections[1].id,'verse');
 const deleted=applyCommands(s,[{op:'session.deleteTime',values:{start:2,end:6}}]);assert.deepEqual(bounds(deleted),[['Verse',0,2],['Chorus',2,4]]);assert.deepEqual(bounds(applyCommands(s,[{op:'session.deleteTime',values:{start:0,end:4}}])),[['Chorus',0,4]]);
});
test('repeat and copy include clipped labels and move keeps a wholly moved section identity',()=>{
 const s=fixture(),repeated=applyCommands(s,[{op:'section.editContent',target:'verse',values:{action:'repeat',count:2}}]);assert.deepEqual(bounds(repeated),[['Verse',0,4],['Verse',4,8],['Verse',8,12],['Chorus',12,16]]);
 const copied=applyCommands(s,[{op:'session.transferSection',values:{mode:'copy',start:2,end:6,position:1}}]);assert.deepEqual(bounds(copied),[['Verse',0,1],['Verse',1,3],['Chorus',3,5],['Verse',5,8],['Chorus',8,12]]);
 const moved=applyCommands(s,[{op:'section.editContent',target:'chorus',values:{action:'move',position:0}}]);assert.deepEqual(bounds(moved),[['Chorus',0,4],['Verse',4,8]]);assert.equal(moved.sections.find(s=>s.start===0).id,'chorus');
});
test('remove content closes the gap and undo restores sections and music together',()=>{
 const h=new SessionHistory(fixture()),before=structuredClone(h.session);h.execute([{op:'section.editContent',target:'verse',values:{action:'remove'}}]);assert.deepEqual(bounds(h.session),[['Chorus',0,4]]);assert.equal(h.session.tracks[0].regions[0].duration,4);h.undo();assert.deepEqual(h.session.tracks,before.tracks);assert.deepEqual(h.session.sections,before.sections);h.redo();assert.equal(h.session.sections.length,1);
});
test('protected content rejects section actions but permits metadata changes',()=>{
 const s=applyCommands(fixture(),[{op:'track.set',target:'t',values:{protected:true}}]);for(const values of [{action:'remove'},{action:'repeat'},{action:'copy',position:8},{action:'move',position:8}])assert.throws(()=>applyCommands(s,[{op:'section.editContent',target:'verse',values}]),/Unprotect/);assert.doesNotThrow(()=>applyCommands(s,[{op:'section.set',target:'verse',values:{name:'Locked verse'}}]));
});
test('section limits and malformed actions reject complete batches',()=>{
 const s=fixture();for(const values of [{action:'bad'},{action:'remove',count:1},{action:'repeat',position:10},{action:'copy'}])assert.throws(()=>applyCommands(s,[{op:'section.editContent',target:'verse',values}]));
 s.sections=Array.from({length:256},(_,i)=>({id:'s'+i,name:'Section',start:i*2,end:i*2+2}));assert.throws(()=>applyCommands(s,[{op:'session.repeatSection',values:{start:0,end:2}}]));assert.equal(s.sections.length,256);
});
test('agent can target a named arrangement section',async()=>{const session=fixture(),commands=[{op:'section.editContent',target:'chorus',values:{action:'move',position:0}}];const result=await planDawEdit({session,instruction:'Move the chorus before the verse'}, {key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Move chorus',commands})}]})})});assert.deepEqual(bounds(applyCommands(session,result.commands)),[['Chorus',0,4],['Verse',4,8]]);});
