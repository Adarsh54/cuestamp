import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {TruePeakMeter} from '../src/experimental/true-peak-meter.js';import {LookaheadLimiter} from '../src/experimental/limiter-dsp.js';
function processor(meter=true){
 const messages=[],clock={time:0};let Processor;
 const source=readFileSync(new URL('../src/experimental/limiter.worklet.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('currentTime','clock.time');
 new Function('AudioWorkletProcessor','sampleRate','clock','registerProcessor','TruePeakMeter','LookaheadLimiter',source)(class{constructor(){this.port={postMessage:m=>messages.push(structuredClone(m))};}},48000,clock,(_name,value)=>Processor=value,TruePeakMeter,LookaheadLimiter);
 return {node:new Processor({processorOptions:{lookaheadMs:0,meter}}),messages,clock};
}
const parameters={gainDb:Float32Array.of(0),ceilingDb:Float32Array.of(0),release:Float32Array.of(.1)};
function run(f,value,count=24){let output;for(let n=0;n<count;n++){output=[new Float32Array(128),new Float32Array(128)];f.node.process([[new Float32Array(128).fill(value)]],[output],parameters);f.clock.time+=128/48000;}return output;}
test('worklet holds peaks over quiet windows; reset epochs reject old requests and preserve audio',()=>{
 const f=processor();run(f,.8);const peak=f.messages.at(-1).heldOutputPeaksDbtp;
 run(f,.01,48);assert.ok(f.messages.at(-1).outputPeaksDbtp[0]< -30);assert.deepEqual(f.messages.at(-1).heldOutputPeaksDbtp,peak);
 f.node.port.onmessage({data:{type:'resetPeaks',epoch:1}});const before=f.messages.length;run(f,.01);const report=f.messages.at(-1);assert.ok(f.messages.length>before);assert.equal(report.meterEpoch,1);assert.ok(report.heldOutputPeaksDbtp[0]< -30);
 f.node.port.onmessage({data:{type:'resetPeaks',epoch:0}});assert.equal(f.node.meterEpoch,1);
 const ref=processor(false);assert.deepEqual(run(f,.02),run(ref,.02));assert.equal(ref.messages.length,0);assert.equal(ref.node.truePeak,null);
 f.node.port.onmessage({data:'stop'});assert.equal(f.node.process([],[],parameters),false);
});
test('node ignores reports queued before peak reset and expires stale held readings',async()=>{
 const {connectLimiter}=await import('../src/experimental/limiter.js');const {effectSchema}=await import('../src/experimental/effects.js');const previous=globalThis.AudioWorkletNode,messages=[];
 globalThis.AudioWorkletNode=class{constructor(){this.parameters=new Map(['gainDb','ceilingDb','release'].map(k=>[k,{setValueAtTime(){}}]));this.port={postMessage:m=>messages.push(m),close(){}};}};
 try{const context={currentTime:1,[Symbol.for('cuestamp.limiterProcessor')]:{ready:true}},node=connectLimiter(context,{connect(){}},effectSchema.parse({id:'l',kind:'limiter'}),[],{position:0,base:0});
 const report=epoch=>({data:{time:1,reduction:0,meterEpoch:epoch,outputPeaksDbtp:[-3,-4],heldOutputPeaksDbtp:[1,0]}});node.port.onmessage(report(0));assert.deepEqual(node.heldOutputPeaksDbtp,[1,0]);node.resetPeaks();assert.deepEqual(messages.at(-1),{type:'resetPeaks',epoch:1});node.port.onmessage(report(0));assert.deepEqual(node.heldOutputPeaksDbtp,[null,null]);node.port.onmessage(report(1));assert.deepEqual(node.heldOutputPeaksDbtp,[1,0]);context.currentTime=2;assert.equal(node.heldOutputPeaksDbtp,undefined);node.stop();assert.equal(node.port.onmessage,null);
 }finally{if(previous===undefined)delete globalThis.AudioWorkletNode;else globalThis.AudioWorkletNode=previous;}
});
