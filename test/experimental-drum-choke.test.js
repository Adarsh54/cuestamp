import test from 'node:test';import assert from 'node:assert/strict';
import {drumChokeLookup,DRUM_CHOKE_FADE} from '../src/experimental/drum-choke.js';
const note=(pitch,start,extra={})=>({pitch,start,velocity:1,...extra});
test('hi-hat choking follows absolute time across unordered overlapping regions',()=>{
 const open=note(46,.5),r={start:1,notes:[open]},other={start:0,notes:[note(42,2)]},track={regions:[r,other]},before=structuredClone(track);
 const lookup=drumChokeLookup(track);assert.equal(lookup(r,open),1);assert.equal(lookup(other,other.notes[0]),null);assert.deepEqual(track,before);
});
test('silent/muted hats do not choke; later open hats retrigger and simultaneous closed hats win',()=>{
 const open=note(46,0),r={start:0,notes:[note(46,.5),note(42,.1,{mute:true}),note(42,.2,{velocity:0}),open]},muted={start:0,mute:true,notes:[note(42,.3)]};
 assert.equal(drumChokeLookup({regions:[r,muted]})(r,open),.5);
 r.notes.push(note(42,0));assert.equal(drumChokeLookup({regions:[r]})(r,open),-DRUM_CHOKE_FADE);
 assert.equal(drumChokeLookup({regions:[{start:0,notes:[open]}]})({start:0},open),null);
});
