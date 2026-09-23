import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands} from '../src/experimental/session.js';
import {audioRecordingWindow} from '../src/experimental/audio-punch.js';
import {cycleRecordingFrames} from '../src/experimental/cycle-recording.js';
import {recordedMediaPlan} from '../src/experimental/media-import-plan.js';
const session=()=>applyCommands(newSession(),[{op:'session.set',values:{audioRecordMode:'cycle',loopEnabled:true,loopStart:2,loopEnd:3}}]);
test('cycle recording starts at cycle start, rounds pass frames and bounds capture',()=>{
 const s=session(),w=audioRecordingWindow(s,50);assert.equal(w.start,2);assert.equal(w.playbackStart,2);assert.equal(w.duration,64);assert.equal(w.punch,false);assert.deepEqual(cycleRecordingFrames(w,48000),{period:48000,maxFrames:3072000});
 assert.equal(audioRecordingWindow({...s,loopEnd:12}).duration,600);assert.equal(cycleRecordingFrames(audioRecordingWindow({...s,loopStart:86399,loopEnd:86400}),48000).maxFrames,48000);
 for(const patch of [{loopEnabled:false},{audioPunchEnabled:true},{loopEnd:2.01}])assert.throws(()=>audioRecordingWindow({...s,...patch}));
});
test('cycle save preserves continuous source, selects final full pass, and retains partial tail',()=>{
 const s=session(),plan=recordedMediaPlan(s,{name:'Passes.wav',assetId:'recording',start:2,duration:2.4,cycleDuration:1}),after=applyCommands(s,plan.commands);assert.equal(plan.cycleTakes,true);assert.equal(after.tracks.length,2);assert.equal(after.tracks[0].regions[0].mute,true);assert.equal(after.tracks[0].regions[0].duration,2.4);const takes=after.tracks[1].regions;assert.deepEqual(takes.map(r=>[r.start,r.offset,r.mute]),[[2,0,true],[2,1,false],[2,2,true]]);assert.ok(Math.abs(takes[2].duration-.4)<1e-9);
});
test('stopping before a full pass still saves all captured audio',()=>{
 const s=session(),plan=recordedMediaPlan(s,{name:'Brief.wav',assetId:'recording',start:2,duration:.2,cycleDuration:1}),after=applyCommands(s,plan.commands);assert.equal(after.tracks.length,1);assert.equal(after.tracks[0].regions[0].mute,false);assert.equal(after.tracks[0].regions[0].duration,.2);
});
