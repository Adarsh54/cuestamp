import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {curveAutomationValue} from '../src/experimental/automation-curves.js';
import {planDawEdit} from '../server/daw-agent.js';
const action=(action='swap',target='a',otherId='b')=>({op:'section.editContent',target,values:{action,otherId}});
const fixture=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'t',kind:'audio'}},{op:'region.add',target:'t',values:{id:'r',assetId:'source',duration:8,offset:10}},{op:'region.set',target:'r',values:{reverse:true}},...[["a","Verse",0,2],["middle","Bridge",2,4],["b","Chorus",4,7],["tail","Outro",7,8]].map(([id,name,start,end])=>({op:'section.add',values:{id,name,start,end}})),{op:'marker.add',values:{id:'verse-marker',name:'Verse marker',time:1}},{op:'marker.add',values:{id:'chorus-marker',name:'Chorus marker',time:5}}]);
const bounds=s=>[...s.sections].sort((a,b)=>a.start-b.start).map(s=>[s.name,s.start,s.end]);
test('unequal-length section swap preserves intervening order, total length, IDs and one-step undo',()=>{
 const s=fixture(),h=new SessionHistory(s);h.execute([action()]);const out=h.session;assert.deepEqual(bounds(out),[['Chorus',0,3],['Bridge',3,5],['Verse',5,7],['Outro',7,8]]);assert.equal(out.sections.find(s=>s.id==='a').start,5);assert.equal(out.sections.find(s=>s.id==='b').start,0);assert.equal(out.markers.find(m=>m.id==='verse-marker').time,6);assert.equal(out.markers.find(m=>m.id==='chorus-marker').time,1);
 const reversed=applyCommands(s,[action('swap','b','a')]);assert.deepEqual(bounds(reversed),bounds(out));h.undo();assert.deepEqual(h.session.tracks,s.tracks);assert.deepEqual(h.session.sections,s.sections);h.redo();assert.deepEqual(bounds(h.session),bounds(out));
});
test('adjacent sections swap with unequal lengths',()=>{const s=fixture(),out=applyCommands(s,[action('swap','middle','b')]);assert.deepEqual(bounds(out),[['Verse',0,2],['Chorus',2,5],['Bridge',5,7],['Outro',7,8]]);});
test('replacement copies source, removes target, shifts later material and follows exact locator ranges',()=>{
 const s=fixture();for(const prefix of ['loop','audioPunch','midiPunch']){s[prefix+'Start']=0;s[prefix+'End']=2;s[prefix+'Enabled']=true;}const out=applyCommands(s,[action('replace')]);assert.deepEqual(bounds(out),[['Chorus',0,3],['Bridge',3,5],['Chorus',5,8],['Outro',8,9]]);assert.equal(out.sections.some(s=>s.id==='a'),false);assert.equal(out.sections.find(s=>s.id==='b').start,5);assert.equal(out.markers.some(m=>m.id==='verse-marker'),false);assert.equal(out.markers.filter(m=>m.name==='Chorus marker').length,2);for(const prefix of ['loop','audioPunch','midiPunch'])assert.deepEqual([out[prefix+'Start'],out[prefix+'End'],out[prefix+'Enabled']],[0,3,true]);
 const shorter=applyCommands(fixture(),[action('replace','b','a')]);assert.deepEqual(bounds(shorter),[['Verse',0,2],['Bridge',2,4],['Verse',4,6],['Outro',6,7]]);
});
test('swap and replacement preserve the corresponding original automation curves',()=>{
 for(const shape of ['linear','hold','smooth','easeIn','easeOut'])for(const mode of ['swap','replace']){const s=fixture();s.masterAutomation=[{id:'p0',parameter:'gainDb',time:0,value:-20,shape},{id:'p1',parameter:'gainDb',time:3,value:-5,shape},{id:'p2',parameter:'gainDb',time:8,value:-10,shape}];const out=applyCommands(s,[action(mode)]);
  for(let time=0;time<(mode==='swap'?8:9);time+=.013){const original=mode==='replace'?(time<3?time+4:time-1):(time<3?time+4:time<5?time-1:time<7?time-5:time);const a=curveAutomationValue(out.masterAutomation,'gainDb',time,0),b=curveAutomationValue(s.masterAutomation,'gainDb',original,0);assert.ok(Math.abs(a-b)<1e-8,`${mode} ${shape} at ${time}: ${a} vs ${b}`);}
 }
});
test('saved comp selections remain valid through swaps and replacements',()=>{
 for(const mode of ['swap','replace']){const s=fixture();s.tracks[0].compAlternatives=[{id:'c',name:'Take',segments:[{regionId:'r',start:0,end:8}],edgeFade:0,crossfade:0,crossfadeShape:'linear',muteSource:false}];const out=applyCommands(s,[action(mode)]);assert.doesNotThrow(()=>applyCommands(out,[{op:'comp.createTrack',target:'t',values:{compId:'c'}}]));}
});
test('invalid pairs and protected content reject atomically',()=>{
 const s=fixture(),before=structuredClone(s);for(const mode of ['swap','replace'])for(const otherId of ['a','missing',null])assert.throws(()=>applyCommands(s,[action(mode,'a',otherId)]));assert.deepEqual(s,before);
 const locked=applyCommands(s,[{op:'track.set',target:'t',values:{protected:true}}]);for(const mode of ['swap','replace'])assert.throws(()=>applyCommands(locked,[action(mode)]),/Unprotect/);assert.equal(locked.sections[0].start,0);
});
test('agent can request a named section swap through the shared engine',async()=>{const session=fixture(),commands=[action()];const result=await planDawEdit({session,instruction:'Swap the verse and chorus'},{key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Swap verse and chorus',commands})}]})})});assert.equal(applyCommands(session,result.commands).sections.find(s=>s.id==='b').start,0);});
test('fractional exchange boundaries keep comp selections valid and swap locators follow their section',()=>{
 for(const mode of ['swap','replace'])for(let i=1;i<=20;i++){const start=i*.017,end=start+.333;let s=applyCommands(newSession(),[{op:'track.add',values:{id:'t',kind:'audio'}},{op:'region.add',target:'t',values:{id:'r',assetId:'source',duration:4}},{op:'section.add',values:{id:'a',name:'A',start,end}},{op:'section.add',values:{id:'b',name:'B',start:2,end:3.1}}]);s.tracks[0].compAlternatives=[{id:'comp',name:'Take',segments:[{regionId:'r',start:0,end:4}],edgeFade:0,crossfade:0,crossfadeShape:'linear',muteSource:false}];const out=applyCommands(s,[action(mode)]);assert.doesNotThrow(()=>applyCommands(out,[{op:'comp.createTrack',target:'t',values:{compId:'comp'}}]));}
 const s=fixture();s.loopStart=0;s.loopEnd=2;s.loopEnabled=true;const out=applyCommands(s,[action()]);assert.deepEqual([out.loopStart,out.loopEnd,out.loopEnabled],[5,7,true]);
});
