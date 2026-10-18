import test from 'node:test';import assert from 'node:assert/strict';
import {sceneSwitchTime,startSceneTransport} from '../src/experimental/scene-transport.js';
test('scene switch boundaries follow quarter beats, meter denominators and tempo changes',()=>{
 assert.equal(sceneSwitchTime({tempo:120},.2,'beat'),.5);
 assert.equal(sceneSwitchTime({tempo:120},.2,'bar'),2);
 assert.equal(sceneSwitchTime({tempo:120,meter:6,meterDenominator:8},.1,'beat'),.25);
 assert.equal(sceneSwitchTime({tempo:120,meter:6,meterDenominator:8},.1,'bar'),1.5);
 assert.equal(sceneSwitchTime({tempo:120,tempoChanges:[{beat:2,bpm:60}]},1.1,'beat'),2);
 assert.equal(sceneSwitchTime({tempo:120,meterChanges:[{bar:2,numerator:3,denominator:4}]},2.1,'bar'),3.5);
 assert.equal(sceneSwitchTime({tempo:120},.3,'immediate'),.3);
 assert.throws(()=>sceneSwitchTime({},NaN,'bar'));assert.throws(()=>sceneSwitchTime({},0,'other'));
});
const fixture=()=>{const nodes=[],graphs=[],context={currentTime:0,sampleRate:48000,destination:{},createGain(){const node={events:[],disconnected:false,gain:{value:1,setValueAtTime(value,time){node.events.push([value,time]);}},connect(){},disconnect(){this.disconnected=true;}};nodes.push(node);return node;}},schedule=(_context,_doc,_buffers,_position,options)=>{const graph={options,stopped:false,meters:{read:()=>new Map()},stop(){this.stopped=true;}};graphs.push(graph);return graph;},plan=id=>({sceneId:id,document:{tempo:120,tracks:[]},end:3,label:id});return {context,nodes,graphs,schedule,plan};};
test('queue schedules matching gates before UI advance, then cleans up old graph and extends end',()=>{const f=fixture(),p=startSceneTransport(f.context,f.plan('a'),new Map(),{schedule:f.schedule});const queued=p.queue(f.plan('b'),'beat');assert.equal(queued.position,.5);assert.deepEqual(f.nodes[0].events,[[1,.1],[0,.6]]);assert.deepEqual(f.nodes[1].events,[[1,.6]]);assert.equal(f.graphs[1].options.baseTime,.6);assert.equal(f.graphs[1].options.destination,f.nodes[1]);assert.equal(p.endPosition,3.5);assert.equal(p.advance(),null);assert.throws(()=>p.queue(f.plan('c'),'beat'),/already queued/);f.context.currentTime=.61;assert.equal(p.advance().sceneId,'b');assert.equal(p.scenePreview,'b');assert.equal(f.graphs[0].stopped,true);p.stop();assert.ok(f.graphs.every(g=>g.stopped));assert.ok(f.nodes.every(n=>n.disconnected));p.stop();assert.throws(()=>p.queue(f.plan('c'),'beat'),/Start scene/);});
test('stop before launch disconnects pending audio and failed preparation preserves active gates',()=>{const f=fixture(),p=startSceneTransport(f.context,f.plan('a'),new Map(),{schedule:f.schedule});p.queue(f.plan('b'),'beat');p.stop();assert.ok(f.graphs.every(g=>g.stopped));const g=fixture(),q=startSceneTransport(g.context,{...g.plan('a'),end:.2},new Map(),{schedule:g.schedule});assert.throws(()=>q.queue(g.plan('b'),'bar'),/ends before/);assert.equal(g.graphs.length,1);assert.deepEqual(g.nodes[0].events,[[1,.1]]);q.stop();});
test('missed preparation deadline cancels new graph without opening its output',()=>{const f=fixture();assert.throws(()=>startSceneTransport(f.context,f.plan('a'),new Map(),{schedule:(...args)=>{const result=f.schedule(...args);f.context.currentTime=1;return result;}}),/missed/);assert.deepEqual(f.nodes[0].events,[]);assert.equal(f.nodes[0].disconnected,true);assert.equal(f.graphs[0].stopped,true);});
test('agent queue action requires scene playback and validates scene and timing',async()=>{
 const {SessionHistory}=await import('../src/experimental/session.js'),{planDawEdit}=await import('../server/daw-agent.js'),h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:2}},{op:'scene.add',values:{id:'s',name:'Verse',regionIds:'r'}}]);const before=structuredClone(h.session);let offered;
 const options={key:'test',model:'test',fetchImpl:async(_url,init)=>{offered=JSON.parse(init.body).tools;return {ok:true,json:async()=>({output:[{type:'function_call',name:'queue_scene',arguments:JSON.stringify({sceneId:'s',duration:5,quantization:'bar'})}]})};}},request={session:h.session,instruction:'Cue Verse on the next bar',allowSceneAudition:true,transport:{sessionId:h.session.id,revision:h.session.revision,epoch:4,position:1,playing:true,mode:'scene'}};
 const plan=await planDawEdit(request,options);assert.equal(plan.action,'queue_scene');assert.equal(plan.quantization,'bar');assert.equal(plan.transportEpoch,4);assert.ok(offered.some(t=>t.name==='queue_scene'));assert.deepEqual(h.session,before);
 await assert.rejects(()=>planDawEdit({...request,transport:{...request.transport,mode:'arrangement'}},options),/Unexpected/);assert.ok(!offered.some(t=>t.name==='queue_scene'));
});

