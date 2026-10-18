import test from 'node:test';import assert from 'node:assert/strict';import {StereoFlanger} from '../src/experimental/flanger-dsp.js';import {effectSchema,effectTail} from '../src/experimental/effects.js';import {SessionHistory} from '../src/experimental/session.js';
const params=(delay=.5,feedback=.5,mix=1)=>({leftMs:Float32Array.of(delay),rightMs:Float32Array.of(delay),feedback:Float32Array.of(feedback),mix:Float32Array.of(mix)});
function render(input,parameters=params(),block=128){const f=new StereoFlanger(48000),out=[new Float32Array(input.length),new Float32Array(input.length)];for(let i=0;i<input.length;i+=block)f.process([input.subarray(i,i+block)],out.map(c=>c.subarray(i,i+block)),Object.fromEntries(Object.entries(parameters).map(([k,v])=>[k,v.length===1?v:v.subarray(i,i+block)])));return out;}
test('short-delay feedback repeats below one render quantum with signed polarity and no channel drift',()=>{
 const signal=new Float32Array(2048);signal[0]=1;
 for(const feedback of [.5,-.5,0]){const out=render(signal,params(.5,feedback));for(let i=0;i<out[0].length;i++){const expected=i>=24&&i%24===0?feedback**(i/24-1):0;assert.ok(Math.abs(out[0][i]-expected)<1e-7,`${i}`);}assert.deepEqual(out[0],out[1]);}
 const fractional=render(signal,params(24.5/48,0));assert.ok(Math.abs(fractional[0][24]-.5)<2e-6);assert.ok(Math.abs(fractional[0][25]-.5)<2e-6);
});
test('dry mode is exact, modulated signed feedback is block-independent and finite',()=>{
 const signal=Float32Array.from({length:20000},(_,i)=>Math.sin(i*.2)*.25),p={leftMs:Float32Array.from(signal,(_,i)=>3+2.9*Math.sin(i*.01)),rightMs:Float32Array.from(signal,(_,i)=>3+2.9*Math.cos(i*.01)),feedback:Float32Array.from(signal,(_,i)=>i<10000?.95:-.95),mix:Float32Array.of(.5)};
 assert.deepEqual(render(signal,p,37),render(signal,p,128));assert.ok(render(signal,p)[0].every(v=>Number.isFinite(v)&&Math.abs(v)<5.1));assert.deepEqual(render(signal,params(.1,.95,0))[0],signal);
 const f=new StereoFlanger(48000);assert.equal(f.rings[0].length,290);assert.throws(()=>new StereoFlanger(0));
});
test('flanger validates parameter and automation bounds, estimates signed-feedback tails and supports undo/presets',()=>{
 const e=effectSchema.parse({id:'f',kind:'flanger'});for(const values of [{depthMs:3},{feedback:1},{feedback:-1},{rate:0},{beats:0},{mix:-1},{automation:[{id:'a',parameter:'depthMs',time:0,value:3}]}])assert.throws(()=>effectSchema.parse({...e,...values}));
 const tail=effectTail([{...e,feedback:0,automation:[{id:'a',parameter:'feedback',time:0,value:-.95}]}]);assert.ok(tail>.6&&tail<1);assert.equal(effectTail([{...e,mix:0}]),0);assert.equal(effectTail([{...e,enabled:false}]),0);
 const h=new SessionHistory();h.execute([{op:'effect.add',target:h.session.id,values:{id:'f',kind:'flanger'}},{op:'effect.automation.point',target:'f',values:{parameter:'feedback',time:1,value:-.5}},{op:'effectPreset.save',target:h.session.id,values:{name:'Flange'}}]);assert.equal(h.session.effectPresets[0].effects[0].kind,'flanger');const saved=structuredClone(h.session);assert.throws(()=>h.execute([{op:'effect.set',target:'f',values:{mix:.7}},{op:'effect.set',target:'f',values:{feedback:1}}]));assert.deepEqual(h.session,saved);h.undo();assert.equal(h.session.masterEffects.length,0);h.redo();assert.equal(h.session.masterEffects[0].automation[0].value,-.5);
});
test('agent adds and automates a tempo-synced flanger through validated commands',async()=>{
 const {planDawEdit}=await import('../server/daw-agent.js'),h=new SessionHistory(),commands=[{op:'effect.add',target:h.session.id,values:{id:'f',kind:'flanger',sync:true,beats:2}},{op:'effect.automation.point',target:'f',values:{parameter:'feedback',time:2,value:-.5}}];
 const result=await planDawEdit({session:h.session,instruction:'Add a synced flanger and automate feedback'},{key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Added flanger',commands})}]})})});h.execute(result.commands);assert.equal(h.session.masterEffects[0].beats,2);assert.equal(h.session.masterEffects[0].automation[0].value,-.5);
});
