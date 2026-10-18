import test from 'node:test';import assert from 'node:assert/strict';import {connectEffects,effectSchema} from '../src/experimental/effects.js';import {effectParameters} from '../src/experimental/effect-automation.js';import {createLiveAutomation} from '../src/experimental/automation-live.js';
function setup(kind,extra={},timing=[]){
 const param=()=>({value:0,events:[],cancelScheduledValues(t){this.events.push(['cancel',t]);},setValueAtTime(v,t){this.events.push(['set',v,t]);},linearRampToValueAtTime(v,t){this.events.push(['linear',v,t]);},exponentialRampToValueAtTime(v,t){this.events.push(['exp',v,t]);}}),node=()=>({gain:param(),frequency:param(),detune:param(),Q:param(),threshold:param(),ratio:param(),attack:param(),release:param(),knee:param(),delayTime:param(),connect(other){return other;},disconnect(){},start(){},stop(){},setPeriodicWave(){}});
 const ctx={currentTime:0,sampleRate:8000,createGain:node,createChannelSplitter:node,createChannelMerger:node,createBiquadFilter:node,createWaveShaper:node,createDynamicsCompressor:node,createDelay:node,createConvolver:node,createOscillator:node,createPeriodicWave:()=>({}),createBuffer:(c,length)=>({getChannelData:()=>new Float32Array(length)})},effect=effectSchema.parse({id:'fx',kind,...extra}),lanes=new Map();
 const originalWorklet=globalThis.AudioWorkletNode;if(kind==='gate'||kind==='delay'||kind==='limiter'){ctx[Symbol.for(kind==='gate'?'cuestamp.noiseGateProcessor':kind==='limiter'?'cuestamp.limiterProcessor':'cuestamp.feedbackDelayProcessor')]={ready:true};globalThis.AudioWorkletNode=class{constructor(){Object.assign(this,node(),{port:{postMessage(){},close(){}},parameters:new Map(Object.keys(effectParameters[kind]).map(key=>[key,param()]))});}};}
 try{connectEffects(ctx,node(),[effect],[],{timing,register:(e,key,param,transform,exponential,latencySeconds)=>{const id=`fx:${key}`,spec=effectParameters[kind][key];if(!lanes.has(id))lanes.set(id,{points:e.automation,fallback:e[key],min:spec.min,max:spec.max,bindings:[]});lanes.get(id).bindings.push({param,transform,exponential,latencySeconds});}});}finally{if(originalWorklet===undefined)delete globalThis.AudioWorkletNode;else globalThis.AudioWorkletNode=originalWorklet;}
 return {ctx,lanes,live:createLiveAutomation({context:ctx,base:0,position:0,lanes})};
}
test('effect live registration covers supported parameters and linked nodes',()=>{
 for(const [kind,parameters]of Object.entries(effectParameters)){
  const {live,lanes}=setup(kind);assert.equal(lanes.size,Object.keys(parameters).length,kind);
  for(const [key,spec]of Object.entries(parameters)){const value=(spec.min+spec.max)/2;live.set('fx',key,value);for(const binding of lanes.get('fx:'+key).bindings)assert.equal(binding.param.events.at(-1)[1],binding.transform(value),`${kind}.${key}`);live.cancel('fx',key);}
 }
 assert.equal(setup('gain').lanes.get('fx:width').bindings.length,4);assert.equal(setup('chorus').lanes.get('fx:mix').bindings.length,4);assert.equal(setup('tremolo').lanes.get('fx:depth').bindings.length,4);
});
test('EQ gain is already dB while utility gain converts dB to amplitude',()=>{
 const eq=setup('eq'),gain=setup('gain');eq.live.set('fx','gainDb',18);gain.live.set('fx','gainDb',18);assert.equal(eq.lanes.get('fx:gainDb').bindings[0].param.events.at(-1)[1],18);assert.equal(gain.lanes.get('fx:gainDb').bindings[0].param.events.at(-1)[1],10**(18/20));assert.throws(()=>eq.live.set('fx','gainDb',25));
});
test('dry/wet, width and millisecond depth keep their linked transforms',()=>{
 const delay=setup('delay');delay.live.set('fx','mix',.3);assert.deepEqual(delay.lanes.get('fx:mix').bindings.map(b=>b.param.events.at(-1)[1]),[.7,.3]);
 const chorus=setup('chorus');chorus.live.set('fx','depthMs',10);assert.deepEqual(chorus.lanes.get('fx:depthMs').bindings.map(b=>b.param.events.at(-1)[1]),[.01,.01]);
 const gain=setup('gain');gain.live.set('fx','width',2);assert.deepEqual(gain.lanes.get('fx:width').bindings.map(b=>b.param.events.at(-1)[1]),[1.5,-.5,-.5,1.5]);
});
test('bypass and synced tremolo rate do not expose inactive live controls',()=>{
 assert.equal(setup('eq',{enabled:false}).lanes.size,0);const synced=setup('tremolo',{sync:true});assert.equal(synced.lanes.has('fx:rate'),false);assert.equal(synced.lanes.has('fx:depth'),true);assert.throws(()=>synced.live.set('fx','rate',2));
});
test('effect return and trim schedules use parameter limits and transform semantics',()=>{
 const {live,lanes,ctx}=setup('eq',{gainDb:3,automation:[{id:'a',parameter:'gainDb',time:0,value:3},{id:'b',parameter:'gainDb',time:10,value:9}]});ctx.currentTime=2;live.trim('fx','gainDb',10);const param=lanes.get('fx:gainDb').bindings[0].param;assert.equal(param.events.at(-1)[1],19);assert.equal(param.events.at(-1)[0],'linear');live.cancel('fx','gainDb');live.set('fx','gainDb',12);ctx.currentTime=3;live.release('fx','gainDb',1);assert.ok(param.events.some(e=>e[0]==='linear'&&Math.abs(e[1]-5.4)<1e-8&&e[2]===4));
});

