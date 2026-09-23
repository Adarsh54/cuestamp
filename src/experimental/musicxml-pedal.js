export function musicxmlPedalValue(value){
 if(value==='yes')return 127;if(value==='no')return 0;
 const number=Number(value);if(typeof value!=='string'||!value.trim()||!Number.isFinite(number)||number<0||number>100)throw Error('MusicXML pedal must be yes, no or a percentage from 0 to 100.');
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
 if(events.some(e=>!Number.isFinite(e.start)||e.start<0||![64,66].includes(e.parameter)||!Number.isInteger(e.value)||e.value<0||e.value>127))throw Error('Invalid imported MusicXML pedal event.');
 const last=events.at(-1),end=Math.max(track.duration??0,...track.notes.map(n=>n.start+n.duration),last?.start??0);
 // A held pedal releases at the score's end, retaining any trailing-rest sustain.
 for(const parameter of [64,66])if(events.findLast(e=>e.parameter===parameter)?.value>=64)events.push({start:end,parameter,value:0});
 return events.flatMap(e=>[...channels].map(channel=>({tick:Math.round(e.start*960),order:0,data:[176|channel,e.parameter,e.value]})));
}
export function musicxmlPedalMarkValues(type,number='1'){
 if(number!=='1')throw Error('Overlapping numbered MusicXML pedal lines require explicit sound pedal data.');
 if(type==='start')return [127];if(type==='stop')return [0];if(type==='change')return [0,127];
 if(['continue','discontinue','resume'].includes(type))return [];
 throw Error('Unsupported MusicXML pedal marking. Sostenuto requires explicit sound pedal data.');
}
export function musicxmlPedalMarks(direction,sound,at,divisions){
 // Explicit sound data is authoritative when the same direction also has a symbol.
 const marks=[...direction.children].filter(n=>n.localName==='direction-type').flatMap(n=>[...n.children].filter(c=>c.localName==='pedal')).filter(mark=>!sound?.hasAttribute(mark.getAttribute('type')==='sostenuto'?'sostenuto-pedal':'damper-pedal'));
 if(!marks.length)return [];
 const start=at+musicxmlSoundOffset(null,direction,divisions);if(!Number.isFinite(start)||start<0)throw Error('MusicXML pedal offset must remain inside the timeline.');
 return marks.flatMap(mark=>musicxmlPedalMarkValues(mark.getAttribute('type'),mark.getAttribute('number')??'1').map(value=>({start,parameter:64,value})));
}
