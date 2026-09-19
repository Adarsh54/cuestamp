import {trimmedRegion} from './region-edit.js';
// Expand both sections equally around their shared boundary. Each section
// reserves at most half its original length for either neighboring transition.
export function compCrossfades(source,segments,regions,{crossfade=0,crossfadeShape='linear'}={}){
 if(!crossfade)return regions;
 const before=segments.map(()=>0),after=segments.map(()=>0);
 for(let i=1;i<segments.length;i++){
  const left=segments[i-1],right=segments[i];if(left.end!==right.start)continue;
  const a=source.regions.find(r=>r.id===left.regionId),b=source.regions.find(r=>r.id===right.regionId);
  const half=Math.max(0,Math.min(crossfade/2,a.start+a.duration-left.end,right.start-b.start,(left.end-left.start)/2,(right.end-right.start)/2));
  after[i-1]=before[i]=half;
 }
 return regions.map((r,i)=>{
  const section=segments[i],original=source.regions.find(r=>r.id===section.regionId),trim=trimmedRegion(original,section.start-before[i],section.end+after[i]);
  const fadeIn=before[i]?before[i]*2:r.fadeIn,fadeOut=after[i]?after[i]*2:r.fadeOut;
  return {...r,...trim,fadeIn,fadeOut:Math.min(fadeOut,Math.max(0,trim.duration-fadeIn)),fadeInShape:before[i]?crossfadeShape:r.fadeInShape,fadeOutShape:after[i]?crossfadeShape:r.fadeOutShape};
 });
}
