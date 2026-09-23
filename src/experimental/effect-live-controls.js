import {effectParameters} from './effect-automation.js';
export function effectLiveControls(effect,esc,mode='static'){
 const trim=mode.startsWith('trim');
 return `<details data-effect-live-panel="${esc(effect.id)}"><summary>Live controls · ${esc(effect.kind)}</summary><p class="muted">Uses the mixer Fader mode. Touch returns on release; Latch holds until Stop. Trim offsets the saved curve. Write selected channel does not record effects. Bypassed effects and tempo-synced free rate are unavailable.</p><div class="daw-effect-fields">${Object.entries(effectParameters[effect.kind]).map(([parameter,spec])=>{
  const disabled=!effect.enabled||mode==='write'||(effect.sync&&parameter==='rate');
  return `<label>${esc(spec.label)}${trim?' · offset':''}<output>${trim?0:effect[parameter]}</output><input type="range" data-effect-live="${esc(effect.id)}" data-effect-parameter="${parameter}" min="${trim?-(spec.max-spec.min):spec.min}" max="${trim?spec.max-spec.min:spec.max}" step="${spec.step}" value="${trim?0:effect[parameter]}" aria-label="${esc(effect.kind+' '+spec.label)}" ${disabled?'disabled':''}></label>`;
 }).join('')}</div></details>`;
}
