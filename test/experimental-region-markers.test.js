import test from 'node:test';
import assert from 'node:assert/strict';
import {SessionHistory} from '../src/experimental/session.js';
import {markersFromRegions} from '../src/experimental/region-markers.js';
import {planDawEdit} from '../server/daw-agent.js';
const setup=()=>{const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'a',name:'Scene A',start:2.0123,duration:2}},{op:'region.add',target:'t',values:{id:'b',name:'Scene B',start:7,duration:1}},{op:'region.add',target:'t',values:{id:'c',name:'Scene A',start:2.0123,duration:1}}]);return h;};
test('region markers preserve exact positions, skip matching pairs and undo as one edit',()=>{
 const h=setup(),before=structuredClone(h.session);
 h.execute([{op:'markers.fromRegions',values:{regionIds:'b,c,a'}}]);
 assert.deepEqual(h.session.markers.map(({name,time})=>({name,time})),[{name:'Scene A',time:2.0123},{name:'Scene B',time:7}]);assert.deepEqual(h.session.tracks,before.tracks);
 const made=structuredClone(h.session);assert.throws(()=>h.execute([{op:'markers.fromRegions',values:{regionIds:'a,b'}}]),/already/);assert.deepEqual(h.session,made);
 h.undo();assert.deepEqual(h.session,{...before,revision:h.session.revision});h.redo();assert.deepEqual(h.session.markers,made.markers);
});
test('region markers reject stale selections, duplicate IDs, extra fields and capacity overflow atomically',()=>{
 const h=setup(),before=structuredClone(h.session);
 for(const values of [{regionIds:'missing'},{regionIds:'a,a'},{regionIds:''},{regionIds:'a',time:3}]){assert.throws(()=>h.execute([{op:'markers.fromRegions',values}]));assert.deepEqual(h.session,before);}
 const full={...before,markers:Array.from({length:1000},(_,i)=>({id:String(i),name:'Existing',time:i}))};assert.throws(()=>markersFromRegions(full,{regionIds:'a'}),/limit/);
 const sameTime={...before,markers:[{id:'old',name:'Other cue',time:2.0123}]};assert.equal(markersFromRegions(sameTime,{regionIds:'a'}).length,1);
});
test('agent can create region markers through the shared validated edit command',async()=>{
 const h=setup();const result=await planDawEdit({session:h.session,instruction:'Make markers from the selected clips',selectedRegionIds:['a','b']},{key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Created scene cues',commands:[{op:'markers.fromRegions',values:{regionIds:'a,b'}}]})}]})})});
 h.execute(result.commands,result.revision);assert.equal(h.session.markers.length,2);
});
