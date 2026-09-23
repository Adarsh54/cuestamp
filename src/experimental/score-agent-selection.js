const bound=new WeakSet();
export function bindScoreSelection(root){
 if(bound.has(root))return;bound.add(root);
 const clear=e=>{if(e.target.closest('[data-score-preview],.daw-agent'))return;const panel=root.querySelector('[data-score-preview]');if(panel){delete panel.dataset.selectedScoreNote;delete panel.dataset.selectedScoreRegion;delete panel.dataset.selectedScoreNotes;}};
 root.addEventListener('pointerdown',clear,true);root.addEventListener('keydown',clear,true);
}
export function selectedScoreNote(root,session){
 const panel=root?.querySelector('[data-score-preview]');if(!panel?.isConnected||panel.querySelector('[data-score-note-editor]')?.hidden)return null;
 const regionId=panel.dataset.selectedScoreRegion,noteId=panel.dataset.selectedScoreNote;
 if(!noteId||!regionId)return null;
 const track=session.tracks.find(t=>t.kind==='midi'&&t.regions.some(r=>r.id===regionId&&r.notes.some(n=>n.id===noteId)));
 if(!track)return null;
 let noteIds;try{noteIds=JSON.parse(panel.dataset.selectedScoreNotes??JSON.stringify([noteId]));}catch{return null;}
 const region=track.regions.find(r=>r.id===regionId);
 if(!Array.isArray(noteIds)||!noteIds.length||!noteIds.includes(noteId)||new Set(noteIds).size!==noteIds.length||noteIds.some(id=>!region.notes.some(n=>n.id===id)))return null;
 return {trackId:track.id,regionId,noteId,...(noteIds.length>1?{noteIds}:{})};
}
