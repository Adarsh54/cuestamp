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
// Internal drum playback is track-based. Separate mixed pitched/percussion parts
// instead of sending their pitched notes through the drum instrument.
export function musicxmlPlaybackTracks(tracks){
 return tracks.flatMap(track=>{
  const pitched=track.notes.filter(n=>!n.percussion),drums=track.notes.filter(n=>n.percussion);
  if(!drums.length)return [track];
  const percussion={...track,name:pitched.length?`${track.name} · Percussion`:track.name,notes:drums,events:[],percussion:true};
  return pitched.length?[{...track,notes:pitched},percussion]:[percussion];
 });
}
