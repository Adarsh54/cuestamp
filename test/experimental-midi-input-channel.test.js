import test from 'node:test';import assert from 'node:assert/strict';import {createMidiInput} from '../src/experimental/midi-input.js';
test('MIDI input channel filters recording and monitoring before capture and keeps event channels',async()=>{
 let time=0,take;const monitored=[],handlers=new Map(),port={id:'p',state:'connected',name:'Keyboard',async open(){},async close(){},addEventListener(type,fn){handlers.set(type,fn);},removeEventListener(type){handlers.delete(type);}},access={inputs:new Map([['p',port]]),addEventListener(){},removeEventListener(){}},controls=new Map();
 const root={querySelector(selector){return {addEventListener(type,fn){controls.set(selector,fn);}};}};
 const controller=createMidiInput({clock:()=>time,requestAccess:async()=>access,onChange(){},onTake(value){take=value;},beforeRecord:async()=>({start:0,startMonitor:()=>({push(data){monitored.push([...data]);},stop(){}})})});controller.bind(root);
 try{
  await controls.get('[data-midi-connect]')();controls.get('[data-midi-channel]')({target:{value:'2'}});await controls.get('[data-midi-record]')();assert.match(controller.view(x=>x),/data-midi-channel disabled/);
  // Programmatic changes while armed cannot switch away from held notes.
  controls.get('[data-midi-channel]')({target:{value:'0'}});
  for(const data of [[0x90,60,100],[0xb0,64,127],[0x92,64,100],[0xb2,11,80],[0xe2,0,96]])handlers.get('midimessage')({data,timeStamp:time});time=1000;
  for(const data of [[0x80,60,0],[0x82,64,0]])handlers.get('midimessage')({data,timeStamp:time});controls.get('[data-midi-finish]')();assert.equal(take.notes.length,1);assert.equal(take.notes[0].pitch,64);assert.equal(take.notes[0].channel,2);assert.equal(take.events.length,2);assert.ok(monitored.every(data=>(data[0]&15)===2));
  controls.get('[data-midi-channel]')({target:{value:''}});await controls.get('[data-midi-record]')();handlers.get('midimessage')({data:[0x9f,72,100],timeStamp:time});time+=1000;controls.get('[data-midi-finish]')();assert.equal(take.notes[0].channel,15);
 }finally{controller.dispose();}
});
