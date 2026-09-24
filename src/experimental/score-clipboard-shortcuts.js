import {shortcutAction} from './shortcuts.js';
export function scoreClipboardShortcut(event){
 const action=shortcutAction(event);if(!['copy','cut','paste'].includes(action))return null;
 const path=event.composedPath?.()??[event.target];
 if(path.some(node=>node?.matches?.('input,textarea,select,[role=textbox],[role=combobox],[role=slider],[role=spinbutton]')||node?.isContentEditable))return null;
 if(['copy','cut'].includes(action)&&event.target?.ownerDocument?.getSelection()?.toString())return null;
 return action;
}
export function bindScoreClipboardShortcuts(panel,{selectionRoot,selection,blocked=()=>false,guard}){
 panel.tabIndex=-1;
 panel.onkeydown=guard(event=>{
  const action=scoreClipboardShortcut(event);
  if(!action||!panel.open||blocked()||panel.ownerDocument.querySelector('dialog[open],[aria-modal=true]'))return;
  event.preventDefault();event.stopPropagation();if(event.repeat)return;
  if(action==='paste'){
   const form=panel.querySelector('[data-score-paste]');if(form.hidden)throw Error('Copy score notes before pasting.');
   form.requestSubmit();
  }else{
   if(!selection().ids.length)throw Error('Select score notes first.');
   panel.querySelector(`[data-score-note-${action}]`).click();
  }
  // Cut/paste can replace the DOM. Keep subsequent shortcuts in the score area.
  if(!panel.isConnected)selectionRoot.querySelector('[data-score-preview]')?.focus({preventScroll:true});
 });
}
