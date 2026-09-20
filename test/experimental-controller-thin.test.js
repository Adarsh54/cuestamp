import test from 'node:test';import assert from 'node:assert/strict';
import {thinControllerPlan} from '../src/experimental/controller-thin.js';
import {controllerValue} from '../src/experimental/midi-events.js';
import {newSession,SessionHistory} from '../src/experimental/session.js';
const events=values=>values.map((value,i)=>({id:`e${i}`,type:'controlChange',channel:0,parameter:11,start:i/10,value}));
test('thinning bounds held-value error throughout dense curves and preserves outside selection',()=>{
 const region={duration:10,events:events(Array.from({length:80},(_,i)=>Math.round(60+30*Math.sin(i/8))))};
 for(const tolerance of [0,1,4,15]){
  const p=thinControllerPlan(region,{type:'controlChange',parameter:11,tolerance,start:1,end:6});assert.ok(p.removed>0);
  for(let t=0;t<10;t+=.017){const error=Math.abs(controllerValue(region.events,'controlChange',11,t,127)-controllerValue(p.events,'controlChange',11,t,127));assert.ok(error<=tolerance);if(t<1||t>=6)assert.equal(error,0);}
  assert.equal(p.events[0].id,'e0');assert.equal(p.events.at(-1).id,'e79');
 }
});
test('resets, coincident points, exact sustain transitions, and other lanes remain',()=>{
 const region={duration:2,events:[...events([50,50,50,50]),{id:'reset',type:'controlChange',channel:0,parameter:121,start:.15,value:0},{id:'other',type:'controlChange',channel:1,parameter:11,start:.1,value:50}]};
 const p=thinControllerPlan(region,{type:'controlChange',parameter:11});assert.ok(p.events.some(e=>e.id==='e2'));assert.ok(p.events.some(e=>e.id==='reset'));assert.ok(p.events.some(e=>e.id==='other'));
 const sustain={duration:1,events:events([0,127,127,0]).map(e=>({...e,parameter:64}))};assert.equal(thinControllerPlan(sustain,{type:'controlChange',parameter:64}).removed,1);assert.throws(()=>thinControllerPlan(sustain,{type:'controlChange',parameter:64,tolerance:1}),/exact/);assert.throws(()=>thinControllerPlan(region,{type:'controlChange',parameter:6}),/RPN/);
 const same={duration:1,events:events([50,50,50]).map(e=>({...e,start:0}))};assert.equal(thinControllerPlan(same,{type:'controlChange',parameter:11}).removed,0);
});
test('shared thinning command is undoable and preserves note content and IDs',()=>{
 const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:2}},...events([50,50,51,51,50]).map(({id,...values})=>({op:'event.add',target:'r',values:{id,...values}}))]);const before=structuredClone(h.session);h.execute([{op:'event.thin',target:'r',values:{type:'controlChange',parameter:11,tolerance:1}}]);assert.deepEqual(h.session.tracks[0].regions[0].events.map(e=>e.id),['e0','e4']);h.undo();assert.deepEqual(h.session,{...before,revision:h.session.revision});
});
