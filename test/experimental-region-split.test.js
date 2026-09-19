import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {planDawEdit} from '../server/daw-agent.js';
const setup=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'a',kind:'audio'}},{op:'region.add',target:'a',values:{id:'r',assetId:'source',start:1,duration:4,offset:8}},{op:'region.set',target:'r',values:{reverse:true,fadeIn:.1,fadeOut:.2,fadeInShape:'equalPower',gainDb:-3,mute:true}},{op:'region.add',target:'a',values:{id:'later',start:5,duration:2}},{op:'track.add',values:{id:'m',kind:'midi'}},{op:'region.add',target:'m',values:{id:'midi',duration:6}},{op:'note.add',target:'midi',values:{id:'note',start:1,duration:3,pitch:64,channel:2}},{op:'track.add',values:{id:'v',kind:'video'}},{op:'region.add',target:'v',values:{id:'video',start:2,duration:4,offset:3}}]);
const split=(ids='r,midi,video,later',time=3)=>({op:'regions.split',values:{regionIds:ids,time}});
test('group splitting cuts crossing regions across tracks and preserves noncrossing selections and originals',()=>{
 const h=new SessionHistory(setup()),before=structuredClone(h.session);h.execute([split()]);const [a,m,v]=h.session.tracks;
 assert.deepEqual(a.regions.map(r=>[r.start,r.duration,r.offset]),[[1,2,10],[3,2,8],[5,2,0]]);assert.deepEqual(a.regions[2],before.tracks[0].regions[1]);
 for(const r of a.regions.slice(0,2)){assert.equal(r.reverse,true);assert.equal(r.mute,true);assert.equal(r.gainDb,-3);assert.equal(r.fadeInShape,'equalPower');}
 assert.deepEqual(a.regions.slice(0,2).map(r=>[r.fadeIn,r.fadeOut]),[[.1,0],[0,.2]]);assert.equal(a.regions[0].id,'r');assert.notEqual(a.regions[1].id,'r');
 assert.deepEqual(m.regions.map(r=>r.notes.map(n=>[n.start,n.duration,n.pitch,n.channel])),[[[1,2,64,2]],[[0,1,64,2]]]);
 assert.deepEqual(v.regions.map(r=>[r.start,r.duration,r.offset]),[[2,1,3],[3,3,4]]);h.undo();assert.deepEqual(h.session.tracks,before.tracks);h.redo();assert.equal(h.session.tracks[0].regions.length,3);
});
test('single reverse split keeps comp selections usable including exact cut boundaries',()=>{
 const s=setup();s.tracks[0].compAlternatives=[{id:'c',name:'Comp',segments:[{regionId:'r',start:1,end:2},{regionId:'r',start:2,end:4},{regionId:'r',start:4,end:5}],edgeFade:0,crossfade:0,crossfadeShape:'linear',muteSource:false}];
 const out=applyCommands(s,[{op:'region.split',target:'r',values:{time:3}}]),right=out.tracks[0].regions.at(-1);
 assert.deepEqual(out.tracks[0].compAlternatives[0].segments,[{regionId:'r',start:1,end:2},{regionId:'r',start:2,end:3},{regionId:right.id,start:3,end:4},{regionId:right.id,start:4,end:5}]);
 assert.doesNotThrow(()=>applyCommands(out,[{op:'comp.createTrack',target:'a',values:{compId:'c'}}]));
});
test('invalid selection, boundaries and capacity reject the complete batch',()=>{
 const s=setup(),before=structuredClone(s);for(const command of [split('r,r'),split('missing'),split('',3),split('r',1),split('r',5),split('r',Infinity)])assert.throws(()=>applyCommands(s,[{op:'session.set',values:{title:'must not save'}},command]));assert.deepEqual(s,before);
 const full=setup();full.tracks[0].regions=Array.from({length:1000},(_,i)=>({...full.tracks[0].regions[0],id:i?'r'+i:'r'}));assert.throws(()=>applyCommands(full,[split('r,midi')]),/1,000/);assert.equal(full.tracks[1].regions.length,1);
 const comps=setup();comps.tracks[0].compAlternatives=[{id:'c',name:'Comp',segments:Array.from({length:64},()=>({regionId:'r',start:1,end:5})),edgeFade:0,crossfade:0,crossfadeShape:'linear',muteSource:false}];assert.throws(()=>applyCommands(comps,[split('r')]));assert.equal(comps.tracks[0].regions.length,2);
});
test('split is scoped to the explicit selection and retains event payload IDs only on the left',()=>{
 const s=setup();s.tracks[0].regions[0].events=[{id:'event',type:'controlChange',channel:0,parameter:7,start:1,value:100}];const out=applyCommands(s,[split('r')]);assert.deepEqual(out.tracks.slice(1),s.tracks.slice(1));const [left,right]=out.tracks[0].regions;assert.equal(left.events[0].id,'event');assert.notEqual(right.events[0].id,'event');assert.equal(right.events[0].start,0);
});
test('agent returns the same atomic selected-region split',async()=>{const session=setup(),commands=[split()];const result=await planDawEdit({session,instruction:'Split my selected regions at three seconds'},{key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Split selected regions',commands})}]})})});assert.equal(applyCommands(session,result.commands,result.revision).tracks[0].regions.length,3);});
