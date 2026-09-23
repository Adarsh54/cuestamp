export function musicxmlPedalValue(value){
 if(value==='yes')return 127;if(value==='no')return 0;
 const number=Number(value);if(typeof value!=='string'||!value.trim()||!Number.isFinite(number)||number<0||number>100)throw Error('MusicXML damper pedal must be yes, no or a percentage from 0 to 100.');
 return Math.round(number*127/100);
}
// Sound offsets override direction offsets, and an absent offset needs no divisions.
export function musicxmlSoundOffset(sound,direction,divisions){
 const offset=node=>node&&[...node.children].find(n=>n.localName==='offset')?.textContent.trim();
 const raw=offset(sound)??offset(direction);if(raw===undefined)return 0;
 const value=Number(raw);if(!raw||!Number.isFinite(value)||!Number.isFinite(divisions)||divisions<=0)throw Error('MusicXML sound offset requires valid divisions.');return value/divisions;
}
export function musicxmlPedalEvents(track,channels){
 const events=[...(track.events??[])].sort((a,b)=>a.start-b.start);
 if(events.some(e=>!Number.isFinite(e.start)||e.start<0||e.parameter!==64||!Number.isInteger(e.value)||e.value<0||e.value>127))throw Error('Invalid imported MusicXML pedal event.');
 const last=events.at(-1),end=Math.max(track.duration??0,...track.notes.map(n=>n.start+n.duration),last?.start??0);
 // A held pedal releases at the score's end, retaining any trailing-rest sustain.
 if(last?.value>=64)events.push({start:end,parameter:64,value:0});
 return events.flatMap(e=>[...channels].map(channel=>({tick:Math.round(e.start*960),order:0,data:[176|channel,64,e.value]})));
}
