import {z} from 'zod';
import {selectedRegions} from './region-selection.js';
import {audibleSources} from './routing.js';
export function selectedRegionsAudition(session,ids){
 selectedRegions(session,ids);const selected=new Set(ids),audible=new Set(audibleSources(session).flatMap(t=>t.regions.map(r=>r.id)));
 const document=structuredClone(session);
 for(const track of document.tracks)track.regions=track.regions.filter(r=>selected.has(r.id)&&audible.has(r.id));
 const regions=document.tracks.flatMap(t=>t.regions);
 if(!regions.length)throw Error('Select unmuted audio or MIDI clips that are audible with the current track solo settings.');
 document.loopEnabled=false;document.metronomeEnabled=false;
 return {kind:'regionSelection',document,position:Math.min(...regions.map(r=>r.start)),label:`Auditioning ${regions.length} selected ${regions.length===1?'clip':'clips'} through the current mixer`};
}

export const selectionAuditionSchema=z.object({regionIds:z.array(z.string().min(1).max(100)).min(1).max(1000).nullable()}).strict();
export function resolveSelectionAudition(session,value,captured=[]){const v=selectionAuditionSchema.parse(value),ids=v.regionIds??captured;selectedRegionsAudition(session,ids);return [...ids];}
