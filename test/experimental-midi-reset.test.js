import test from 'node:test';import assert from 'node:assert/strict';
import {controllerValue,chasedEvents,sustainedEnd,scheduleMidiChannel} from '../src/experimental/midi-events.js';
import {sustainLengthPlan} from '../src/experimental/sustain-lengths.js';
import {trimmedMidiRegion} from '../src/experimental/region-edit.js';
const cc=(parameter,value,start=0)=>({id:crypto.randomUUID(),type:'controlChange',parameter,value,start,channel:0});
test('reset restores expression and sustain but retains volume and pan, including chased state',()=>{
 const events=[cc(7,80),cc(10,20),cc(11,40),cc(64,127),cc(121,0,1)];
 for(const stream of [events,chasedEvents(events,1.5)]){assert.equal(controllerValue(stream,'controlChange',11,2,127),127);assert.equal(controllerValue(stream,'controlChange',64,2,0),0);assert.equal(controllerValue(stream,'controlChange',7,2,127),80);assert.equal(controllerValue(stream,'controlChange',10,2,64),20);}
 const renewed=[...events,cc(11,60,1.1),cc(64,127,1.2)];assert.equal(controllerValue(chasedEvents(renewed,1.5),'controlChange',11,0,127),60);assert.equal(controllerValue(chasedEvents(renewed,1.5),'controlChange',64,0,0),127);
});
test('pedal resets release held notes consistently in playback, trimming and sustain conversion',()=>{
 const note={id:'n',channel:0,pitch:60,start:0,duration:.5,velocity:1},events=[cc(64,127),cc(121,0,1)],region={start:0,duration:3,offset:0,fadeIn:0,fadeOut:0,notes:[note],events};
 assert.equal(sustainedEnd(note,events,3),1);assert.equal(trimmedMidiRegion(region,1.2,3).notes.length,0);assert.ok(Math.abs(trimmedMidiRegion(region,.8,3).notes[0].duration-.2)<1e-12);
 const plan=sustainLengthPlan(region);assert.deepEqual(plan.edits,[{id:'n',duration:1}]);assert.deepEqual(plan.removedIds,[events[0].id]);assert.equal(sustainedEnd({...note,start:1.2},events,3),1.7);
});
test('channel scheduler emits expression reset while retaining the channel volume',()=>{
 const calls=[],param={setValueAtTime:(...args)=>calls.push(args)},node={gain:param,pan:{setValueAtTime:()=>{}},connect(){return this;}},ctx={createGain:()=>node,createStereoPanner:()=>node};
 scheduleMidiChannel(ctx,node,[cc(7,64),cc(11,0),cc(121,0,1)],0,10,[]);assert.deepEqual(calls,[[0,10],[64/127,11]]);
});
