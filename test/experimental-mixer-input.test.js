import test from 'node:test';
import assert from 'node:assert/strict';
import {bindMixer} from '../src/experimental/mixer.js';
import {newSession} from '../src/experimental/session.js';
function fixture(mode='static'){
 const edits=[],samples=[],releases=[];
 const input={value:'-6',min:'-96',max:'12',dataset:{},validity:{badInput:false},parentElement:{querySelector:()=>null}};
 const root={querySelector:s=>s==='[data-master-gain]'?input:null,querySelectorAll:()=>[]};
 bindMixer(root,{session:newSession(),execute:c=>edits.push(c),guard:f=>f,touchMode:mode,isPlaying:()=>true,touch:{input:(...args)=>samples.push(args),release:(...args)=>releases.push(args)},select:()=>{}});
 return {input,edits,samples,releases};
}
test('blank, incomplete and out-of-range master edits never become zero or automation samples',()=>{
 for(const mode of ['static','touch'])for(const value of ['', '-', '1e', 'Infinity','13','-97']){
  const f=fixture(mode);f.input.value=value;f.input.oninput();f.input.onchange();
  assert.deepEqual(f.edits,[]);assert.deepEqual(f.samples,[]);assert.equal(f.input.value,'-6');
 }
});
test('valid zero is accepted and a cleared live gesture ends at the last accepted value',()=>{
 const f=fixture('touch');f.input.value='0';f.input.oninput();assert.equal(f.samples[0][2],0);
 f.input.value='';f.input.oninput();f.input.onblur();assert.equal(f.samples.length,1);assert.equal(f.releases.length,1);assert.equal(f.input.value,'0');assert.deepEqual(f.edits,[]);
 const s=fixture();s.input.value='0';s.input.onchange();assert.equal(s.edits[0][0].values.masterDb,0);
});
