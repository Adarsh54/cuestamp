const children=(node,name)=>[...node.children].filter(n=>n.localName===name);
export function percussionMappings(definition){
 const declared=new Set(children(definition,'score-instrument').map(n=>n.getAttribute('id'))),mappings=new Map();
 for(const instrument of children(definition,'midi-instrument')){
  const values=children(instrument,'midi-unpitched');if(!values.length)continue;
  const id=instrument.getAttribute('id'),raw=values[0].textContent.trim(),value=Number(raw);
  if(!id||!declared.has(id)||mappings.has(id)||values.length!==1||!/^\d+$/.test(raw)||!Number.isInteger(value)||value<1||value>128)throw Error('MusicXML percussion requires distinct declared instruments with MIDI note numbers 1–128.');
  mappings.set(id,value-1);
 }
 return mappings;
}
export function percussionPitch(note,mappings){
 const instruments=children(note,'instrument');
 const id=instruments[0]?.getAttribute('id');
 if(instruments.length>1||instruments.length===1&&(!id||!mappings.has(id))||!instruments.length&&mappings.size!==1)throw Error('MusicXML percussion note requires an unambiguous MIDI instrument mapping.');
 return id?mappings.get(id):mappings.values().next().value;
}
// MIDI note-off messages have no note IDs. Keep overlapping same-pitch hits
// in separate SMF tracks so readMidi can reconstruct each duration exactly.
function percussionLayers(notes){
 const layers=[];
 for(const note of [...notes].sort((a,b)=>a.start-b.start)){
  if(note.velocity<=0)continue;
  const start=Math.round(note.start*960),end=Math.round((note.start+note.duration)*960);
  let layer=layers.find(layer=>(layer.ends.get(note.pitch)??-1)<=start);
  if(!layer){if(layers.length>=128)throw Error('MusicXML percussion layering exceeds the 128-track session limit.');layer={notes:[],ends:new Map()};layers.push(layer);}
  layer.notes.push(note);layer.ends.set(note.pitch,end);
 }
 return layers.map(layer=>layer.notes);
}
// Internal drum playback is track-based. Separate mixed pitched/percussion parts
// instead of sending their pitched notes through the drum instrument.
export function musicxmlPlaybackTracks(tracks){
 const result=tracks.flatMap(track=>{
  const pitched=track.notes.filter(n=>!n.percussion),drums=track.notes.filter(n=>n.percussion);
  if(!drums.length)return [track];
  const name=pitched.length?`${track.name} · Percussion`:track.name,layers=percussionLayers(drums);
  const percussion=layers.map((notes,index)=>({...track,name:layers.length>1?`${name} · Layer ${index+1}`:name,notes,events:[],percussion:true}));
  return pitched.length?[{...track,notes:pitched},...percussion]:percussion;
 });
 if(result.length>128)throw Error('MusicXML import exceeds the 128-track session limit after percussion separation.');
 return result;
}