test('distortion drive and wet output retain dB transforms during live automation',()=>{
 const {live,lanes}=setup('distortion');live.set('fx','driveDb',24);live.set('fx','outputDb',-12);
 assert.equal(lanes.get('fx:driveDb').bindings[0].param.events.at(-1)[1],10**(24/20)/16);
 assert.equal(lanes.get('fx:outputDb').bindings[0].param.events.at(-1)[1],10**(-12/20));
 for(const key of ['driveDb','outputDb'])assert.equal(lanes.get('fx:'+key).bindings[0].exponential,true);
});

test('insert automation and live gestures follow input latency; compressor makeup follows output latency',()=>{
 const timing=[{id:'fx',inputFrames:80,outputFrames:128}];
 const {ctx,live,lanes}=setup('compressor',{automation:[{id:'a',parameter:'makeupDb',time:1,value:6}]},timing);
 const threshold=lanes.get('fx:threshold').bindings[0],makeup=lanes.get('fx:makeupDb').bindings[0];
 assert.equal(threshold.param.events[0][2],.01);assert.equal(makeup.param.events[0][2],.016);assert.equal(makeup.param.events.at(-1)[2],1.016);
 ctx.currentTime=.5;assert.equal(live.set('fx','makeupDb',3),.5);assert.equal(makeup.param.events.at(-1)[2],.516);
 live.set('fx','threshold',-30);assert.equal(threshold.param.events.at(-1)[2],.51);
 ctx.currentTime=.75;live.release('fx','makeupDb',.1);assert.ok(makeup.param.events.some(e=>Math.abs(e[2]-.866)<1e-12));
});
test('delegated effect renderers and linked controls inherit their insert timing',()=>{
 for(const kind of ['limiter','gate','distortion','phaser','chorus','tremolo','gain','eq','delay','reverb']){
  const {lanes,live,ctx}=setup(kind,{},[{id:'fx',inputFrames:80,outputFrames:80}]);
  for(const [id,lane] of lanes){for(const binding of lane.bindings){assert.equal(binding.latencySeconds,.01,kind);assert.equal(binding.param.events[0][2],.01,kind);}
   ctx.currentTime=2;live.set('fx',id.slice(3),lane.fallback);for(const binding of lane.bindings)assert.equal(binding.param.events.at(-1)[2],2.01,kind);
  }
 }
});
