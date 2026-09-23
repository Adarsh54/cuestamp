import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {planDawEdit} from '../server/daw-agent.js';
const fixture=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'t',name:'Recording'}},{op:'region.add',target:'t',values:{id:'r',assetId:'source',start:10,offset:2,duration:10}}]);
const command={op:'region.cycleTakes',target:'r',values:{duration:4,start:5,edgeFade:0}};
test('split passes align source slices, keep partial tail and select last complete pass with undo',()=>{
 const original=fixture(),h=new SessionHistory(original);h.execute([command]);const copy=h.session.tracks[1];assert.equal(h.session.tracks[0].regions[0].mute,true);assert.deepEqual(copy.regions.map(r=>[r.start,r.offset,r.duration,r.mute]),[[5,2,4,true],[5,6,4,false],[5,10,2,true]]);assert.ok(copy.regions.every(r=>r.assetId==='source'));assert.equal(new Set(copy.regions.map(r=>r.takeGroup.id)).size,1);assert.equal(new Set(copy.regions.map(r=>r.takeGroup.takeId)).size,3);h.undo();assert.deepEqual(h.session.tracks,original.tracks);h.redo();assert.equal(h.session.tracks.length,2);
});
test('reversed passes preserve source coverage and exact multiples select the final take',()=>{
 const s=applyCommands(fixture(),[{op:'region.set',target:'r',values:{reverse:true,duration:12}}]),after=applyCommands(s,[command]);assert.deepEqual(after.tracks[1].regions.map(r=>[r.offset,r.reverse,r.mute]),[[10,true,true],[6,true,true],[2,true,false]]);
});
test('invalid splitting is atomic and respects protection, capacity and source state',()=>{
 const s=fixture();for(const values of [{duration:10,start:0},{duration:.01,start:0},{duration:0,start:0},{duration:4,start:86400},{duration:4,start:0,edgeFade:1}])assert.throws(()=>applyCommands(s,[{...command,values}]));
 for(const values of [{protected:true}])assert.throws(()=>applyCommands(applyCommands(s,[{op:'track.set',target:'t',values}]),[command]),/Unprotect/);
 assert.throws(()=>applyCommands(applyCommands(s,[{op:'region.set',target:'r',values:{mute:true}}]),[command]),/audible/);assert.equal(s.tracks.length,1);
});
test('agent validates the same pass-splitting command',async()=>{
 const session=fixture(),result=await planDawEdit({session,instruction:'Split this recording into four-second takes placed at five seconds, no fade'},{key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Split recorded passes.',commands:[command]})}]})})});assert.deepEqual(result.commands,[command]);
});
