import {scoreTransposition,writtenKey} from './score-transposition.js';
import {musicxmlRhythm,musicxmlTripletGroups} from './musicxml-rhythm.js';
import {compileTempoMap,regionBeatTiming} from './tempo-map.js';
import {compileKeyMap} from './key-map.js';
import {compileMeterMap} from './meter-map.js';
export const MUSICXML_DIVISIONS=960;
const xml=value=>String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const pitches=[['C',0],['C',1],['D',0],['D',1],['E',0],['F',0],['F',1],['G',0],['G',1],['A',0],['A',1],['B',0]];
const natural={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
export function spelledPitch(pitch,key){
 const count=key?.sharps??0,order=count<0?'BEADGCF':'FCGDAEB',altered=new Set(order.slice(0,Math.abs(count)));
 const diatonic=Object.entries(natural).map(([step,pc])=>[step,altered.has(step)?Math.sign(count):0,pc]);
 const match=diatonic.find(([,alter,pc])=>(pc+alter+12)%12===pitch%12);
 const flats=[['C',0],['D',-1],['D',0],['E',-1],['E',0],['F',0],['G',-1],['G',0],['A',-1],['A',0],['B',-1],['B',0]];
 const [step,alter]=match??(count<0?flats:pitches)[pitch%12];
 return {step,alter,octave:(pitch-natural[step]-alter)/12-1};
}
const keyXml=key=>key?`<key><fifths>${key.sharps}</fifths><mode>${key.mode}</mode></key>`:'';
export function musicxmlRegionPlan(session,track,region){
 if(track?.kind!=='midi'||!track.regions.some(r=>r.id===region?.id))throw Error('Select a MIDI region to export notation.');
 if(track.instrument==='drumKit'||region.notes.some(n=>n.channel===9))throw Error('Percussion notation is not supported yet. Select a pitched MIDI region.');
 const timing=regionBeatTiming(region,session),tempo=compileTempoMap(session),meter=compileMeterMap(session),origin=tempo.beatAtTime(region.start),endBeat=tempo.beatAtTime(region.start+region.duration),tick=beat=>Math.round((beat-origin)*MUSICXML_DIVISIONS),total=tick(endBeat);
 if(total<1)throw Error('The region is shorter than one notation tick.');
 const notes=region.notes.filter(n=>!n.mute&&n.velocity>0).map(n=>({...n,startTick:Math.round(timing.beatAtTime(n.start)*MUSICXML_DIVISIONS),endTick:Math.round(timing.beatAtTime(n.start+n.duration)*MUSICXML_DIVISIONS)})).sort((a,b)=>a.startTick-b.startTick||b.pitch-a.pitch);
 const voiceEnds=[],chords=new Map();for(const n of notes){if(n.endTick<=n.startTick||n.startTick<0||n.endTick>total)throw Error('A note is too short or outside the region at 1/960-quarter-note resolution.');const chordKey=`${n.startTick}:${n.endTick}`;if(chords.has(chordKey)){n.voice=chords.get(chordKey);continue;}let voice=voiceEnds.findIndex(end=>end<=n.startTick);if(voice<0)voice=voiceEnds.length;if(voice>=128)throw Error('Notation export supports at most 128 simultaneous voices.');voiceEnds[voice]=n.endTick;n.voice=voice+1;chords.set(chordKey,n.voice);}
 const measures=[];let bar=meter.positionAtBeat(origin).bar,at=origin;
 while(at<endBeat-1e-9){if(measures.length>=2048)throw Error('Export up to 2,048 measures at a time.');const next=Math.min(endBeat,meter.barStart(bar+1)),signature=meter.signatureAtBar(bar),start=tick(at),end=tick(next);if(end>start)measures.push({bar,start,end,signature,partial:at>meter.barStart(bar)+1e-9||next<meter.barStart(bar+1)-1e-9,tempos:[...(measures.length===0?[{beat:at,bpm:tempo.tempoAtBeat(at)}]:[]),...tempo.points.filter(p=>p.beat>=at&&p.beat<next&&(measures.length>0||p.beat>at))].map(p=>({offset:tick(p.beat)-start,bpm:p.bpm}))});at=next;bar++;}
 return {notes,measures,voices:Math.max(1,voiceEnds.length),total};
}
function regionMeasures(session,track,region){
 const transposition=scoreTransposition(track),keys=compileKeyMap(session),tempo=compileTempoMap(session),origin=tempo.beatAtTime(region.start);
 const plan=musicxmlRegionPlan(session,track,region),parts=[],clefs={treble:['G',2],bass:['F',4],alto:['C',3],tenor:['C',4]},clef=clefs[track.scoreClef??'treble'];if(!clef)throw Error('Choose a supported score clef.');let lastSignature='',lastKey='';
 for(const [index,m] of plan.measures.entries()){
  const key=keys.keyAtBeat(origin+m.start/MUSICXML_DIVISIONS),keyTag=keyXml(writtenKey(key,transposition)),startKey=keyTag!==lastKey?keyTag:'';
  lastKey=keyTag;
  const changes=new Map(keys.points.map(p=>[Math.round((p.beat-origin)*MUSICXML_DIVISIONS),p]).filter(([tick])=>tick>m.start&&tick<m.end));
  const boundaries=[m.start,...changes.keys(),m.end];
  const signature=`${m.signature.numerator}/${m.signature.denominator}`,attributes=`${index===0?'<divisions>960</divisions>':''}${startKey}${signature!==lastSignature?`<time><beats>${m.signature.numerator}</beats><beat-type>${m.signature.denominator}</beat-type></time>`:''}${index===0?`<clef><sign>${clef[0]}</sign><line>${clef[1]}</line></clef>`:''}${index===0&&transposition.semitones?`<transpose><diatonic>${-transposition.diatonic}</diatonic><chromatic>${-transposition.semitones}</chromatic></transpose>`:''}`;lastSignature=signature;
  const music=[attributes?`<attributes>${attributes}</attributes>`:'',...m.tempos.map(t=>`<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${t.bpm}</per-minute></metronome></direction-type><offset>${t.offset}</offset><sound tempo="${t.bpm}"/></direction>`)];
  for(let voice=1;voice<=plan.voices;voice++){
   if(voice>1)music.push(`<backup><duration>${m.end-m.start}</duration></backup>`);let cursor=m.start;
   for(let segment=0;segment<boundaries.length-1;segment++){
    const left=boundaries[segment],right=boundaries[segment+1];
    if(voice===1&&changes.has(left)){lastKey=keyXml(writtenKey(changes.get(left),transposition));music.push(`<attributes>${lastKey}</attributes>`);}
    const events=[];
    for(const n of plan.notes.filter(n=>n.voice===voice&&n.startTick<right&&n.endTick>left)){
     const start=Math.max(left,n.startTick),end=Math.min(right,n.endTick);
     const previous=events.at(-1);if(previous?.notes&&previous.start===start&&previous.end===end){previous.notes.push(n);continue;}
     if(start>cursor)events.push({start:cursor,end:start});events.push({start,end,notes:[n]});cursor=end;
    }
    if(cursor<right){events.push({start:cursor,end:right});cursor=right;}
    const groups=musicxmlTripletGroups(events);
    for(const event of events){
     const {start,end,notes}=event,rhythm=musicxmlRhythm(end-start),group=groups.get(event);
     const tuplet=group&&group!=='member'?`<tuplet type="${group}" number="1"${group==='start'?' bracket="yes" show-number="actual"':''}/>`:'';
     if(rhythm.triplet&&!group)music.push(`<direction placement="above"><direction-type><words font-size="9">3:2</words></direction-type><voice>${voice}</voice></direction>`);
     if(!notes){music.push(`<note><rest/><duration>${end-start}</duration><voice>${voice}</voice>${rhythm.duration}${tuplet?`<notations>${tuplet}</notations>`:''}</note>`);continue;}
     for(const [chordIndex,n] of notes.entries()){
     const noteTuplet=chordIndex===0?tuplet:'';
     const writtenPitch=n.pitch+transposition.semitones;if(writtenPitch>131)throw Error('Written pitch exceeds MusicXML octave 9. Use concert pitch for this part.');
     const {step,alter,octave}=spelledPitch(writtenPitch,writtenKey(keys.keyAtBeat(tempo.beatAtTime(region.start+n.start)),transposition)),ties=[...(n.startTick<start?['stop']:[]),...(n.endTick>end?['start']:[])];
     music.push(`<note dynamics="${(n.velocity*100).toFixed(3)}">${chordIndex?'<chord/>':''}<pitch><step>${step}</step>${alter?`<alter>${alter}</alter>`:''}<octave>${octave}</octave></pitch><duration>${end-start}</duration>${ties.map(type=>`<tie type="${type}"/>`).join('')}<voice>${voice}</voice>${rhythm.duration}${ties.length||noteTuplet?`<notations>${ties.map(type=>`<tied type="${type}"/>`).join('')}${noteTuplet}</notations>`:''}</note>`);
     }
    }
   }
  }parts.push(`<measure number="${index+1}"${m.partial?' implicit="yes"':''}>${music.join('')}</measure>`);
 }
 return parts.join('');
}
function scoreDocument(title,parts){
 return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>${xml(title)}</work-title></work><identification><encoding><software>Cuestamp</software></encoding></identification><part-list>${parts.map((p,i)=>`<score-part id="P${i+1}"><part-name>${xml(p.name)}</part-name></score-part>`).join('')}</part-list>${parts.map((p,i)=>`<part id="P${i+1}">${p.measures}</part>`).join('')}</score-partwise>`;
}
export function exportRegionMusicxml(session,track,region){return scoreDocument(region.name||session.title,[{name:track.name,measures:regionMeasures(session,track,region)}]);}
export function scoreTracks(session){return session.tracks.filter(t=>t.kind==='midi'&&t.instrument!=='drumKit'&&t.regions.length&&!t.regions.some(r=>r.notes.some(n=>n.channel===9)));}
export function scorePartRegions(session,trackIds=scoreTracks(session).map(t=>t.id)){
 if(!Array.isArray(trackIds)||!trackIds.length||trackIds.length>128||new Set(trackIds).size!==trackIds.length)throw Error('Choose between 1 and 128 distinct pitched MIDI tracks.');
 const eligible=scoreTracks(session),tracks=trackIds.map(id=>{const track=eligible.find(t=>t.id===id);if(!track)throw Error('Choose existing pitched MIDI tracks with regions; percussion notation is not supported.');return track;});
 const end=Math.max(...tracks.flatMap(t=>t.regions.map(r=>r.start+r.duration)));
 return tracks.map(track=>{
  // Align all parts to the same timeline, retaining gaps as rests and overlapping regions as voices.
  const region={id:'score-export',name:session.title,start:0,duration:end,notes:track.regions.flatMap(r=>r.notes.map(n=>({...n,start:r.start+n.start,scoreRegionId:r.id})))};
  return {track:{...track,regions:[region]},region};
 });
}
export function exportScoreMusicxml(session,trackIds){
 return scoreDocument(session.title,scorePartRegions(session,trackIds).map(({track,region})=>({name:track.name,measures:regionMeasures(session,track,region)})));
}
export function resolveMusicxmlRegion(session,regionId){if(typeof regionId!=='string'||!regionId||regionId.length>100)throw Error('Choose an existing MIDI region.');const track=session.tracks.find(t=>t.regions.some(r=>r.id===regionId)),region=track?.regions.find(r=>r.id===regionId);musicxmlRegionPlan(session,track,region);return {track,region};}
