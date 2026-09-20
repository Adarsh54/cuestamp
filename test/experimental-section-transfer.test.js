import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {curveAutomationValue} from '../src/experimental/automation-curves.js';
import {planDawEdit} from '../server/daw-agent.js';
const transfer=(mode='copy',start=2,end=4,position=6)=>({op:'session.transferSection',values:{mode,start,end,position}});
const fixture=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'a',kind:'audio'}},{op:'region.add',target:'a',values:{id:'r',assetId:'source',duration:8,offset:10}},{op:'region.set',target:'r',values:{reverse:true}},{op:'track.add',values:{id:'m',kind:'midi'}},{op:'region.add',target:'m',values:{id:'midi',duration:8}},{op:'note.add',target:'midi',values:{id:'note',start:1,duration:6}},{op:'track.add',values:{id:'v',kind:'video'}},{op:'region.add',target:'v',values:{id:'video',start:3,duration:3,offset:8}},{op:'marker.add',values:{id:'verse',time:2,name:'Verse'}},{op:'marker.add',values:{id:'chorus',time:4,name:'Chorus'}}]);
test('copy inserts cropped reversed audio, MIDI and video at an independent position',()=>{
 const h=new SessionHistory(fixture()),before=structuredClone(h.session);h.execute([transfer()]);const s=h.session;
 assert.deepEqual(s.tracks[0].regions.map(r=>[r.start,r.duration,r.offset]),[[0,6,12],[8,2,10],[6,2,14]]);
 assert.deepEqual(s.tracks[1].regions.at(-1).notes.map(n=>[n.start,n.duration]),[[0,2]]);assert.notEqual(s.tracks[1].regions.at(-1).notes[0].id,'note');assert.deepEqual(s.tracks[2].regions.at(-1).start,7);assert.deepEqual(s.markers.map(m=>[m.name,m.time]),[['Verse',2],['Chorus',4],['Verse',6]]);
 h.undo();assert.deepEqual(h.session.tracks,before.tracks);h.redo();assert.deepEqual(h.session.tracks,s.tracks);
});
test('forward and backward moves interpret destination in the original timeline and retain marker IDs',()=>{
 const s=fixture(),out=applyCommands(s,[transfer('move')]);assert.deepEqual(out.tracks[0].regions.map(r=>[r.start,r.duration,r.offset]),[[0,2,16],[2,2,12],[6,2,10],[4,2,14]]);assert.equal(out.markers.find(m=>m.id==='verse').time,4);assert.equal(out.markers.find(m=>m.id==='chorus').time,2);
 const back=applyCommands(s,[transfer('move',4,6,1)]);assert.deepEqual(back.tracks[0].regions.map(r=>[r.start,r.duration,r.offset]),[[0,1,17],[3,3,14],[6,2,10],[1,2,12]]);
});
test('source snapshot remains correct when copying into or before the source',()=>{
 const s=fixture();for(const position of [0,2,3,4]){const out=applyCommands(s,[transfer('copy',2,4,position)]),copy=out.tracks[0].regions.at(-1);assert.deepEqual([copy.start,copy.duration,copy.offset],[position,2,14]);}
});
test('automation follows copy/move across shapes and time boundaries',()=>{
 for(const shape of ['linear','hold','smooth','easeIn','easeOut'])for(const [mode,start,end,position] of [['copy',2,4,6],['copy',1.13,3.27,0],['copy',1,4,2],['move',2,4,6],['move',4,6,1],['move',0,2,7]]){
  const s=fixture();s.masterAutomation=[{id:'p0',parameter:'gainDb',time:0,value:-20,shape},{id:'p1',parameter:'gainDb',time:3,value:-5,shape},{id:'p2',parameter:'gainDb',time:8,value:-10,shape}];const out=applyCommands(s,[transfer(mode,start,end,position)]),duration=end-start,dest=mode==='move'&&position>end?position-duration:position;
  for(let t=0;t<10;t+=.013){let original;if(t>=dest&&t<dest+duration)original=start+t-dest;else{original=t>=dest+duration?t-duration:t;if(mode==='move'&&original>=start)original+=duration;}
   const a=curveAutomationValue(out.masterAutomation,'gainDb',t,0),b=curveAutomationValue(s.masterAutomation,'gainDb',original,0);assert.ok(Math.abs(a-b)<1e-8,`${shape} ${mode} ${start},${end}->${position} at ${t}: ${a} != ${b}`);
  }
 }
});
test('fully moved comps and locator ranges follow the section and remain editable',()=>{
 const s=fixture();s.tracks[0].compAlternatives=[{id:'c',name:'Verse',segments:[{regionId:'r',start:2,end:4}],edgeFade:0,crossfade:0,crossfadeShape:'linear',muteSource:false}];for(const prefix of ['loop','audioPunch','midiPunch']){s[prefix+'Start']=2;s[prefix+'End']=4;s[prefix+'Enabled']=true;}
 const out=applyCommands(s,[transfer('move')]);assert.deepEqual(out.tracks[0].compAlternatives[0].segments,[{regionId:out.tracks[0].regions.at(-1).id,start:4,end:6}]);assert.doesNotThrow(()=>applyCommands(out,[{op:'comp.createTrack',target:'a',values:{compId:'c'}}]));for(const prefix of ['loop','audioPunch','midiPunch'])assert.deepEqual([out[prefix+'Start'],out[prefix+'End'],out[prefix+'Enabled']],[4,6,true]);
});
test('invalid locations, protection, overflow and capacity fail atomically',()=>{
 const s=fixture(),before=structuredClone(s);for(const args of [['move',2,4,2],['move',2,4,3],['move',2,4,4],['copy',4,2,6],['copy',2,4,86400],['copy',2,4,-1],['copy',2,4,Infinity],['bad',2,4,6]])assert.throws(()=>applyCommands(s,[transfer(...args)]));
 const locked=applyCommands(s,[{op:'track.set',target:'a',values:{protected:true}}]);for(const mode of ['copy','move'])assert.throws(()=>applyCommands(locked,[transfer(mode)]),/Unprotect/);assert.deepEqual(s,before);
 s.tracks[0].regions=Array.from({length:500},(_,i)=>({...s.tracks[0].regions[0],id:'r'+i}));assert.throws(()=>applyCommands(s,[transfer()]),/1,000/);assert.equal(s.tracks[0].regions.length,500);
});
test('fractional transferred comp selections remain inside their regions',()=>{
 for(const mode of ['copy','move'])for(const position of [0,6])for(let i=1;i<=10;i++){const start=i*.017,end=start+.333,s=fixture();s.tracks[0].compAlternatives=[{id:'c',name:'Comp',segments:[{regionId:'r',start:0,end:8}],edgeFade:0,crossfade:0,crossfadeShape:'linear',muteSource:false}];const out=applyCommands(s,[transfer(mode,start,end,position)]);assert.doesNotThrow(()=>applyCommands(out,[{op:'comp.createTrack',target:'a',values:{compId:'c'}}]));}
});
test('agent uses the same validated transfer operation',async()=>{const session=fixture(),commands=[transfer('move')];const result=await planDawEdit({session,instruction:'Move seconds two through four to the six-second mark'}, {key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Move section',commands})}]})})});assert.equal(applyCommands(session,result.commands).tracks[0].regions.at(-1).start,4);});
test('transfer carries sustain controllers and every automation scope',()=>{
 let s=fixture();s=applyCommands(s,[{op:'note.set',target:'note',values:{start:.5,duration:.25}},{op:'event.add',target:'midi',values:{id:'on',type:'controlChange',parameter:64,value:127,start:.25}},{op:'event.add',target:'midi',values:{id:'off',type:'controlChange',parameter:64,value:0,start:3}},{op:'track.add',values:{id:'bus',kind:'bus'}},{op:'send.set',target:'a',values:{busId:'bus',gainDb:-6}},{op:'effect.add',target:'a',values:{id:'fx',kind:'gain'}},{op:'effect.add',target:s.id,values:{id:'masterfx',kind:'gain'}}]);
 const points=id=>[{id,parameter:'gainDb',time:2.5,value:-6},{id:id+'after',parameter:'gainDb',time:7,value:0}];s.masterAutomation=points('master');s.masterEffects[0].automation=points('masterfxpoint');s.tracks[0].automation=points('track');s.tracks[0].effects[0].automation=points('effect');s.tracks[0].sends[0].automation=points('send');
 for(const mode of ['copy','move']){const out=applyCommands(s,[transfer(mode)]),dest=mode==='copy'?6:4;for(const lane of [out.masterAutomation,out.masterEffects[0].automation,out.tracks[0].automation,out.tracks[0].effects[0].automation,out.tracks[0].sends[0].automation])assert.ok(lane.some(p=>p.time===dest+.5&&p.value===-6));const copy=out.tracks[1].regions.at(-1);assert.equal(copy.notes.length,1);assert.equal(copy.notes[0].start,0);assert.ok(copy.events.some(e=>e.parameter===64&&e.value===127&&e.start===0));assert.ok(copy.events.some(e=>e.parameter===64&&e.value===0&&e.start===1));}
});
