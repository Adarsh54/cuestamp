import {chordQualities} from './chords.js';
const sharp=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'],flat=['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
// Exact pitch-class matches only. No inferred missing tones or harmonic intent.
export function analyzeChord(notes,keySignature=null){
 if(!Array.isArray(notes)||notes.length>20000||notes.some(n=>!Number.isInteger(n.pitch)||n.pitch<0||n.pitch>127))throw Error('Choose valid MIDI notes to identify a chord.');
 const pitches=[...new Set(notes.map(n=>n.pitch))].sort((a,b)=>a-b),classes=[...new Set(pitches.map(p=>p%12))].sort((a,b)=>a-b),bass=pitches.length?pitches[0]%12:null,names=keySignature?.sharps<0?flat:sharp,candidates=[];
 if(classes.length>=2)for(let root=0;root<12;root++)for(const [quality,label,intervals] of chordQualities){
  if(intervals.length!==classes.length||!intervals.every(i=>classes.includes((root+i)%12)))continue;
  const inversion=intervals.findIndex(interval=>interval%12===(bass-root+12)%12);candidates.push({root,quality,bass,inversion,label:`${names[root]} ${label.toLowerCase()}${bass===root?'':` / ${names[bass]}`}`});
 }
 candidates.sort((a,b)=>(a.inversion===0?0:1)-(b.inversion===0?0:1)||a.root-b.root||a.quality.localeCompare(b.quality));
 const timed=notes.length>0&&notes.every(n=>Number.isFinite(n.start)&&Number.isFinite(n.duration)&&n.duration>0);
 return {noteCount:notes.length,pitches,pitchClasses:classes,bass,mutedCount:notes.filter(n=>n.mute).length,simultaneous:timed?Math.max(...notes.map(n=>n.start))<Math.min(...notes.map(n=>n.start+n.duration)):null,candidates};
}
export function chordAnalysisView(notes,keySignature){
 if(notes.length<2)return '<p class="muted" data-chord-analysis>Select two or more notes to identify their chord.</p>';
 const a=analyzeChord(notes,keySignature),labels=a.candidates.map(c=>c.label).join(' · ');
 return `<p class="muted" data-chord-analysis aria-live="polite"><strong>Selected pitches:</strong> ${labels||'No exact match among the supported chord types.'}${a.candidates.length>1?' Multiple interpretations.':''}${a.simultaneous===false?' These notes do not all overlap in time.':''}${a.mutedCount?' Includes muted notes.':''}</p>`;
}
export function selectedChordContext(session,ids=[]){
 if(ids.length<2)return null;const selected=new Set(ids),notes=[];
 for(const track of session.tracks)if(track.kind==='midi')for(const region of track.regions)for(const note of region.notes)if(selected.has(note.id))notes.push({...note,start:region.start+note.start});
 return notes.length>=2?analyzeChord(notes,session.keySignature):null;
}
