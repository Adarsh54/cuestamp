export const trackColors=[['Green','#20c978'],['Blue','#6488ed'],['Purple','#a77be8'],['Pink','#e778aa'],['Red','#e87676'],['Orange','#e7a25e'],['Yellow','#d7c663'],['Teal','#55bac6']];
export const trackColorStyle=track=>/^#[0-9a-f]{6}$/i.test(track.color||'')?`--daw-track-color:${track.color};`:'';
export function trackColorView(track){return `<fieldset class="daw-track-color"><legend>Track color</legend><div>${trackColors.map(([name,color])=>`<button type="button" data-track-color-choice="${color}" aria-label="${name} track color" aria-pressed="${track.color?.toLowerCase()===color}" style="--swatch:${color}"></button>`).join('')}<label>Custom<input type="color" data-track-color-custom value="${/^#[0-9a-f]{6}$/i.test(track.color||'')?track.color:'#20c978'}" aria-label="Custom track color"></label><button type="button" data-track-color-reset ${track.color?'':'disabled'}>Default color</button></div></fieldset>`;}
export function bindTrackColor(root,{track,execute,guard,blocked=()=>false}){
 if(!track)return;const set=color=>{if(blocked())throw Error('Finish the current operation before changing track color.');if((track.color??null)===color)return;execute([{op:'track.set',target:track.id,values:{color}}],'Updated track color');};
 root.querySelectorAll('[data-track-color-choice]').forEach(button=>button.onclick=guard(()=>set(button.dataset.trackColorChoice)));
 const input=root.querySelector('[data-track-color-custom]');if(input)input.onchange=guard(()=>set(input.value));
 const reset=root.querySelector('[data-track-color-reset]');if(reset)reset.onclick=guard(()=>set(null));
}
