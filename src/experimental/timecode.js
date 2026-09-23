export const frameRates=[23.976,24,25,29.97,30,50,59.94,60];
export const exactFrameRate=rate=>rate===23.976?24000/1001:rate===29.97?30000/1001:rate===59.94?60000/1001:rate;
export const supportsDropFrame=rate=>rate===29.97||rate===59.94;
function droppedLabels(rate,dropFrame){if(dropFrame&&!supportsDropFrame(rate))throw Error('Drop-frame timecode requires 29.97 or 59.94 fps.');return dropFrame?Math.round(rate)/15:0;}
export function formatTimecode(seconds,rate=24,dropFrame=false){
 const nominal=Math.round(rate),drop=droppedLabels(rate,dropFrame);let frame=Math.max(0,Math.floor(seconds*exactFrameRate(rate)+1e-7));
 if(drop){const tenMinutes=nominal*600-drop*9,minute=nominal*60-drop,blocks=Math.floor(frame/tenMinutes),remainder=frame%tenMinutes;frame+=drop*9*blocks+drop*Math.max(0,Math.floor((remainder-drop)/minute));}
 const parts=[Math.floor(frame/(nominal*3600)),Math.floor(frame/(nominal*60))%60,Math.floor(frame/nominal)%60,frame%nominal].map(v=>String(v).padStart(2,'0'));return parts.slice(0,3).join(':')+(dropFrame?';':':')+parts[3];
}
export function parseTimecode(text,rate=24,dropFrame=false){
 const drop=droppedLabels(rate,dropFrame),pattern=dropFrame?/^\d{2}:\d{2}:\d{2};\d{2}$/:/^\d{2}:\d{2}:\d{2}:\d{2}$/;
 if(!pattern.test(text))throw Error('Enter timecode as '+(dropFrame?'HH:MM:SS;FF.':'HH:MM:SS:FF.'));
 const [h,m,s,f]=text.split(/[:;]/).map(Number),nominal=Math.round(rate);if(m>59||s>59||f>=nominal)throw Error('Timecode is outside the selected frame rate.');
 if(drop&&m%10!==0&&s===0&&f<drop)throw Error('This frame number is skipped in drop-frame timecode.');
 const minutes=h*60+m;return ((h*3600+m*60+s)*nominal+f-drop*(minutes-Math.floor(minutes/10)))/exactFrameRate(rate);
}
const sessionOffset=session=>Math.floor((session.timecodeOffset||0)*exactFrameRate(session.frameRate||24)+1e-7)/exactFrameRate(session.frameRate||24);
export function formatSessionTimecode(seconds,session){return formatTimecode(seconds+sessionOffset(session),session.frameRate,session.dropFrame);}
export function parseSessionTimecode(text,session){const time=parseTimecode(text,session.frameRate,session.dropFrame)-sessionOffset(session);if(time< -1e-7||time>86400)throw Error('Timecode must be within this session’s 24-hour timeline.');return Math.max(0,time);}
export function stepFrame(seconds,direction,rate=24){const fps=exactFrameRate(rate);return Math.max(0,Math.round(seconds*fps)+direction)/fps;}
export function scoringView(session,position,busy=false){const rate=session.frameRate||24;return `<div class="daw-scoring"><label>Frame rate<select data-frame-rate>${frameRates.map(r=>`<option value="${r}" ${r===rate?'selected':''}>${r} fps</option>`).join('')}</select></label><label>Timecode format<select data-drop-frame><option value="false" ${!session.dropFrame?'selected':''}>Non-drop</option><option value="true" ${session.dropFrame?'selected':''} ${supportsDropFrame(rate)?'':'disabled'}>Drop-frame</option></select></label><label>Timecode at timeline zero<input data-timecode-offset value="${formatTimecode(session.timecodeOffset||0,rate,session.dropFrame)}" aria-label="Timecode at timeline zero" inputmode="numeric"></label><label>Timecode<input data-timecode value="${formatSessionTimecode(position,session)}" aria-label="Timeline timecode" inputmode="numeric"></label><button data-action="frame-back" aria-label="Previous frame">← Frame</button><button data-action="frame-forward" aria-label="Next frame">Frame →</button><button data-action="extract-movie-audio" ${busy?'disabled':''}>Extract movie audio</button></div>`;}
