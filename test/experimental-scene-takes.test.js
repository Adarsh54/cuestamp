import test from 'node:test';import assert from 'node:assert/strict';
import {SceneTakes} from '../src/experimental/scene-takes.js';
const performance=(sessionId='s')=>({sessionId,revision:0,events:[{sceneId:'scene',start:0,duration:1}]});
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
test('takes are named, selected and persisted separately for each project',()=>{
 const store=storage(),library=new SceneTakes(store,'test'),first=library.add(performance()),second=library.add(performance());assert.equal(first.name,'Take 1');assert.equal(second.name,'Take 2');assert.equal(library.selected('s').id,second.id);
 library.rename(first.id,'First idea','s');library.select(first.id,'s');library.add(performance('other'));assert.equal(library.list('s').length,2);assert.equal(library.selected('s').id,first.id);assert.throws(()=>library.select(first.id,'other'),/this project/);
 library.select(first.id,'s');library.placed(first.performance);assert.equal(first.placements,1);assert.equal(second.placements,0);assert.equal(library.list('s').length,2);
 const restored=new SceneTakes(store,'test');assert.equal(restored.selected('s').name,'First idea');assert.equal(restored.selected('s').placements,1);restored.discard(first.id,'s');assert.equal(restored.selected('s').id,second.id);
});
test('legacy take migrates once and only removes the old key after successful storage',()=>{
 const store=storage();store.setItem('test:scene-performance',JSON.stringify(performance()));const library=new SceneTakes(store,'test');assert.equal(library.list('s').length,1);assert.equal(store.getItem('test:scene-performance'),null);assert.equal(new SceneTakes(store,'test').list('s').length,1);
 const broken=storage();broken.setItem('test:scene-performance',JSON.stringify(performance()));broken.setItem=()=>{throw Error('quota');};const memory=new SceneTakes(broken,'test');assert.equal(memory.saved,false);assert.equal(memory.list('s').length,1);assert.ok(broken.getItem('test:scene-performance'));
});
test('capacity and invalid names do not replace recordings; corrupt stored data is preserved',()=>{
 const store=storage(),library=new SceneTakes(store,'test');for(let i=0;i<32;i++)library.add(performance());const before=JSON.stringify(library.data);assert.throws(()=>library.add(performance()),/32/);assert.equal(JSON.stringify(library.data),before);assert.throws(()=>library.rename(library.selected('s').id,' ','s'));assert.equal(JSON.stringify(library.data),before);
 store.setItem('bad:scene-takes','broken');const bad=new SceneTakes(store,'bad');assert.ok(bad.loadError);assert.throws(()=>bad.add(performance()),/preserved/);assert.equal(store.getItem('bad:scene-takes'),'broken');
});
