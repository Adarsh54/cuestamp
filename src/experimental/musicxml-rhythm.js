// Supply written duration as well as sounding ticks; renderers otherwise guess triplets incorrectly.
export function musicxmlRhythm(ticks){
 const lengths=[['whole',3840],['half',1920],['quarter',960],['eighth',480],['16th',240],['32nd',120],['64th',60]];
 for(const [variant,factor] of [['straight',1],['dotted',1.5],['triplet',2/3]])for(const [type,duration] of lengths){
  if(Math.abs(ticks-duration*factor)>1e-7)continue;
  return {duration:`<type>${type}</type>${variant==='dotted'?'<dot/>':''}${variant==='triplet'?'<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>':''}`,notation:'',triplet:variant==='triplet'};
 }
 return {duration:'',notation:''};
}
// Group complete runs only. Gaps are explicit rest events; groups never cross a bar/key boundary.
export function musicxmlTripletGroups(events){
 const groups=new Map();
 for(let index=0;index+2<events.length;index++){
  const run=events.slice(index,index+3),duration=run[0].end-run[0].start;
  if(!musicxmlRhythm(duration).triplet||run.some(e=>e.end-e.start!==duration)||run[0].end!==run[1].start||run[1].end!==run[2].start)continue;
  groups.set(run[0],'start');groups.set(run[1],'member');groups.set(run[2],'stop');index+=2;
 }
 return groups;
}
