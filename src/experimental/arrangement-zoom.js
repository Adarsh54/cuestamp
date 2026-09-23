export const arrangementZoomLimits={min:.001,max:100};
export function fitArrangementRange(start,end,viewportWidth){
 if(![start,end,viewportWidth].every(Number.isFinite)||start<0||end<start||viewportWidth<=0)throw Error('Choose a valid visible timeline range.');
 const padding=Math.min(32,viewportWidth/8),span=Math.max(.01,end-start);
 const zoom=Math.max(arrangementZoomLimits.min,Math.min(arrangementZoomLimits.max,(viewportWidth-2*padding)/span));
 return {zoom,left:Math.max(0,start*zoom-padding)};
}
export function selectedArrangementRange(session,ids){
 const selected=new Set(ids),regions=session.tracks.flatMap(t=>t.regions).filter(r=>selected.has(r.id));
 if(!regions.length)return null;
 return {start:Math.min(...regions.map(r=>r.start)),end:Math.max(...regions.map(r=>r.start+r.duration))};
}
