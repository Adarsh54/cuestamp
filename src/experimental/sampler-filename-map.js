import {z} from 'zod';
const ident=z.string().min(1).max(100);
export const filenameMapSchema=z.object({trackId:ident,zoneIds:z.array(ident).min(1).max(128).refine(ids=>new Set(ids).size===ids.length,'Choose each sample zone once.'),middleC:z.union([z.literal(3),z.literal(4)]),low:z.number().int().min(0).max(127),high:z.number().int().min(0).max(127)}).strict().refine(v=>v.low<=v.high,'Choose a valid key range.');
export function sampleFilenameRoot(filename,middleC=4){
 if(![3,4].includes(middleC))throw Error('Choose C3 or C4 for MIDI note 60.');
 if(typeof filename!=='string'||!filename.length||filename.length>500)throw Error('A sample filename is missing or too long.');
 const stem=filename.split(/[\\/]/).pop().replace(/\.(wav|wave|flac|mp3|m4a|ogg|aiff?|aac)$/i,'').replaceAll('♯','#').replaceAll('♭','b'),roots=[];
 const natural={c:0,d:2,e:4,f:5,g:7,a:9,b:11};
 for(const match of stem.matchAll(/(?:^|[^a-z0-9])([a-g])([#b]?)(-?\d+)(?=$|[^a-z0-9])/gi)){
  const [,letter,accidental,octave]=match;roots.push(60+(Number(octave)-middleC)*12+natural[letter.toLowerCase()]+(accidental==='#'?1:accidental.toLowerCase()==='b'?-1:0));
 }
 for(const match of stem.matchAll(/(?:^|[^a-z0-9])(?:midi|note|root)[ _=:]*(-?\d+)(?=$|[^a-z0-9])/gi))roots.push(Number(match[1]));
 if(!roots.length)throw Error(`No root note found in “${filename}”. Use a note such as C4 or midi60.`);
 if(roots.some(root=>root<0||root>127))throw Error(`Root note outside MIDI 0–127 in “${filename}”. Check the octave convention.`);
 if(new Set(roots).size!==1)throw Error(`Conflicting root notes in “${filename}”. Use one unambiguous note label.`);
 return roots[0];
}
export function validateFilenameMap(session,options){const v=filenameMapSchema.parse(options),track=session.tracks.find(t=>t.id===v.trackId);if(track?.kind!=='midi')throw Error('Choose an instrument track.');if(v.zoneIds.some(id=>!track.sampleZones?.some(z=>z.id===id)))throw Error('A selected sample zone no longer exists.');return v;}
export function filenameMapPlan(track,files,options){
 const v=validateFilenameMap({tracks:[track]},options),rows=v.zoneIds.map(id=>{const zone=track.sampleZones.find(z=>z.id===id),file=files.get(zone.assetId);if(!file)throw Error(`Restore the source file for “${zone.name}” before mapping.`);return {id,name:zone.name,filename:file.name,root:sampleFilenameRoot(file.name,v.middleC)};});
 if(rows.some(r=>r.root<v.low||r.root>v.high))throw Error('The key range must include every filename root note.');
 return {rows,commands:[{op:'samplerZone.automap',target:track.id,values:{mode:'roots',zoneIds:JSON.stringify(v.zoneIds),roots:JSON.stringify(rows.map(({id,root})=>({id,root}))),low:v.low,high:v.high}}]};
}
