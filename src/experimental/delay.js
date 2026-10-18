import {connectPingPong} from './ping-pong.js';
import {syncedDelayTiming,scheduleSyncedDelay} from './delay-timing.js';
import {scheduleEffectParameter} from './effect-automation.js';
export function connectDelay(context,input,effect,nodes,{position=0,base=context.currentTime,tempo=120,tempoChanges=[],register}={}){
 if(effect.mode==='pingPong')return connectPingPong(context,input,effect,nodes,{position,base,tempo,tempoChanges,register});
 const timing={tempo,tempoChanges},maximum=effect.sync?syncedDelayTiming(effect,timing).maximum:2;
 const delay=()=>{const node=context.createDelay(maximum);if(effect.sync)scheduleSyncedDelay(node.delayTime,effect,timing,position,base);else{register?.(effect,'time',node.delayTime,v=>v,false);scheduleEffectParameter(node.delayTime,effect,'time',position,base);}nodes.push(node);return node;};
 const feedback=()=>{const gain=context.createGain();register?.(effect,'feedback',gain.gain,v=>v,false);scheduleEffectParameter(gain.gain,effect,'feedback',position,base);nodes.push(gain);return gain;};
 const left=delay(),firstFeedback=feedback();
 input.connect(left);left.connect(firstFeedback).connect(left);return left;
}
