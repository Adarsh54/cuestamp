import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {copyRegionClipboard} from '../src/experimental/region-clipboard.js';
const source=()=>applyCommands(newSession(),['midi','audio'].flatMap((kind,i)=>[{op:'track.add',values:{id:'t'+i,kind}},...['a','b'].map(name=>({op:'region.add',target:'t'+i,values:{id:kind+name,start:1,duration:4}}))]));
test('selected timing edits only MIDI regions, preserve timing and undo as one action',()=>{
 const h=new SessionHistory(source()),before=structuredClone(h.session);h.execute([{op:'regions.tempoFollow',values:{regionIds:'midia,midib,audioa',tempoFollow:false}}]);assert.ok(h.session.tracks[0].regions.every(r=>r.tempoFollow===false));assert.deepEqual(h.session.tracks[1],before.tracks[1]);assert.equal(h.session.tracks[0].regions[0].start,1);h.undo();assert.deepEqual(h.session,{...before,revision:h.session.revision});
});
test('missing IDs, duplicates, empty/non-MIDI selections and protected changes reject atomically',()=>{
 const h=new SessionHistory(source()),before=structuredClone(h.session);for(const regionIds of ['midia,missing','midia,midia','','audioa']){assert.throws(()=>h.execute([{op:'regions.tempoFollow',values:{regionIds,tempoFollow:false}}]));assert.deepEqual(h.session,before);}
 h.execute([{op:'track.set',target:'t0',values:{protected:true}}]);const protectedSession=structuredClone(h.session);assert.throws(()=>h.execute([{op:'regions.tempoFollow',values:{regionIds:'midia,midib',tempoFollow:false}}]),/Unprotect/);assert.deepEqual(h.session,protectedSession);
 // Already-following protected regions are not mutated just to write an explicit default.
 h.execute([{op:'regions.tempoFollow',values:{regionIds:'midia,midib',tempoFollow:true}}]);assert.deepEqual(h.session.tracks,protectedSession.tracks);
});
test('fixed mode survives split, paste and repeat; selected mode can be restored afterward',()=>{
 let s=applyCommands(source(),[{op:'regions.tempoFollow',values:{regionIds:'midia',tempoFollow:false}}]);const clip=copyRegionClipboard(s,['midia']);
 s=applyCommands(s,[{op:'regions.paste',values:{data:clip.data,position:10}},{op:'region.split',target:'midia',values:{time:3}},{op:'region.repeat',target:'midia',values:{count:1,interval:20}}]);const fixed=s.tracks[0].regions.filter(r=>r.id!=='midib');assert.equal(fixed.length,4);assert.ok(fixed.every(r=>r.tempoFollow===false));
 const before=fixed.map(r=>[r.start,r.duration]);s=applyCommands(s,[{op:'session.set',values:{tempo:60}}]);assert.deepEqual(s.tracks[0].regions.filter(r=>r.id!=='midib').map(r=>[r.start,r.duration]),before);
 s=applyCommands(s,[{op:'regions.tempoFollow',values:{regionIds:fixed.map(r=>r.id).join(','),tempoFollow:true}}]);assert.ok(s.tracks[0].regions.every(r=>r.tempoFollow!==false));
});
