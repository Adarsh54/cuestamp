import {z} from 'zod';
const options=z.object({regionIds:z.string().min(1).max(101000),seconds:z.number().finite().min(-86400).max(86400)}).strict();
export function selectedRegions(session,ids){
 if(!Array.isArray(ids)||!ids.length||ids.length>1000||new Set(ids).size!==ids.length)throw Error('Choose 1–1,000 distinct regions.');
 const all=new Map(session.tracks.flatMap(t=>t.regions.map(r=>[r.id,r])));if(ids.some(id=>!all.has(id)))throw Error('A selected region no longer exists.');return ids.map(id=>all.get(id));
}
export function movedRegions(session,values){const v=options.parse(values),regions=selectedRegions(session,v.regionIds.split(','));const edits=regions.map(r=>({id:r.id,start:r.start+v.seconds}));if(edits.some(r=>r.start<0||r.start>86400))throw Error('Move must keep all region starts between 0 and 86,400 seconds.');return edits;}
export function clampRegionMove(regions,delta){return Math.max(-Math.min(...regions.map(r=>r.start)),Math.min(86400-Math.max(...regions.map(r=>r.start)),delta));}
export function regionSelectionView(ids,session){const midi=session?session.tracks.filter(t=>t.kind==='midi').flatMap(t=>t.regions).filter(r=>ids.includes(r.id)):[],fixed=midi.filter(r=>r.tempoFollow===false).length;return ids.length>1?`<form data-region-group-move class="daw-region-group"><strong>${ids.length} regions selected</strong><label>Move together · seconds<input name="seconds" type="number" min="-86400" max="86400" step="any" value="0" required></label><button>Move selected regions</button><button type="button" data-align-region-selection="start">Align starts to playhead</button><button type="button" data-align-region-selection="end">Align ends to playhead</button><button type="button" data-split-region-selection>Split selected at playhead</button><button type="button" data-duplicate-region-selection>Duplicate selected regions</button><button type="button" data-delete-region-selection>Delete selected regions</button>${midi.length?`<div role="group" aria-label="Selected MIDI timing"><small>${fixed} of ${midi.length} selected MIDI regions keep fixed timing.</small><button type="button" data-region-tempo-follow="false" ${fixed===midi.length?'disabled':''}>Keep MIDI timing fixed</button><button type="button" data-region-tempo-follow="true" ${fixed===0?'disabled':''}>Make MIDI follow tempo</button></div>`:''}<button type="button" data-clear-region-selection>Clear selection</button><small>Drag a selected region to move the group. Tracks and spacing stay unchanged; Shift bypasses snapping. Duplicates start after the end of the group. Trim and fade handles edit only their region.</small></form>`:'';}
const groupOptions=z.object({regionIds:z.string().min(1).max(101000)}).strict();
export function regionIdsForDeletion(session,values){const v=groupOptions.parse(values);return new Set(selectedRegions(session,v.regionIds.split(',')).map(r=>r.id));}
export function duplicatedRegions(session,values){
 const v=groupOptions.extend({seconds:z.number().finite().min(-86400).max(86400).optional()}).parse(values),regions=selectedRegions(session,v.regionIds.split(',')),ids=new Set(regions.map(r=>r.id));
 const seconds=v.seconds??Math.max(...regions.map(r=>r.start+r.duration))-Math.min(...regions.map(r=>r.start));
 movedRegions(session,{regionIds:v.regionIds,seconds});
 for(const track of session.tracks)if(track.regions.length+track.regions.filter(r=>ids.has(r.id)).length>1000)throw Error('Duplicating would exceed the 1,000-region track limit.');
 return session.tracks.flatMap(track=>track.regions.filter(r=>ids.has(r.id)).map(region=>({trackId:track.id,region:{...structuredClone(region),id:crypto.randomUUID(),start:region.start+seconds,notes:region.notes.map(n=>({...n,id:crypto.randomUUID()})),events:region.events.map(e=>({...e,id:crypto.randomUUID()}))}})));
}

export function setSelectedTempoFollow(session,values){
 const v=groupOptions.extend({tempoFollow:z.boolean()}).parse(values),ids=new Set(selectedRegions(session,v.regionIds.split(',')).map(r=>r.id));
 const regions=session.tracks.filter(t=>t.kind==='midi').flatMap(t=>t.regions).filter(r=>ids.has(r.id));
 if(!regions.length)throw Error('Select at least one MIDI region.');
 for(const region of regions)if((region.tempoFollow!==false)!==v.tempoFollow)region.tempoFollow=v.tempoFollow;
}

export function alignedRegions(session,values){
 const v=groupOptions.extend({position:z.number().finite().min(0).max(86400),edge:z.enum(['start','end']).default('start')}).parse(values);
 const edits=selectedRegions(session,v.regionIds.split(',')).map(r=>({id:r.id,start:v.position-(v.edge==='end'?r.duration:0)}));
 if(edits.some(r=>r.start<0))throw Error('Aligning region ends here would place a region before the project start.');
 return edits;
}
