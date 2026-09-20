import {regionBeatTiming,compileTempoMap} from './tempo-map.js';
export const pianoSnapOptions=[[0,'Off'],[1,'1/4'],[.5,'1/8'],[.25,'1/16'],[.125,'1/32'],[1/3,'1/8 triplet'],[1/6,'1/16 triplet']];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function snapTime(value,step,{floor=false}={}){
 if(!step)return value;
 return (floor?Math.floor(value/step+1e-9):Math.round(value/step))*step;
}
export function notePlacement(time,regionDuration,step,defaultDuration){
 const start=snapTime(Math.max(0,time),step,{floor:true});
 if(start>=regionDuration)return null;
 return {start,duration:Math.min(step||defaultDuration,regionDuration-start)};
}
export function noteDrag(note,{seconds,semitones=0,step=0,resize=false,regionDuration}){
 const shift=snapTime(seconds,step);
 if(resize)return {duration:clamp(note.duration+shift,Math.min(step||.001,regionDuration-note.start),Math.min(3600,regionDuration-note.start))};
 return {start:clamp(note.start+shift,0,regionDuration-note.duration),pitch:clamp(note.pitch+Math.round(semitones),0,127)};
}
export function applyPianoGrid(root,beat,snap,region,session){
 const grid=root.querySelector('.daw-note-grid');if(!grid)return;
 if(region&&session?.tempoChanges?.length){const lines=musicalPianoGrid(region,session,snap),stops=lines.flatMap(time=>{const x=28+time*80;return [`transparent ${x}px`,`var(--line) ${x}px`,`var(--line) ${x+1}px`,`transparent ${x+1}px`];});grid.style.setProperty('--piano-grid-image',stops.length?`linear-gradient(to right,${stops.join(',')})`:'none');grid.style.setProperty('--piano-grid-position','0px');grid.style.setProperty('--piano-snap-width','100%');return;}
 grid.style.removeProperty('--piano-grid-image');grid.style.removeProperty('--piano-grid-position');
 grid.style.setProperty('--piano-snap-width',`${snap?beat*snap*80:1}px`);
 grid.style.setProperty('--piano-grid-color',snap?'var(--line)':'transparent');
}

export function musicalNotePlacement(time,region,timing,snap){
 const clock=regionBeatTiming(region,timing),beat=clock.beatAtTime(Math.max(0,time)),startBeat=snapTime(beat,snap,{floor:true}),start=clock.timeAtBeat(startBeat);
 if(start>=region.duration)return null;
 const duration=Math.min(clock.durationAtBeat(startBeat,snap||.25),region.duration-start);
 if(!(duration>0)||start+duration<=start)throw Error('Note length is below timeline precision.');
 return {start,duration};
}

// Bound visual density without changing the actual editing snap interval.
export function musicalPianoGrid(region,session,snap){
 if(!snap)return [];
 if(!Number.isFinite(snap)||snap<=0)throw Error('Choose a positive piano grid interval.');
 const clock=regionBeatTiming(region,session),map=compileTempoMap(session),end=clock.beatAtTime(region.duration),fastest=Math.max(...map.points.map(p=>p.bpm));let step=snap;
 while(end/step>999||step*60/fastest*80<4)step*=2;
 const count=Math.min(1000,Math.floor(end/step+1e-9)+1);
 return Array.from({length:count},(_,i)=>clock.timeAtBeat(i*step)).filter(time=>time<=region.duration+1e-9);
}
