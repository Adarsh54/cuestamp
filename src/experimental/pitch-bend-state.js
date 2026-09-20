import {pitchBendRangeSchema,pitchBendCents} from './pitch-bend.js';
export const rpnControllers=new Set([6,38,96,97,98,99,100,101]);
// One state per MIDI channel. RPN 0: MSB is semitones, LSB is cents.
export function createPitchBendState(defaultRange=2){
 const initial=pitchBendRangeSchema.parse(defaultRange);let msb=127,lsb=127,registered=true,semitones=Math.floor(initial),cents=(initial%1)*100,bend=8192,fine=8192,coarse=64;
 return {get range(){return semitones+cents/100;},get tuningCents(){return (coarse-64)*100+(fine-8192)*100/8192;},get cents(){return pitchBendCents(bend,this.range)+this.tuningCents;},push(event){
  const previous=this.cents;
  if(event.type==='pitchBend')bend=event.value;
  if(event.type==='controlChange'){
   const p=event.parameter,v=event.value;
   if(p===101){msb=v;registered=true;}if(p===100){lsb=v;registered=true;}
   if(p===98||p===99)registered=false;
   if(registered&&msb===0&&lsb===0){if(p===6)semitones=v;if(p===38)cents=v;
    // MIDI RP-018: one cent per message; the value byte is ignored.
    // Carry/borrow at 100 cents, saturating at the representable data-entry limits.
    if(p===96||p===97){const total=Math.max(0,Math.min(12827,semitones*100+cents+(p===96?1:-1)));semitones=Math.min(127,Math.floor(total/100));cents=total-semitones*100;}}
   if(registered&&msb===0&&lsb===1){
    if(p===6)fine=v*128+(fine%128);if(p===38)fine=Math.floor(fine/128)*128+v;
    if(p===96||p===97)fine=Math.max(0,Math.min(16383,fine+(p===96?1:-1)));
   }
   if(registered&&msb===0&&lsb===2){
    if(p===6)coarse=v;
    if(p===96||p===97)coarse=Math.max(0,Math.min(127,coarse+(p===96?1:-1)));
   }
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
