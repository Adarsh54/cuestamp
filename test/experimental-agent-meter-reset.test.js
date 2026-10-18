import test from 'node:test';import assert from 'node:assert/strict';
import {SessionHistory} from '../src/experimental/session.js';import {captureMeterObservation} from '../src/experimental/meter-context.js';import {performMeterReset} from '../src/experimental/agent-meter-reset.js';import {planDawEdit} from '../server/daw-agent.js';
function fixture(){const h=new SessionHistory();h.execute([{op:'effect.add',target:h.session.id,values:{id:'l',kind:'limiter'}}]);const session=h.session,transport={sessionId:session.id,revision:session.revision,epoch:4,position:1,playing:true,mode:'arrangement'},observation=captureMeterObservation(session,new Map([[session.id,{left:.2,right:.2,peak:.2}]]),{position:1,mode:'linear',sampleRate:48000,effectValues:new Map([['l',{reductionDb:0,outputPeaksDbtp:[-2,-2],heldOutputPeaksDbtp:[1,1]}]])});return {session,transport,observation};}
const adapter=(action,inspect=()=>{})=>({key:'test',model:'test',fetchImpl:async(_url,options)=>{inspect(JSON.parse(options.body));return {ok:true,json:async()=>({output:[{type:'function_call',name:'reset_limiter_peak_hold',arguments:JSON.stringify(action)}]})};}});
test('agent exposes reset only for observed live peak holds and validates exact targets',async()=>{
 const {session,transport,observation}=fixture(),request={session,transport,meterObservation:observation,instruction:'Reset the limiter peak hold',allowTransport:true};let sent;
 const result=await planDawEdit(request,adapter({effectId:'l'},body=>sent=body));assert.equal(result.action,'reset_limiter_peak_hold');assert.deepEqual(result.commands,[]);assert.equal(result.transportEpoch,4);assert.ok(sent.tools.some(t=>t.name==='reset_limiter_peak_hold'));
 for(const action of [{effectId:'missing'},{effectId:'l',ceilingDb:-3},{}])await assert.rejects(planDawEdit(request,adapter(action)));
 for(const extra of [{allowTransport:false},{editingContinuation:true},{meterObservation:undefined},{transport:{...transport,playing:false,mode:'stopped'}}])await assert.rejects(planDawEdit({...request,...extra},adapter({effectId:'l'})));
});
test('reset rejects stale playback, scene graph switches, missing readings and cancellation without touching audio',()=>{
 const {session,transport,observation}=fixture();let resets=0;const graph={},playback={meters:graph,readEffectMeters:()=>new Map([['l',{heldOutputPeaksDbtp:[1,1]}]]),resetEffectMeters:id=>{assert.equal(id,'l');resets++;return true;}};
 const options={transport,observation,expectedEpoch:4,currentEpoch:4,expectedPlayback:playback,playback,expectedMeters:graph};const before=structuredClone(session);
 assert.match(performMeterReset(session,{effectId:'l'},options),/Playback continues/);assert.equal(resets,1);assert.deepEqual(session,before);
 for(const extra of [{currentEpoch:5},{playback:null},{expectedPlayback:{}},{expectedMeters:{}},{observation:{...observation,measuredAt:0}},{signal:AbortSignal.abort(Error('Canceled'))}])assert.throws(()=>performMeterReset(session,{effectId:'l'},{...options,...extra}));
 playback.readEffectMeters=()=>new Map();assert.throws(()=>performMeterReset(session,{effectId:'l'},options),/unavailable/);assert.equal(resets,1);
});
