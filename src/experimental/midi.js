import {compileMeterMap} from './meter-map.js';
import {compileTempoMap} from './tempo-map.js';
import {eventBytes,eventFromBytes} from './midi-events.js';
// Standard MIDI File types 0/1, PPQ timing, tempo maps and note-on/off pairs.
export function readMidi(buffer){
 const view=new DataView(buffer),bytes=new Uint8Array(buffer);let p=0;
 const check=n=>{if(p+n>bytes.length)throw Error('Truncated MIDI file.');};
 const u8=()=>{check(1);return view.getUint8(p++);},u16=()=>{check(2);const n=view.getUint16(p);p+=2;return n;},u32=()=>{check(4);const n=view.getUint32(p);p+=4;return n;},text=n=>{check(n);const s=new TextDecoder().decode(bytes.slice(p,p+n));p+=n;return s;};
 const vlq=()=>{let n=0;for(let i=0;i<4;i++){const b=u8();n=(n<<7)|(b&127);if(!(b&128))return n;}throw Error('Invalid MIDI variable length value.');};
 if(text(4)!=='MThd')throw Error('Not a standard MIDI file.');const header=u32(),format=u16(),count=u16(),ppq=u16();if(header<6||format>1||ppq&0x8000||!ppq)throw Error('Use type 0/1 MIDI with PPQ timing.');p+=header-6;
 const tempos=[{tick:0,microseconds:500000}],tracks=[],markers=[],signatures=[];
 for(let ti=0;ti<count;ti++){
  if(text(4)!=='MTrk')throw Error('Invalid MIDI track.');const length=u32(),end=p+length;if(end>bytes.length)throw Error('Truncated MIDI track.');let tick=0,running=0,name=`MIDI ${ti+1}`;const open=new Map(),notes=[],events=[];
  while(p<end){tick+=vlq();let status=u8();if(status<128){if(!running)throw Error('Invalid running status.');p--;status=running;}
   if(status===255){running=0;const type=u8(),n=vlq();check(n);if(type===0x51&&n===3){const microseconds=(bytes[p]<<16)|(bytes[p+1]<<8)|bytes[p+2];if(!microseconds)throw Error('MIDI tempo must be positive.');tempos.push({tick,microseconds});}if(type===0x58){if(n!==4||!bytes[p]||bytes[p+1]>30||!bytes[p+3])throw Error('Invalid or unsupported MIDI time signature.');signatures.push({tick,numerator:bytes[p],denominator:2**bytes[p+1],clocksPerClick:bytes[p+2],notated32ndsPerQuarter:bytes[p+3]});}if(type===6){if(markers.length>=1000)throw Error('MIDI imports support up to 1,000 markers.');markers.push({tick,name:new TextDecoder().decode(bytes.slice(p,p+n)).slice(0,200)});}if(type===3)name=new TextDecoder().decode(bytes.slice(p,p+n));p+=n;continue;}
   if(status===240||status===247){running=0;const n=vlq();check(n);p+=n;continue;}
   if(status>=240)throw Error('Unsupported MIDI system event.');running=status;const type=status>>4,channel=status&15,a=u8(),b=type===12||type===13?0:u8();if(a>127||b>127)throw Error('Invalid MIDI event data.');const key=channel+':'+a;
   if(type===9&&b){const list=open.get(key)||[];list.push({pitch:a,channel,tick,velocity:b/127});open.set(key,list);}
   else if(type===8||(type===9&&!b)){const n=open.get(key)?.shift();if(n&&tick>n.tick)notes.push({...n,end:tick});}else{const event=eventFromBytes(type,channel,a,b,tick);if(event)events.push(event);}
  }
  if(p!==end)throw Error('MIDI event exceeds its track.');tracks.push({name,notes,events});
 }
 // Compile tempo segments once; imported performances can contain thousands of
 // tempo events. Binary lookup avoids rescanning all earlier points per note.
 const ordered=[...new Map(tempos.map(point=>[point.tick,point])).values()].sort((a,b)=>a.tick-b.tick),segments=[];
 for(const point of ordered){const previous=segments.at(-1);segments.push({...point,time:previous?previous.time+(point.tick-previous.tick)*previous.microseconds/ppq/1e6:0});}
 const seconds=tick=>{let lo=0,hi=segments.length;while(lo<hi){const mid=(lo+hi)>>1;if(segments[mid].tick<=tick)lo=mid+1;else hi=mid;}const point=segments[Math.max(0,lo-1)];return point.time+(tick-point.tick)*point.microseconds/ppq/1e6;};
 const tempoChanges=ordered.filter(point=>point.tick>0).map(point=>({beat:point.tick/ppq,bpm:60000000/point.microseconds}));
 const timeSignatures=[...new Map(signatures.map(point=>[point.tick,point])).values()].sort((a,b)=>a.tick-b.tick).map(({tick,...point})=>({...point,beat:tick/ppq,time:seconds(tick)}));
 return {timeSignatures,hasTempoEvents:tempos.length>1,tempoChanges,markers:markers.map(m=>({name:m.name,time:seconds(m.tick)})),tempo:60000000/(tempos.filter(t=>t.tick===0).at(-1)?.microseconds||500000),tracks:tracks.filter(t=>t.notes.length||t.events.length).map(t=>({name:t.name,events:t.events.map(e=>({...e,start:seconds(e.start)})),notes:t.notes.map(n=>({id:crypto.randomUUID(),pitch:n.pitch,channel:n.channel,start:seconds(n.tick),duration:seconds(n.end)-seconds(n.tick),velocity:n.velocity}))}))};
}
export function writeMidi(session,{includeMuted=false}={}){
 const ppq=480,map=compileTempoMap(session),signatures=compileMeterMap(session),chunks=[];
 const tickAt=time=>Math.round(map.beatAtTime(time)*ppq);
 const int=(n,bytes)=>Array.from({length:bytes},(_,i)=>(n>>>((bytes-1-i)*8))&255),str=s=>[...new TextEncoder().encode(s)];
 const vlq=n=>{if(!Number.isInteger(n)||n<0||n>0x0fffffff)throw Error('MIDI event spacing exceeds the file format limit.');let out=[n&127];while((n>>>=7)>0)out.unshift((n&127)|128);return out;};
 const chunk=data=>[...str('MTrk'),...int(data.length,4),...data];
 const conductorEvents=map.points.map(point=>({tick:Math.round(point.beat*ppq),priority:0,data:[255,81,3,...int(Math.round(60000000/point.bpm),3)]}));
 for(const point of signatures.points){if(map.timeAtBeat(point.beat)>86400)throw Error('Time signatures must fit within the 24-hour timeline.');conductorEvents.push({tick:Math.round(point.beat*ppq),priority:-1,data:[255,88,4,point.numerator,Math.log2(point.denominator),24,8]});}
 for(const marker of session.markers||[]){const name=str(marker.name);conductorEvents.push({tick:tickAt(marker.time),priority:1,data:[255,6,...vlq(name.length),...name]});}
 conductorEvents.sort((a,b)=>a.tick-b.tick||a.priority-b.priority);const conductor=[];let previousTick=0;
 for(const event of conductorEvents){conductor.push(...vlq(event.tick-previousTick),...event.data);previousTick=event.tick;}
 conductor.push(0,255,47,0);chunks.push(chunk(conductor));
 for(const track of session.tracks.filter(t=>t.kind==='midi'&&(includeMuted||!t.mute))){const events=[];for(const r of track.regions.filter(r=>includeMuted||!r.mute))for(const e of r.events||[])events.push({tick:tickAt(r.start+e.start),priority:0,data:eventBytes(e)});for(const r of track.regions.filter(r=>includeMuted||!r.mute))for(const n of r.notes){if(n.velocity===0||(!includeMuted&&n.mute))continue;const start=tickAt(r.start+n.start),end=Math.max(start+1,tickAt(r.start+n.start+n.duration));events.push({tick:start,priority:2,data:[144|(n.channel||0),n.pitch,Math.max(1,Math.round(n.velocity*127))]},{tick:end,priority:1,data:[128|(n.channel||0),n.pitch,0]});}events.sort((a,b)=>a.tick-b.tick||a.priority-b.priority);let previous=0;const name=str(track.name),data=[0,255,3,...vlq(name.length),...name];for(const e of events){data.push(...vlq(e.tick-previous),...e.data);previous=e.tick;}data.push(0,255,47,0);chunks.push(chunk(data));}
 return new Uint8Array([...str('MThd'),0,0,0,6,0,1,...int(chunks.length,2),...int(ppq,2),...chunks.flat()]);
}

export const MAX_MIDI_IMPORT_BYTES=8*1024*1024;
export function encodeMidiImport(buffer){
 const bytes=new Uint8Array(buffer);if(bytes.byteLength>MAX_MIDI_IMPORT_BYTES)throw Error('MIDI imports support files up to 8 MB.');
 let text='';for(let offset=0;offset<bytes.length;offset+=32768)text+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
 return btoa(text);
}
export function decodeMidiImport(data){
 if(typeof data!=='string'||data.length>Math.ceil(MAX_MIDI_IMPORT_BYTES/3)*4||data.length%4||!data.length||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))throw Error('Invalid MIDI import data or file exceeds 8 MB.');
 let binary;try{binary=atob(data);}catch{throw Error('Invalid MIDI import encoding.');}if(binary.length>MAX_MIDI_IMPORT_BYTES)throw Error('MIDI imports support files up to 8 MB.');
 return Uint8Array.from(binary,c=>c.charCodeAt(0)).buffer;
}
