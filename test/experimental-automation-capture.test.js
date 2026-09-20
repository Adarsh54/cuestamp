import test from 'node:test';import assert from 'node:assert/strict';import {createAutomationCapture} from '../src/experimental/automation-capture.js';
test('automation capture keeps gesture timing, corners and extrema while compressing straight ramps',()=>{
 const capture=createAutomationCapture({start:0,value:-60,min:-96,max:12});for(let i=1;i<=1200;i++)capture.push(i/60,-60+i/20);assert.equal(capture.count,2);capture.push(21,-12);capture.push(22,0);capture.push(23,0);const points=capture.finish(24,-6);assert.deepEqual(points,[{time:0,value:-60},{time:20,value:0},{time:21,value:-12},{time:22,value:0},{time:23,value:0},{time:24,value:-6}]);assert.throws(()=>capture.push(25,0),/ended/);
});
test('same-time events replace the latest value without exposing mutable internal samples',()=>{
 const capture=createAutomationCapture({start:3,value:0,min:-1,max:1});capture.push(3,.2);capture.push(4,.5);capture.push(4,.7);const snapshot=capture.points;snapshot[0].value=999;assert.equal(capture.points[0].value,.2);assert.deepEqual(capture.finish(5),[{time:3,value:.2},{time:4,value:.7},{time:5,value:.7}]);
});
test('invalid values, backward seeks and full captures reject without corrupting the recoverable gesture',()=>{
 const capture=createAutomationCapture({start:1,value:0,min:-1,max:1,maxPoints:3});capture.push(2,1);capture.push(3,-1);const before=capture.points;for(const [time,value]of [[2,0],[4,NaN],[4,2],[4,0]])assert.throws(()=>capture.push(time,value));assert.deepEqual(capture.points,before);assert.deepEqual(capture.finish(3),before);
 const canceled=createAutomationCapture({start:0,value:0,min:-1,max:1});assert.throws(()=>canceled.finish(0));canceled.cancel();assert.deepEqual(canceled.points,[]);assert.throws(()=>canceled.push(1,0),/ended/);
});
