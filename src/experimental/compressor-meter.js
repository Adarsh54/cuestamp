export function compressorMeterView(effect){return effect.kind==='compressor'?`<div class="daw-compressor-meter" data-compressor-meter="${effect.id}" data-enabled="${effect.enabled}"><meter min="0" max="40" value="0" aria-label="Compressor gain reduction in decibels"></meter><output>${effect.enabled?'Play to measure gain reduction':'Bypassed'}</output></div>`:'';}
export function updateCompressorMeters(root,playback){
 const values=playback?.readEffectMeters?.();
 for(const el of root?.querySelectorAll('[data-compressor-meter]')||[]){
  const db=values?.get(el.dataset.compressorMeter)?.reductionDb,enabled=el.dataset.enabled==='true',valid=enabled&&Number.isFinite(db);
  el.querySelector('meter').value=valid?Math.min(40,Math.max(0,-db)):0;
  el.querySelector('output').textContent=!enabled?'Bypassed':!playback?'Play to measure gain reduction':playback.loop?'Unavailable during cycle playback':valid?`${Math.max(0,-db).toFixed(1)} dB gain reduction`:'Gain reduction unavailable';
 }
}
export function createEffectMeters(){
 const entries=new Map();let stopped=false;
 return {
  add(effect,node){if(!stopped&&effect.kind==='compressor')entries.set(effect.id,node);},
  read(){const values=new Map();if(stopped)return values;for(const [id,node]of entries)if(Number.isFinite(node.reduction))values.set(id,{reductionDb:Math.min(0,node.reduction)});return values;},
  stop(){stopped=true;entries.clear();},
 };
}
