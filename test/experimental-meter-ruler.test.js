import test from 'node:test';import assert from 'node:assert/strict';import {timelineTicks,parseMusicalPosition,formatMusicalPosition,rulerButtons} from '../src/experimental/timeline-ruler.js';
const s={tempo:120,meter:4,meterChanges:[{bar:3,numerator:6,denominator:8},{bar:5,numerator:7,denominator:4}],tempoChanges:[{beat:8,bpm:60}]};
test('ruler ticks follow notated beats and changing bar lengths through tempo changes',()=>{
 const ticks=timelineTicks(s,'musical',1000,14000),find=label=>ticks.find(t=>t.label===label)?.time;
 assert.equal(find('2|4'),3.5);assert.equal(find('3|1'),4);assert.equal(find('3|2'),4.5);assert.equal(find('3|6'),6.5);assert.equal(find('4|1'),7);assert.equal(find('5|1'),10);assert.equal(find('5|2'),11);
 assert.equal(find('3|7'),undefined);
 for(const t of ticks){assert.equal(parseMusicalPosition(t.label.replace('|',':'),s),t.time);assert.equal(formatMusicalPosition(t.time,s).split(':').slice(0,2).join('|'),t.label);}
});
test('low zoom retains bar-aligned labels with bounded count and spacing',()=>{
 for(const session of [s,{tempo:300,meter:1,meterDenominator:64},{tempo:20,meter:32,meterDenominator:1}, {...s,meterChanges:[{bar:3,numerator:1,denominator:64}]}]){
  const ticks=timelineTicks(session,'musical',1,86400);assert.ok(ticks.length<=1000);assert.ok(ticks.length>0);
  for(let i=0;i<ticks.length;i++){const t=ticks[i];assert.match(t.label,/\|1$/);assert.equal(parseMusicalPosition(t.label.replace('|',':'),session),t.time);if(i)assert.ok(t.time>ticks[i-1].time);}
 }
});
test('constant compound meters display denominator beats and ruler seek targets use their times',()=>{
 const session={tempo:120,meter:6,meterDenominator:8},ticks=timelineTicks(session,'musical',1000,2000);
 assert.deepEqual(ticks.slice(0,7),Array.from({length:7},(_,i)=>({time:i*.25,label:i<6?'1|'+(i+1):'2|1'})));
 assert.match(rulerButtons(session,'musical',1000,2000),/data-seek="1.5" style="left:1500px" aria-label="Go to 2\|1 bars\/beats"/);
});
