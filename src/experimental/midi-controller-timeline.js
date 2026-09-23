import {compilePedalTimeline} from './pedal-timeline.js';
import {compilePitchTimeIntegral} from './pitch-time-integral.js';
import {pitchBendTimeline} from './pitch-bend-state.js';
export function upperMidiTime(points,time,key='time'){let lo=0,hi=points.length;while(lo<hi){const mid=(lo+hi)>>>1;if(points[mid][key]<=time)lo=mid+1;else hi=mid;}return lo;}
// Compile once per region/channel, then share the immutable event interpretation
// across its voices. Equal-time messages retain file order; the final value wins.
export function compileMidiControllers(events,range=2){
 const ordered=[...events].sort((a,b)=>a.start-b.start),levels=[{time:0,gain:1,pan:0}];let volume=127,expression=127,pan=64;
 for(const e of ordered){if(e.type!=='controlChange')continue;const p=e.parameter;
  if(![7,11,10,121].includes(p))continue;
  if(p===7)volume=e.value;if(p===11)expression=e.value;if(p===10)pan=e.value;if(p===121)expression=127;
  const point={time:e.start,gain:volume/127*expression/127,pan:(pan-64)/(pan<64?64:63)};
  if(levels.at(-1).time===point.time)levels[levels.length-1]=point;else levels.push(point);
 }
 const pitch=pitchBendTimeline(ordered,range);
 return {events:ordered,levels,pitch,pitchIntegral:compilePitchTimeIntegral(pitch),...compilePedalTimeline(ordered)};
}
