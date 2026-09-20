import test from 'node:test';import assert from 'node:assert/strict';
import {formatMusicalPosition,parseMusicalPosition,timelineTicks,parseTimelinePosition,timelinePosition} from '../src/experimental/timeline-ruler.js';
const s={tempo:120,meter:3,frameRate:29.97};
test('musical positions use one-based bars/beats and 960 ticks including bar boundaries',()=>{
 assert.equal(formatMusicalPosition(0,s),'1:1:000');assert.equal(formatMusicalPosition(1.5,s),'2:1:000');assert.equal(formatMusicalPosition(3.75,s),'3:2:480');assert.equal(parseMusicalPosition('3:2:480',s),3.75);assert.equal(parseMusicalPosition('2:1',s),1.5);assert.equal(parseMusicalPosition(' 2:1:000 ',s),1.5);
 for(const tempo of [20,97,120,300])for(const meter of [1,3,4,7,16])for(const value of ['1:1:000','2:1:001','50:1:959']){const session={...s,tempo,meter};assert.equal(formatMusicalPosition(parseMusicalPosition(value,session),session),value);}
});
test('malformed and out-of-range jumps reject',()=>{
 for(const value of ['','0:1','1:0','1:4','1:1:960','1:1:-1','1:1:0012','one','9999999:1'])assert.throws(()=>parseMusicalPosition(value,s));
 for(const value of ['','NaN','Infinity','-1','86401'])assert.throws(()=>parseTimelinePosition(value,s,'seconds'));assert.equal(parseTimelinePosition('1.25',s,'seconds'),1.25);assert.ok(Math.abs(parseTimelinePosition('00:00:01:00',s,'timecode')-1.001)<1e-12);
});
test('ruler ticks stay bounded and musical ticks align to current tempo and meter',()=>{
 const ticks=timelineTicks(s,'musical',32,720);assert.equal(ticks[0].label,'1|1');assert.equal(ticks[1].label,'2|1');assert.equal(ticks[1].time,1.5);
 const zoomed=timelineTicks(s,'musical',100,720);assert.equal(zoomed[1].label,'1|2');assert.equal(zoomed[1].time,.5);
 for(const mode of ['seconds','musical','timecode']){const long=timelineTicks(s,mode,100,86400*100);assert.ok(long.length<=1000);assert.ok(long.every((p,i)=>Number.isFinite(p.time)&&p.time>=0&&(!i||p.time>long[i-1].time)));}
});
test('timecode ruler uses exact fractional-frame positions while seconds mode preserves existing seeks',()=>{
 const ticks=timelineTicks(s,'timecode',100,720);for(const tick of ticks)assert.ok(Math.abs(parseTimelinePosition(tick.label,s,'timecode')-tick.time)<1e-9);
 assert.ok(timelineTicks(s,'seconds',32,720).some(t=>t.time===2));assert.equal(timelinePosition(3.75,s,'musical'),'3:2:480');assert.equal(timelinePosition(3.75,s,'seconds'),'3.75 s');
});
