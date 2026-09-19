import test from 'node:test';
import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {insertAutomationTime} from '../src/experimental/insert-time.js';
import {curveAutomationValue} from '../src/experimental/automation-curves.js';
import {planDawEdit} from '../server/daw-agent.js';
const command=(position=2,duration=3)=>({op:'session.insertTime',values:{position,duration}});
const fixture=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'audio',kind:'audio'}},{op:'region.add',target:'audio',values:{id:'r',start:0,duration:4,offset:10}},{op:'region.set',target:'r',values:{reverse:true}},{op:'track.add',values:{id:'midi',kind:'midi'}},{op:'region.add',target:'midi',values:{id:'m',duration:4}},{op:'note.add',target:'m',values:{id:'n',start:1,duration:2}},{op:'marker.add',values:{id:'mark',time:2,name:'Cut'}}]);
test('insert time splits reverse audio and sustained MIDI, shifts markers/ranges, and undoes atomically',()=>{
 const h=new SessionHistory(fixture()),before=structuredClone(h.session);h.execute([command()]);const s=h.session;
 assert.deepEqual(s.tracks[0].regions.map(r=>[r.start,r.duration,r.offset,r.reverse]),[[0,2,12,true],[5,2,10,true]]);
 assert.deepEqual(s.tracks[1].regions.map(r=>r.notes.map(n=>[n.start,n.duration])),[[[1,1]],[[0,1]]]);
 assert.equal(s.tracks[1].regions[0].notes[0].id,'n');assert.notEqual(s.tracks[1].regions[1].notes[0].id,'n');assert.equal(s.markers[0].time,5);assert.equal(s.loopEnd,7);
 h.undo();assert.deepEqual(h.session.tracks,before.tracks);h.redo();assert.deepEqual(h.session.tracks,s.tracks);
});
test('automation preserves rendered curves before/after insertion and holds the gap',()=>{
 for(const shape of ['linear','hold','smooth','easeIn','easeOut'])for(const position of [0,1.17,2,3,4]){
  const points=[{id:'a',parameter:'gainDb',time:0,value:-20,shape},{id:'b',parameter:'gainDb',time:2,value:-5,shape},{id:'c',parameter:'gainDb',time:4,value:-10}];
  const output=insertAutomationTime(points,position,3);
  for(let time=0;time<5;time+=.013){const actual=curveAutomationValue(output,'gainDb',time>=position?time+3:time,0),expected=curveAutomationValue(points,'gainDb',time,0);assert.ok(Math.abs(actual-expected)<1e-9,`${shape} at ${position} time ${time}: ${actual} != ${expected}`);}
  assert.equal(new Set(output.map(p=>p.id)).size,output.length);
 }
});
test('comp selections remap split sources, future regions and exact boundaries shift correctly',()=>{
 const s=fixture();s.tracks[0].compAlternatives=[{id:'comp',name:'Take',segments:[{regionId:'r',start:1,end:3}],edgeFade:0,muteSource:true,crossfade:0,crossfadeShape:'linear'}];
 const out=applyCommands(s,[command()]),regions=out.tracks[0].regions;
 assert.deepEqual(out.tracks[0].compAlternatives[0].segments,[{regionId:'r',start:1,end:2},{regionId:regions[1].id,start:5,end:6}]);
 const boundary=applyCommands(s,[command(0,1)]);assert.equal(boundary.tracks[0].regions.length,1);assert.equal(boundary.tracks[0].regions[0].start,1);
});
test('invalid times and capacity failures leave input untouched',()=>{
 const s=fixture(),before=structuredClone(s);for(const args of [[-1,2],[2,0],[2,-1],[86400,1],[2,Infinity]])assert.throws(()=>applyCommands(s,[command(...args)]));
 s.markers[0].time=86400;assert.throws(()=>applyCommands(s,[command()]));s.markers[0].time=2;assert.deepEqual(s,before);
 s.tracks[0].regions=Array.from({length:1000},(_,i)=>({...s.tracks[0].regions[0],id:'r'+i}));assert.throws(()=>applyCommands(s,[command()]));assert.equal(s.tracks[0].regions.length,1000);
});
test('agent can request the same project-wide command',async()=>{const session=fixture(),commands=[command()];const result=await planDawEdit({session,instruction:'Insert three seconds across the project at two seconds'},{key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Insert time',commands})}]})})});assert.equal(applyCommands(session,result.commands,result.revision).markers[0].time,5);});
test('insertion carries pedal-held notes, video offsets, every automation scope and range boundaries',()=>{
 let s=fixture();s=applyCommands(s,[{op:'note.set',target:'n',values:{start:.5,duration:.25}},{op:'event.add',target:'m',values:{id:'pedal-on',type:'controlChange',parameter:64,value:127,start:.25}},{op:'event.add',target:'m',values:{id:'pedal-off',type:'controlChange',parameter:64,value:0,start:3}},{op:'track.add',values:{id:'video',kind:'video'}},{op:'region.add',target:'video',values:{id:'v',start:1,duration:4,offset:5}},{op:'track.add',values:{id:'bus',kind:'bus'}},{op:'send.set',target:'audio',values:{busId:'bus',gainDb:-6}},{op:'effect.add',target:'audio',values:{id:'fx',kind:'gain'}},{op:'effect.add',target:s.id,values:{id:'master-fx',kind:'gain'}}]);
 const point=id=>({id,parameter:'gainDb',time:3,value:-6});s.masterAutomation=[point('master-a')];s.masterEffects[0].automation=[point('master-fx-a')];s.tracks[0].automation=[point('track-a')];s.tracks[0].effects[0].automation=[point('fx-a')];s.tracks[0].sends[0].automation=[point('send-a')];s.loopStart=2;s.loopEnd=4;s.audioPunchStart=0;s.audioPunchEnd=2;s.midiPunchStart=1;s.midiPunchEnd=4;
 const out=applyCommands(s,[command()]),right=out.tracks[1].regions[1];assert.equal(right.notes.length,1);assert.equal(right.notes[0].start,0);assert.ok(right.events.some(e=>e.parameter===64&&e.value===127&&e.start===0));assert.ok(right.events.some(e=>e.parameter===64&&e.value===0&&e.start===1));
 assert.deepEqual(out.tracks[2].regions.map(r=>[r.start,r.duration,r.offset]),[[1,1,5],[5,3,6]]);
 for(const points of [out.masterAutomation,out.masterEffects[0].automation,out.tracks[0].automation,out.tracks[0].effects[0].automation,out.tracks[0].sends[0].automation])assert.equal(points.find(p=>p.id.endsWith('-a')).time,6);
 assert.deepEqual([out.loopStart,out.loopEnd,out.audioPunchStart,out.audioPunchEnd,out.midiPunchStart,out.midiPunchEnd],[5,7,0,2,1,7]);
});
