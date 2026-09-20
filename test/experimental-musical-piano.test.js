import test from 'node:test';import assert from 'node:assert/strict';
import {musicalNotePlacement} from '../src/experimental/piano-grid.js';
import {pianoView} from '../src/experimental/piano.js';
import {defaultNoteTools} from '../src/experimental/note-transform-controls.js';
const session={tempo:120,tempoChanges:[{beat:8,bpm:60}]},region={id:'r',name:'Piano',start:3,duration:5,notes:[{id:'n',start:.5,duration:1.5,pitch:60,velocity:.8}],events:[]};
test('drawn notes snap and size in local beats across tempo changes',()=>{assert.deepEqual(musicalNotePlacement(1.4,region,session,.25),{start:1.25,duration:.25});assert.deepEqual(musicalNotePlacement(.9,region,session,1),{start:.5,duration:.5});const free=musicalNotePlacement(.9,region,session,0);assert.ok(Math.abs(free.start-.9)<1e-9);assert.ok(Math.abs(free.duration-.15)<1e-9);assert.equal(musicalNotePlacement(6,region,session,.25),null);assert.deepEqual(musicalNotePlacement(4.9,region,session,0),{start:4.9,duration:5-4.9});});
test('piano note fields and velocity labels display beat duration at note onset',()=>{const s={...session,tracks:[{kind:'midi',regions:[region]}]},html=pianoView(region,120,'n',s=>s,{...defaultNoteTools,selectedIds:['n']},s);assert.match(html,/name="start"[^>]*value="1"/);assert.match(html,/name="duration"[^>]*value="2"/);assert.match(html,/Velocity for MIDI note 60 at beat 1.00/);});
