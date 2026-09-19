import test from 'node:test';import assert from 'node:assert/strict';
import {arrangementStep,snapArrangementTime,snapArrangementDelta,arrangementGridSpacing} from '../src/experimental/arrangement-snap.js';
import {scissorsCut} from '../src/experimental/scissors.js';
const s={tempo:120,meter:3,frameRate:29.97};
test('musical snap grids follow tempo/meter; time and rational-frame grids do not',()=>{
 for(const [grid,value]of [['bar',1.5],['beat',.5],['eighth',.25],['sixteenth',.125],['thirtySecond',.0625],['eighthTriplet',1/6],['sixteenthTriplet',1/12],['second',1],['tenth',.1],['off',0]])assert.equal(arrangementStep(s,grid),value);
 assert.equal(arrangementStep(s,'frame'),1001/30000);assert.equal(arrangementStep({...s,tempo:60},'bar'),3);assert.equal(arrangementStep({...s,tempo:60},'frame'),1001/30000);assert.throws(()=>arrangementStep(s,'bad'));
});
test('relative snap preserves offset and group spacing while absolute snap aligns the anchor',()=>{
 const relative=snapArrangementDelta(s,.42,.1,{grid:'beat',alignment:'relative'}),absolute=snapArrangementDelta(s,.42,.1,{grid:'beat',alignment:'absolute'});assert.equal(relative,.5);assert.equal(absolute,.4);assert.equal(.1+absolute,.5);assert.equal(snapArrangementDelta(s,-.42,1.1,{grid:'beat',alignment:'relative'}),-.5);
 assert.equal(snapArrangementDelta(s,.42,.1,{grid:'off',alignment:'absolute'}),.42);assert.equal(snapArrangementDelta(s,.42,.1,{grid:'beat',alignment:'absolute'},true),.42);
});
test('scissors uses the chosen absolute grid and Shift bypasses it',()=>{
 const session={...s,tracks:[{regions:[{id:'r',start:.1,duration:3}]}]};assert.equal(scissorsCut(session,'r',[],.6,{grid:'beat'}).time,.5);assert.equal(scissorsCut(session,'r',[],.6,{grid:'bar'}).count,0);assert.equal(scissorsCut(session,'r',[],.6,{grid:'bar',snap:false}).time,.6);assert.equal(scissorsCut(session,'r',[],.613,{grid:'off'}).time,.613);
});
test('frame snapping uses exact fractional rates and displayed grid skips overcrowded subdivisions',()=>{
 const at=snapArrangementTime(s,1,'frame');assert.ok(Math.abs(at-30*1001/30000)<1e-12);assert.equal(arrangementGridSpacing(s,32,'sixteenth'),8);assert.equal(arrangementGridSpacing(s,80,'sixteenth'),10);assert.equal(arrangementGridSpacing(s,80,'off'),0);
});
