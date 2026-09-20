import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {deleteAutomationTime} from '../src/experimental/delete-time.js';
import {curveAutomationValue} from '../src/experimental/automation-curves.js';
import {planDawEdit} from '../server/daw-agent.js';
const cut=(start=2,end=4)=>({op:'session.deleteTime',values:{start,end}});
const fixture=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'a',kind:'audio'}},{op:'region.add',target:'a',values:{id:'r',assetId:'source',duration:6,offset:10}},{op:'region.set',target:'r',values:{reverse:true}},{op:'track.add',values:{id:'m',kind:'midi'}},{op:'region.add',target:'m',values:{id:'midi',duration:6}},{op:'note.add',target:'midi',values:{id:'note',start:1,duration:4}},{op:'track.add',values:{id:'v',kind:'video'}},{op:'region.add',target:'v',values:{id:'video',start:3,duration:3,offset:8}},{op:'region.add',target:'a',values:{id:'inside',start:2,duration:2}},{op:'region.add',target:'a',values:{id:'later',start:4,duration:2}},{op:'marker.add',values:{id:'left',time:1}},{op:'marker.add',values:{id:'deleted',time:2}},{op:'marker.add',values:{id:'right',time:4}}]);
test('delete time crops reverse audio, carries MIDI, shifts video and markers and supports undo',()=>{
 const h=new SessionHistory(fixture()),before=structuredClone(h.session);h.execute([cut()]);const s=h.session;
 assert.deepEqual(s.tracks[0].regions.map(r=>[r.start,r.duration,r.offset]),[[0,2,14],[2,2,10],[2,2,0]]);
 assert.deepEqual(s.tracks[1].regions.map(r=>r.notes.map(n=>[n.start,n.duration])),[[[1,1]],[[0,1]]]);assert.notEqual(s.tracks[1].regions[1].notes[0].id,'note');
 assert.deepEqual(s.tracks[2].regions.map(r=>[r.id,r.start,r.duration,r.offset]),[['video',2,2,9]]);assert.deepEqual(s.markers.map(m=>[m.id,m.time]),[['left',1],['right',2]]);
 h.undo();assert.deepEqual(h.session.tracks,before.tracks);h.redo();assert.deepEqual(h.session.tracks,s.tracks);
});
test('automation preserves curves outside the sub-microsecond seam for every shape',()=>{
 for(const shape of ['linear','hold','smooth','easeIn','easeOut'])for(const [start,end] of [[0,1.7],[.2,3.3],[2,4],[.01,.02],[3.99,5],[5,6]]){
  const points=[{id:'a',parameter:'gainDb',time:0,value:-20,shape},{id:'b',parameter:'gainDb',time:2,value:-5,shape},{id:'c',parameter:'gainDb',time:4,value:-10,shape}];const out=deleteAutomationTime(points,start,end);
  for(let t=0;t<6;t+=.013){if(t>=start&&t<end)continue;const actual=curveAutomationValue(out,'gainDb',t>=end?t-(end-start):t,0),expected=curveAutomationValue(points,'gainDb',t,0);assert.ok(Math.abs(actual-expected)<1e-8,`${shape} ${start},${end} time ${t}: ${actual} vs ${expected}`);}
  assert.equal(new Set(out.map(p=>p.id)).size,out.length);assert.equal(new Set(out.map(p=>p.time)).size,out.length);
 }
});
test('comp references follow surviving pieces, removed alternatives disappear, collapsed ranges disable',()=>{
 const s=fixture();s.tracks[0].compAlternatives=[{id:'c',name:'Comp',segments:[{regionId:'r',start:1,end:5}],edgeFade:0,crossfade:0,crossfadeShape:'linear',muteSource:false},{id:'gone',name:'Gone',segments:[{regionId:'inside',start:2,end:4}],edgeFade:0,crossfade:0,crossfadeShape:'linear',muteSource:false}];s.loopStart=2;s.loopEnd=4;s.loopEnabled=true;s.audioPunchStart=1;s.audioPunchEnd=5;s.midiPunchStart=4;s.midiPunchEnd=6;
 const out=applyCommands(s,[cut()]);assert.equal(out.tracks[0].compAlternatives.length,1);assert.deepEqual(out.tracks[0].compAlternatives[0].segments,[{regionId:'r',start:1,end:2},{regionId:out.tracks[0].regions[1].id,start:2,end:3}]);assert.deepEqual([out.loopStart,out.loopEnd,out.loopEnabled,out.audioPunchStart,out.audioPunchEnd,out.midiPunchStart,out.midiPunchEnd],[2,3,false,1,3,2,4]);assert.doesNotThrow(()=>applyCommands(out,[{op:'comp.createTrack',target:'a',values:{compId:'c'}}]));
});
test('invalid ranges, protected content and excessive split counts reject atomically',()=>{
 const s=fixture(),before=structuredClone(s);for(const pair of [[2,2],[3,2],[-1,2],[0,Infinity],[0,86401]])assert.throws(()=>applyCommands(s,[cut(...pair)]));
 const protectedSession=applyCommands(s,[{op:'track.set',target:'m',values:{protected:true}}]);assert.throws(()=>applyCommands(protectedSession,[cut()]),/Unprotect/);assert.deepEqual(s,before);
 s.tracks[0].regions=Array.from({length:1000},(_,i)=>({...s.tracks[0].regions[0],id:'r'+i}));assert.throws(()=>applyCommands(s,[cut()]));assert.equal(s.tracks[0].regions.length,1000);
});
test('deletion at zero, full removal, and untouched earlier protected content',()=>{
 const s=fixture(),out=applyCommands(s,[cut(0,86400)]);assert.ok(out.tracks.every(t=>!t.regions.length));assert.equal(out.markers.length,0);assert.equal(out.loopEnabled,false);assert.deepEqual([out.loopStart,out.loopEnd],[0,1]);
 const early=applyCommands(newSession(),[{op:'track.add',values:{id:'t',kind:'audio'}},{op:'region.add',target:'t',values:{duration:1}},{op:'track.set',target:'t',values:{protected:true}}]);assert.doesNotThrow(()=>applyCommands(early,[cut()]));
});
test('agent uses the shared deletion command',async()=>{const session=fixture(),commands=[cut()];const result=await planDawEdit({session,instruction:'Remove seconds two to four across the project and close the gap'},{key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Delete time',commands})}]})})});assert.equal(applyCommands(session,result.commands).tracks[0].regions[1].start,2);});
test('all automation owners follow deletion and pedal-held notes are chased at the seam',()=>{
 let s=fixture();s=applyCommands(s,[{op:'note.set',target:'note',values:{start:.5,duration:.25}},{op:'event.add',target:'midi',values:{id:'on',type:'controlChange',parameter:64,value:127,start:.25}},{op:'event.add',target:'midi',values:{id:'off',type:'controlChange',parameter:64,value:0,start:5}},{op:'track.add',values:{id:'bus',kind:'bus'}},{op:'send.set',target:'a',values:{busId:'bus',gainDb:-6}},{op:'effect.add',target:'a',values:{id:'fx',kind:'gain'}},{op:'effect.add',target:s.id,values:{id:'masterfx',kind:'gain'}}]);
 const point=id=>({id,parameter:'gainDb',time:5,value:-6});s.masterAutomation=[point('master')];s.masterEffects[0].automation=[point('masterfxpoint')];s.tracks[0].automation=[point('track')];s.tracks[0].effects[0].automation=[point('effect')];s.tracks[0].sends[0].automation=[point('send')];
 const out=applyCommands(s,[cut()]);for(const points of [out.masterAutomation,out.masterEffects[0].automation,out.tracks[0].automation,out.tracks[0].effects[0].automation,out.tracks[0].sends[0].automation]){assert.equal(points.length,1);assert.equal(points[0].time,3);}
 const right=out.tracks[1].regions[1];assert.equal(right.notes.length,1);assert.equal(right.notes[0].start,0);assert.ok(right.events.some(e=>e.parameter===64&&e.value===127&&e.start===0));assert.ok(right.events.some(e=>e.parameter===64&&e.value===0&&e.start===1));
});
test('automation before its first point and after its final point retains the proper seam values',()=>{
 const points=[{id:'a',parameter:'pan',time:2,value:-1,shape:'linear'},{id:'b',parameter:'pan',time:4,value:1,shape:'hold'}];
 for(const [start,end] of [[0,1],[1,3],[1,5],[2,4],[3,5]]){const out=deleteAutomationTime(points,start,end);for(const time of [0,.3,.8,1,1.5,2,3,5]){const expected=curveAutomationValue(points,'pan',time<start?time:time+end-start,0);assert.ok(Math.abs(curveAutomationValue(out,'pan',time,0)-expected)<1e-9);}}
});
test('the exact deletion end maps to its start without a floating-point remnant',()=>{
 const s=fixture(),start=.034,end=.367;s.sections=[{id:'section',name:'Removed',start,end}];s.loopStart=start;s.loopEnd=end;s.loopEnabled=true;s.markers=[{id:'boundary',name:'Right boundary',time:end}];const out=applyCommands(s,[cut(start,end)]);assert.deepEqual(out.sections,[]);assert.deepEqual([out.loopStart,out.loopEnd,out.loopEnabled],[start,start+1,false]);assert.equal(out.markers[0].time,start);
});
