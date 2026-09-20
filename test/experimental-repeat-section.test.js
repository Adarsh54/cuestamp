import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {repeatAutomationSection} from '../src/experimental/repeat-section.js';
import {curveAutomationValue} from '../src/experimental/automation-curves.js';
import {planDawEdit} from '../server/daw-agent.js';
const repeat=(start=1,end=3,count=1)=>({op:'session.repeatSection',values:{start,end,count}});
const fixture=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'a',kind:'audio'}},{op:'region.add',target:'a',values:{id:'r',assetId:'source',duration:4,offset:10}},{op:'region.set',target:'r',values:{reverse:true}},{op:'track.add',values:{id:'m',kind:'midi'}},{op:'region.add',target:'m',values:{id:'midi',duration:4}},{op:'note.add',target:'midi',values:{id:'note',start:.5,duration:3}},{op:'track.add',values:{id:'v',kind:'video'}},{op:'region.add',target:'v',values:{id:'video',start:2,duration:2,offset:8}},{op:'marker.add',values:{id:'left',time:1,name:'Verse'}},{op:'marker.add',values:{id:'right',time:3,name:'Chorus'}}]);
test('repeat copies cropped reverse audio, MIDI and video and shifts later arrangement, in one undo',()=>{
 const h=new SessionHistory(fixture()),before=structuredClone(h.session);h.execute([repeat()]);const s=h.session;
 assert.deepEqual(s.tracks[0].regions.map(r=>[r.start,r.duration,r.offset]),[[0,3,11],[5,1,10],[3,2,11]]);
 assert.deepEqual(s.tracks[1].regions.at(-1).notes.map(n=>[n.start,n.duration]),[[0,2]]);assert.notEqual(s.tracks[1].regions.at(-1).notes[0].id,'note');
 assert.deepEqual(s.tracks[2].regions.map(r=>[r.start,r.duration,r.offset]),[[2,1,8],[5,1,9],[4,1,8]]);
 assert.deepEqual(s.markers.map(m=>[m.name,m.time]),[['Verse',1],['Chorus',5],['Verse',3]]);
 h.undo();assert.deepEqual(h.session.tracks,before.tracks);h.redo();assert.deepEqual(h.session.tracks,s.tracks);
});
test('repeated automation matches source curves and preserves curves before and after insertion',()=>{
 for(const shape of ['linear','hold','smooth','easeIn','easeOut'])for(const [start,end] of [[0,2],[.17,3.2],[1,4],[3,6],[5,6]]){
  const points=[{id:'a',parameter:'gainDb',time:0,value:-20,shape},{id:'b',parameter:'gainDb',time:2,value:-5,shape},{id:'c',parameter:'gainDb',time:4,value:-10,shape}];const out=repeatAutomationSection(points,start,end),duration=end-start;
  for(let time=0;time<8;time+=.013){const sourceTime=time<end?time:time-duration;const actual=curveAutomationValue(out,'gainDb',time,0),expected=curveAutomationValue(points,'gainDb',sourceTime,0);assert.ok(Math.abs(actual-expected)<1e-8,`${shape} ${start},${end} at ${time}: ${actual} != ${expected}`);}
  assert.equal(new Set(out.map(p=>p.id)).size,out.length);assert.equal(new Set(out.map(p=>p.time)).size,out.length);
 }
});
test('multiple copies retain source section, duplicate comp selections and move later ranges',()=>{
 const s=fixture();s.loopStart=1;s.loopEnd=3;s.audioPunchStart=3;s.audioPunchEnd=4;s.midiPunchStart=2;s.midiPunchEnd=4;s.tracks[0].compAlternatives=[{id:'comp',name:'Take',segments:[{regionId:'r',start:0,end:4}],edgeFade:0,crossfade:0,crossfadeShape:'linear',muteSource:false}];
 const out=applyCommands(s,[repeat(1,3,2)]),t=out.tracks[0];assert.deepEqual(t.regions.map(r=>[r.start,r.duration]),[[0,3],[7,1],[5,2],[3,2]]);assert.deepEqual(t.compAlternatives[0].segments.map(s=>[s.start,s.end]),[[0,3],[3,5],[5,7],[7,8]]);assert.doesNotThrow(()=>applyCommands(out,[{op:'comp.createTrack',target:'a',values:{compId:'comp'}}]));assert.deepEqual([out.loopStart,out.loopEnd,out.audioPunchStart,out.audioPunchEnd,out.midiPunchStart,out.midiPunchEnd],[1,3,7,8,2,8]);
});
test('invalid bounds, counts, track protection and capacity reject the whole edit',()=>{
 const s=fixture(),before=structuredClone(s);for(const values of [[1,1,1],[-1,2,1],[0,Infinity,1],[0,4,0],[0,4,17],[0,4,1.5],[80000,85000,1]])assert.throws(()=>applyCommands(s,[repeat(...values)]));
 const locked=applyCommands(s,[{op:'track.set',target:'m',values:{protected:true}}]);assert.throws(()=>applyCommands(locked,[repeat()]),/Unprotect/);assert.deepEqual(s,before);
 const full=structuredClone(s);full.tracks[0].regions=Array.from({length:500},(_,i)=>({...full.tracks[0].regions[0],id:'r'+i}));assert.throws(()=>applyCommands(full,[repeat()]),/1,000/);assert.equal(full.tracks[0].regions.length,500);
});
test('all automation scopes are repeated and MIDI sustain is chased into the copy',()=>{
 let s=fixture();s=applyCommands(s,[{op:'note.set',target:'note',values:{start:.25,duration:.25}},{op:'event.add',target:'midi',values:{id:'on',type:'controlChange',parameter:64,value:127,start:0}},{op:'event.add',target:'midi',values:{id:'off',type:'controlChange',parameter:64,value:0,start:2.5}},{op:'track.add',values:{id:'bus',kind:'bus'}},{op:'send.set',target:'a',values:{busId:'bus',gainDb:-6}},{op:'effect.add',target:'a',values:{id:'fx',kind:'gain'}},{op:'effect.add',target:s.id,values:{id:'masterfx',kind:'gain'}}]);
 const points=id=>[{id,parameter:'gainDb',time:2,value:-6},{id:id+'later',parameter:'gainDb',time:4,value:0}];s.masterAutomation=points('master');s.masterEffects[0].automation=points('masterfxpoint');s.tracks[0].automation=points('track');s.tracks[0].effects[0].automation=points('effect');s.tracks[0].sends[0].automation=points('send');
 const out=applyCommands(s,[repeat()]);for(const lane of [out.masterAutomation,out.masterEffects[0].automation,out.tracks[0].automation,out.tracks[0].effects[0].automation,out.tracks[0].sends[0].automation]){assert.ok(lane.some(p=>p.time===4&&p.value===-6));assert.ok(lane.some(p=>p.time===6&&p.value===0));}
 const copy=out.tracks[1].regions.at(-1);assert.equal(copy.notes.length,1);assert.equal(copy.notes[0].start,0);assert.ok(copy.events.some(e=>e.parameter===64&&e.value===127&&e.start===0));assert.ok(copy.events.some(e=>e.parameter===64&&e.value===0&&e.start===1.5));
});
test('agent requests the same atomic repeat operation',async()=>{const session=fixture(),commands=[repeat()];const result=await planDawEdit({session,instruction:'Repeat seconds one to three across the whole arrangement'},{key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Repeat section',commands})}]})})});assert.equal(applyCommands(session,result.commands).tracks[0].regions.at(-1).start,3);});
test('automation seams also work before the first point and with multiple repetitions',()=>{
 const points=[{id:'a',parameter:'pan',time:2,value:-1,shape:'smooth'},{id:'b',parameter:'pan',time:4,value:1,shape:'hold'}];
 for(const [start,end] of [[0,1],[0,3],[1,3],[2,4],[3,5]]){let out=points;for(let n=0;n<3;n++)out=repeatAutomationSection(out,start,end);const duration=end-start;for(let time=0;time<12;time+=.013){const source=time<end?time:time<end+3*duration?start+(time-end)%duration:time-3*duration;const expected=curveAutomationValue(points,'pan',source,0);assert.ok(Math.abs(curveAutomationValue(out,'pan',time,0)-expected)<1e-8,`${start},${end} at ${time}`);}}
});
test('fractional repeated comp boundaries remain inside their source regions',()=>{
 for(let i=1;i<=50;i++){const start=i*.017,end=start+.333;let s=applyCommands(newSession(),[{op:'track.add',values:{id:'a',kind:'audio'}},{op:'region.add',target:'a',values:{id:'r',assetId:'source',duration:2}}]);s.tracks[0].compAlternatives=[{id:'c',name:'Comp',segments:[{regionId:'r',start:0,end:2}],edgeFade:0,crossfade:0,crossfadeShape:'linear',muteSource:false}];s=applyCommands(s,[repeat(start,end,2)]);assert.doesNotThrow(()=>applyCommands(s,[{op:'comp.createTrack',target:'a',values:{compId:'c'}}]));}
});

test('insert and delete time also preserve fractional comp boundaries',()=>{
 for(const op of ['session.insertTime','session.deleteTime'])for(let i=1;i<=50;i++){const start=i*.017,end=start+.333;let s=applyCommands(newSession(),[{op:'track.add',values:{id:'a',kind:'audio'}},{op:'region.add',target:'a',values:{id:'r',assetId:'source',duration:2}}]);s.tracks[0].compAlternatives=[{id:'c',name:'Comp',segments:[{regionId:'r',start:0,end:2}],edgeFade:0,crossfade:0,crossfadeShape:'linear',muteSource:false}];s=applyCommands(s,[{op,values:op==='session.insertTime'?{position:start,duration:end-start}:{start,end}}]);assert.doesNotThrow(()=>applyCommands(s,[{op:'comp.createTrack',target:'a',values:{compId:'c'}}]));}
});
