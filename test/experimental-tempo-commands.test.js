import test from 'node:test';
import assert from 'node:assert/strict';
import {newSession,applyCommands,sessionSchema,SessionHistory} from '../src/experimental/session.js';
import {compileTempoMap} from '../src/experimental/tempo-map.js';
import {writeMidi,readMidi} from '../src/experimental/midi.js';
const fixture=()=>applyCommands(newSession(),[
 {op:'track.add',values:{id:'m',kind:'midi'}},{op:'region.add',target:'m',values:{id:'r',start:2,duration:4}},
 {op:'note.add',target:'r',values:{id:'n',start:1,duration:2}},
 {op:'event.add',target:'r',values:{id:'cc',start:3,type:'controlChange',parameter:64,value:127}},
 {op:'track.add',values:{id:'a',kind:'audio'}},{op:'region.add',target:'a',values:{duration:8}},
 {op:'marker.add',values:{id:'mark',name:'Fixed',time:5}}
]);
const musical=s=>{const map=compileTempoMap(s),r=s.tracks[0].regions[0];return [r.start,r.start+r.duration,...r.notes.flatMap(n=>[r.start+n.start,r.start+n.start+n.duration]),...r.events.map(e=>r.start+e.start)].map(t=>map.beatAtTime(t));};
test('tempo commands preserve musical MIDI endpoints, absolute media, undo and saved documents',()=>{
 const base=fixture(),h=new SessionHistory(base),beats=musical(base);
 for(const cmd of [
  {op:'tempo.add',values:{id:'slow',beat:8,bpm:60}},
  {op:'tempo.add',values:{id:'fast',beat:12,bpm:240}},
  {op:'tempo.set',target:'slow',values:{beat:6,bpm:90}},
  {op:'session.set',values:{tempo:100}},
  {op:'tempo.delete',target:'fast'}
 ]){
  const before=structuredClone(h.session);h.execute([cmd]);
  musical(h.session).forEach((b,i)=>assert.ok(Math.abs(b-beats[i])<1e-9));
  assert.deepEqual(h.session.tracks[1],base.tracks[1]);assert.deepEqual(h.session.markers,base.markers);
  const saved=sessionSchema.parse(JSON.parse(JSON.stringify(h.session)));assert.deepEqual(saved,h.session);
  h.undo();assert.deepEqual(h.session.tracks,before.tracks);assert.deepEqual(h.session.tempoChanges,before.tempoChanges);h.redo();
 }
 const midi=readMidi(writeMidi(h.session).buffer);assert.equal(midi.tempoChanges.length,1);assert.equal(midi.tempoChanges[0].beat,6);
});
test('invalid maps and IDs reject atomically, including protected MIDI changes',()=>{
 const s=fixture(),before=structuredClone(s);
 for(const cmds of [
  [{op:'tempo.add',values:{beat:0,bpm:60}}],
  [{op:'tempo.add',values:{id:'r',beat:8,bpm:60}}],
  [{op:'tempo.add',values:{beat:8,bpm:60}},{op:'tempo.add',values:{beat:8,bpm:90}}],
  [{op:'tempo.add',values:{beat:432000,bpm:60}}],
  [{op:'tempo.set',target:'missing',values:{bpm:60}}],
  [{op:'tempo.add',values:{beat:8,bpm:301}}],
  [{op:'track.set',target:'m',values:{protected:true}},{op:'tempo.add',values:{beat:8,bpm:60}}]
 ])assert.throws(()=>applyCommands(s,cmds));
 assert.deepEqual(s,before);
 assert.throws(()=>sessionSchema.parse({...s,tempoChanges:[{id:'x',beat:8,bpm:60},{id:'x',beat:9,bpm:90}]}));
 assert.throws(()=>sessionSchema.parse({...s,tempoChanges:[{id:'x',beat:8,bpm:60},{id:'y',beat:8,bpm:90}]}));
});
test('old sessions load with an empty map and deleting all changes restores original timing',()=>{
 const s=fixture();delete s.tempoChanges;assert.deepEqual(sessionSchema.parse(s).tempoChanges,[]);
 const changed=applyCommands(s,[{op:'tempo.add',values:{id:'p',beat:8,bpm:60}}]);
 const restored=applyCommands(changed,[{op:'tempo.delete',target:'p'}]);assert.deepEqual(restored.tracks,s.tracks);
});
test('agent tempo edits retain mapped context and use the validated command engine',async()=>{
 const {planDawEdit}=await import('../server/daw-agent.js');
 const session=applyCommands(fixture(),[{op:'tempo.add',values:{id:'p',beat:8,bpm:60}}]);
 const commands=[{op:'tempo.set',target:'p',values:{bpm:90}}];
 const result=await planDawEdit({session,instruction:'Change the tempo at beat nine to 90 BPM'},{provider:'openai',key:'test',model:'test',fetchImpl:async(url,init)=>{
  const body=JSON.parse(init.body);assert.ok(JSON.stringify(body.input).includes('tempoChanges'));assert.ok(JSON.stringify(body.tools).includes('tempo.set'));
  return {ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Updated tempo',commands})}]})};
 }});
 const next=applyCommands(session,result.commands,result.revision);assert.equal(next.tempoChanges[0].bpm,90);assert.deepEqual(musical(next),musical(session));
});
