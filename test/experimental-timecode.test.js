import test from 'node:test';import assert from 'node:assert/strict';import {formatTimecode,parseTimecode,stepFrame} from '../src/experimental/timecode.js';import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
test('timecode round trips frames at integer and fractional frame rates',()=>{for(const fps of [24,25,29.97,59.94]){for(const text of ['00:00:00:00','00:00:01:12','01:23:45:17'])assert.equal(formatTimecode(parseTimecode(text,fps),fps),text);assert.equal(formatTimecode(stepFrame(0,1,fps),fps),'00:00:00:01');}assert.equal(stepFrame(0,-1,24),0);assert.throws(()=>parseTimecode('00:00:00:24',24));assert.throws(()=>parseTimecode('00:70:00:00',24));});
test('movie audio extraction preserves original source and timing with independent edit history',()=>{const original=applyCommands(newSession(),[{op:'track.add',values:{id:'video',kind:'video',name:'Picture'}},{op:'region.add',target:'video',values:{id:'movie',assetId:'original',start:4,offset:2,duration:3}}]),history=new SessionHistory(original);history.execute([{op:'region.extractAudio',target:'movie',values:{trackId:'audio',regionId:'sound'}}]);const audio=history.session.tracks[1];assert.equal(audio.kind,'audio');assert.equal(audio.regions[0].assetId,'original');assert.equal(audio.regions[0].start,4);assert.equal(audio.regions[0].offset,2);history.execute([{op:'region.set',target:'sound',values:{gainDb:-12}}]);assert.equal(history.session.tracks[0].regions[0].gainDb,0);history.undo();history.undo();assert.equal(history.session.tracks.length,1);});
test('frame rate is validated and extraction rejects non-movie targets',()=>{assert.throws(()=>applyCommands(newSession(),[{op:'session.set',values:{frameRate:42}}]));const s=applyCommands(newSession(),[{op:'track.add',values:{id:'t'}},{op:'region.add',target:'t',values:{id:'r',assetId:'a'}}]);assert.throws(()=>applyCommands(s,[{op:'region.extractAudio',target:'r'}]),/movie/);});
test('drop-frame skips labels at minutes while preserving every physical frame',()=>{
 for(const rate of [29.97,59.94]){const nominal=Math.round(rate),drop=nominal/15,fps=nominal*1000/1001;
 assert.equal(formatTimecode((nominal*60-1)/fps,rate,true),`00:00:59;${nominal-1}`);
 assert.equal(formatTimecode(nominal*60/fps,rate,true),`00:01:00;0${drop}`);
 assert.equal(formatTimecode((nominal*600-drop*9)/fps,rate,true),'00:10:00;00');
 assert.equal(formatTimecode((nominal*3600-drop*54)/fps,rate,true),'01:00:00;00');
 for(let frame=0;frame<nominal*601;frame++){const text=formatTimecode(frame/fps,rate,true);assert.ok(Math.abs(parseTimecode(text,rate,true)*fps-frame)<1e-7);}
 for(let frame=0;frame<drop;frame++)assert.throws(()=>parseTimecode(`00:01:00;0${frame}`,rate,true),/skipped/);
 assert.equal(formatTimecode(stepFrame(parseTimecode('00:01:00;0'+drop,rate,true),-1,rate),rate,true),`00:00:59;${nominal-1}`);
 }
 assert.throws(()=>parseTimecode('00:01:00:02',29.97,true));assert.throws(()=>formatTimecode(1,24,true),/requires/);
});
test('drop-frame settings persist through undo and reject incompatible rates atomically',()=>{
 const h=new SessionHistory();h.execute([{op:'session.set',values:{frameRate:29.97,dropFrame:true}}]);assert.equal(h.session.dropFrame,true);const before=JSON.stringify(h.session);assert.throws(()=>h.execute([{op:'session.set',values:{frameRate:24}}]),/Drop-frame/);assert.equal(JSON.stringify(h.session),before);h.undo();assert.equal(h.session.dropFrame??false,false);h.redo();assert.equal(h.session.dropFrame,true);
});
