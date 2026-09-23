const loads=new WeakMap(),ready=new WeakSet();
export function prepareLiveLoudness(context){
 if(!context.audioWorklet)return Promise.resolve(false);
 if(!loads.has(context))loads.set(context,(async()=>{try{const {default:url}=await import('./live-loudness.worklet.js?worker&url');await context.audioWorklet.addModule(url);ready.add(context);return true;}catch{return false;}})());
 return loads.get(context);
}
export function createLiveLoudness(context,source,{startTime=context.currentTime}={}){
 if(!ready.has(context))return null;
 let node,sink,closed=false,value={momentaryLufs:null,shortTermLufs:null};
 try{
  node=new AudioWorkletNode(context,'cuestamp-live-loudness',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],channelCount:2,channelCountMode:'explicit',processorOptions:{startTime}});
  sink=context.createGain();sink.gain.value=0;node.connect(sink).connect(context.destination);source.connect(node);
  node.port.onmessage=event=>{if(!closed)value=event.data;};node.onprocessorerror=()=>{value={unavailable:true};};
  return {read:()=>value,stop(){if(closed)return;closed=true;node.port.onmessage=null;node.port.postMessage('stop');node.port.close();source.disconnect(node);node.disconnect();sink.disconnect();}};
 }catch{try{source.disconnect(node);}catch{}node?.disconnect();sink?.disconnect();return null;}
}
export function updateLiveLoudness(root,values){
 const value=values&&[...values.values()].find(v=>v.loudness)?.loudness,format=v=>v===null?'—':v.toFixed(1)+' LUFS';
 for(const output of root?.querySelectorAll('[data-live-loudness]')||[])output.textContent=!values?'Live loudness · Play to measure':!value||value.unavailable?'Live loudness unavailable':`Live loudness · Momentary ${format(value.momentaryLufs)} · Short-term ${format(value.shortTermLufs)}`;
}