test('scene switches reserve processor pre-roll while gates and receipts use audible beats',()=>{
 const f=fixture(),withDelay=(id,count)=>({...f.plan(id),document:{tempo:120,tracks:[],masterEffects:Array.from({length:count},(_,i)=>({id:`c${i}`,enabled:true,kind:'compressor'}))}});
 const p=startSceneTransport(f.context,withDelay('a',16),new Map(),{schedule:f.schedule});assert.ok(Math.abs(p.base-.196)<1e-12);assert.ok(Math.abs(f.graphs[0].options.baseTime-.1)<1e-12);assert.equal(f.graphs[0].options.compensateLatency,true);
 f.context.currentTime=.55;const result=p.queue(withDelay('b',32),'beat');assert.equal(result.position,1);assert.ok(Math.abs(f.graphs[1].options.baseTime-1.004)<1e-12);assert.ok(Math.abs(f.nodes[1].events[0][1]-1.196)<1e-12);
 f.context.currentTime=1.1;assert.equal(p.advance(),null);f.context.currentTime=1.2;assert.equal(p.advance().sceneId,'b');p.stop();assert.ok(Math.abs(p.performance().events[1].start-1)<1e-12);
});
test('preparation must finish before source start, even if audible launch is still in the future',()=>{
 const f=fixture(),plan={...f.plan('a'),document:{tempo:120,tracks:[],masterEffects:Array.from({length:16},(_,i)=>({id:`c${i}`,enabled:true,kind:'compressor'}))}};
 assert.throws(()=>startSceneTransport(f.context,plan,new Map(),{schedule:(...args)=>{const graph=f.schedule(...args);f.context.currentTime=.15;return graph;}}),/missed/);assert.equal(f.graphs[0].stopped,true);assert.deepEqual(f.nodes[0].events,[]);
});
test('stop-all schedules each queued graph at its own source deadline for one audible boundary',()=>{
 const f=fixture(),withDelay=(id,count)=>({...f.plan(id),document:{tempo:120,tracks:[],masterEffects:Array.from({length:count},(_,i)=>({id:`c${i}`,enabled:true,kind:'compressor'}))}}),calls=[];
 const schedule=(...args)=>{const graph=f.schedule(...args);graph.stopAllRegions=({when})=>calls.push(when);return graph;};
 const p=startSceneTransport(f.context,withDelay('a',16),new Map(),{schedule});p.queue(withDelay('b',32),'beat');assert.equal(p.stopAll({quantization:'beat'}).position,.5);assert.equal(calls.length,2);assert.ok(Math.abs(calls[0]-.6)<1e-12);assert.ok(Math.abs(calls[1]-.504)<1e-12);p.stop();
});
