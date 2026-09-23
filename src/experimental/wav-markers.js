// RIFF cue points address sample frames; LIST/adtl labels reference their numeric IDs.
export function wavMarkerChunks(markers,sampleRate,frames){
 if(!Array.isArray(markers)||markers.length>1000)throw Error('WAV supports up to 1,000 cue markers.');
 if(!markers.length)return new Uint8Array();
 const names=markers.map(m=>{if(!m||typeof m.name!=='string'||m.name.length>200||!Number.isFinite(m.time)||m.time<0||m.time>=frames/sampleRate)throw Error('Invalid WAV cue marker.');return new TextEncoder().encode(m.name.replaceAll('\0',''));});
 const cueSize=4+24*markers.length,listSize=4+names.reduce((n,name)=>n+8+4+name.length+1+(name.length+1)%2,0);
 const result=new Uint8Array(8+cueSize+8+listSize),v=new DataView(result.buffer);
 const text=(offset,s)=>{for(let i=0;i<s.length;i++)result[offset+i]=s.charCodeAt(i);};
 text(0,'cue ');v.setUint32(4,cueSize,true);v.setUint32(8,markers.length,true);
 markers.forEach((m,i)=>{const offset=12+24*i,frame=Math.min(frames-1,Math.round(m.time*sampleRate));v.setUint32(offset,i+1,true);v.setUint32(offset+4,frame,true);text(offset+8,'data');v.setUint32(offset+20,frame,true);});
 let offset=8+cueSize;text(offset,'LIST');v.setUint32(offset+4,listSize,true);text(offset+8,'adtl');offset+=12;
 names.forEach((name,i)=>{const size=4+name.length+1;text(offset,'labl');v.setUint32(offset+4,size,true);v.setUint32(offset+8,i+1,true);result.set(name,offset+12);offset+=8+size+size%2;});
 return result;
}
export function bounceMarkers(session,position,duration){
 return [...session.markers].filter(m=>m.time>=position&&m.time<position+duration).sort((a,b)=>a.time-b.time).map(m=>({name:m.name,time:m.time-position}));
}
