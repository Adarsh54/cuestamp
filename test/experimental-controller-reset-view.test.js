import test from 'node:test';import assert from 'node:assert/strict';
import {controllerLaneState,controllerLaneView} from '../src/experimental/controller-lane.js';
import {controllerValue} from '../src/experimental/midi-events.js';
const cc=(id,parameter,value,start,channel=0)=>({id,type:'controlChange',parameter,value,start,channel});
test('controller curves include reset-derived values without making them editable lane events',()=>{
 const region={duration:3,events:[cc('down',64,127,0),cc('quiet',11,20,0),{id:'bend',type:'pitchBend',parameter:0,value:10000,start:0,channel:0},cc('reset',121,0,1),cc('other',121,0,2,1)]};
 for(const [lane,value] of [['expression',127],['sustain',0],['bend',8192]]){const s=controllerLaneState(region,{controllerLane:lane});assert.equal(s.events.length,1);assert.equal(s.points.length,2);assert.equal(s.points[1].value,value);assert.equal(s.points[1].reset,true);const html=controllerLaneView(region,120,{controllerLane:lane},s=>s);assert.ok(html.includes('data-controller-reset="reset"'));assert.ok(!html.includes('data-controller-point="reset"'));assert.ok(!html.includes('data-controller-reset="other"'));}
 for(const lane of ['volume','pan'])assert.equal(controllerLaneState(region,{controllerLane:lane}).points.length,0);
});
test('same-time order in the displayed curve matches playback when reset and data share a timestamp',()=>{
 for(const events of [[cc('reset',121,0,1),cc('expression',11,20,1)],[cc('expression',11,20,1),cc('reset',121,0,1)]]){const region={duration:3,events},s=controllerLaneState(region,{controllerLane:'expression'});assert.equal(s.points.at(-1).value,controllerValue(events,'controlChange',11,1,127));assert.deepEqual(s.events.map(e=>e.id),['expression']);}
});
