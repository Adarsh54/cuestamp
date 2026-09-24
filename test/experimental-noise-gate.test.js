import test from 'node:test';import assert from 'node:assert/strict';
import {NoiseGate} from '../src/experimental/noise-gate-dsp.js';
import {SessionHistory} from '../src/experimental/session.js';
import {effectSchema,effectTail} from '../src/experimental/effects.js';
import {planDawEdit} from '../server/daw-agent.js';
const process=(gate,left,right,values={})=>{const effect=effectSchema.parse({id:'g',kind:'gate',attack:0,hold:0,release:.001,...values}),parameters=Object.fromEntries(['threshold','reductionDb','hysteresis','attack','hold','release'].map(k=>[k,new Float32Array([effect[k]])])),output=[new Float32Array(left.length),new Float32Array(left.length)];gate.process([left,right],output,parameters);return output;};
test('gate attenuates quiet passages, links stereo, holds and releases without changing input',()=>{
 const rate=48000,gate=new NoiseGate(rate),quiet=new Float32Array(rate/2).fill(.001),loud=new Float32Array(rate/2).fill(.2),copy=loud.slice();
 let out=process(gate,quiet,quiet);assert.ok(Math.abs(out[0].at(-1)-.000001)<1e-9);
 out=process(gate,loud,quiet,{hold:.1});assert.ok(Math.abs(out[0].at(-1)-.2)<1e-7);assert.ok(Math.abs(out[1].at(-1)-.001)<1e-9);
 out=process(gate,quiet,quiet,{hold:.1});assert.ok(out[0][4800]>.0009);assert.ok(out[0].at(-1)<.000002);assert.deepEqual(loud,copy);
 const dry=process(new NoiseGate(rate),quiet,quiet,{reductionDb:0});assert.deepEqual(dry[0],quiet);
});
test('hysteresis keeps an opened gate open between thresholds; new gates stay closed there',()=>{
 const gate=new NoiseGate(48000),loud=new Float32Array(4800).fill(.2),between=new Float32Array(48000).fill(.007);
 process(gate,loud,loud);const held=process(gate,between,between),closed=process(new NoiseGate(48000),between,between);
 assert.ok(held[0].at(-1)>.0069);assert.ok(closed[0].at(-1)<.00001);
});
test('gate commands, automation, bypass and undo share validated effect schema',()=>{
 const h=new SessionHistory();h.execute([{op:'effect.add',target:h.session.id,values:{id:'gate',kind:'gate'}},{op:'effect.automation.point',target:'gate',values:{parameter:'hold',time:1,value:1}}]);const saved=structuredClone(h.session);
 assert.equal(effectTail(h.session.masterEffects),0);assert.throws(()=>h.execute([{op:'effect.set',target:'gate',values:{hysteresis:-1}}]));assert.deepEqual(h.session,saved);
 h.execute([{op:'effect.set',target:'gate',values:{enabled:false}}]);h.undo();assert.equal(h.session.masterEffects[0].enabled,true);
});
test('agent can add and automate a gate through the normal command harness',async()=>{
 const h=new SessionHistory(),commands=[{op:'effect.add',target:h.session.id,values:{id:'gate',kind:'gate',threshold:-35}},{op:'effect.automation.point',target:'gate',values:{parameter:'reductionDb',time:0,value:-40}}];
 const result=await planDawEdit({session:h.session,instruction:'Add a noise gate to master at -35 dB with 40 dB reduction'},{key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Gate',commands})}]})})});
 h.execute(result.commands);assert.equal(h.session.masterEffects[0].threshold,-35);
});

test('attack smoothing follows its time constant and is continuous across render blocks',()=>{
 const rate=48000,input=new Float32Array(960).fill(.2),gate=new NoiseGate(rate);
 const whole=process(gate,input,input,{attack:.01});const splitGate=new NoiseGate(rate),a=process(splitGate,input.subarray(0,480),input.subarray(0,480),{attack:.01}),b=process(splitGate,input.subarray(480),input.subarray(480),{attack:.01});
 assert.ok(Math.abs(whole[0][479]/.2-(1-.999/Math.E))<1e-6);assert.deepEqual(whole[0],Float32Array.from([...a[0],...b[0]]));
});

test('detector filtering settings reject reversed bands and cannot be automated as gain controls',()=>{
 for(const values of [{lowCutHz:1000,highCutHz:1000},{lowCutHz:0},{highCutHz:22000}])assert.throws(()=>effectSchema.parse({id:'g',kind:'gate',...values}));
 const e=effectSchema.parse({id:'g',kind:'gate'});assert.equal(e.filterEnabled,false);assert.throws(()=>effectSchema.parse({...e,automation:[{id:'p',parameter:'lowCutHz',time:0,value:200}]}));
});

test('ducker preserves idle audio and lowers both channels only during the trigger and recovery',()=>{
 const rate=48000,gate=new NoiseGate(rate,'duck'),left=new Float32Array(rate).fill(.4),right=new Float32Array(rate).fill(-.2),trigger=new Float32Array(rate);trigger.fill(.5,rate*.2,rate*.4);
 const values={threshold:-40,reductionDb:-12,hysteresis:6,attack:.01,hold:.05,release:.1},parameters=Object.fromEntries(Object.entries(values).map(([key,v])=>[key,new Float32Array([v])])),out=[new Float32Array(rate),new Float32Array(rate)];
 gate.process([left,right],out,parameters,[trigger]);assert.equal(out[0][rate*.1],left[0]);assert.ok(Math.abs(out[0][rate*.35]/left[0]-10**(-12/20))<1e-5);assert.ok(out[0][rate*.45]<.102);assert.ok(out[0][rate*.9]>.39);
 for(let i=0;i<rate;i++)assert.equal(out[0][i],-2*out[1][i]);assert.ok(left.every(v=>v===left[0]));
});

test('ducker mode is validated, saved in presets and undoable',()=>{
 const h=new SessionHistory();h.execute([{op:'effect.add',target:h.session.id,values:{id:'duck',kind:'gate',mode:'duck',reductionDb:-12}},{op:'effectPreset.save',target:h.session.id,values:{id:'preset',name:'Voice duck'}}]);assert.equal(h.session.effectPresets[0].effects[0].mode,'duck');
 h.execute([{op:'effect.set',target:'duck',values:{mode:'gate'}}]);h.undo();assert.equal(h.session.masterEffects[0].mode,'duck');assert.throws(()=>h.execute([{op:'effect.set',target:'duck',values:{mode:'unknown'}}]));
});
