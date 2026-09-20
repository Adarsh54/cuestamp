import {compileTempoMap,regionBeatTiming,durationForBeats} from './tempo-map.js';
import {compileMeterMap} from './meter-map.js';
import {meterGrid} from './meter-grid.js';

export function durationForBars(session,start,bars){
 const grid=meterGrid(session,'bar');
 return grid?grid.timeAt(grid.atTime(start)+bars)-start:durationForBeats(session,start,bars*session.meter);
}

// Only materialize the selected bar. Mapped patterns follow project bar lines;
// a region beginning or ending within a bar shows its clipped portion.
export function patternBar(region,session,requested=0){
 const timing=regionBeatTiming(region,session);
 if(!session.meterChanges?.length){
  const unit=4/(session.meterDenominator??4),length=session.meter*unit,step=Math.min(.25,unit),bars=Math.max(1,Math.ceil(timing.beatAtTime(region.duration)/length)),index=Math.max(0,Math.min(Math.floor(requested)||0,bars-1));
  return {unit,step,bars,index,label:'',cells:Array.from({length:length/step},(_,i)=>({time:timing.timeAtBeat(index*length+i*step),beats:step,accent:i%(unit/step)===0}))};
 }
 const tempo=compileTempoMap(session),meter=compileMeterMap(session),start=tempo.beatAtTime(region.start),end=tempo.beatAtTime(region.start+region.duration);
 const first=meter.positionAtBeat(start).bar,lastPosition=meter.positionAtBeat(end),last=lastPosition.bar-(lastPosition.beat===1&&lastPosition.fraction<1e-9?1:0),bars=Math.max(1,last-first+1),index=Math.max(0,Math.min(Math.floor(requested)||0,bars-1)),bar=first+index;
 const signature=meter.signatureAtBar(bar),unit=4/signature.denominator,step=Math.min(.25,unit),origin=meter.barStart(bar),stop=Math.min(end,meter.barStart(bar+1)),cells=[];
 for(let i=0;i<signature.numerator*unit/step;i++){
  const a=Math.max(start,origin+i*step),b=Math.min(stop,origin+(i+1)*step);
  if(b-a>1e-9)cells.push({time:tempo.timeAtBeat(a)-region.start,beats:b-a,accent:i%(unit/step)===0});
 }
 return {unit,step,bars,index,cells,label:`Project bar ${bar} · ${signature.numerator}/${signature.denominator}. `};
}
