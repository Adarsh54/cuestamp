import test from 'node:test';
import assert from 'node:assert/strict';
import {updateDrumStepPosition} from '../src/experimental/drum-step-position.js';
import {stepSequencerView} from '../src/experimental/drums.js';
test('step cursor follows half-open intervals, rewinds, clears and reindexes a replaced bar',()=>{
 const cell=(start,end)=>({dataset:{stepStart:String(start),stepEnd:String(end)},active:false,setAttribute(){this.active=true;},removeAttribute(){this.active=false;}});
 const a=cell(3,3.25),b=cell(3.25,3.5),row=cell(3,3.25);let cells=[a,b,row],panel={querySelectorAll:()=>cells};const root={querySelector:()=>panel};
 updateDrumStepPosition(root,3.1);assert.deepEqual(cells.map(c=>c.active),[true,false,true]);
 updateDrumStepPosition(root,3.25);assert.deepEqual(cells.map(c=>c.active),[false,true,false]);
 updateDrumStepPosition(root,3);assert.equal(a.active,true);
 updateDrumStepPosition(root,null);assert.ok(cells.every(c=>!c.active));
 cells=[cell(4,4.25)];panel={querySelectorAll:()=>cells};updateDrumStepPosition(root,4.1);assert.equal(cells[0].active,true);
 updateDrumStepPosition(root,4.25);assert.equal(cells[0].active,false);
 updateDrumStepPosition(root,NaN);assert.equal(cells[0].active,false);
});
test('rendered step boundaries integrate tempo changes and clip region ends',()=>{
 const html=stepSequencerView({start:2,duration:.3,notes:[]},{tempo:120,meter:4,tempoChanges:[{beat:4.25,bpm:60}]},0,100);
 const boundaries=[...html.matchAll(/data-step-start="([^"]+)" data-step-end="([^"]+)"/g)].slice(0,2).map(m=>m.slice(1).map(Number));
 assert.deepEqual(boundaries,[[2,2.125],[2.125,2.3]]);
});
