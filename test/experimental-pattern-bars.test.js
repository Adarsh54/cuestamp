import test from 'node:test';
import assert from 'node:assert/strict';
import {patternBar,durationForBars} from '../src/experimental/pattern-bars.js';
import {stepSequencerView} from '../src/experimental/drums.js';
const session={tempo:120,meter:4,meterChanges:[{bar:2,numerator:6,denominator:8},{bar:3,numerator:3,denominator:4}]};
test('pattern bars follow changing signatures and clip partial boundaries',()=>{
 const region={start:.1,duration:4,notes:[]};
 const first=patternBar(region,session,0);assert.equal(first.bars,3);assert.equal(first.cells[0].time,0);assert.ok(Math.abs(first.cells[0].beats-.05)<1e-9);
 const second=patternBar(region,session,1);assert.equal(second.cells.length,12);assert.equal(second.cells[0].time,1.9);assert.match(second.label,/6\/8/);
 const last=patternBar(region,session,20);assert.equal(last.index,2);assert.equal(last.cells.length,5);assert.ok(Math.abs(last.cells.at(-1).beats-.2)<1e-9);
 const html=stepSequencerView(region,session,1,100);assert.match(html,/Project bar 2/);assert.equal((html.match(/data-step-pitch=/g)||[]).length,72);
});
test('exact region end does not add an empty pattern bar',()=>{
 const bar=patternBar({start:0,duration:3.5},session,9);assert.equal(bar.bars,2);assert.equal(bar.index,1);assert.equal(bar.cells.length,12);
});
test('four-bar defaults integrate signatures and tempo changes',()=>{
 assert.equal(durationForBars(session,0,4),6.5);
 assert.equal(durationForBars({...session,tempoChanges:[{beat:4,bpm:60}]},0,4),11);
 assert.equal(durationForBars({tempo:120,meter:6,meterDenominator:8},0,4),6);
 assert.equal(durationForBars({tempo:120,meter:4},0,4),8);
});
test('long mapped patterns materialize one bar only',()=>{
 const bar=patternBar({start:0,duration:86400},session,10000);assert.equal(bar.cells.length,12);assert.equal(bar.index,10000);
});
