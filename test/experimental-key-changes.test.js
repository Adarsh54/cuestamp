import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {readMidi,writeMidi} from '../src/experimental/midi.js';
import {compileKeyMap} from '../src/experimental/key-map.js';
import {conversationTurn} from '../src/experimental/agent-conversation.js';
const add=(id,beat,sharps=2)=>({op:'keyChange.add',values:{id,beat,sharps,mode:'minor'}});
test('key timeline sorts, persists, edits and deletes with undo; exported MIDI retains modulation',()=>{
 const h=new SessionHistory(newSession()),before=structuredClone(h.session);h.execute([{op:'key.set',values:{sharps:0,mode:'major'}},add('b',12,-3),add('a',4)]);
 assert.deepEqual(h.session.keyChanges.map(p=>p.id),['a','b']);assert.equal(compileKeyMap(h.session).keyAtBeat(5).sharps,2);
 const restored=new SessionHistory(JSON.parse(JSON.stringify(h.session)));assert.deepEqual(restored.session.keyChanges,h.session.keyChanges);
 const midi=readMidi(writeMidi(h.session).buffer);assert.deepEqual(midi.keySignatures.map(p=>[p.beat,p.sharps,p.mode]),[[0,0,'major'],[4,2,'minor'],[12,-3,'minor']]);
 const turn=conversationTurn({before,after:h.session,instruction:'Add modulations',summary:'Done',outcome:'applied'});assert.equal(turn.changes.filter(p=>p.entity==='key change').length,2);
 h.execute([{op:'keyChange.set',target:'a',values:{beat:8,mode:'major'}}]);assert.equal(h.session.keyChanges[0].beat,8);h.execute([{op:'keyChange.delete',target:'a'}]);assert.equal(h.session.keyChanges.length,1);h.undo();assert.equal(h.session.keyChanges.length,2);
});
test('invalid or ambiguous key changes reject whole batches; unknown initial key stays unknown',()=>{
 const h=new SessionHistory(newSession());h.execute([add('a',4)]);const before=structuredClone(h.session);
 for(const command of [add('b',4),add('a',8),add('b',0),add('b',8,8),add('b',432000)]){assert.throws(()=>h.execute([command]));assert.deepEqual(h.session,before);}
 assert.equal(compileKeyMap(h.session).keyAtBeat(0),null);h.execute([{op:'key.clear'}]);assert.equal(h.session.keyChanges.length,1);
});

test('key IDs cannot collide with existing project entities',()=>{
 const s=applyCommands(newSession(),[{op:'track.add',values:{id:'track',kind:'midi'}}]);assert.throws(()=>applyCommands(s,[add('track',4)]),/unique/);
});

test('key-change controls submit validated changes and reject blank positions',async()=>{
 const {bindKeyChanges,keyChangesView}=await import('../src/experimental/key-change-controls.js');const {projectKeys}=await import('../src/experimental/key-controls.js');const h=new SessionHistory(newSession());
 const form={elements:{beat:{value:'8'},key:{value:'-2:minor'}}};const root={querySelectorAll:()=>[],querySelector:()=>form};
 bindKeyChanges(root,{projectKeys,guard:f=>f,execute:commands=>h.execute(commands)});form.onsubmit({preventDefault(){}});assert.equal(h.session.keyChanges[0].beat,8);assert.equal(h.session.keyChanges[0].sharps,-2);
 const view=keyChangesView(h.session,projectKeys);assert.match(view,/Bar 3/);assert.match(view,/4.00 s/);assert.match(view,/data-key-change-delete/);
 const before=structuredClone(h.session);form.elements.beat.value='';assert.throws(()=>form.onsubmit({preventDefault(){}}),/Choose a beat/);assert.deepEqual(h.session,before);
});

test('project-key scale and diatonic tools follow each note onset across modulations',()=>{
 const base=applyCommands(newSession(),[{op:'key.set',values:{sharps:0,mode:'major'}},add('mod',8,1),{op:'tempo.add',values:{id:'tempo',beat:4,bpm:60}},{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',start:2,duration:8}},...[0,3.9,4,5].map((start,i)=>({op:'note.add',target:'r',values:{id:`n${i}`,pitch:64,start,duration:.1,velocity:.8}}))]);
 // Key changes at project second 6; region-relative second 4. E minor begins there.
 const scale=applyCommands(base,[{op:'notes.scale',target:'r',values:{useProjectKey:true,direction:'up'}}]);assert.deepEqual(scale.tracks[0].regions[0].notes.map(n=>n.pitch),[64,64,64,64]);
 for(const op of ['notes.diatonicTranspose','notes.transpose']){
  const result=applyCommands(base,[{op,target:'r',values:{useProjectKey:true,steps:1,...(op==='notes.transpose'?{mode:'diatonic'}:{})}}]);assert.deepEqual(result.tracks[0].regions[0].notes.map(n=>n.pitch),[65,65,66,66]);
 }
 const f=applyCommands(base,[{op:'note.set',target:'n2',values:{pitch:65}},{op:'notes.scale',target:'r',values:{useProjectKey:true,direction:'up',noteId:'n2'}}]);assert.equal(f.tracks[0].regions[0].notes[2].pitch,66);
});
test('unknown earlier keys reject only when affected notes are selected, without partial edits',()=>{
 const h=new SessionHistory(applyCommands(newSession(),[add('mod',4,1),{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',start:0,duration:8}},{op:'note.add',target:'r',values:{id:'early',pitch:64,start:0,duration:1,velocity:.8}},{op:'note.add',target:'r',values:{id:'late',pitch:64,start:3,duration:1,velocity:.8}}]));
 const before=structuredClone(h.session);assert.throws(()=>h.execute([{op:'notes.diatonicTranspose',target:'r',values:{steps:1,useProjectKey:true}}]),/selected passage/);assert.deepEqual(h.session,before);
 h.execute([{op:'notes.diatonicTranspose',target:'r',values:{steps:1,useProjectKey:true,noteId:'late'}}]);assert.deepEqual(h.session.tracks[0].regions[0].notes.map(n=>n.pitch),[64,66]);
});
