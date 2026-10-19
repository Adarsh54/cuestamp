import test from 'node:test';import assert from 'node:assert/strict';
import {samplerFilterSchema,scheduleFilterEnvelope,createSamplerFilter} from '../src/experimental/sampler-filter.js';
import {envelopeAt} from '../src/experimental/sampler-envelope.js';import {SessionHistory} from '../src/experimental/session.js';import {planDawEdit} from '../server/daw-agent.js';
const parameter=()=>({events:[],value:0,setValueAtTime(value,time){this.events.push({kind:'set',value,time});},exponentialRampToValueAtTime(value,time){this.events.push({kind:'ramp',value,time});},cancelScheduledValues(time){this.events=this.events.filter(e=>e.time<time);}});
function at(events,t){let before=events[0];for(const event of events){if(event.time>t)return event.kind==='ramp'?before.value*(event.value/before.value)**((t-before.time)/(event.time-before.time)):before.value;before=event;}return before.value;}
test('filter envelope follows semitone ADSR with exact frequency clamp crossings, seeks and early releases',()=>{
 for(const depth of [-96,-24,0,24,96])for(const [attack,decay,sustain,release]of [[.2,.3,.4,.2],[0,.3,.5,0],[.2,0,.4,.2],[0,0,.7,.3]])for(const gate of [.1,.4,.8,Infinity])for(const age of [0,.15,.45,.9]){
 const s=samplerFilterSchema.parse({sampleFilterEnvDepth:depth,sampleFilterAttack:attack,sampleFilterDecay:decay,sampleFilterSustain:sustain,sampleFilterRelease:release}),p=parameter();scheduleFilterEnvelope(p,1000,32000,s,2,age,gate);
 for(let delta=.0001;delta<1;delta+=.0137){const env=envelopeAt(age+delta,gate,{attack,decay,sustain,release}),expected=Math.max(20,Math.min(15998.4,1000*2**(depth*env/12)));assert.ok(Math.abs(at(p.events,2+delta)-expected)<1e-6,JSON.stringify({depth,attack,decay,sustain,release,gate,age,delta,events:p.events,expected,actual:at(p.events,2+delta)}));}
 }
});
test('live filter release cancels held modulation and resumes from current envelope level',()=>{
 const p=parameter(),context={sampleRate:48000,currentTime:0,createBiquadFilter:()=>({frequency:p,Q:{value:0}})},settings={sampleFilterType:'lowpass',sampleFilterCutoff:1000,sampleFilterEnvDepth:24,sampleFilterAttack:1,sampleFilterDecay:.2,sampleFilterSustain:.5,sampleFilterRelease:.4};const node=createSamplerFilter(context,settings,60,60);node.releaseEnvelope(.25);assert.ok(Math.abs(at(p.events,.25)-1000*Math.sqrt(2))<1e-8);assert.ok(Math.abs(at(p.events,.45)-1000*2**.25)<1e-8);assert.equal(at(p.events,.65),1000);assert.equal(createSamplerFilter(context,{...settings,sampleFilterEnvDepth:0},60,60).releaseEnvelope,undefined);
});
test('filter envelope validates atomic edits, presets, undo and agent commands',async()=>{
 const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'midi',instrument:'sampler',sampleAssetId:'sample'}}]);const before=structuredClone(h.session);for(const values of [{sampleFilterVelocity:-.1},{sampleFilterVelocity:1.1},{sampleFilterEnvDepth:97},{sampleFilterAttack:-1},{sampleFilterDecay:11},{sampleFilterSustain:2},{sampleFilterRelease:31}]){assert.throws(()=>h.execute([{op:'track.set',target:'t',values}]));assert.deepEqual(h.session,before);}
 const values={sampleFilterVelocity:.75,sampleFilterEnvDepth:-24,sampleFilterAttack:.1,sampleFilterDecay:.2,sampleFilterSustain:.3,sampleFilterRelease:.4},commands=[{op:'track.set',target:'t',values}];h.execute(commands);h.execute([{op:'samplerPreset.save',target:'t',values:{name:'Dark sweep',id:'preset'}}]);assert.equal(h.session.samplerPresets[0].settings.sampleFilterEnvDepth,-24);assert.equal(h.session.samplerPresets[0].settings.sampleFilterVelocity,.75);h.execute([{op:'track.set',target:'t',values:{sampleFilterEnvDepth:12}}]);h.execute([{op:'samplerPreset.apply',target:'t',values:{presetId:'preset'}}]);assert.equal(h.session.tracks[0].sampleFilterEnvDepth,-24);h.undo();assert.equal(h.session.tracks[0].sampleFilterEnvDepth,12);h.redo();assert.equal(h.session.tracks[0].sampleFilterSustain,.3);
 const result=await planDawEdit({session:before,instruction:'Give the sampler a downward two-octave filter envelope'}, {key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Set filter envelope',commands})}]})})});assert.equal(result.commands[0].values.sampleFilterEnvDepth,-24);assert.equal(result.commands[0].values.sampleFilterVelocity,.75);
});

test('velocity scales signed envelope depth and preserves scaled depth through early release',()=>{
 for(const depth of [-36,36])for(const sensitivity of [0,.5,1])for(const velocity of [0,.25,1]){
 const settings={sampleFilterType:'lowpass',sampleFilterCutoff:1000,sampleFilterEnvDepth:depth,sampleFilterVelocity:sensitivity,sampleFilterAttack:1,sampleFilterRelease:.4},p=parameter(),context={sampleRate:48000,currentTime:0,createBiquadFilter:()=>({frequency:p,Q:{value:0}})};
 const node=createSamplerFilter(context,settings,60,60,{velocity}),scaled=depth*(1-sensitivity+sensitivity*velocity);
 if(!scaled){assert.equal(node.releaseEnvelope,undefined);assert.equal(p.value,1000);continue;}
 assert.ok(Math.abs(at(p.events,.25)-1000*2**(scaled*.25/12))<1e-8);node.releaseEnvelope(.25);assert.ok(Math.abs(at(p.events,.45)-1000*2**(scaled*.125/12))<1e-8);assert.equal(at(p.events,.65),1000);
 }
 const context={sampleRate:48000,currentTime:0,createBiquadFilter:()=>{throw Error('Should validate before allocation');}};
 for(const velocity of [-1,2,NaN,Infinity])assert.throws(()=>createSamplerFilter(context,{sampleFilterType:'lowpass'},60,60,{velocity}),/Invalid sampler filter velocity/);
 assert.equal(samplerFilterSchema.parse({}).sampleFilterVelocity,0);
});
