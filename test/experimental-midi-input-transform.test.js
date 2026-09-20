import test from 'node:test';import assert from 'node:assert/strict';import {createMidiInputTransform} from '../src/experimental/midi-input-transform.js';
test('input transposition keeps note-on/off and poly pressure paired without altering source bytes',()=>{
 for(const transpose of [-48,-12,0,12,48])for(let pitch=0;pitch<128;pitch++)for(const status of [0x90,0x80,0xa0]){
  const original=new Uint8Array([status,pitch,75]),result=createMidiInputTransform({transpose})(original),expected=pitch+transpose;
  assert.equal(original[1],pitch);if(expected<0||expected>127)assert.equal(result,null);else assert.deepEqual([...result],[status,expected,75]);
 }
 assert.deepEqual([...createMidiInputTransform({transpose:12})(new Uint8Array([0x92,60,0]))],[0x92,72,0]);
});
test('channel filter and transposition preserve controller values and reject malformed input',()=>{
 const transform=createMidiInputTransform({channel:2,transpose:12});for(const message of [[0xb2,64,127],[0xe2,0,96],[0xc2,20],[0xd2,40]])assert.deepEqual([...transform(message)],message);
 assert.equal(transform([0x90,60,100]),null);for(const message of [[0x92,60],[0x92,200,100],[0x92,60,128],[],[60,100]])assert.equal(transform(message),null);
 for(const config of [{transpose:49},{transpose:1.5},{channel:16}])assert.throws(()=>createMidiInputTransform(config));
});
