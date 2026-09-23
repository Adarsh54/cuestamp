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
test('true-peak ceiling uses the larger inter-sample peak and never falls back silently',()=>{
 const {session,analysis}=fixture(),measured={...analysis,truePeak:{oversample:4,peaksDbtp:[-3,-4]}};
 const sample=loudnessNormalizationPlan(session,measured,-14,-1,'sample'),truePeak=loudnessNormalizationPlan(session,measured,-14,-1,'true');
 assert.equal(sample.deltaDb,5);assert.equal(truePeak.deltaDb,2);assert.equal(truePeak.peakMode,'true');assert.equal(truePeak.limited,true);
 assert.throws(()=>loudnessNormalizationPlan(session,analysis,-14,-1,'true'),/measure estimated true peaks/);
 assert.throws(()=>loudnessNormalizationPlan(session,measured,-14,-1,'invalid'),/Choose/);
});
test('agent true-peak action shares the measured ceiling and reanalysis requirement',async()=>{
 const {session,analysis}=fixture(),measured={...analysis,truePeak:{oversample:4,peaksDbtp:[-3,-4]}},options={key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'normalize_mix_loudness',arguments:JSON.stringify({targetLufs:-14,ceilingDb:-1,peakMode:'true'})}]})})};
 const plan=await planDawEdit({session,mixAnalysis:measured,instruction:'Set -14 LUFS with -1 dBTP ceiling'},options);
 assert.equal(plan.commands[0].values.deltaDb,2);assert.equal(plan.verifyMix,true);assert.match(plan.summary,/estimated true-peak/);
 await assert.rejects(planDawEdit({session,mixAnalysis:analysis,instruction:'Set true peak ceiling'},options),/measure estimated true peaks/);
});
test('measured gain brings an inter-sample waveform to its estimated ceiling',async()=>{
 const {truePeakStatistics}=await import('../src/experimental/audio-true-peak.js'),{integratedLoudness}=await import('../src/experimental/audio-loudness.js'),{audioStatistics}=await import('../src/experimental/audio-statistics.js');
 const {session,analysis}=fixture(),source=Float32Array.from({length:48000},(_,i)=>.9*Math.sin(Math.PI/2*i+Math.PI/4)),channels=[source,source];
 const measured={...analysis,channels:audioStatistics(channels),loudness:integratedLoudness(channels,48000),truePeak:truePeakStatistics(channels,48000)},plan=loudnessNormalizationPlan(session,measured,-5,-12,'true');
 const scaled=source.map(v=>v*10**(plan.deltaDb/20)),after=truePeakStatistics([scaled,scaled],48000);
 assert.equal(plan.limited,true);assert.ok(after.peaksDbtp.every(v=>Math.abs(v+12)<1e-5));
});
