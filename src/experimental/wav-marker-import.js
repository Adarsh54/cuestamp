// Read metadata by slicing the file: never copy the PCM data just to find cues.
export async function readWavMarkers(file){
 const read=async(start,length)=>new Uint8Array(await file.slice(start,start+length).arrayBuffer());
 const text=(b,start=0,length=4)=>String.fromCharCode(...b.subarray(start,start+length));
 const header=await read(0,12);if(header.length<12||text(header)!=='RIFF'||text(header,8)!=='WAVE')return [];
 const end=new DataView(header.buffer).getUint32(4,true)+8;if(end>file.size||end<12)throw Error('WAV marker metadata is truncated.');
 const cues=new Map(),labels=new Map();let rate=0,align=0,format=0,dataSize=0,chunks=0,metadataBytes=0;
 for(let p=12;p<end;){
  if(++chunks>10000||p+8>end)throw Error('Invalid WAV marker chunks.');
  const h=await read(p,8),size=new DataView(h.buffer).getUint32(4,true),type=text(h),next=p+8+size+size%2;
  if(next>end)throw Error('WAV marker metadata is truncated.');
  if(type==='fmt '){if(size<16)throw Error('Invalid WAV format.');const b=await read(p+8,16),v=new DataView(b.buffer);format=v.getUint16(0,true);rate=v.getUint32(4,true);align=v.getUint16(12,true);}
  else if(type==='data')dataSize+=size;
  else if(type==='cue '||type==='LIST'){
   if(type==='LIST'&&(size<4||text(await read(p+8,4))!=='adtl')){p=next;continue;}
   metadataBytes+=size;if(metadataBytes>1024*1024)throw Error('WAV marker metadata exceeds 1 MB.');
   const b=await read(p+8,size),v=new DataView(b.buffer);
   if(type==='cue '){if(size<4)throw Error('Invalid WAV cue chunk.');const count=v.getUint32(0,true);if(count>1000||4+count*24>size)throw Error('Invalid WAV cue count.');
    for(let i=0;i<count;i++){const o=4+i*24,id=v.getUint32(o,true);if(cues.has(id)||cues.size>=1000)throw Error('Invalid or duplicate WAV cue ID.');if(text(b,o+8)!=='data'||v.getUint32(o+12,true)||v.getUint32(o+16,true))throw Error('Unsupported WAV cue addressing.');cues.set(id,v.getUint32(o+20,true));}
   }else for(let o=4;o<size;){if(o+8>size)throw Error('Invalid WAV cue label.');const n=v.getUint32(o+4,true),stop=o+8+n;if(stop+n%2>size)throw Error('Invalid WAV cue label.');if(text(b,o)==='labl'){if(n<5)throw Error('Invalid WAV cue label.');const name=b.subarray(o+12,stop),zero=name.indexOf(0);labels.set(v.getUint32(o+8,true),new TextDecoder().decode(zero<0?name:name.subarray(0,zero)).slice(0,200));}o=stop+n%2;}
  }
  p=next;
 }
 if(!cues.size)return [];if(![1,3].includes(format)||!rate||!align)throw Error('WAV cue import requires PCM or float audio.');
 return [...cues].map(([id,frame])=>{if(frame>=dataSize/align)throw Error('WAV cue lies outside the audio.');return {name:labels.get(id)||'Cue '+id,time:frame/rate};}).sort((a,b)=>a.time-b.time);
}
