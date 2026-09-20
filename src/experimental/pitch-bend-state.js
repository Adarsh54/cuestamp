import {pitchBendRangeSchema,pitchBendCents} from './pitch-bend.js';
export const rpnControllers=new Set([6,38,98,99,100,101]);
// One state per MIDI channel. RPN 0: MSB is semitones, LSB is cents.
export function createPitchBendState(defaultRange=2){
 const initial=pitchBendRangeSchema.parse(defaultRange);let msb=127,lsb=127,registered=true,semitones=Math.floor(initial),cents=(initial%1)*100,bend=8192;
 return {get range(){return semitones+cents/100;},get cents(){return pitchBendCents(bend,this.range);},push(event){
  const previous=this.cents;
  if(event.type==='pitchBend')bend=event.value;
  if(event.type==='controlChange'){
   const p=event.parameter,v=event.value;
   if(p===101){msb=v;registered=true;}if(p===100){lsb=v;registered=true;}
   if(p===98||p===99)registered=false;
   if(registered&&msb===0&&lsb===0){if(p===6)semitones=v;if(p===38)cents=v;}
   if(p===121){bend=8192;msb=lsb=127;registered=true;}
  }
  return previous!==this.cents;
 }};
}
export function pitchBendTimeline(events,range=2){
 const state=createPitchBendState(range),points=[{time:0,cents:0}];
 for(const event of [...events].sort((a,b)=>a.start-b.start))if(state.push(event)){const point={time:event.start,cents:state.cents};if(points.at(-1).time===point.time)points[points.length-1]=point;else points.push(point);}
 return points;
}
