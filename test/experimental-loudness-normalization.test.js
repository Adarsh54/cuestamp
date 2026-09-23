import test from 'node:test';
import assert from 'node:assert/strict';
import {SessionHistory,newSession} from '../src/experimental/session.js';
import {loudnessNormalizationPlan} from '../src/experimental/mix-analysis.js';
import {planDawEdit} from '../server/daw-agent.js';
const fixture=()=>{const history=new SessionHistory(newSession()),session=history.session;return {history,session,analysis:{sessionId:session.id,revision:session.revision,measuredAt:Date.now(),sampleRate:48000,frames:48000,channels:[0,1].map(()=>({peakDb:-6,rmsDb:-23,peakFrame:0,overSamples:0})),loudness:{integratedLufs:-23,blocks:7,gatedBlocks:7}}};};
test('loudness gain uses measured target, caps sample peaks, and remains undoable',()=>{
 const {history,session,analysis}=fixture(),plan=loudnessNormalizationPlan(session,analysis,-18,-1);
 assert.equal(plan.deltaDb,5);assert.equal(plan.limited,false);history.execute(plan.commands);assert.equal(history.session.masterDb,session.masterDb+5);history.undo();assert.equal(history.session.masterDb,session.masterDb);
 const capped=loudnessNormalizationPlan(session,analysis,-14,-1);assert.equal(capped.deltaDb,5);assert.equal(capped.limited,true);assert.equal(capped.estimatedLufs,-18);
 assert.equal(loudnessNormalizationPlan(session,analysis,-30,-1).deltaDb,-7);
});
test('rejects missing, silent, stale or invalid loudness targets and gain overflow',()=>{
 const {session,analysis}=fixture();for(const a of [undefined,{...analysis,revision:999},{...analysis,loudness:undefined},{...analysis,loudness:{integratedLufs:null,blocks:7,gatedBlocks:0}}])assert.throws(()=>loudnessNormalizationPlan(session,a,-14,-1));
 for(const [target,ceiling] of [[NaN,-1],[-61,-1],[-4,-1],[-14,1],[-14,-61]])assert.throws(()=>loudnessNormalizationPlan(session,analysis,target,ceiling));
 assert.throws(()=>loudnessNormalizationPlan({...session,masterDb:12},analysis,-18,-1),/outside/);
});
test('agent uses shared measured gain planner and requires fresh verification',async()=>{
 const {session,analysis}=fixture();let sent;const options={key:'test',model:'test',fetchImpl:async(_,request)=>{sent=JSON.parse(request.body);return {ok:true,json:async()=>({output:[{type:'function_call',name:'normalize_mix_loudness',arguments:JSON.stringify({targetLufs:-14,ceilingDb:-1})}]})};}};
 const result=await planDawEdit({session,mixAnalysis:analysis,instruction:'Normalize to -14 LUFS with a -1 sample peak ceiling'},options);
 assert.ok(sent.tools.some(t=>t.name==='normalize_mix_loudness'));assert.equal(result.commands[0].values.deltaDb,5);assert.equal(result.verifyMix,true);assert.match(result.summary,/ceiling limits/);
 await assert.rejects(planDawEdit({session,instruction:'Normalize'},options),/Unexpected/);
 await assert.rejects(planDawEdit({session,mixAnalysis:{...analysis,revision:12},instruction:'Normalize'},options),/does not match/);
});
