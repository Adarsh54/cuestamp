import {compileTempoMap} from './tempo-map.js';
const major=['Cb','Gb','Db','Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#'];
const minor=['Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#','G#','D#','A#'];
export function validateKeySignature({sharps,mode}){
 if(!Number.isInteger(sharps)||sharps<-7||sharps>7||!['major','minor'].includes(mode))throw Error('Use a major or minor key with -7 to 7 sharps (negative values mean flats).');
 return {sharps,mode};
}
export function keySignatureName(key){validateKeySignature(key);return `${(key.mode==='minor'?minor:major)[key.sharps+7]} ${key.mode}`;}
// An absent key is unknown, not an inferred C major. Positions are quarter beats.
export function compileKeyMap({keySignature=null,keyChanges=[]}={}){
 if(!Array.isArray(keyChanges)||keyChanges.length>256)throw Error('Use at most 256 key changes.');
 const points=keySignature?[{beat:0,...validateKeySignature(keySignature)}]:[];
 for(const p of [...keyChanges].sort((a,b)=>a.beat-b.beat)){
  if(!Number.isFinite(p.beat)||p.beat<=0||p.beat>432000)throw Error('Key changes require a positive quarter-note beat within the timeline.');
  if(points.at(-1)?.beat===p.beat)throw Error('Only one key change can occupy a beat.');
  points.push({beat:p.beat,...validateKeySignature(p),...(p.id===undefined?{}:{id:p.id})});
 }
 points.forEach(Object.freeze);Object.freeze(points);
 return Object.freeze({points,keyAtBeat(beat){if(!Number.isFinite(beat)||beat<0)throw Error('Choose a nonnegative musical position.');let lo=0,hi=points.length;while(lo<hi){const mid=(lo+hi)>>1;if(points[mid].beat<=beat)lo=mid+1;else hi=mid;}return points[lo-1]??null;}});
}
export function projectKeyScale(session){
 if(!session?.keySignature)throw Error('Set a project key first.');
 const key=validateKeySignature(session.keySignature);
 // Each sharp advances seven semitones; relative minor is nine above major.
 return {root:((key.sharps*7+(key.mode==='minor'?9:0))%12+12)%12,scale:key.mode};
}

// Resolve each note at its onset; sustained notes are not split at key changes.
export function projectKeyAtTime(session){
 const keys=compileKeyMap(session),tempo=compileTempoMap(session);
 return time=>{const key=keys.keyAtBeat(tempo.beatAtTime(time));if(!key)throw Error('Set a project key for the selected passage first.');return projectKeyScale({keySignature:key});};
}
