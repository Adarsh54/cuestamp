import {resolveScorePasteAction} from './agent-score-clipboard.js';
import {regionBeatTiming} from './tempo-map.js';
import {selectedMidiNotes} from './note-selection.js';
const clipboards=new WeakMap();
export function copyScoreNotes(session,region,ids){
 const chosen=selectedMidiNotes(region,{noteIds:ids.join(',')});
 if(!chosen.length)throw Error('Select score notes to copy.');
 const timing=regionBeatTiming(region,session),origin=Math.min(...chosen.map(n=>n.start)),beat=timing.beatAtTime(origin);
 return {token:crypto.randomUUID(),sessionId:session.id,notes:chosen.map(n=>({note:structuredClone(n),seconds:n.start-origin,beats:timing.beatAtTime(n.start)-beat,length:timing.beatsInDuration(n.start,n.duration)}))};
}
export function pasteScoreNotes(session,clipboard,{regionId,beat=0,timing='beats',extend=false}){
 if(!clipboard?.notes?.length||clipboard.sessionId!==session.id)throw Error('Copy notes in this project first.');
 if(!Number.isFinite(beat)||beat<0||!['beats','seconds'].includes(timing)||typeof extend!=='boolean')throw Error('Choose a valid paste position and timing.');
 const track=session.tracks.find(t=>t.kind==='midi'&&t.regions.some(r=>r.id===regionId)),region=track?.regions.find(r=>r.id===regionId);
 if(!region)throw Error('Choose a MIDI destination region.');
 if(region.notes.length+clipboard.notes.length>20000)throw Error('The destination would exceed 20,000 notes.');
 const map=regionBeatTiming(region,session),position=map.timeAtBeat(beat);
 const notes=clipboard.notes.map(item=>{const start=timing==='beats'?map.timeAtBeat(beat+item.beats):position+item.seconds,duration=timing==='beats'?map.durationAtBeat(beat+item.beats,item.length):item.note.duration;return {...structuredClone(item.note),id:crypto.randomUUID(),start,duration};});
 const end=Math.max(...notes.map(n=>n.start+n.duration));
 if(!Number.isFinite(end)||end>86400||notes.some(n=>!Number.isFinite(n.start)||n.start<0||!Number.isFinite(n.duration)||n.duration<.001||n.duration>3600))throw Error('Pasted notes exceed the supported timing range.');
 if(end>region.duration+1e-9&&!extend)throw Error('The notes do not fit. Enable Extend destination or choose an earlier beat.');
 return [...(end>region.duration?[{op:'region.set',target:region.id,values:{duration:end}}]:[]),{op:'notes.addMany',target:region.id,values:{notes:JSON.stringify(notes)}}];
}
export function scoreClipboardContext(root,session){
 const clipboard=clipboards.get(root)?.clipboard;
 if(!clipboard||clipboard.sessionId!==session.id)return undefined;
 return {sessionId:session.id,revision:session.revision,token:clipboard.token,count:clipboard.notes.length};
}
export function pasteFromScoreClipboard(root,session,context,value){
 const action=resolveScorePasteAction(session,value,context),clipboard=clipboards.get(root)?.clipboard;
 if(!clipboard||clipboard.token!==context.token)throw Error('Copied score notes changed while planning. Run the instruction again.');
 return pasteScoreNotes(session,clipboard,action);
}
export const scoreClipboardView=()=>`<form data-score-paste hidden><p data-score-clipboard-status role="status"></p><div class="button-row"><label>Paste into<select name="destination"></select></label><label>Start · beats into region<input name="beat" type="number" min="0" step="any" value="0" required></label><label>Preserve<select name="timing"><option value="beats">Musical rhythm</option><option value="seconds">Original seconds</option></select></label><label><input name="extend" type="checkbox"> Extend destination to fit</label><button type="submit">Paste notes</button><button type="button" data-score-clipboard-clear>Clear copied notes</button></div><p class="muted">Copies note pitches, velocities and articulations. Destination instruments and controllers apply; source controller events are not copied.</p></form>`;
export function bindScoreClipboard(panel,{session,selectionRoot,selection,execute,guard}){
 let state=clipboards.get(selectionRoot);if(state?.clipboard.sessionId!==session.id){state=null;clipboards.delete(selectionRoot);}
 const form=panel.querySelector('[data-score-paste]'),copy=panel.querySelector('[data-score-note-copy]');
 const regions=session.tracks.filter(t=>t.kind==='midi').flatMap(t=>t.regions.map(r=>({region:r,name:`${t.name} / ${r.name}`})));
 for(const {region,name} of regions){const option=panel.ownerDocument.createElement('option');option.value=region.id;option.textContent=name;form.elements.destination.append(option);}
 const render=()=>{form.hidden=!state;if(!state)return;form.querySelector('[data-score-clipboard-status]').textContent=`${state.clipboard.notes.length} notes copied`;form.elements.destination.value=regions.some(r=>r.region.id===state.regionId)?state.regionId:regions[0]?.region.id??'';form.elements.beat.value=state.beat;form.elements.timing.value=state.timing;form.elements.extend.checked=state.extend;};
 copy.onclick=guard(()=>{const {region,ids}=selection();state={clipboard:copyScoreNotes(session,region,ids),regionId:region.id,beat:0,timing:'beats',extend:false};clipboards.set(selectionRoot,state);render();});
 const remember=()=>{if(!state)return;state.regionId=form.elements.destination.value;state.beat=form.elements.beat.valueAsNumber;state.timing=form.elements.timing.value;state.extend=form.elements.extend.checked;};
 form.oninput=remember;form.onchange=remember;
 form.onsubmit=guard(e=>{e.preventDefault();remember();execute(pasteScoreNotes(session,state?.clipboard,state??{}),'Pasted score notes');});
 form.querySelector('[data-score-clipboard-clear]').onclick=()=>{state=null;clipboards.delete(selectionRoot);render();};render();
}
