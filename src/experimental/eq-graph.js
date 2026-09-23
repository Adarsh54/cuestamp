import {eqHasGain} from './eq-modes.js';
export {eqHasGain} from './eq-modes.js';
import {effectSchema} from './effects.js';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const eqPlot={left:42,top:14,width:500,height:180};
export const eqFrequencyX=f=>eqPlot.left+clamp(Math.log10(f/20)/3,0,1)*eqPlot.width;
export const eqGainY=db=>eqPlot.top+(24-clamp(db,-24,24))/48*eqPlot.height;
export function eqPointValues(effect,x,y){return {frequency:clamp(20*10**(clamp((x-eqPlot.left)/eqPlot.width,0,1)*3),20,20000),...(eqHasGain(effect.type)?{gainDb:clamp(24-(y-eqPlot.top)/eqPlot.height*48,-24,24)}:{})};}
export function eqKeyboardValues(effect,key,fine=false){const direction=['ArrowRight','ArrowUp'].includes(key)?1:-1;if(['ArrowLeft','ArrowRight'].includes(key))return {frequency:clamp(effect.frequency*2**(direction/(fine?48:12)),20,20000)};if(['ArrowUp','ArrowDown'].includes(key)&&eqHasGain(effect.type))return {gainDb:clamp(effect.gainDb+direction*(fine?.1:.5),-24,24)};return null;}
const contexts=new Map();
export function eqResponse(effect,sampleRate=48000,frequencies){
 const e=effectSchema.parse(effect);if(e.kind!=='eq')throw Error('Choose an EQ insert.');
 if(!contexts.has(sampleRate))contexts.set(sampleRate,new OfflineAudioContext(1,1,sampleRate));
 if(frequencies===undefined){const center=Math.min(e.frequency,sampleRate/2-1);frequencies=[...Array.from({length:181},(_,i)=>20*10**(i/180*3)),...[-2,-1,-.5,-.25,0,.25,.5,1,2].map(offset=>center+offset*center/e.q)].filter(f=>f>=20&&f<=20000).sort((a,b)=>a-b);}
 frequencies=Float32Array.from(frequencies).filter(f=>f>=0&&f<sampleRate/2);
 const filter=contexts.get(sampleRate).createBiquadFilter();filter.type=e.type;filter.frequency.value=Math.min(e.frequency,sampleRate/2-1);filter.Q.value=e.q;filter.gain.value=e.gainDb;
 const magnitude=new Float32Array(frequencies.length),phase=new Float32Array(frequencies.length);filter.getFrequencyResponse(frequencies,magnitude,phase);filter.disconnect();
 return Array.from(frequencies,(frequency,i)=>({frequency,db:e.enabled?20*Math.log10(Math.max(1e-12,magnitude[i])):0}));
}
export function eqGraphView(effect){return effect.kind==='eq'?`<div class="daw-eq-graph" data-eq-graph="${effect.id}"><svg viewBox="0 0 556 220" data-eq-plot tabindex="0" role="group" aria-label="EQ response editor. Left and right arrows change frequency; up and down change gain. Shift makes smaller changes.">${[-24,-12,0,12,24].map(db=>`<line x1="42" x2="542" y1="${eqGainY(db)}" y2="${eqGainY(db)}" class="eq-grid"/><text x="35" y="${eqGainY(db)+4}" text-anchor="end">${db>0?'+':''}${db}</text>`).join('')}${[20,100,1000,10000,20000].map(f=>`<line x1="${eqFrequencyX(f)}" x2="${eqFrequencyX(f)}" y1="14" y2="194" class="eq-grid"/><text x="${eqFrequencyX(f)}" y="212" text-anchor="middle">${f>=1000?f/1000+'k':f}</text>`).join('')}<defs><clipPath id="eq-clip-${effect.id}"><rect x="42" y="14" width="500" height="180"/></clipPath></defs><path data-eq-curve clip-path="url(#eq-clip-${effect.id})"/><circle data-eq-handle r="6"/></svg><output data-eq-readout></output><small data-eq-caption></small><small>Drag to apply frequency and gain. For low/high-pass, notch and band-pass filters, drag horizontally; gain is unused. Use Q for resonance or bandwidth. Escape cancels a drag. Arrow keys edit; Shift makes smaller changes.</small></div>`:'';}
export function bindEqGraphs(root,{effects,execute,guard,sampleRate=48000,blocked=()=>false,revision}){
 for(const effect of effects.filter(e=>e.kind==='eq')){
  const graph=root.querySelector(`[data-eq-graph="${effect.id}"]`);if(!graph)continue;const form=graph.closest('form'),svg=graph.querySelector('svg'),curve=graph.querySelector('[data-eq-curve]'),handle=graph.querySelector('circle'),readout=graph.querySelector('output'),caption=graph.querySelector('[data-eq-caption]');let drag=null;
  const read=()=>effectSchema.parse({...effect,...Object.fromEntries([...form.querySelectorAll('[name]')].map(el=>[el.name,el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?NaN:Number(el.value)):el.value]))});
  const update=()=>{try{const e=read(),response=eqResponse(e,sampleRate);curve.setAttribute('d',response.map((p,i)=>`${i?'L':'M'}${eqFrequencyX(p.frequency).toFixed(2)},${(eqPlot.top+(24-p.db)/48*eqPlot.height).toFixed(2)}`).join(' '));handle.setAttribute('cx',eqFrequencyX(e.frequency));handle.setAttribute('cy',eqGainY(eqHasGain(e.type)?e.gainDb:0));readout.textContent=`${e.frequency.toFixed(1)} Hz · ${eqHasGain(e.type)?e.gainDb.toFixed(1)+' dB · ':''}Q ${e.q.toFixed(2)}${e.enabled?'':' · Bypassed'}`;caption.textContent=`Static response · ${sampleRate/1000} kHz.${e.automation.length?' Automation overrides these static settings during playback.':''}`;svg.setAttribute('aria-disabled',String(blocked()));return e;}catch{curve.setAttribute('d','');readout.textContent='Enter valid EQ settings to preview the response.';svg.setAttribute('aria-disabled','true');return null;}};
  const set=values=>{for(const [key,value]of Object.entries(values))form.elements[key].value=Number(value.toFixed(6));update();};
  const apply=()=>{if(blocked()||!svg.isConnected)return;const e=read(),{id,kind,automation,...values}=e;if(Object.keys(values).some(key=>values[key]!==effect[key]))execute([{op:'effect.set',target:effect.id,values}],'Adjusted EQ graph',revision);};
  const finish=commit=>{if(!drag)return;const previous=drag;drag=null;previous.observer.disconnect();window.removeEventListener('blur',cancel);if(!commit){for(const [key,value]of Object.entries(previous.values))form.elements[key].value=value;update();}if(svg.hasPointerCapture(previous.id))svg.releasePointerCapture(previous.id);if(commit)void guard(apply)();};
  const cancel=()=>finish(false);
  const move=e=>{if(!drag||e.pointerId!==drag.id)return;const box=svg.getBoundingClientRect(),x=(e.clientX-box.left)*556/box.width,y=(e.clientY-box.top)*220/box.height;set(eqPointValues(drag.effect,x,y));};
  svg.onpointerdown=e=>{if(e.button!==0||drag||blocked())return;const current=update();if(!current)return;e.preventDefault();svg.focus({preventScroll:true});const observer=new MutationObserver(()=>{if(!svg.isConnected)cancel();});drag={id:e.pointerId,effect:current,values:Object.fromEntries(['frequency','gainDb'].map(k=>[k,form.elements[k].value])),observer};observer.observe(root.ownerDocument,{childList:true,subtree:true});window.addEventListener('blur',cancel);svg.setPointerCapture(e.pointerId);move(e);};
  svg.onpointermove=move;svg.onpointerup=e=>{if(e.pointerId===drag?.id){move(e);finish(true);}};svg.onpointercancel=cancel;svg.onlostpointercapture=cancel;
  svg.onkeydown=guard(e=>{if(e.key==='Escape'&&drag){e.preventDefault();cancel();return;}if(drag||blocked()||e.ctrlKey||e.metaKey||e.altKey)return;const current=update();if(!current)return;const values=eqKeyboardValues(current,e.key,e.shiftKey);if(!values)return;e.preventDefault();e.stopPropagation();set(values);apply();root.querySelector(`[data-eq-graph="${effect.id}"] svg`)?.focus({preventScroll:true});});
  form.addEventListener('input',update);form.addEventListener('change',update);update();
 }
}
