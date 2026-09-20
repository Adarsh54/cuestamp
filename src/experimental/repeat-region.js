import {compileTempoMap} from './tempo-map.js';
export function repeatRegion(region,{count,interval,beats},existingCount,{session,kind}={}){
 if(!Number.isInteger(count)||count<1||count>100)throw Error('Choose between 1 and 100 additional copies.');
 if(beats!==undefined&&interval!==undefined)throw Error('Choose repeat spacing in beats or seconds, not both.');
 const musical=beats!==undefined;
 if(musical&&(!session||!Number.isFinite(beats)||beats<=0||beats>432000))throw Error('Choose positive beat spacing with session timing.');
 interval??=region.duration;
 if(!Number.isFinite(interval)||interval<=0||interval>86400)throw Error('Repeat spacing must be positive and no more than 86,400 seconds.');
 if(existingCount+count>1000)throw Error('Repeating would exceed the 1,000-region track limit.');
 const map=musical?compileTempoMap(session):null,origin=map?.beatAtTime(region.start);
 const starts=Array.from({length:count},(_,i)=>musical?map.timeAtBeat(origin+(i+1)*beats):region.start+(i+1)*interval);
 if(starts.some(start=>!Number.isFinite(start)||start>86400))throw Error('Repeated region starts must stay within 86,400 seconds.');
 return starts.map((start,i)=>{
  const copy={...structuredClone(region),id:crypto.randomUUID(),start,notes:region.notes.map(n=>({...n,id:crypto.randomUUID()})),events:region.events.map(e=>({...e,id:crypto.randomUUID()}))};
  if(musical&&kind==='midi'&&map.hasChanges){
   const shift=(i+1)*beats,remap=local=>map.timeAtBeat(map.beatAtTime(region.start+local)+shift)-start;
   copy.duration=remap(region.duration);copy.fadeIn=remap(region.fadeIn);copy.fadeOut=copy.duration-remap(region.duration-region.fadeOut);
   for(let j=0;j<copy.notes.length;j++){const n=region.notes[j],a=remap(n.start),b=remap(n.start+n.duration);if(b<=a)throw Error('Repeat note length is below timeline precision.');copy.notes[j].start=a;copy.notes[j].duration=b-a;}
   for(let j=0;j<copy.events.length;j++)copy.events[j].start=remap(region.events[j].start);
  }
  if(musical&&(!(copy.duration>0)||start+copy.duration>86400))throw Error('Repeated region exceeds the timeline.');
  return copy;
 });
}
