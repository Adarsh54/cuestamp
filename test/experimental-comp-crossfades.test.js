import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory,sessionSchema} from '../src/experimental/session.js';import {audioCompPlan,compAuditionPlan} from '../src/experimental/audio-comp.js';
const setup=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'t'}},{op:'region.add',target:'t',values:{id:'a',assetId:'one',duration:4,offset:2}},{op:'region.add',target:'t',values:{id:'b',assetId:'two',duration:4,offset:2}},{op:'region.set',target:'b',values:{reverse:true}}]);
const values=(segments=[{regionId:'a',start:0,end:1},{regionId:'b',start:1,end:2}],extra={})=>({segments:JSON.stringify(segments),crossfade:.2,crossfadeShape:'equalPower',...extra});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('automatic comp crossfades expand around transitions, keep timing and reverse offsets, and share audition/undo paths',()=>{
 const s=setup(),before=structuredClone(s),v=values(),r=audioCompPlan(s,'t',v).regions;
 close(r[0].duration,1.1);close(r[1].start,.9);close(r[1].duration,1.1);close(r[1].offset,4);close(r[0].fadeOut,.2);close(r[1].fadeIn,.2);assert.equal(r[0].fadeOutShape,'equalPower');assert.equal(r[1].fadeInShape,'equalPower');assert.equal(r[0].fadeIn,.005);assert.deepEqual(s,before);
 const h=new SessionHistory(s);h.execute([{op:'track.comp',target:'t',values:v}]);const audition=compAuditionPlan(s,'t',v);assert.deepEqual(audition.document.tracks[1].regions.map(({id,...r})=>r),h.session.tracks[1].regions.map(({id,...r})=>r));h.undo();assert.deepEqual(h.session.tracks,s.tracks);
});
test('comp transitions respect gaps, short sections, limited source handles, zero setting and invalid parameters',()=>{
 const s=setup(),gap=audioCompPlan(s,'t',values([{regionId:'a',start:0,end:1},{regionId:'b',start:1.2,end:2}])).regions;assert.equal(gap[0].duration,1);assert.equal(gap[1].start,1.2);assert.equal(gap[0].fadeOut,.005);
 const noHandles=structuredClone(s);noHandles.tracks[0].regions[0].duration=1;assert.equal(audioCompPlan(noHandles,'t',values()).regions[0].fadeOut,.005);
 const limited=structuredClone(s);limited.tracks[0].regions[0].duration=1.025;const limitedPlan=audioCompPlan(limited,'t',values()).regions;close(limitedPlan[0].fadeOut,.05);close(limitedPlan[1].start,.975);
 const tiny=audioCompPlan(s,'t',values([{regionId:'a',start:0,end:1},{regionId:'b',start:1,end:1.02},{regionId:'a',start:1.02,end:2}],{crossfade:1,edgeFade:.1})).regions;for(const r of tiny){assert.ok(r.fadeIn+r.fadeOut<=r.duration);assert.ok(r.offset>=2);assert.ok(r.offset+r.duration<=6+1e-9);}close(tiny[1].fadeIn,.02);close(tiny[1].fadeOut,.02);
 const off=audioCompPlan(s,'t',values(undefined,{crossfade:0})).regions;assert.equal(off[0].duration,1);assert.equal(off[1].start,1);for(const extra of [{crossfade:-1},{crossfade:1.1},{crossfade:NaN},{crossfadeShape:'spline'}])assert.throws(()=>audioCompPlan(s,'t',values(undefined,extra)));
});
test('crossfade settings persist in alternatives and older alternatives default to no crossfade',()=>{
 const s=applyCommands(setup(),[{op:'comp.save',target:'t',values:{id:'choice',name:'Smooth',...values()}}]),saved=s.tracks[0].compAlternatives[0];assert.equal(saved.crossfade,.2);assert.equal(saved.crossfadeShape,'equalPower');const made=applyCommands(s,[{op:'comp.createTrack',target:'t',values:{compId:'choice'}}]);close(made.tracks[1].regions[0].fadeOut,.2);
 delete saved.crossfade;delete saved.crossfadeShape;const old=sessionSchema.parse(s);assert.equal(old.tracks[0].compAlternatives[0].crossfade,0);assert.equal(old.tracks[0].compAlternatives[0].crossfadeShape,'linear');
});
