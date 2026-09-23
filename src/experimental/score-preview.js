import {scoreNoteEditorView,bindScoreNotes} from './score-note-editor.js';
import {compileTempoMap} from './tempo-map.js';
import {compileMeterMap} from './meter-map.js';
import {compileKeyMap} from './key-map.js';
import {exportRegionMusicxml,exportScoreMusicxml,scoreTracks} from './musicxml.js';
export function validateScorePreviewKeys(session,region){
 const tempo=compileTempoMap(session),meter=compileMeterMap(session),start=tempo.beatAtTime(region.start),end=tempo.beatAtTime(region.start+region.duration);
 for(const key of compileKeyMap(session).points){if(key.beat<=start||key.beat>=end)continue;const bar=meter.positionAtBeat(key.beat).bar;if(Math.abs(meter.barStart(bar)-key.beat)>1e-9)throw Error('This region has a mid-bar key change that the score preview cannot display accurately. Export MusicXML to view it in notation software.');}
}
export function scorePreviewDocument(session,track,region,scope){
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
 return `<details data-score-preview><summary>Score preview</summary><div class="button-row"><label>Show<select data-score-scope><option value="region" ${!hasRegion?'disabled':''}>Selected MIDI region</option><option value="arrangement" ${!hasRegion?'selected':''}>Full arrangement</option></select></label>${hasRegion?`<label>Selected track clef<select data-score-clef>${["treble","bass","alto","tenor"].map(c=>`<option value="${c}" ${c===(track.scoreClef??"treble")?"selected":""}>${c[0].toUpperCase()+c.slice(1)}</option>`).join('')}</select></label>`:''}<label>Score zoom<select data-score-zoom><option value="0.75">75%</option><option value="1" selected>100%</option><option value="1.25">125%</option><option value="1.5">150%</option></select></label></div><p class="muted">Click a note to edit it. Drag vertically or use ↑/↓ to move by staff steps in the project key; Shift+↑/↓ moves an octave. Escape cancels a drag. Export MusicXML to continue in notation software. Full arrangement shows pitched MIDI tracks, including muted tracks and regions. Percussion and audio tracks are excluded.</p>${scoreNoteEditorView()}<output data-score-status aria-live="polite"></output><div class="daw-score-scroll"><div data-score-sheet role="group" aria-label="Score"></div></div></details>`;
}
export function bindScorePreview(root,{session,track,region,execute,guard}){
 const panel=root.querySelector('[data-score-preview]');if(!panel)return;
 const sheet=panel.querySelector('[data-score-sheet]'),status=panel.querySelector('output'),zoom=panel.querySelector('[data-score-zoom]'),scope=panel.querySelector('[data-score-scope]');
 let renderer=null,loadedScope=null,generation=0;
 const draw=async()=>{
  if(!panel.open||!panel.isConnected)return;
  const request=++generation,selectedScope=scope.value;status.textContent='Preparing score…';
  try{
   if(!renderer||loadedScope!==selectedScope){
    const document=scorePreviewDocument(session,track,region,selectedScope),module=await import('opensheetmusicdisplay');
    if(request!==generation||!panel.isConnected)return;
    const Display=module.OpenSheetMusicDisplay??module.default?.OpenSheetMusicDisplay;
    // Load into an isolated, measurable surface so an old request cannot overwrite the active score.
    const surface=sheet.ownerDocument.createElement('div');surface.style.width='900px';
    const candidate=new Display(surface,{autoResize:false,backend:'svg',drawingParameters:'compacttight',drawTitle:true,drawPartNames:true});
    await candidate.load(document.xml);
    if(request!==generation||!panel.isConnected){candidate.clear();return;}
    sheet.replaceChildren(surface);renderer=candidate;loadedScope=selectedScope;sheet.setAttribute('aria-label',document.label);
   }
   renderer.Zoom=Number(zoom.value);renderer.render();bindScoreNotes(panel,renderer,{session,track,region,scope:selectedScope,execute,guard});status.textContent='Score preview ready.';
  }catch(error){if(request!==generation||!panel.isConnected)return;sheet.replaceChildren();loadedScope=null;renderer=null;status.textContent=error.message||'Unable to render this score.';}
 };
 const clef=panel.querySelector('[data-score-clef]');if(clef)clef.onchange=guard(e=>execute([{op:'track.set',target:track.id,values:{scoreClef:e.target.value}}],'Changed score clef'));
 panel.addEventListener('toggle',()=>{if(panel.open)void draw();});zoom.onchange=()=>void draw();scope.onchange=()=>void draw();if(panel.open)void draw();
}
