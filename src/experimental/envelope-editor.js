const limits={attack:10,decay:10,sustain:1,release:30},clamp=(value,max)=>Math.max(0,Math.min(max,value));
export function envelopeGraph(values){
 for(const [key,max]of Object.entries(limits))if(!Number.isFinite(values[key])||values[key]<0||values[key]>max)throw Error('Enter valid envelope values before editing its graph.');
 const {attack,decay,sustain,release}=values,hold=Math.max(.5,(attack+decay+release)/3),duration=Math.max(1,attack+decay+hold+release);
 return {hold,duration,points:{attack:[attack,1],decay:[attack+decay,sustain],sustain:[attack+decay+hold/2,sustain],release:[attack+decay+hold+release,0]}};
}
export function dragEnvelope(original,stage,time,level,hold){
 if(!Object.hasOwn(limits,stage)||![time,level,hold].every(Number.isFinite))throw Error('Invalid envelope gesture.');const next={...original};
 if(stage==='attack')next.attack=clamp(time,10);
 if(stage==='decay'){next.decay=clamp(time-original.attack,10);next.sustain=clamp(level,1);}
 if(stage==='sustain')next.sustain=clamp(level,1);
 if(stage==='release')next.release=clamp(time-original.attack-original.decay-hold,30);
 for(const key of Object.keys(next))if(next[key]!==original[key])next[key]=Math.round(next[key]*1000)/1000;
 return next;
}
export function keyEnvelope(original,stage,key,shift=false){
 if(!Object.hasOwn(limits,stage)||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(key))return null;
 const target=stage==='decay'&&['ArrowUp','ArrowDown'].includes(key)?'sustain':stage,step=(shift ? .1 : .01),direction=['ArrowLeft','ArrowDown'].includes(key)?-1:1;
 return {...original,[target]:key==='Home'?0:key==='End'?limits[target]:clamp(Math.round((original[target]+step*direction)*1e9)/1e9,limits[target])};
}
export function envelopeEditorView(fields,label){return `<div class="daw-envelope-editor" data-envelope-editor ${Object.entries(fields).map(([key,name])=>`data-${key}="${name}"`).join(' ')}><svg viewBox="0 0 360 150" role="group" aria-label="${label}"><path class="daw-envelope-axis" d="M24 18V126H336"/><path data-envelope-path/>${Object.keys(limits).map(stage=>`<circle data-envelope-stage="${stage}" r="7" tabindex="0" role="slider" aria-label="${stage[0].toUpperCase()+stage.slice(1)}" aria-valuemin="0" aria-valuemax="${limits[stage]}"/><text data-envelope-label="${stage}" text-anchor="middle">${stage[0].toUpperCase()}</text>`).join('')}</svg><output data-envelope-status></output><small>Drag A for attack, D for decay and sustain, S for sustain, R for release. Arrow keys adjust a focused handle; Shift makes larger steps. Escape cancels a drag. Apply the form to save.</small></div>`;}
export function bindEnvelopeEditors(root,{blocked=()=>false}={}){
 for(const container of root.querySelectorAll('[data-envelope-editor]')){
  const form=container.closest('form'),svg=container.querySelector('svg'),inputs=Object.fromEntries(Object.keys(limits).map(key=>[key,form?.elements.namedItem(container.dataset[key])])),status=container.querySelector('[data-envelope-status]');if(Object.values(inputs).some(v=>!v))continue;let drag=null;
  const read=()=>Object.fromEntries(Object.entries(inputs).map(([key,input])=>[key,input.value===''?NaN:Number(input.value)]));
  const write=values=>{for(const [key,value]of Object.entries(values))inputs[key].value=String(value);};
  const draw=()=>{let values,model;try{values=read();model=envelopeGraph(values);}catch(error){status.textContent=error.message;return;}
   const duration=drag?.duration??model.duration,hold=drag?.hold??model.hold,points=envelopeGraph(values).points;points.sustain=[values.attack+values.decay+hold/2,values.sustain];points.release=[values.attack+values.decay+hold+values.release,0];const x=t=>24+312*t/duration,y=v=>126-108*v;
   container.querySelector('[data-envelope-path]').setAttribute('d',`M24 126 L${x(points.attack[0])} 18 L${x(points.decay[0])} ${y(values.sustain)} L${x(values.attack+values.decay+hold)} ${y(values.sustain)} L${x(points.release[0])} 126`);
   for(const [stage,[time,level]]of Object.entries(points)){const handle=container.querySelector(`[data-envelope-stage="${stage}"]`),label=container.querySelector(`[data-envelope-label="${stage}"]`);handle.setAttribute('cx',String(Math.max(24,Math.min(336,x(time)))));handle.setAttribute('cy',String(y(level)));handle.setAttribute('aria-valuenow',String(values[stage]));handle.setAttribute('aria-valuetext',stage==='decay'?`${values.decay} seconds; sustain ${values.sustain}`:`${values[stage]}${stage==='sustain'?' level':' seconds'}`);handle.setAttribute('aria-disabled',String(blocked()));label.setAttribute('x',handle.getAttribute('cx'));label.setAttribute('y',String(level>.85?y(level)+22:y(level)-14));}
   status.textContent=`Illustrative sustain hold ${hold.toFixed(2)} s · ${duration.toFixed(2)} s shown`;
  };
  const finish=cancel=>{if(!drag)return;const previous=drag;drag=null;if(cancel)write(previous.values);if(svg.hasPointerCapture(previous.id))svg.releasePointerCapture(previous.id);draw();};
  svg.addEventListener('pointerdown',event=>{const handle=event.target.closest('[data-envelope-stage]');if(!handle||event.button!==0||blocked())return;let values,model;try{values=read();model=envelopeGraph(values);}catch{draw();return;}event.preventDefault();event.stopPropagation();handle.focus();drag={id:event.pointerId,stage:handle.dataset.envelopeStage,values,...model};svg.setPointerCapture(event.pointerId);});
  svg.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;if(blocked()){finish(true);return;}const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const local=point.matrixTransform(svg.getScreenCTM().inverse());write(dragEnvelope(drag.values,drag.stage,(local.x-24)/312*drag.duration,(126-local.y)/108,drag.hold));draw();});
  svg.addEventListener('pointerup',event=>{if(drag?.id===event.pointerId)finish(false);});svg.addEventListener('pointercancel',()=>finish(true));svg.addEventListener('lostpointercapture',()=>finish(true));
  svg.addEventListener('keydown',event=>{if(event.key==='Escape'&&drag){event.preventDefault();event.stopPropagation();finish(true);return;}const handle=event.target.closest('[data-envelope-stage]');if(!handle||blocked())return;let values;try{values=read();envelopeGraph(values);}catch{return;}const next=keyEnvelope(values,handle.dataset.envelopeStage,event.key,event.shiftKey);if(next){event.preventDefault();event.stopPropagation();write(next);draw();}});
  form.addEventListener('input',event=>{if(Object.values(inputs).includes(event.target))draw();});draw();
 }
}
