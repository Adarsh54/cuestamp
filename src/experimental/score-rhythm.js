import {durationForBeats,regionBeatTiming} from './tempo-map.js';
export const scoreLengths=[['whole',4,'Whole'],['half',2,'Half'],['quarter',1,'Quarter'],['eighth',.5,'Eighth'],['sixteenth',.25,'Sixteenth'],['thirtySecond',.125,'Thirty-second']];
const factors={straight:1,dotted:1.5,triplet:2/3};
export function scoreRhythmDuration(session,region,start,length,variant){
 const beats=scoreLengths.find(([id])=>id===length)?.[1],factor=factors[variant];
 if(!beats||!factor||!Number.isFinite(start)||start<0)throw Error('Choose a note length, rhythm and a valid start.');
 const duration=durationForBeats(session,region.start+start,beats*factor);
 if(start+duration>region.duration+1e-9)throw Error('This note length extends beyond the MIDI region. Shorten it or extend the region first.');
 return duration;
}
export function identifyScoreRhythm(session,region,note){
 const beats=regionBeatTiming(region,session).beatsInDuration(note.start,note.duration);
 for(const [variant,factor] of Object.entries(factors))for(const [length,value] of scoreLengths)if(Math.abs(beats-value*factor)<1e-7)return {length,variant};
 return {length:'custom',variant:'straight'};
}
export const scoreRhythmView=()=>`<div class="button-row"><label>Written length<select name="scoreLength"><option value="custom">Custom duration</option>${scoreLengths.map(([id,,label])=>`<option value="${id}">${label} note</option>`).join('')}</select></label><label>Rhythm<select name="scoreRhythm"><option value="straight">Straight</option><option value="dotted">Dotted</option><option value="triplet">Triplet</option></select></label><output data-score-rhythm-status aria-live="polite"></output></div>`;
