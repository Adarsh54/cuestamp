import test from 'node:test';import assert from 'node:assert/strict';
import {SessionHistory} from '../src/experimental/session.js';
import {renderingSources,stemSession,stemGroups,validateRouting} from '../src/experimental/routing.js';
import {audibleAssets} from '../src/experimental/media-refs.js';
import {regionBouncePlan} from '../src/experimental/bounce-in-place.js';
import {planDawEdit} from '../server/daw-agent.js';
const setup=()=>{const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'pad',kind:'audio'}},{op:'region.add',target:'pad',values:{id:'pad-r',assetId:'pad-a',duration:2}},{op:'track.add',values:{id:'key',kind:'audio'}},{op:'track.set',target:'key',values:{mute:true}},{op:'region.add',target:'key',values:{id:'key-r',assetId:'key-a',duration:2}},{op:'effect.add',target:'pad',values:{id:'gate',kind:'gate',sidechainTrackId:'key'}}]);return h;};
test('muted detector sources are decoded but marked inaudible, and stems retain their source files',()=>{
 const h=setup(),sources=renderingSources(h.session);assert.equal(sources.find(t=>t.id==='key').sidechainOnly,true);assert.deepEqual(new Set(audibleAssets(h.session)),new Set(['pad-a','key-a']));
 for(const document of [stemSession(h.session,h.session.tracks[0]),stemGroups(h.session)[0].document,regionBouncePlan(h.session,'pad-r').entries[0].document]){validateRouting(document);const key=document.tracks.find(t=>t.id==='key');assert.ok(key.mute);assert.equal(key.regions[0].assetId,'key-a');assert.deepEqual(key.effects,[]);}
 h.execute([{op:'region.set',target:'key-r',values:{mute:true}}]);assert.equal(renderingSources(h.session).find(t=>t.id==='key').regions.length,0);
});
test('sidechain references validate atomically and deleting a source resets assignments with undo',()=>{
 const h=setup(),before=structuredClone(h.session);for(const sidechainTrackId of ['missing',h.session.id])assert.throws(()=>h.execute([{op:'effect.set',target:'gate',values:{sidechainTrackId}}]));assert.deepEqual(h.session,before);
 h.execute([{op:'track.delete',target:'key'}]);assert.equal(h.session.tracks[0].effects[0].sidechainTrackId,null);h.undo();assert.equal(h.session.tracks[0].effects[0].sidechainTrackId,'key');
 h.execute([{op:'effectPreset.save',target:'pad',values:{id:'p',name:'Gate'}}]);assert.equal(h.session.effectPresets[0].effects[0].sidechainTrackId,null);
});
test('agent sidechain assignments use the same validated command executor',async()=>{
 const h=setup(),commands=[{op:'effect.set',target:'gate',values:{sidechainTrackId:null}}];const result=await planDawEdit({session:h.session,instruction:'Return the pad gate to its own detector'},{key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Use local detector',commands})}]})})});h.execute(result.commands);assert.equal(h.session.tracks[0].effects[0].sidechainTrackId,null);
});

test('bypassed gate assignments survive isolated export without decoding their detector',()=>{
 const h=setup();h.execute([{op:'effect.set',target:'gate',values:{enabled:false}}]);const document=stemSession(h.session,h.session.tracks[0]);validateRouting(document);assert.deepEqual(audibleAssets(document),['pad-a']);
});
