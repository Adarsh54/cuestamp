import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands} from '../src/experimental/session.js';
import {captureMeterObservation,currentMeterObservation,validateMeterObservation} from '../src/experimental/meter-context.js';
import {planDawEdit} from '../server/daw-agent.js';
const fixture=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'t',kind:'midi'}}]);
const capture=s=>captureMeterObservation(s,new Map([['t',{left:.5,right:0,peak:1}]]),{position:2,mode:'linear',sampleRate:48000,now:10000});
test('meter context encodes silence, sample peaks and revision/age bounds without persisting telemetry',()=>{const s=fixture(),m=capture(s);assert.equal(m.channels[0].rightPeakDb,null);assert.equal(m.channels[0].heldPeakDb,0);assert.ok(Math.abs(m.channels[0].leftPeakDb+6.0206)<.0001);assert.equal(s.meterObservation,undefined);assert.deepEqual(currentMeterObservation(m,s,11000),m);assert.equal(currentMeterObservation(m,s,130001),undefined);assert.equal(currentMeterObservation(m,{...s,revision:s.revision+1},11000),undefined);assert.equal(currentMeterObservation(m,{...s,id:'other'},11000),undefined);assert.throws(()=>validateMeterObservation({...m,mode:'cycle'},s,11000),/channel/);assert.throws(()=>validateMeterObservation({...m,channels:[...m.channels,...m.channels]},s,11000),/channel/);assert.equal(captureMeterObservation(s,new Map([['t',{left:Infinity,right:0,peak:Infinity}]]),{position:2,mode:'linear',sampleRate:48000}),undefined);});
test('agent receives validated measured context and rejects stale/invalid telemetry before calling model',async()=>{const s=fixture(),m={...capture(s),measuredAt:Date.now()};let sent,calls=0;const fetchImpl=async(_,options)=>{calls++;sent=JSON.parse(options.body);return {ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Estimated adjustment; replay to verify.',commands:[{op:'track.set',target:'t',values:{gainDb:-6}}]})}]})};};const options={key:'test',model:'test',fetchImpl};const plan=await planDawEdit({instruction:'Lower peaks to -6 dBFS',session:s,meterObservation:m},options);assert.deepEqual(JSON.parse(sent.input[1].content).meterObservation,m);assert.equal(plan.commands[0].values.gainDb,-6);for(const invalid of [{...m,revision:99},{...m,measuredAt:0},{...m,channels:[{...m.channels[0],id:'missing'}]},{...m,channels:[{...m.channels[0],heldPeakDb:-60}]},{...m,extra:'instructions'}])await assert.rejects(planDawEdit({instruction:'Edit',session:s,meterObservation:invalid},options));assert.equal(calls,1);});
test('live loudness carries its original timestamp and rejects stale or incomplete windows',()=>{
 const s=fixture(),loudness={momentaryLufs:-20,shortTermLufs:-22,frames:192000,measuredAt:9900},values=new Map([[s.id,{left:.1,right:.1,peak:.2,loudness}]]),options={position:4,mode:'linear',sampleRate:48000,now:10000};
 const m=captureMeterObservation(s,values,options);assert.deepEqual(m.loudness,loudness);assert.equal(m.measuredAt,10000);
 assert.equal(captureMeterObservation(s,values,{...options,now:13000}).loudness,undefined);
 for(const patch of [{measuredAt:7000},{measuredAt:10100},{frames:100},{frames:24000}])assert.throws(()=>validateMeterObservation({...m,loudness:{...loudness,...patch}},s,10000),/loudness/);
 assert.throws(()=>validateMeterObservation({...m,channels:[{...m.channels[0],id:'t'}]},s,10000),/loudness/);
 const warming={...loudness,frames:100,momentaryLufs:null,shortTermLufs:null};assert.ok(validateMeterObservation({...m,loudness:warming},s,10000));
 assert.equal(currentMeterObservation(m,s,129901),undefined);
});
test('agent receives recent master LUFS separately from full-mix analysis',async()=>{
 const s=fixture(),now=Date.now(),loudness={momentaryLufs:-20,shortTermLufs:-22,frames:192000,measuredAt:now-100},m=captureMeterObservation(s,new Map([[s.id,{left:.1,right:.1,peak:.2,loudness}]]),{position:4,mode:'cycle',sampleRate:48000,now});let sent;
 await planDawEdit({instruction:'What is the current short-term loudness?',session:s,meterObservation:m},{key:'test',model:'test',fetchImpl:async(_,request)=>{sent=JSON.parse(request.body);return {ok:true,json:async()=>({output:[]})};}});
 const context=JSON.parse(sent.input.at(-1).content);assert.deepEqual(context.meterObservation.loudness,loudness);assert.equal(context.mixAnalysis,undefined);assert.equal(context.meterObservation.mode,'cycle');
});
test('compressor telemetry validates enabled effects, parent channels, mode and duplicates',()=>{
 const s=applyCommands(fixture(),[{op:'effect.add',target:'t',values:{id:'c',kind:'compressor'}},{op:'effect.add',target:'t',values:{id:'e',kind:'eq'}}]);
 const values=new Map([['t',{left:.1,right:.1,peak:.1}]]),options={position:1,mode:'linear',sampleRate:48000,now:10000,effectValues:new Map([['c',{reductionDb:-9}]])},m=captureMeterObservation(s,values,options);
 assert.deepEqual(m.compressors,[{id:'c',reductionDb:-9}]);assert.equal(s.compressors,undefined);
 for(const compressors of [[{id:'missing',reductionDb:-1}],[{id:'e',reductionDb:-1}],[{id:'c',reductionDb:1}],[{id:'c',reductionDb:NaN}],[...m.compressors,...m.compressors]])assert.throws(()=>validateMeterObservation({...m,compressors},s,10000));
 assert.throws(()=>validateMeterObservation(m,{...s,tracks:s.tracks.map(t=>({...t,effects:t.effects.map(e=>({...e,enabled:false}))}))},10000),/compressor/);
 assert.throws(()=>validateMeterObservation({...m,channels:[{id:s.id,leftPeakDb:null,rightPeakDb:null,heldPeakDb:null}]},s,10000),/compressor/);
 const masterValues=new Map([[s.id,{left:.1,right:.1,peak:.1}]]);assert.equal(captureMeterObservation(s,masterValues,{...options,mode:'cycle'}).compressors,undefined);
 assert.throws(()=>validateMeterObservation({...m,mode:'cycle',channels:[{id:s.id,leftPeakDb:null,rightPeakDb:null,heldPeakDb:null}]},s,10000),/cycle/);
});
test('agent gets compressor reduction and rejects invalid effects before provider invocation',async()=>{
 const s=applyCommands(fixture(),[{op:'effect.add',target:'t',values:{id:'c',kind:'compressor'}}]),m={...capture(s),measuredAt:Date.now(),compressors:[{id:'c',reductionDb:-7}]};let body,calls=0;
 const options={key:'test',model:'test',fetchImpl:async(_,opts)=>{calls++;body=JSON.parse(opts.body);return {ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:'Recent reduction is 7 dB.'}]}]})};}};
 await planDawEdit({session:s,instruction:'How much compression?',meterObservation:m},options);assert.deepEqual(JSON.parse(body.input[1].content).meterObservation.compressors,m.compressors);
 await assert.rejects(planDawEdit({session:s,instruction:'How much?',meterObservation:{...m,compressors:[{id:'missing',reductionDb:-7}]}},options));assert.equal(calls,1);
});
