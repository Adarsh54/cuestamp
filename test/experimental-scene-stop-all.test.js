import test from 'node:test';import assert from 'node:assert/strict';
import {startSceneTransport} from '../src/experimental/scene-transport.js';
import {SessionHistory} from '../src/experimental/session.js';
import {sceneAudition} from '../src/experimental/scene-playback.js';
const setup=()=>{const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'a',kind:'midi'}},{op:'region.add',target:'a',values:{id:'r',duration:1}},{op:'scene.add',values:{id:'s',name:'Verse',regionIds:'r'}}]);return h;};
test('stop all clips caps recording and queued observations at one boundary while keeping playback open',()=>{
 const h=setup(),context={currentTime:0,destination:{},createGain:()=>({gain:{value:0,setValueAtTime(){}},connect(){},disconnect(){}})},graphs=[],schedule=()=>{const g={stops:[],stop(){},stopAllRegions({when}){g.stops.push(when);}};graphs.push(g);return g;};
 const preview={...sceneAudition(h.session,{sceneId:'s',duration:4}),recordPerformance:true},p=startSceneTransport(context,preview,new Map(),{schedule});
 p.queue(preview,'beat');assert.equal(p.stopAll({quantization:'immediate'}).position,.1);
 assert.deepEqual(graphs.map(g=>g.stops),[[.2],[.2]]);
 context.currentTime=.7;p.advance();assert.equal(p.sceneState().cells.some(c=>c.state==='playing'||c.state==='queued'),false);
 assert.equal(p.performance().events.length,1);assert.equal(p.performance().events[0].duration,.1);
 assert.equal(p.endPosition,4.5);p.stop();assert.throws(()=>p.stopAll({quantization:'beat'}),/Start scene/);
});
test('stop beyond the outgoing window targets the incoming graph; invalid timing changes neither',()=>{
 const h=setup(),context={currentTime:0,destination:{},createGain:()=>({gain:{value:0,setValueAtTime(){}},connect(){},disconnect(){}})},calls=[],schedule=()=>({stop(){},stopAllRegions({when}){calls.push(when);}}),p=startSceneTransport(context,sceneAudition(h.session,{sceneId:'s',duration:1}),new Map(),{schedule});
 p.queue(sceneAudition(h.session,{sceneId:'s',duration:4}),'beat');p.stopAll({quantization:'bar'});assert.deepEqual(calls,[2.1]);
 assert.throws(()=>p.stopAll({quantization:'wrong'}),/Choose immediate/);assert.deepEqual(calls,[2.1]);
});
test('agent all-clip stop is standalone and available only during scene playback',async()=>{
 const {planDawEdit}=await import('../server/daw-agent.js'),h=setup(),request={session:h.session,instruction:'Stop every clip at the next bar',allowSceneAudition:true,transport:{sessionId:h.session.id,revision:h.session.revision,epoch:4,position:.5,playing:true,mode:'scene'}};
 let offered;const options={key:'test',model:'test',fetchImpl:async(_url,init)=>{offered=JSON.parse(init.body).tools;return {ok:true,json:async()=>({output:[{type:'function_call',name:'stop_all_scene_clips',arguments:JSON.stringify({quantization:'bar'})}]})};}};
 const result=await planDawEdit(request,options);assert.equal(result.action,'stop_all_scene_clips');assert.deepEqual(result.options,{quantization:'bar'});assert.equal(result.transportEpoch,4);assert.ok(offered.some(t=>t.name==='stop_all_scene_clips'));
 await assert.rejects(()=>planDawEdit({...request,transport:{...request.transport,mode:'arrangement'}},options),/Unexpected/);
});
