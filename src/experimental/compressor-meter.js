export function compressorMeterView(effect){return ['compressor','gate','limiter'].includes(effect.kind)?`<div class="daw-compressor-meter" data-compressor-meter="${effect.id}" data-enabled="${effect.enabled}" data-duck="${effect.kind==='gate'&&effect.mode==='duck'}"><meter min="0" max="${effect.kind==='gate'?96:40}" value="0" aria-label="${effect.kind==='gate'?(effect.mode==='duck'?'Ducker':'Noise gate'):effect.kind==='limiter'?'Limiter':'Compressor'} gain reduction in decibels"></meter><output>${effect.enabled?'Play to measure gain reduction':'Bypassed'}</output></div>`:'';}
export function updateCompressorMeters(root,playback){
 const values=playback?.readEffectMeters?.();
 for(const el of root?.querySelectorAll('[data-compressor-meter]')||[]){
  const peaks=values?.get(el.dataset.compressorMeter)?.outputPeaksDbtp,db=values?.get(el.dataset.compressorMeter)?.reductionDb,enabled=el.dataset.enabled==='true',valid=enabled&&Number.isFinite(db);
  el.querySelector('meter').value=valid?Math.min(Number(el.querySelector('meter').max),Math.max(0,-db)):0;
  el.querySelector('output').textContent=!enabled?'Bypassed':!playback?'Play to measure gain reduction':playback.loop?'Unavailable during cycle playback':valid?`${typeof values?.get(el.dataset.compressorMeter)?.open==='boolean'?(el.dataset.duck==='true'?(values.get(el.dataset.compressorMeter).open?'Ducking · ':'Recovering / idle · '):(values.get(el.dataset.compressorMeter).open?'Open · ':'Closed · ')):''}${Math.max(0,-db).toFixed(1)} dB gain reduction${peaks?' · estimated output '+(peaks.some(v=>v!==null)?Math.max(...peaks.filter(v=>v!==null)).toFixed(1):'−∞')+' dBTP':''}`:'Gain reduction unavailable';
 }
}
export function createEffectMeters(){
 const entries=new Map();let stopped=false;
 return {
  add(effect,node){if(!stopped&&['compressor','gate','limiter'].includes(effect.kind))entries.set(effect.id,{node,kind:effect.kind});},
  read(){const values=new Map();if(stopped)return values;for(const [id,{node,kind}]of entries)if(Number.isFinite(node.reduction))values.set(id,{reductionDb:Math.min(0,node.reduction),...(kind==='gate'?{open:Boolean(node.gateOpen)}:{}),...(kind==='limiter'&&Array.isArray(node.outputPeaksDbtp)&&node.outputPeaksDbtp.length===2&&node.outputPeaksDbtp.every(v=>v===null||Number.isFinite(v))?{outputPeaksDbtp:[...node.outputPeaksDbtp]}:{})});return values;},
  stop(){stopped=true;entries.clear();},
 };
}
