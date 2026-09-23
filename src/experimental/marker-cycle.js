export function markerCyclePlan(session,startId,{endMarkerId}={}){
 const start=session.markers.find(m=>m.id===startId);if(!start)throw Error('Choose an existing start marker.');
 const end=endMarkerId===undefined?[...session.markers].filter(m=>m.time>start.time).sort((a,b)=>a.time-b.time)[0]:session.markers.find(m=>m.id===endMarkerId);
 if(!end)throw Error('Choose a later marker to end the cycle.');if(end.time<=start.time)throw Error('The end marker must follow the start marker.');if(end.time-start.time>600)throw Error('Choose markers at most 10 minutes apart.');
 return {loopStart:start.time,loopEnd:end.time,loopEnabled:true};
}
