import {partwiseMusicxmlRoot,validateTimewiseBoundaries} from './musicxml-timewise.js';
import {encodeMidiImport} from './midi.js';
const children=(node,name)=>[...node.children].filter(n=>n.localName===name),child=(node,name)=>children(node,name)[0],text=(node,name)=>child(node,name)?.textContent.trim();
const number=(value,label)=>{const n=Number(value);if(value===undefined||value===''||!Number.isFinite(n))throw Error(`MusicXML requires a valid ${label}.`);return n;};
const natural={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
export function parseMusicxml(source){
 if(typeof source!=='string'||new TextEncoder().encode(source).length>8*1024*1024)throw Error('MusicXML imports support files up to 8 MB.');
 if(/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(source))throw Error('MusicXML entity declarations are not supported.');
 const document=new DOMParser().parseFromString(source,'application/xml'),sourceRoot=document.documentElement;
 if(document.querySelector('parsererror')||!['score-partwise','score-timewise'].includes(sourceRoot.localName))throw Error('Import a valid partwise or timewise MusicXML score.');
 const timewise=sourceRoot.localName==='score-timewise',root=partwiseMusicxmlRoot(sourceRoot);
 const unsupported=root.querySelector('repeat,ending,grace,unpitched,tremolo,ornaments,octave-shift,scordatura,accordion-registration');
 if(unsupported)throw Error(`MusicXML ${unsupported.localName} playback is not supported yet. Export a performed MIDI file instead.`);
 const definitions=new Map(children(child(root,'part-list')??root,'score-part').map(p=>[p.id,text(p,'part-name')||'Score part']));
 const parts=children(root,'part');if(!parts.length||parts.length>128)throw Error('Import between 1 and 128 score parts.');
 if(new Set(parts.map(p=>p.id)).size!==parts.length)throw Error('MusicXML part IDs must be distinct.');
 const tempos=new Map(),meters=new Map(),keys=new Map(),put=(map,beat,value,label)=>{const tick=Math.round(beat*960),previous=map.get(tick);if(previous!==undefined&&JSON.stringify(previous)!==JSON.stringify(value))throw Error(`Conflicting ${label} in MusicXML parts.`);map.set(tick,value);};
 let count=0;
 const tracks=parts.map(part=>{
  if(!definitions.has(part.id))throw Error('MusicXML part is missing from its part list.');
  let divisions=0,transpose=0,keyTranspose=0,at=0,meter=4;const notes=[],ties=new Map(),measureEnds=[];
  const measures=children(part,'measure');if(measures.length>2048)throw Error('Import up to 2,048 measures per part.');
  for(const measure of measures){
   let cursor=0,extent=0,previous=null;
   for(const item of measure.children){
    if(item.localName==='attributes'){
     if(child(item,'divisions')){divisions=number(text(item,'divisions'),'divisions');if(divisions<=0)throw Error('MusicXML divisions must be positive.');}
     const time=child(item,'time');if(time){if(cursor!==0||children(time,'beats').length!==1||children(time,'beat-type').length!==1)throw Error('Compound or mid-measure MusicXML time changes are not supported.');const beats=number(text(time,'beats'),'meter numerator'),denominator=number(text(time,'beat-type'),'meter denominator');if(!Number.isInteger(beats)||beats<1||beats>32||![1,2,4,8,16,32].includes(denominator))throw Error('Unsupported MusicXML time signature.');meter=beats*4/denominator;put(meters,at,{beats,denominator},'time signatures');}
     const trans=children(item,'transpose');if(trans.length){if(trans.length>1||trans[0].hasAttribute('number')||child(trans[0],'double'))throw Error('Per-staff and doubled transposition are not supported.');transpose=number(text(trans[0],'chromatic'),'transposition')+12*number(text(trans[0],'octave-change')??'0','octave transposition');keyTranspose=text(trans[0],'diatonic')!==undefined?7*number(text(trans[0],'chromatic'),'transposition')-12*number(text(trans[0],'diatonic'),'diatonic transposition'):[0,7,2,-3,4,-1,6,1,-4,3,-2,5][((transpose%12)+12)%12];if(!Number.isInteger(transpose)||!Number.isInteger(keyTranspose)||!Number.isInteger(number(text(trans[0],'chromatic'),'transposition'))||!Number.isInteger(number(text(trans[0],'octave-change')??'0','octave transposition')))throw Error('Microtonal transposition is not supported.');}
     const key=child(item,'key');if(key){const sharps=number(text(key,'fifths'),'key fifths'),mode=text(key,'mode')??'major';if(!Number.isInteger(sharps)||Math.abs(sharps)>7||!['major','minor'].includes(mode))throw Error('Only major and minor MusicXML keys are supported.');let concertSharps=sharps+keyTranspose;while(concertSharps>7)concertSharps-=12;while(concertSharps< -7)concertSharps+=12;put(keys,at+cursor,{sharps:concertSharps,mode},'key signatures');}
    }else if(item.localName==='backup'||item.localName==='forward'){
     const duration=number(text(item,'duration'),'voice duration')/divisions;if(!Number.isFinite(duration)||duration<=0)throw Error('MusicXML voice durations require positive divisions and duration.');cursor+=item.localName==='backup'?-duration:duration;if(cursor< -1e-8)throw Error('MusicXML backup crosses a measure boundary.');cursor=Math.max(0,cursor);extent=Math.max(extent,cursor);previous=null;
    }else if(item.localName==='direction'||item.localName==='sound'){
     const sound=item.localName==='sound'?item:child(item,'sound'),offset=number(text(item,'offset')??'0','direction offset')/divisions;
     if(sound){for(const attribute of ['dacapo','dalsegno','tocoda','fine','segno','coda'])if(sound.hasAttribute(attribute))throw Error('MusicXML playback jumps require a performed MIDI export.');if(sound.hasAttribute('tempo')){const bpm=number(sound.getAttribute('tempo'),'tempo');if(bpm<20||bpm>300||at+cursor+offset<0)throw Error('MusicXML tempo must be 20–300 BPM at a nonnegative position.');put(tempos,at+cursor+offset,bpm,'tempos');}}
     const metronome=item.querySelector('metronome');if(metronome&&!sound?.hasAttribute('tempo')){const unit={whole:4,half:2,quarter:1,eighth:.5,'16th':.25,'32nd':.125}[text(metronome,'beat-unit')],dots=children(metronome,'beat-unit-dot').length,bpm=number(text(metronome,'per-minute'),'metronome tempo')*unit*(2-2**(-dots));if(!Number.isFinite(bpm)||bpm<20||bpm>300||at+cursor+offset<0)throw Error('Unsupported MusicXML metronome tempo.');put(tempos,at+cursor+offset,bpm,'tempos');}
    }else if(item.localName==='note'){
     if(++count>20000)throw Error('Import up to 20,000 score notes at a time.');
     const duration=number(text(item,'duration'),'note duration')/divisions;if(!Number.isFinite(duration)||duration<=0)throw Error('MusicXML note durations require positive divisions and duration.');
     const chord=Boolean(child(item,'chord')),rest=Boolean(child(item,'rest')),voice=text(item,'voice')??'1',staff=text(item,'staff')??'1';
     if(chord&&(!previous||previous.rest||previous.voice!==voice||previous.staff!==staff||duration>previous.duration+1e-8))throw Error('MusicXML chord has no matching preceding note.');
     const start=at+(chord?previous.start:cursor);if(!chord){previous={start:cursor,duration,voice,staff,rest};cursor+=duration;}extent=Math.max(extent,start-at+duration,cursor);
     if(rest||child(item,'cue'))continue;
     if(item.hasAttribute('attack')||item.hasAttribute('release')||item.hasAttribute('time-only'))throw Error('MusicXML note timing overrides require a performed MIDI export.');
     const pitchNode=child(item,'pitch');if(!pitchNode)throw Error('MusicXML note requires a pitch.');const step=text(pitchNode,'step'),alter=number(text(pitchNode,'alter')??'0','pitch alteration'),octave=number(text(pitchNode,'octave'),'pitch octave'),pitch=(octave+1)*12+natural[step]+alter+transpose;
     if(!Number.isInteger(pitch)||pitch<0||pitch>127)throw Error('MusicXML notes must use whole MIDI pitches 0–127.');
     const tieTypes=children(item,'tie').map(t=>t.getAttribute('type')),key=`${voice}:${staff}:${pitch}`,pending=ties.get(key);
     if(tieTypes.some(t=>!['start','stop'].includes(t)))throw Error('Unsupported MusicXML tie.');
     if(tieTypes.includes('stop')){if(!pending||Math.abs(pending.start+pending.duration-start)>1e-7)throw Error('MusicXML tie does not connect matching consecutive notes.');pending.duration+=duration;if(!tieTypes.includes('start'))ties.delete(key);}
     else{if(pending)throw Error('MusicXML tie is missing its ending.');const n={pitch,start,duration,velocity:.8};if(item.hasAttribute('dynamics'))n.velocity=Math.min(1,Math.max(0,number(item.getAttribute('dynamics'),'dynamics')*.9/127));notes.push(n);if(tieTypes.includes('start'))ties.set(key,n);}
    }
   }
   if(extent<=0)extent=meter;
   if(measure.getAttribute('implicit')!=='yes'&&extent<meter)extent=meter;
   at+=extent;measureEnds.push(at);if(at>432000)throw Error('MusicXML score exceeds the timeline limit.');
  }
  if(ties.size)throw Error('MusicXML contains unfinished ties.');
  return {name:definitions.get(part.id),notes,duration:at,measureEnds};
 });
 if(timewise)validateTimewiseBoundaries(tracks);
 for(const track of tracks)delete track.measureEnds;
 if(!tracks.some(t=>t.notes.length))throw Error('The MusicXML score has no pitched notes.');
 return {tracks,tempos:[...tempos],meters:[...meters],keys:[...keys]};
}
const bytes=(n,size)=>Array.from({length:size},(_,i)=>(n>>>((size-i-1)*8))&255);
const vlq=n=>{const result=[n&127];while((n>>>=7)>0)result.unshift((n&127)|128);return result;};
const string=value=>Array.from(new TextEncoder().encode(value));
export function musicxmlMidi(score){
 const chunk=events=>{events.sort((a,b)=>a.tick-b.tick||a.order-b.order);let last=0;const out=[];for(const e of events){if(!Number.isInteger(e.tick)||e.tick<last||e.tick>0xfffffff)throw Error('MusicXML timing exceeds MIDI limits.');out.push(...vlq(e.tick-last),...e.data);last=e.tick;}out.push(0,255,47,0);return [...string('MTrk'),...bytes(out.length,4),...out];};
 const meta=(tick,type,data)=>({tick,order:0,data:[255,type,...vlq(data.length),...data]});
 const conductor=[...score.tempos.map(([tick,bpm])=>meta(tick,81,bytes(Math.round(60000000/bpm),3))),...score.meters.map(([tick,m])=>meta(tick,88,[m.beats,Math.log2(m.denominator),24,8])),...score.keys.map(([tick,k])=>meta(tick,89,[k.sharps&255,k.mode==='minor'?1:0]))];
 if(!score.tempos.some(([tick])=>tick===0))conductor.push(meta(0,81,bytes(500000,3)));
 const chunks=[chunk(conductor)];for(const track of score.tracks){const events=[meta(0,3,string(track.name.slice(0,200)))];const channels=new Map();for(const n of [...track.notes].sort((a,b)=>a.start-b.start)){const start=Math.round(n.start*960),end=Math.round((n.start+n.duration)*960);if(end<=start)throw Error('MusicXML note is shorter than one MIDI tick.');if(n.velocity<=0)continue;const ends=channels.get(n.pitch)??Array(16).fill(-1);let channel=ends.findIndex((end,i)=>i!==9&&end<=start);if(channel<0)throw Error('MusicXML has more than 15 overlapping notes at the same pitch.');ends[channel]=end;channels.set(n.pitch,ends);events.push({tick:start,order:2,data:[144|channel,n.pitch,Math.max(1,Math.round(n.velocity*127))]},{tick:end,order:1,data:[128|channel,n.pitch,0]});}chunks.push(chunk(events));}
 const size=14+chunks.reduce((sum,c)=>sum+c.length,0),out=new Uint8Array(size);let offset=0;for(const chunk of [[...string('MThd'),0,0,0,6,0,1,...bytes(chunks.length,2),...bytes(960,2)],...chunks]){out.set(chunk,offset);offset+=chunk.length;}return out;
}
export function musicxmlImportData(source){return encodeMidiImport(musicxmlMidi(parseMusicxml(source)));}
