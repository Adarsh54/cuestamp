import {scoreTracks} from './musicxml.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function scorePartsView(session){const tracks=scoreTracks(session);return `<details data-score-parts><summary>Score parts</summary><button type="button" data-score-all-parts>Show all parts</button><div class="button-row">${tracks.map(t=>`<label><input type="checkbox" data-score-part value="${esc(t.id)}" checked>${esc(t.name)}</label>`).join('')}</div><small>Applies to arrangement view and Download displayed score. Track order is preserved.</small></details>`;}
export function scorePartView(session,ids){
 if(ids===null||ids===undefined)return session;
 if(!Array.isArray(ids)||new Set(ids).size!==ids.length)throw Error('Choose distinct score parts.');
 const eligible=scoreTracks(session),tracks=eligible.filter(t=>ids.includes(t.id));
 if(!tracks.length)throw Error('Choose at least one score part.');
 if(tracks.length!==ids.length)throw Error('A selected score part is no longer available.');
 return {...session,tracks};
}
