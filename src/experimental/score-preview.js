import {scorePartsView,scorePartView} from './score-parts.js';
import {scoreInstruments,scorePitchView} from './score-transposition.js';
import {bindScoreSelection} from './score-agent-selection.js';
import {indexScorePosition} from './score-position.js';
import {scoreNoteEditorView,bindScoreNotes} from './score-note-editor.js';
import {compileTempoMap} from './tempo-map.js';
import {compileMeterMap} from './meter-map.js';
import {compileKeyMap} from './key-map.js';
import {exportRegionMusicxml,exportScoreMusicxml,scoreTracks} from './musicxml.js';
export function validateScorePreviewKeys(session,region){
 const tempo=compileTempoMap(session),meter=compileMeterMap(session),start=tempo.beatAtTime(region.start),end=tempo.beatAtTime(region.start+region.duration);
 for(const key of compileKeyMap(session).points){if(key.beat<=start||key.beat>=end)continue;const bar=meter.positionAtBeat(key.beat).bar;if(Math.abs(meter.barStart(bar)-key.beat)>1e-9)throw Error('This region has a mid-bar key change that the score preview cannot display accurately. Export MusicXML to view it in notation software.');}
}
export function scorePreviewDocument(session,track,region,scope,pitchMode='written'){
 ({session,track}=scorePitchView(session,track,pitchMode));
 if(scope==='arrangement'){
  const tracks=scoreTracks(session);if(!tracks.length)throw Error('Add a pitched MIDI region to preview a score.');
  validateScorePreviewKeys(session,{start:0,duration:Math.max(...tracks.flatMap(t=>t.regions.map(r=>r.start+r.duration)))});
  return {xml:exportScoreMusicxml(session),label:`Arrangement score: ${tracks.length} parts`,name:session.title};
 }
 validateScorePreviewKeys(session,region);return {xml:exportRegionMusicxml(session,track,region),label:`Score for ${region.name}`,name:region.name};
}
export function scorePreviewView(track,region,session){
 const hasRegion=track?.kind==='midi'&&Boolean(region),hasScore=session&&scoreTracks(session).length>0;
 if(!hasRegion&&!hasScore)return '';
 return `<details data-score-preview><summary>Score preview</summary><div class="button-row"><label>Show<select data-score-scope><option value="region" ${!hasRegion?'disabled':''}>Selected MIDI region</option><option value="arrangement" ${!hasRegion?'selected':''}>Arrangement parts</option></select></label>${hasRegion?`<label>Selected track notation<select data-score-instrument>${Object.entries(scoreInstruments).map(([id,item])=>`<option value="${id}" ${id===(track.scoreInstrument??'concert')?'selected':''}>${item.label}</option>`).join('')}</select></label><label>Selected track clef<select data-score-clef>${["treble","bass","alto","tenor"].map(c=>`<option value="${c}" ${c===(track.scoreClef??"treble")?"selected":""}>${c[0].toUpperCase()+c.slice(1)}</option>`).join('')}</select></label>`:''}<label>Pitch display<select data-score-pitch-view><option value="written">Written pitch</option><option value="concert">Concert pitch</option></select></label><label>Score zoom<select data-score-zoom><option value="0.75">75%</option><option value="1" selected>100%</option><option value="1.25">125%</option><option value="1.5">150%</option></select></label><button type="button" data-score-download>Download displayed score</button></div><p class="muted">Click a note to edit it or a rest inside a MIDI region to add a note. Shift-click or Shift+Enter toggles notes within one region for duplicate/delete actions and agent requests. Selecting another region starts a new selection. Drag vertically or use ↑/↓ to move by staff steps in the project key; Shift+↑/↓ moves an octave. Escape cancels a drag. Delete removes the selection when the focused note belongs to it. Notation instrument changes written pitches only; note fields show sounding MIDI pitches. Blue highlights mark the transport position. Export MusicXML to continue in notation software. Arrangement view shows selected pitched MIDI tracks, including muted tracks and regions. Percussion and audio tracks are excluded.</p>${session?scorePartsView(session):''}${scoreNoteEditorView()}<output data-score-status aria-live="polite"></output><div class="daw-score-scroll"><div data-score-sheet role="group" aria-label="Score"></div></div></details>`;
}
const scoreViews=new WeakMap();
export function bindScorePreview(root,{session,track,region,execute,guard,download}){
 bindScoreSelection(root);const panel=root.querySelector('[data-score-preview]');if(!panel)return;
 const sheet=panel.querySelector('[data-score-sheet]'),status=panel.querySelector('[data-score-status]'),zoom=panel.querySelector('[data-score-zoom]'),scope=panel.querySelector('[data-score-scope]'),pitchView=panel.querySelector('[data-score-pitch-view]');
 let view=scoreViews.get(root);if(!view||view.sessionId!==session.id){view={sessionId:session.id,scope:scope.value,zoom:zoom.value,pitchMode:'written',partIds:null,top:0,left:0};scoreViews.set(root,view);}
 if([...scope.options].some(o=>o.value===view.scope&&!o.disabled))scope.value=view.scope;zoom.value=view.zoom;pitchView.value=view.pitchMode??'written';
 const choices=[...panel.querySelectorAll('[data-score-part]')],partsPanel=panel.querySelector('[data-score-parts]');
 if(view.partIds)view.partIds=view.partIds.filter(id=>choices.some(input=>input.value===id));
 for(const input of choices)input.checked=view.partIds===null||view.partIds===undefined||view.partIds.includes(input.value);
 const displayedSession=()=>scope.value==='arrangement'?scorePartView(session,view.partIds):session;
 const scroll=panel.querySelector('.daw-score-scroll');scroll.onscroll=()=>{view.top=scroll.scrollTop;view.left=scroll.scrollLeft;};
 let renderer=null,loadedScope=null,generation=0;
 const draw=async()=>{
  if(partsPanel)partsPanel.hidden=scope.value!=='arrangement';
  if(!panel.open||!panel.isConnected)return;
  const request=++generation,selectedScope=scope.value,pitchMode=pitchView.value,cacheKey=selectedScope+':'+pitchMode+':'+JSON.stringify(view.partIds);status.textContent='Preparing score…';
  try{
   const sourceSession=displayedSession(),display=scorePitchView(sourceSession,track,pitchMode);
   if(!renderer||loadedScope!==cacheKey){
    const document=scorePreviewDocument(sourceSession,track,region,selectedScope,pitchMode),module=await import('opensheetmusicdisplay');
    if(request!==generation||!panel.isConnected)return;
    const Display=module.OpenSheetMusicDisplay??module.default?.OpenSheetMusicDisplay;
    // Load into an isolated, measurable surface so an old request cannot overwrite the active score.
    const surface=sheet.ownerDocument.createElement('div');surface.style.width='900px';
    const candidate=new Display(surface,{autoResize:false,backend:'svg',drawingParameters:'compacttight',drawTitle:true,drawPartNames:true});
    await candidate.load(document.xml);
    if(request!==generation||!panel.isConnected){candidate.clear();return;}
    sheet.replaceChildren(surface);renderer=candidate;loadedScope=cacheKey;sheet.setAttribute('aria-label',document.label);
   }
   renderer.Zoom=Number(zoom.value);renderer.render();bindScoreNotes(panel,renderer,{session:display.session,track:display.track,region,scope:selectedScope,execute,guard});indexScorePosition(root,panel);scroll.scrollTop=view.top;scroll.scrollLeft=view.left;status.textContent='Score preview ready.';
  }catch(error){if(request!==generation||!panel.isConnected)return;sheet.replaceChildren();panel.querySelector('[data-score-note-editor]').hidden=true;delete panel.dataset.selectedScoreNote;delete panel.dataset.selectedScoreRegion;delete panel.dataset.selectedScoreNotes;loadedScope=null;renderer=null;status.textContent=error.message||'Unable to render this score.';}
 };
 for(const input of choices)input.onchange=()=>{view.partIds=choices.filter(c=>c.checked).map(c=>c.value);void draw();};
 const all=panel.querySelector('[data-score-all-parts]');if(all)all.onclick=()=>{view.partIds=null;choices.forEach(c=>{c.checked=true;});void draw();};
 if(partsPanel)partsPanel.hidden=scope.value!=='arrangement';
 pitchView.onchange=()=>{view.pitchMode=pitchView.value;void draw();};
 panel.querySelector('[data-score-download]').onclick=guard(()=>{const display=scorePitchView(displayedSession(),track,pitchView.value),xml=scope.value==='arrangement'?exportScoreMusicxml(display.session):exportRegionMusicxml(display.session,display.track,region);download(new Blob([xml],{type:'application/vnd.recordare.musicxml+xml'}),`${scope.value==='arrangement'?session.title:region.name||'Score'}-${pitchView.value}.musicxml`);});
 const instrument=panel.querySelector('[data-score-instrument]');if(instrument)instrument.onchange=guard(e=>execute([{op:'track.set',target:track.id,values:{scoreInstrument:e.target.value}}],'Changed score instrument notation'));
 const clef=panel.querySelector('[data-score-clef]');if(clef)clef.onchange=guard(e=>execute([{op:'track.set',target:track.id,values:{scoreClef:e.target.value}}],'Changed score clef'));
 panel.addEventListener('toggle',()=>{if(panel.open)void draw();});zoom.onchange=()=>{view.zoom=zoom.value;void draw();};scope.onchange=()=>{view.scope=scope.value;view.top=0;view.left=0;void draw();};if(panel.open)void draw();
}
