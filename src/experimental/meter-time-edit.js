import {compileMeterMap} from './meter-map.js';
import {compileTempoMap} from './tempo-map.js';

// Rebuild bar anchors after second-based edits using the resulting tempo map.
// Never round a signature into a different bar: the current document format
// cannot express partial bars at signature seams.
export function meterFromSeconds(points,timing){
 const tempo=compileTempoMap(timing),ordered=[...new Map(points.map(p=>[p.time,p])).values()].sort((a,b)=>a.time-b.time);
 if(!ordered.length||ordered[0].time!==0)throw Error('A signature timeline must start at zero.');
 const first=ordered[0],result={meter:first.numerator,meterDenominator:first.denominator,meterChanges:[]};
 let previous=first,previousBeat=0,bar=1;
 for(const p of ordered){
  if(!Number.isFinite(p.time)||p.time<0||p.time>86400)throw Error('Signature change exceeds the timeline.');
  compileMeterMap({meter:p.numerator,meterDenominator:p.denominator});
  if(p.numerator===previous.numerator&&p.denominator===previous.denominator)continue;
  const beat=tempo.beatAtTime(p.time),bars=(beat-previousBeat)/(previous.numerator*4/previous.denominator),whole=Math.round(bars);
  if(whole<1||Math.abs(bars-whole)>1e-8)throw Error('This edit would place a time-signature change inside a bar. Use whole-bar boundaries and durations.');
  bar+=whole;result.meterChanges.push({id:p.id??crypto.randomUUID(),bar,numerator:p.numerator,denominator:p.denominator});previous=p;previousBeat=beat;
 }
 compileMeterMap(result);return result;
}
function points(session){const tempo=compileTempoMap(session);return compileMeterMap(session).points.map(p=>({...p,time:tempo.timeAtBeat(p.beat)}));}
export function insertMeterTime(session,position,duration,resultingTempo=session){
 if(!Number.isFinite(position)||position<0||!Number.isFinite(duration)||duration<=0||position+duration>86400)throw Error('Choose a valid signature insertion range.');
 if(!session.meterChanges?.length)return null;
 return meterFromSeconds(points(session).map((p,i)=>({...p,time:i&&p.time>=position?p.time+duration:p.time})),resultingTempo);
}
export function deleteMeterTime(session,start,end,resultingTempo=session){
 if(!Number.isFinite(start)||start<0||!Number.isFinite(end)||end<=start||end>86400)throw Error('Choose a valid signature deletion range.');
 if(!session.meterChanges?.length)return null;
 const original=points(session),before=original.filter(p=>p.time<start),after=original.filter(p=>p.time>=end).map(p=>({...p,time:p.time-(end-start)}));
 if(!after.some(p=>p.time===start)){const active=original.findLast(p=>p.time<=end);after.unshift({...active,time:start,id:crypto.randomUUID()});}
 return meterFromSeconds([...before,...after],resultingTempo);
}
export function insertMeterSection(destination,source,start,end,position,resultingTempo=destination,{move=false}={}){
 if(![start,end,position].every(Number.isFinite)||start<0||end<=start||end>86400||position<0||position+end-start>86400)throw Error('Choose a valid signature section and destination.');
 if(!destination.meterChanges?.length&&!source.meterChanges?.length&&destination.meter===source.meter&&(destination.meterDenominator??4)===(source.meterDenominator??4))return null;
 const from=points(source),to=points(destination),duration=end-start,active=(list,time)=>list.findLast(p=>p.time<=time);
 const before=to.filter(p=>p.time<position),after=to.filter(p=>p.time>=position).map(p=>({...p,time:p.time+duration}));
 if(!after.some(p=>p.time===position+duration))after.unshift({...active(to,position),time:position+duration,id:crypto.randomUUID()});
 const first=active(from,start),copied=[{...first,time:position,id:move&&first.time===start&&first.id?first.id:crypto.randomUUID()},...from.filter(p=>p.time>start&&p.time<end).map(p=>({...p,time:position+p.time-start,id:move&&p.id?p.id:crypto.randomUUID()}))];
 return meterFromSeconds([...before,...copied,...after],resultingTempo);
}
