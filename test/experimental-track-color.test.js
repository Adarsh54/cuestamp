import test from 'node:test';import assert from 'node:assert/strict';import {SessionHistory,sessionSchema} from '../src/experimental/session.js';import {trackColorStyle,trackColorView} from '../src/experimental/track-color.js';
test('track colors validate on create/edit and preserve default compatibility',()=>{
 const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',color:'#AABBCC'}}]);assert.equal(h.session.tracks[0].color,'#AABBCC');
 for(const color of ['red','#abc','var(--x)','#ffffff;display:none',42])assert.throws(()=>h.execute([{op:'track.set',target:'t',values:{color}}]));
 h.execute([{op:'track.set',target:'t',values:{color:null}}]);assert.equal(trackColorStyle(h.session.tracks[0]),'');h.undo();assert.equal(h.session.tracks[0].color,'#AABBCC');h.redo();assert.equal(h.session.tracks[0].color,null);
});
test('colors survive duplication and JSON reload without changing audio controls',()=>{
 const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',color:'#6488ed'}},{op:'track.duplicate',target:'t',values:{id:'copy'}}]);assert.equal(h.session.tracks[1].color,'#6488ed');const before=structuredClone(h.session.tracks[0]);h.execute([{op:'track.set',target:'t',values:{color:'#e87676'}}]);assert.deepEqual({...h.session.tracks[0],color:before.color},before);assert.deepEqual(sessionSchema.parse(JSON.parse(JSON.stringify(h.session))),h.session);
});
test('color styles reject untrusted CSS and swatches expose accessible labels',()=>{
 assert.equal(trackColorStyle({color:'#abcdef'}),'--daw-track-color:#abcdef;');assert.equal(trackColorStyle({color:'red;display:none'}),'');assert.match(trackColorView({color:'#6488ed'}),/Blue track color/);assert.match(trackColorView({color:'#6488ed'}),/aria-pressed="true"/);
});
