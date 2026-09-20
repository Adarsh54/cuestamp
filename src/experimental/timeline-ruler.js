import {formatTimecode,parseTimecode,exactFrameRate} from './timecode.js';
export const rulerModes=[['seconds','Seconds'],['musical','Bars / beats'],['timecode','Timecode · non-drop']];
const ticksPerBeat=960;
export function formatMusicalPosition(seconds,session){
 const ticks=Math.max(0,Math.floor(seconds*session.tempo/60*ticksPerBeat+1e-7)),beat=Math.floor(ticks/ticksPerBeat),meter=session.meter||4;
 return `${Math.floor(beat/meter)+1}:${beat%meter+1}:${String(ticks%ticksPerBeat).padStart(3,'0')}`;
}
export function parseMusicalPosition(text,session){
 const match=/^(\d{1,7}):(\d{1,2})(?::(\d{1,3}))?$/.exec(text.trim());
 if(!match)throw Error('Enter bar:beat:tick, for example 2:1:000. Bars and beats start at 1.');
 const bar=Number(match[1]),beat=Number(match[2]),tick=Number(match[3]||0),meter=session.meter||4;
 if(bar<1||beat<1||beat>meter||tick<0||tick>=ticksPerBeat)throw Error(`Use bars from 1, beats 1–${meter}, and ticks 0–959.`);
 const time=((bar-1)*meter+beat-1+tick/ticksPerBeat)*60/session.tempo;
 if(!Number.isFinite(time)||time>86400)throw Error('Choose a position within 24 hours.');return time;
}
export function timelinePosition(time,session,mode){return mode==='musical'?formatMusicalPosition(time,session):mode==='timecode'?formatTimecode(time,session.frameRate):time.toFixed(2)+' s';}
export function parseTimelinePosition(text,session,mode){const time=mode==='musical'?parseMusicalPosition(text,session):mode==='timecode'?parseTimecode(text.trim(),session.frameRate):text.trim()?Number(text):NaN;if(!Number.isFinite(time)||time<0||time>86400)throw Error('Choose a position between 0 and 86,400 seconds.');return time;}
const niceStep=minimum=>{const scale=10**Math.floor(Math.log10(Math.max(1,minimum)));return [1,2,5,10].map(n=>n*scale).find(n=>n>=minimum)||scale*10;};
export function timelineTicks(session,mode,zoom,width){
 const end=width/zoom,minimum=Math.max(end/999,(mode==='timecode'?105:mode==='musical'?32:55)/zoom);let step;
 if(mode==='musical'){
  const beat=60/session.tempo,meter=session.meter||4;
  step=minimum<=beat?beat:beat*meter*niceStep(minimum/(beat*meter));
 }else if(mode==='timecode')step=niceStep(minimum)*Math.round(session.frameRate||24)/exactFrameRate(session.frameRate||24);
 else step=niceStep(Math.max(2,minimum));
 const count=Math.min(1000,Math.ceil(end/step));return Array.from({length:count},(_,i)=>{const time=i*step,label=mode==='musical'?formatMusicalPosition(time,session).split(':').slice(0,2).join('|'):mode==='timecode'?formatTimecode(time,session.frameRate):`${Number(time.toFixed(6))}s`;return {time,label};});
}
export function rulerButtons(session,mode,zoom,width){return timelineTicks(session,mode,zoom,width).map(({time,label})=>`<button data-seek="${time}" style="left:${time*zoom}px" aria-label="Go to ${label}${mode==='musical'?' bars/beats':''}">${label}</button>`).join('');}
export function rulerSelector(mode,disabled){return `<label>Ruler<select data-ruler-mode aria-label="Timeline ruler" ${disabled?'disabled':''}>${rulerModes.map(([value,label])=>`<option value="${value}" ${mode===value?'selected':''}>${label}</option>`).join('')}</select></label>`;}
export function positionJump(session,position,mode,disabled){const label=mode==='musical'?'Bar : beat : tick':mode==='timecode'?'Timecode · non-drop':'Position · seconds',value=mode==='seconds'?position.toFixed(3):timelinePosition(position,session,mode);return `<form data-position-jump class="daw-position-jump"><label>${label}<input name="position" aria-label="Go to position" value="${value}" required ${disabled?'disabled':''}></label><button ${disabled?'disabled':''}>Go to position</button>${mode==='musical'?'<small>Bars and beats start at 1; 960 ticks per beat.</small>':''}</form>`;}
