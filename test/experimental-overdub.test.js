import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,SessionHistory} from '../src/experimental/session.js';
import {scheduleRecordingPlayback} from '../src/experimental/recording-playback.js';
test('recording playback is opt-in, persisted and independently undoable',()=>{
 const h=new SessionHistory(newSession());assert.equal(h.session.recordWithPlayback,false);h.execute([{op:'session.set',values:{recordWithPlayback:true}}]);assert.equal(h.session.recordWithPlayback,true);h.undo();assert.equal(h.session.recordWithPlayback,false);h.redo();assert.equal(h.session.recordWithPlayback,true);assert.throws(()=>h.execute([{op:'session.set',values:{recordWithPlayback:'yes'}}]));
 assert.doesNotThrow(()=>scheduleRecordingPlayback(null,{recordWithPlayback:false},null,0,0).stop());
});

test('recording reserves processing pre-roll only for live backing tracks',async()=>{
 const {recordingPlaybackLatency}=await import('../src/experimental/recording-playback.js'),{recordingTiming}=await import('../src/experimental/recording-timing.js');
 const h=new SessionHistory();h.execute([{op:'session.set',values:{recordWithPlayback:true,countInBars:1}},{op:'effect.add',target:h.session.id,values:{kind:'compressor'}}]);
 const latency=recordingPlaybackLatency(h.session,48000);assert.equal(latency,.006);assert.equal(recordingPlaybackLatency(h.session,48000,{}),0);assert.equal(recordingPlaybackLatency({...h.session,recordWithPlayback:false},48000),0);
 const original=recordingTiming(h.session,10,48000),timing=recordingTiming(h.session,10+latency,48000);assert.equal(timing.countInSeconds,original.countInSeconds);assert.ok(Math.abs(timing.captureTime-original.captureTime-latency)<1e-10);
 assert.throws(()=>scheduleRecordingPlayback({sampleRate:48000,currentTime:10},h.session,new Map(),0,10.001),/missed the recording start/);
});
