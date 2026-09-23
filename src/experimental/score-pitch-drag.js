import {scoreTransposition,writtenKey} from './score-transposition.js';
import {spelledPitch} from './musicxml.js';
import {compileKeyMap} from './key-map.js';
import {compileTempoMap} from './tempo-map.js';
const letters='CDEFGAB',naturals=[0,2,4,5,7,9,11];
export function scorePitchStep(pitch,steps,key,maxPitch=127){
 if(!Number.isInteger(pitch)||pitch<0||pitch>maxPitch||!Number.isInteger(steps))throw Error('Use a MIDI pitch and whole staff steps.');
 const spelling=spelledPitch(pitch,key),index=letters.indexOf(spelling.step),position=spelling.octave*7+index+steps,nextIndex=((position%7)+7)%7,octave=Math.floor(position/7);
 const sharps=key?.sharps??0,altered=(sharps<0?'BEADGCF':'FCGDAEB').slice(0,Math.abs(sharps)),keyAlter=step=>altered.includes(step)?Math.sign(sharps):0;
 const deviation=spelling.alter-keyAlter(spelling.step),next=(octave+1)*12+naturals[nextIndex]+keyAlter(letters[nextIndex])+deviation;
 if(next<0||next>maxPitch)throw Error('That staff position is outside MIDI pitch 0–127.');return next;
}
export function bindScorePitchDrag(element,{session,reference,zoom,execute,guard,onSelect,onDelete}){
 const region=session.tracks.flatMap(t=>t.regions).find(r=>r.id===reference.regionId),note=region?.notes.find(n=>n.id===reference.noteId);if(!note)return;
 const track=session.tracks.find(t=>t.regions.some(r=>r.id===region.id)),transposition=scoreTransposition(track),key=writtenKey(compileKeyMap(session).keyAtBeat(compileTempoMap(session).beatAtTime(region.start+note.start)),transposition);
 const move=steps=>{const pitch=scorePitchStep(note.pitch+transposition.semitones,steps,key,131)-transposition.semitones;if(pitch<0||pitch>127)throw Error('That staff position is outside MIDI pitch 0–127.');return pitch;};
 let gesture=null,suppressClick=false;
 const restore=()=>{element.style.translate='';element.removeAttribute('data-score-drag-pitch');element.setAttribute('aria-label',`Edit MIDI note ${note.pitch}`);};
 const cancel=()=>{if(!gesture)return;const id=gesture.id;gesture=null;suppressClick=true;restore();if(element.hasPointerCapture(id))element.releasePointerCapture(id);};
 element.style.touchAction='none';
 element.onpointerdown=e=>{if(e.button!==0||!e.isPrimary)return;e.preventDefault();e.stopPropagation();element.focus();suppressClick=false;gesture={id:e.pointerId,y:e.clientY,steps:0,pitch:note.pitch};element.setPointerCapture(e.pointerId);};
 element.onpointermove=e=>{if(!gesture||gesture.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();const steps=Math.round((gesture.y-e.clientY)/(5*zoom));gesture.steps=steps;
  try{gesture.pitch=move(steps);element.dataset.scoreDragPitch=String(gesture.pitch);element.style.translate=`0 ${-steps*5}px`;element.setAttribute('aria-label',`Move to MIDI note ${gesture.pitch}`);}catch{gesture.pitch=null;element.setAttribute('aria-label','Outside MIDI pitch range');}
 };
 element.onpointerup=guard(e=>{if(!gesture||gesture.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();const finished=gesture;gesture=null;suppressClick=true;restore();if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId);
  if(finished.pitch===null)throw Error('That staff position is outside MIDI pitch 0–127.');
  if(finished.pitch!==note.pitch)execute([{op:'note.set',target:note.id,values:{pitch:finished.pitch}}],'Changed score note pitch');else onSelect(e);
 });
 element.onpointercancel=cancel;element.onlostpointercapture=cancel;
 element.onclick=e=>{e.stopPropagation();if(suppressClick){suppressClick=false;return;}onSelect(e);};
 element.onkeydown=guard(e=>{
  if(e.key==='Escape'&&gesture){e.preventDefault();e.stopPropagation();cancel();return;}
  if(gesture)return;
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopPropagation();if(onDelete)onDelete();else execute([{op:'note.delete',target:note.id}],'Deleted score note');return;}
  if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();onSelect(e);return;}
  if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();e.stopPropagation();const steps=(e.key==='ArrowUp'?1:-1)*(e.shiftKey?7:1);execute([{op:'note.set',target:note.id,values:{pitch:move(steps)}}],'Changed score note pitch');}
 });
}
