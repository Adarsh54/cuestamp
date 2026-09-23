import test from 'node:test';
import assert from 'node:assert/strict';
import {createMidiInput} from '../src/experimental/midi-input.js';
function setup(beforeRemember){
 let time=0,listener,take,closed=0;const controls=new Map();
 const port={id:'p',state:'connected',open:async()=>{},close:async()=>{closed++;},addEventListener(type,fn){listener=fn;},removeEventListener(){listener=null;}};
 const controller=createMidiInput({clock:()=>time,requestAccess:async()=>({inputs:new Map([['p',port]]),addEventListener(){},removeEventListener(){}}),beforeRemember,beforeRecent:()=>({start:0}),onTake:t=>{take=t;},onChange(){}});
 controller.bind({querySelector:s=>({addEventListener(type,fn){controls.set(s,fn);}})});
 return {controller,controls,emit(data,t){time=t;listener?.({data,timeStamp:t});},get take(){return take;},get closed(){return closed;}};
}
test('remembered MIDI monitoring uses transformed messages and releases voices on pause',async()=>{
 const heard=[];let stops=0;const h=setup(async({monitor})=>({startMonitor:()=>monitor?{push:d=>heard.push([...d]),stop:()=>stops++}:null}));
 try{await h.controls.get('[data-midi-connect]')();h.controls.get('[data-midi-transpose]')({target:{value:'12'}});await h.controls.get('[data-midi-remember]')();h.emit([0x90,60,100],0);h.emit([0x80,60,0],1000);assert.deepEqual(heard,[[0x90,72,100],[0x80,72,0]]);h.controls.get('[data-midi-memory-pause]')();assert.equal(stops,1);h.controls.get('[data-midi-recent]')();assert.equal(h.take.notes[0].pitch,72);assert.equal(stops,1);
 h.controls.get('[data-midi-memory-monitor]')({target:{checked:false}});await h.controls.get('[data-midi-remember]')();h.emit([0x90,64,100],2000);assert.equal(heard.length,2);
 }finally{h.controller.dispose();}
});
test('leaving while memory monitor prepares cannot start voices or attach input afterward',async()=>{
 let resolve,started=0;const h=setup(()=>new Promise(r=>{resolve=r;}));await h.controls.get('[data-midi-connect]')();const opening=h.controls.get('[data-midi-remember]')();await Promise.resolve();h.controller.dispose();resolve({startMonitor(){started++;return {stop(){},push(){}};}});await opening;assert.equal(started,0);assert.ok(h.closed>0);assert.equal(h.controller.active,false);
});

test('agent capture uses observed memory and rejects changed performances without consuming them',async()=>{
 const h=setup(async()=>({}));try{await h.controls.get('[data-midi-connect]')();await h.controls.get('[data-midi-remember]')();h.emit([0x90,60,100],0);h.emit([0x80,60,0],1000);const observed=h.controller.memoryObservation();h.emit([0x90,64,100],1100);assert.throws(()=>h.controller.captureRecent({agent:true,expected:observed}),/changed/);assert.equal(h.take,undefined);h.emit([0x80,64,0],1500);const latest=h.controller.memoryObservation();assert.equal(h.controller.captureRecent({agent:true,expected:latest}),true);assert.equal(h.take.notes.length,2);assert.equal(h.controller.memoryObservation(),undefined);}finally{h.controller.dispose();}
});
