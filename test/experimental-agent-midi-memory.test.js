import test from 'node:test';import assert from 'node:assert/strict';
import {SessionHistory} from '../src/experimental/session.js';
import {planDawEdit} from '../server/daw-agent.js';
test('agent MIDI capture requires observed ready memory and rejects extra arguments and invalid destinations',async()=>{
 const h=new SessionHistory();const input={session:h.session,instruction:'Keep what I just played',allowTransport:true,transport:{sessionId:h.session.id,revision:0,epoch:3,position:0,playing:false,recentMidi:{version:2,asOf:1500,count:2,ready:true,targetTrackId:null}}};
 const adapter=(available,args={})=>({key:'test',model:'test',fetchImpl:async(url,options)=>{assert.equal(JSON.parse(options.body).tools.some(t=>t.name==='capture_recent_midi'),available);return {ok:true,json:async()=>({output:[{type:'function_call',name:'capture_recent_midi',arguments:JSON.stringify(args)}]})};}});
 const result=await planDawEdit(input,adapter(true));assert.equal(result.action,'capture_recent_midi');assert.equal(result.transportEpoch,3);assert.deepEqual(result.commands,[]);
 await assert.rejects(planDawEdit(input,adapter(true,{notes:[]})));
 await assert.rejects(planDawEdit({...input,allowTransport:false},adapter(false)),/Unexpected/);
 await assert.rejects(planDawEdit({...input,transport:{...input.transport,recentMidi:{...input.transport.recentMidi,ready:false}}},adapter(false)),/Unexpected/);
 await assert.rejects(planDawEdit({...input,transport:{...input.transport,recentMidi:{...input.transport.recentMidi,targetTrackId:'missing'}}},adapter(true)),/destination/);
});
