import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory,sessionSchema} from '../src/experimental/session.js';
import {mediaDestination} from '../src/experimental/media-import-plan.js';
const setup=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'a',name:'Finished',kind:'midi'}},{op:'region.add',target:'a',values:{id:'r',duration:4,assetId:'source'}},{op:'note.add',target:'r',values:{id:'n',pitch:60,start:0,duration:1}},{op:'track.add',values:{id:'b',kind:'midi'}},{op:'region.add',target:'b',values:{id:'other',duration:4}},{op:'track.set',target:'a',values:{protected:true}}]);
const lock=protectedValue=>({op:'track.set',target:'a',values:{protected:protectedValue}});
test('track protection rejects content edits and deletion atomically across command families',()=>{
 const s=setup(),original=structuredClone(s);
 for(const command of [
 {op:'track.delete',target:'a'}, {op:'region.delete',target:'r'},
 {op:'region.set',target:'r',values:{name:'Changed'}}, {op:'region.add',target:'a',values:{duration:1}},
 {op:'note.set',target:'n',values:{pitch:72}}, {op:'note.add',target:'r',values:{pitch:62,duration:1}},
 {op:'event.add',target:'r',values:{type:'controlChange',start:0,parameter:64,value:127}},
 {op:'region.move',target:'r',values:{trackId:'b'}}, {op:'region.move',target:'other',values:{trackId:'a'}},
 {op:'regions.split',values:{regionIds:'other,r',time:2}},
 {op:'session.insertTime',values:{position:2,duration:1}}, {op:'session.set',values:{tempo:90}},
 ]){assert.throws(()=>applyCommands(s,[{op:'session.set',values:{title:'Discard me'}},command]),/Unprotect Finished/,command.op);assert.deepEqual(s,original);}
});
test('unlock must precede editing; rejected history batches preserve state',()=>{
 const h=new SessionHistory(setup()),before=structuredClone(h.session),edit={op:'note.set',target:'n',values:{pitch:65}};
 assert.throws(()=>h.execute([edit,lock(false)]),/Unprotect/);assert.deepEqual(h.session,before);assert.equal(h.past.length,0);
 h.execute([lock(false),edit,lock(true)]);assert.equal(h.session.tracks[0].regions[0].notes[0].pitch,65);assert.equal(h.session.tracks[0].protected,true);
 h.undo();assert.deepEqual(h.session.tracks,before.tracks);h.redo();assert.equal(h.session.tracks[0].regions[0].notes[0].pitch,65);
 const unlocked=applyCommands(before,[lock(false)]);assert.throws(()=>applyCommands(unlocked,[lock(true),edit,lock(false)]),/Unprotect/);
});
test('mixing remains available, copies are editable, protection survives serialization',()=>{
 const s=setup(),out=applyCommands(s,[{op:'track.set',target:'a',values:{gainDb:-6,pan:.5,mute:true,name:'Mix'}},{op:'automation.point',target:'a',values:{parameter:'gainDb',time:0,value:-6}},{op:'track.duplicate',target:'a',values:{id:'copy'}}]);
 assert.deepEqual(out.tracks[0].regions,s.tracks[0].regions);assert.equal(out.tracks[0].protected,true);assert.equal(out.tracks[1].protected,false);
 assert.doesNotThrow(()=>applyCommands(out,[{op:'region.set',target:out.tracks[1].regions[0].id,values:{start:2}}]));
 assert.equal(sessionSchema.parse(JSON.parse(JSON.stringify(out))).tracks[0].protected,true);
});
test('protected audio destinations refuse import and recording preflight',()=>{
 const s=applyCommands(newSession(),[{op:'track.add',values:{id:'audio',kind:'audio',name:'Original'}},{op:'track.set',target:'audio',values:{protected:true}}]);
 assert.throws(()=>mediaDestination(s,'audio'),/Unprotect Original/);assert.equal(mediaDestination(s,undefined),null);
});
test('protected saved comps cannot be changed; explicit copies preserve source',()=>{
 const s=applyCommands(newSession(),[{op:'track.add',values:{id:'a',name:'Finished',kind:'audio'}},{op:'region.add',target:'a',values:{id:'r',duration:4,assetId:'source'}},{op:'track.set',target:'a',values:{protected:true}}]);
 s.tracks[0].compAlternatives=[{id:'c',name:'Best take',segments:[{regionId:'r',start:0,end:4}],edgeFade:0,crossfade:0,crossfadeShape:'linear',muteSource:false}];
 assert.throws(()=>applyCommands(s,[{op:'comp.delete',target:'a',values:{compId:'c'}}]),/Unprotect/);
 assert.doesNotThrow(()=>applyCommands(s,[{op:'comp.createTrack',target:'a',values:{compId:'c'}}]));
});
test('agent edits undergo the same protection validation',async()=>{
 const {planDawEdit}=await import('../server/daw-agent.js');const session=setup();
 const adapter=commands=>({key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Edit notes',commands})}]})})});
 await assert.rejects(()=>planDawEdit({session,instruction:'Transpose the notes'},adapter([{op:'note.set',target:'n',values:{pitch:70}}])),/Unprotect/);
 const result=await planDawEdit({session,instruction:'Unprotect the track and transpose the notes'},adapter([lock(false),{op:'note.set',target:'n',values:{pitch:70}}]));assert.equal(applyCommands(session,result.commands).tracks[0].regions[0].notes[0].pitch,70);
});
