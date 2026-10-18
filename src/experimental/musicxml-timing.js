export function musicxmlTimingOffset(value,divisions){
 if(value===null)return 0;
 if(typeof value!=='string'||!/^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*$/.test(value)||!Number.isFinite(divisions)||divisions<=0)throw Error('Invalid MusicXML note timing offset.');
 const offset=Number(value)/divisions;
 if(!Number.isFinite(offset))throw Error('Invalid MusicXML note timing offset.');
 return offset;
}
// Run after nominal tie assembly and onset dynamics. Written positions still
// determine measure lengths and whether ties connect, independent of playback.
export function applyMusicxmlTiming(notes){
 for(const note of notes){
  const start=note.start+(note.attackOffset??0),end=note.start+note.duration+(note.releaseOffset??0);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>432000)throw Error('MusicXML note timing must have positive duration inside the timeline.');
  note.start=start;note.duration=end-start;
  delete note.attackOffset;delete note.releaseOffset;
 }
}
