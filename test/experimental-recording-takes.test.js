import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {recordedMediaPlan} from '../src/experimental/media-import-plan.js';
const fixture=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'t',name:'Voice'}},{op:'session.set',values:{audioRecordMode:'takes'}},{op:'region.add',target:'t',values:{id:'a',assetId:'one',start:0,duration:4}}]);
const settings={trackId:'t',name:'Recording.wav',assetId:'new',start:0,duration:3};
test('recording creates and extends take groups atomically with source preservation and undo',()=>{
 const s=fixture(),h=new SessionHistory(s),plan=recordedMediaPlan(s,settings);assert.equal(plan.commands.length,2);h.execute(plan.commands);let regions=h.session.tracks[0].regions;assert.deepEqual(regions.map(r=>r.mute),[true,false]);const group=regions[0].takeGroup.id;
 const second=recordedMediaPlan(h.session,{...settings,assetId:'next'});h.execute(second.commands);regions=h.session.tracks[0].regions;assert.equal(regions.length,3);assert.ok(regions.every(r=>r.takeGroup.id===group));assert.deepEqual(regions.map(r=>r.mute),[true,true,false]);h.undo();assert.equal(h.session.tracks[0].regions.length,2);h.undo();assert.deepEqual(h.session.tracks,s.tracks);
});
test('layer mode and disjoint recordings leave existing regions untouched',()=>{
 const s=fixture();for(const input of [{session:{...s,audioRecordMode:'layer'},settings},{session:s,settings:{...settings,start:10}}]){const plan=recordedMediaPlan(input.session,input.settings);assert.equal(plan.commands.length,1);assert.deepEqual(applyCommands(input.session,plan.commands).tracks[0].regions[0],s.tracks[0].regions[0]);}
 assert.equal(recordedMediaPlan(s,{...settings,trackId:undefined}).commands.length,2);
});
test('ambiguous overlapping groups preserve the recording as an explicit separate layer',()=>{
 let s=fixture();s=applyCommands(s,[{op:'region.add',target:'t',values:{id:'b',assetId:'two',start:0,duration:4}},{op:'takes.create',target:'t',values:{regionIds:'a,b',name:'First'}},{op:'region.add',target:'t',values:{id:'c',assetId:'three',start:0,duration:4}}]);
 const plan=recordedMediaPlan(s,settings);assert.equal(plan.commands.length,1);assert.match(plan.message,/separate layer/);assert.deepEqual(applyCommands(s,plan.commands).tracks[0].regions.slice(0,3),s.tracks[0].regions);
 assert.throws(()=>recordedMediaPlan({...s,tracks:s.tracks.map(t=>({...t,protected:true}))},settings),/Unprotect/);
});
