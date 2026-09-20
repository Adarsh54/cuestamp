import {regionBeatTiming} from './tempo-map.js';
import {z} from 'zod';
const integer=(max)=>z.number().int().min(0).max(max).optional(),time=max=>z.number().finite().min(0).max(max).optional();
const filterSchema=max=>z.object({pitchMin:integer(127),pitchMax:integer(127),velocityMin:integer(127),velocityMax:integer(127),channel:integer(15),start:time(max),end:time(max),durationMin:time(max),durationMax:time(max),mute:z.boolean().optional()}).strict().superRefine((v,ctx)=>{for(const [lo,hi]of [['pitchMin','pitchMax'],['velocityMin','velocityMax'],['durationMin','durationMax'],['start','end']])if(v[lo]!==undefined&&v[hi]!==undefined&&(lo==='start'?v[lo]>=v[hi]:v[lo]>v[hi]))ctx.addIssue({code:'custom',message:`${hi} must ${lo==='start'?'follow':'be at least'} ${lo}.`});});
export const noteFilterSchema=filterSchema(86400),musicalNoteFilterSchema=filterSchema(432000);
export function matchingMidiNotes(region,filter={}){
 const f=noteFilterSchema.parse(filter);return matchNotes(region.notes,f);
}
function matchNotes(notes,f){return notes.filter(n=>{const velocity=Math.round(n.velocity*127);return (f.pitchMin===undefined||n.pitch>=f.pitchMin)&&(f.pitchMax===undefined||n.pitch<=f.pitchMax)&&(f.velocityMin===undefined||velocity>=f.velocityMin)&&(f.velocityMax===undefined||velocity<=f.velocityMax)&&(f.channel===undefined||(n.channel??0)===f.channel)&&(f.start===undefined||n.start>=f.start)&&(f.end===undefined||n.start<f.end)&&(f.durationMin===undefined||n.duration>=f.durationMin)&&(f.durationMax===undefined||n.duration<=f.durationMax)&&(f.mute===undefined||Boolean(n.mute)===f.mute);});
}
// Durations are measured independently at each note, not at the region origin.
export function matchingMidiNotesInBeats(region,filter,timing){
 const f=musicalNoteFilterSchema.parse(filter),clock=regionBeatTiming(region,timing),matches=matchNotes(region.notes.map(n=>({...n,start:clock.beatAtTime(n.start),duration:clock.beatsInDuration(n.start,n.duration)})),f),ids=new Set(matches.map(n=>n.id));
 return region.notes.filter(n=>ids.has(n.id));
}
export function combineNoteSelection(region,current,matches,mode='replace'){
 if(!['replace','add','subtract','intersect'].includes(mode))throw Error('Choose a valid selection mode.');const old=new Set(current),found=new Set(matches);return region.notes.filter(n=>mode==='replace'?found.has(n.id):mode==='add'?old.has(n.id)||found.has(n.id):mode==='subtract'?old.has(n.id)&&!found.has(n.id):old.has(n.id)&&found.has(n.id)).map(n=>n.id);
}
export const filterableNoteOperations=['notes.repeat','notes.mute','notes.move','notes.resize','notes.delete','notes.duplicate','notes.quantize','notes.transpose','notes.join'];
export function resolveNoteFilter(region,op,values){
 if(values.filter===undefined)return values;
 if(!filterableNoteOperations.includes(op))throw Error('This operation does not support a note filter.');
 if(values.noteId!==undefined||values.noteIds!==undefined)throw Error('Choose a note filter or explicit note IDs, not both.');
 if(typeof values.filter!=='string'||values.filter.length>4000)throw Error('Note filter must be a JSON object string.');
 const ids=matchingMidiNotes(region,JSON.parse(values.filter)).map(n=>n.id);if(!ids.length)throw Error('No notes match this filter.');const {filter,...rest}=values;return {...rest,noteIds:ids.join(',')};
}
const fields=[['pitchMin','Lowest pitch',0,127,1],['pitchMax','Highest pitch',0,127,1],['velocityMin','Lowest velocity',0,127,1],['velocityMax','Highest velocity',0,127,1],['start','From beat',0,432000,'any'],['end','Before beat',0,432000,'any'],['durationMin','Shortest · beats',0,432000,'any'],['durationMax','Longest · beats',0,432000,'any'],['channel','Channel',1,16,1]];
const state=settings=>settings.filterTools??={mode:'replace',mute:'any'};
export function noteFilterView(settings,esc){const s=state(settings);return `<details class="daw-note-filter"><summary>Select notes by condition</summary><form data-note-filter><div class="button-row">${fields.map(([key,label,min,max,step])=>`<label>${label}<input name="${key}" type="number" min="${min}" max="${max}" step="${step}" placeholder="Any" value="${esc(s[key]??'')}"></label>`).join('')}<label>Mute state<select name="mute">${[['any','Any'],['muted','Muted'],['audible','Unmuted']].map(([v,label])=>`<option value="${v}" ${s.mute===v?'selected':''}>${label}</option>`).join('')}</select></label><label>Selection<select name="mode">${[['replace','Replace selection'],['add','Add matches'],['subtract','Remove matches'],['intersect','Keep matching selected']].map(([v,label])=>`<option value="${v}" ${s.mode===v?'selected':''}>${label}</option>`).join('')}</select></label><button type="submit">Select matching notes</button><button type="button" data-filter-reset>Reset conditions</button><button type="button" data-selection-invert>Invert selection</button></div><output data-filter-preview></output><p class="muted">All conditions must match. Leave a field blank for any value. Pitch and velocity use 0–127; channel uses 1–16. Timing is in beats from the region start; the ending beat is excluded. Selection does not change the music or add an undo step. Apply any note editing tool to the resulting selection.</p></form></details>`;}
export function bindNoteFilter(root,{region,tempo,session,settings,select,guard}){
 const form=root.querySelector('[data-note-filter]');if(!form)return;const s=state(settings),button=form.querySelector('[type=submit]');let matched=[];
 const update=()=>{const f={};for(const [key]of fields){const input=form.elements[key];s[key]=input.value;if(input.value!=='')f[key]=input.valueAsNumber-(key==='channel'?1:0);else if(input.validity.badInput)f[key]=NaN;}s.mute=form.elements.mute.value;s.mode=form.elements.mode.value;if(s.mute!=='any')f.mute=s.mute==='muted';try{matched=matchingMidiNotesInBeats(region,f,session??tempo).map(n=>n.id);const next=combineNoteSelection(region,settings.selectedIds||[],matched,s.mode);form.querySelector('[data-filter-preview]').textContent=`${matched.length} matching · ${next.length} selected after applying`;button.disabled=false;}catch(e){form.querySelector('[data-filter-preview]').textContent=e.message;button.disabled=true;}};
 form.oninput=update;form.onchange=update;form.onsubmit=guard(e=>{e.preventDefault();update();if(button.disabled)return;settings.selectedIds=combineNoteSelection(region,settings.selectedIds||[],matched,s.mode);select(settings.selectedIds[0]||null);});
 form.querySelector('[data-filter-reset]').onclick=()=>{for(const [key]of fields)form.elements[key].value='';form.elements.mute.value='any';update();};form.querySelector('[data-selection-invert]').onclick=()=>{const current=new Set(settings.selectedIds||[]);settings.selectedIds=region.notes.filter(n=>!current.has(n.id)).map(n=>n.id);select(settings.selectedIds[0]||null);};update();
}
