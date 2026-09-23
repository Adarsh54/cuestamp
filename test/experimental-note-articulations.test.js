import test from 'node:test';import assert from 'node:assert/strict';import {SessionHistory} from '../src/experimental/session.js';import {midiOutputPlan} from '../src/experimental/midi-output-plan.js';import {readMidi,writeMidi} from '../src/experimental/midi.js';import {articulationMessages} from '../src/experimental/note-articulations.js';import {planDawEdit} from '../server/daw-agent.js';
const preset={id:'p',name:'Staccato',type:'keyswitch',channel:0,parameter:24,value:100,duration:.05};
const setup=()=>{const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:3}},{op:'note.add',target:'r',values:{id:'a',pitch:60,start:.5,duration:1}},{op:'note.add',target:'r',values:{id:'b',pitch:64,start:.5,duration:1}},{op:'midiSwitch.save',target:'t',values:preset}]);return h;};
test('assignments preserve musical notes, snapshot mappings, deduplicate chord switches and chase held notes',()=>{
 const h=setup(),before=structuredClone(h.session);h.execute([{op:'notes.articulation',target:'r',values:{id:'p',noteIds:'a,b'}}]);const notes=h.session.tracks[0].regions[0].notes;assert.equal(notes.length,2);assert.deepEqual(notes.map(({articulation,...n})=>n),before.tracks[0].regions[0].notes);
 for(const start of [0,.75]){const plan=midiOutputPlan(h.session,'t',start),ons=plan.messages.filter(m=>(m.bytes[0]&240)===144);assert.deepEqual(ons.map(m=>m.bytes[1]),[24,60,64]);assert.equal(ons[0].time,Math.max(start,.5));}
 h.execute([{op:'midiSwitch.delete',target:'t',values:{id:'p'}}]);assert.equal(midiOutputPlan(h.session,'t').messages.filter(m=>m.bytes[1]===24&&(m.bytes[0]&240)===144).length,1);
 const exported=readMidi(writeMidi(h.session).buffer).tracks[0].notes;assert.equal(exported.length,3);assert.ok(exported.some(n=>n.pitch===24&&Math.abs(n.start-.5)<1e-9));
 h.execute([{op:'notes.articulation',target:'r',values:{id:null,noteIds:'a,b'}}]);assert.ok(h.session.tracks[0].regions[0].notes.every(n=>!n.articulation));h.undo();assert.ok(h.session.tracks[0].regions[0].notes.every(n=>n.articulation));
});
test('muted assignments do not emit switches; incompatible chords and musical pitch collisions reject',()=>{
 const h=setup();h.execute([{op:'notes.articulation',target:'r',values:{id:'p',noteIds:'a'}},{op:'note.set',target:'a',values:{mute:true}}]);assert.ok(!midiOutputPlan(h.session,'t').messages.some(m=>(m.bytes[0]&240)===144&&m.bytes[1]===24));
 h.execute([{op:'note.set',target:'a',values:{mute:false}},{op:'midiSwitch.save',target:'t',values:{...preset,id:'q',parameter:25}},{op:'notes.articulation',target:'r',values:{id:'q',noteIds:'b'}}]);assert.throws(()=>midiOutputPlan(h.session,'t'),/different articulations/);assert.throws(()=>writeMidi(h.session),/different articulations/);
 h.execute([{op:'notes.articulation',target:'r',values:{id:null,noteIds:'b'}},{op:'note.set',target:'b',values:{pitch:24}}]);assert.throws(()=>midiOutputPlan(h.session,'t'),/overlaps/);
});
test('nearby switches shorten prior pulses and exported short pulses retain a note-off',()=>{
 const notes=[0,.01].map(start=>({start,duration:.5,channel:0,pitch:60,articulation:preset})),messages=articulationMessages(notes);assert.equal(messages.find(m=>m.noteOnTime===0).time,.01);
 const h=setup();h.execute([{op:'session.set',values:{tempo:20}},{op:'midiSwitch.save',target:'t',values:{...preset,duration:.001}},{op:'notes.articulation',target:'r',values:{id:'p',noteIds:'a,b'}}]);const key=readMidi(writeMidi(h.session).buffer).tracks[0].notes.find(n=>n.pitch===24);assert.ok(key.duration>0);
});
test('agent assignments share validation, explicit selection, protection and Undo',async()=>{
 const h=setup();const commands=[{op:'notes.articulation',target:'r',values:{id:'p',noteIds:'a,b'}}],result=await planDawEdit({session:h.session,instruction:'Apply my saved Staccato to selected notes',selectedNoteIds:['a','b']},{key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Assigned Staccato',commands})}]})})});h.execute(result.commands,result.revision);assert.ok(h.session.tracks[0].regions[0].notes[0].articulation);h.undo();assert.equal(h.session.tracks[0].regions[0].notes[0].articulation,undefined);
 for(const values of [{id:'p'},{id:'missing',noteIds:'a'},{id:'p',noteIds:'missing'},{id:'p',noteIds:'a,a'}])assert.throws(()=>h.execute([{op:'notes.articulation',target:'r',values}]));h.execute([{op:'track.set',target:'t',values:{protected:true}}]);assert.throws(()=>h.execute(commands));
});
