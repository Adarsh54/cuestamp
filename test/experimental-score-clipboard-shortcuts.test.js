import test from 'node:test';import assert from 'node:assert/strict';
import {scoreClipboardShortcut} from '../src/experimental/score-clipboard-shortcuts.js';
const event=(key,extra={})=>({key,ctrlKey:true,target:{ownerDocument:{getSelection:()=>({toString:()=>''})}},composedPath:()=>[],...extra});
test('score clipboard shortcuts recognize both platform modifiers and avoid composition or alternate commands',()=>{
 for(const [key,action] of [['c','copy'],['x','cut'],['v','paste']]){assert.equal(scoreClipboardShortcut(event(key)),action);assert.equal(scoreClipboardShortcut(event(key,{ctrlKey:false,metaKey:true})),action);}
 for(const extra of [{ctrlKey:false},{shiftKey:true},{altKey:true},{defaultPrevented:true},{isComposing:true},{keyCode:229}])assert.equal(scoreClipboardShortcut(event('c',extra)),null);
 assert.equal(scoreClipboardShortcut(event('z')),null);
});
test('score shortcuts leave text inputs, editable roles and selected prose to the browser',()=>{
 assert.equal(scoreClipboardShortcut(event('v',{composedPath:()=>[{matches:()=>true}]})),null);
 assert.equal(scoreClipboardShortcut(event('x',{composedPath:()=>[{isContentEditable:true}]})),null);
 assert.equal(scoreClipboardShortcut(event('c',{target:{ownerDocument:{getSelection:()=>({toString:()=> 'selected prose'})}}})),null);
});
