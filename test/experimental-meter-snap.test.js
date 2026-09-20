import test from 'node:test';import assert from 'node:assert/strict';import {meterGrid} from '../src/experimental/meter-grid.js';import {snapArrangementTime,snapArrangementDelta,arrangementKeyboardDelta,arrangementStep,arrangementGridLines} from '../src/experimental/arrangement-snap.js';
const s={tempo:120,meter:4,meterChanges:[{bar:3,numerator:6,denominator:8},{bar:5,numerator:7,denominator:4}],tempoChanges:[{beat:8,bpm:60}]};
test('absolute bar and beat snapping honor changing denominators and tempo',()=>{
 assert.equal(snapArrangementTime(s,5.8,'bar'),7);assert.equal(snapArrangementTime(s,4.3,'beat'),4.5);assert.equal(snapArrangementTime(s,10.6,'beat'),11);
 assert.equal(snapArrangementTime(s,4.3,'eighth'),4.5);assert.equal(snapArrangementTime(s,4.3,'second'),4);assert.equal(snapArrangementTime(s,4.3,'beat',true),4.3);
 assert.equal(arrangementStep(s,'bar',4),3);assert.equal(arrangementStep(s,'beat',4),.5);
});
test('relative grid moves and keyboard steps preserve grid phase across signature boundaries',()=>{
 assert.equal(arrangementKeyboardDelta(s,'bar',4,-1),-2);assert.equal(arrangementKeyboardDelta(s,'bar',4,1),3);
 assert.equal(arrangementKeyboardDelta(s,'beat',4,-1),-.5);assert.equal(arrangementKeyboardDelta(s,'beat',10,1),1);assert.equal(arrangementKeyboardDelta(s,'beat',10,-1),-.5);
 assert.equal(snapArrangementDelta(s,2.8,4,{grid:'bar',alignment:'relative'}),3);
 const grid=meterGrid(s,'bar'),anchor=grid.timeAt(1.5),move=arrangementKeyboardDelta(s,'bar',anchor,1);assert.equal(grid.atTime(anchor+move),2.5);
 assert.equal(snapArrangementDelta(s,1.8,4,{grid:'bar',alignment:'absolute'}),3);
 for(const kind of ['bar','beat']){const g=meterGrid(s,kind);for(let t=-2;t<100;t+=.17)assert.ok(Math.abs(g.timeAt(g.atTime(t))-t)<1e-9);}
});
test('rendered bar/beat grid lines agree with snap targets and remain bounded',()=>{
 for(const kind of ['bar','beat']){
  const lines=arrangementGridLines(s,100,1400,kind);assert.ok(lines.length<1000);for(const x of lines)assert.ok(Math.abs(snapArrangementTime(s,x/100,kind)*100-x)<1e-9);
  assert.ok(arrangementGridLines({...s,meter:1,meterDenominator:64},1,86400,kind).length<=1000);
 }
 assert.deepEqual(arrangementGridLines(s,100,1100,'bar'),[0,200,400,700,1000]);assert.throws(()=>arrangementGridLines(s,0,100,'bar'));
 assert.equal(meterGrid({tempo:120,meter:4},'bar'),null);
});
