// Supply written duration as well as sounding ticks; renderers otherwise guess triplets incorrectly.
export function musicxmlRhythm(ticks){
 const lengths=[['whole',3840],['half',1920],['quarter',960],['eighth',480],['16th',240],['32nd',120],['64th',60]];
 for(const [variant,factor] of [['straight',1],['dotted',1.5],['triplet',2/3]])for(const [type,duration] of lengths){
  if(Math.abs(ticks-duration*factor)>1e-7)continue;
  return {duration:`<type>${type}</type>${variant==='dotted'?'<dot/>':''}${variant==='triplet'?'<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>':''}`,notation:'',triplet:variant==='triplet'};
 }
 return {duration:'',notation:''};
}
