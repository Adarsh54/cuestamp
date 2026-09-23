import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory,sessionSchema} from '../src/experimental/session.js';
import {planDawEdit} from '../server/daw-agent.js';
const fixture=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'t',kind:'audio'}},...['a','b','c'].map((id,i)=>({op:'region.add',target:'t',values:{id,assetId:'source'+i,start:i===2?10:0,duration:4}}))]);
const create={op:'takes.create',target:'t',values:{regionIds:'a,b',name:'Vocals',activeRegionId:'b'}};
test('group/select/ungroup preserve media and unrelated regions with undo and serialization',()=>{
 const before=fixture(),h=new SessionHistory(before);h.execute([create]);const track=h.session.tracks[0],groupId=track.regions[0].takeGroup.id;
 assert.deepEqual(track.regions.map(r=>r.mute),[true,false,false]);assert.deepEqual(track.regions.map(r=>r.assetId),before.tracks[0].regions.map(r=>r.assetId));assert.equal(track.regions[0].takeGroup.takeId,'a');assert.deepEqual(sessionSchema.parse(JSON.parse(JSON.stringify(h.session))),h.session);
 h.execute([{op:'takes.select',target:'t',values:{groupId,regionId:'a'}}]);assert.deepEqual(h.session.tracks[0].regions.map(r=>r.mute),[false,true,false]);h.undo();assert.deepEqual(h.session.tracks[0].regions.map(r=>r.mute),[true,false,false]);h.redo();h.execute([{op:'takes.ungroup',target:'t',values:{groupId}}]);assert.ok(h.session.tracks[0].regions.every(r=>!r.takeGroup));assert.deepEqual(h.session.tracks[0].regions.map(r=>r.mute),[false,true,false]);
});
test('grouping rejects nonoverlapping, duplicate, missing and protected regions atomically',()=>{
 const before=fixture();for(const ids of ['a','a,a','a,c','a,missing'])assert.throws(()=>applyCommands(before,[{...create,values:{...create.values,regionIds:ids}}]));
 assert.throws(()=>applyCommands(applyCommands(before,[{op:'track.set',target:'t',values:{protected:true}}]),[create]),/Unprotect/);
 const grouped=applyCommands(before,[create]);assert.throws(()=>applyCommands(grouped,[create]),/ungrouped/);assert.deepEqual(before.tracks[0].regions.map(r=>r.mute),[false,false,false]);
});
test('selecting a split take enables every fragment; created comp is independent',()=>{
 let s=applyCommands(fixture(),[create]),groupId=s.tracks[0].regions[0].takeGroup.id;s=applyCommands(s,[{op:'region.split',target:'a',values:{time:2}},{op:'takes.select',target:'t',values:{groupId,regionId:'a'}}]);
 const fragments=s.tracks[0].regions.filter(r=>r.takeGroup?.takeId==='a');assert.equal(fragments.length,2);assert.ok(fragments.every(r=>!r.mute));assert.equal(s.tracks[0].regions.find(r=>r.id==='b').mute,true);
 const comp=applyCommands(s,[{op:'track.comp',target:'t',values:{segments:JSON.stringify([{regionId:'b',start:0,end:4}])}}]);assert.ok(comp.tracks[1].regions.every(r=>!r.takeGroup&&!r.mute));
});
test('agent can select a real take through the same validated command',async()=>{
 const session=applyCommands(fixture(),[create]),groupId=session.tracks[0].regions[0].takeGroup.id,commands=[{op:'takes.select',target:'t',values:{groupId,regionId:'a'}}];
 const result=await planDawEdit({session,instruction:'Use the first vocal take'},{key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({commands,summary:'Selected first take.'})}]})})});assert.deepEqual(result.commands,commands);assert.equal(applyCommands(session,result.commands).tracks[0].regions[0].mute,false);
});
