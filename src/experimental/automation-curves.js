import {z} from 'zod';
export const automationShape=z.enum(['linear','hold','smooth','easeIn','easeOut']);
export const curveShapeOptions=[['linear','Linear'],['hold','Hold / step'],['smooth','Smooth'],['easeIn','Ease in'],['easeOut','Ease out']];
const curve=(shape,t)=>shape==='smooth'?t*t*(3-2*t):shape==='easeIn'?t*t:shape==='easeOut'?1-(1-t)**2:t;
// A fixed 64-segment approximation is shared by rendering, seeking, graphs and
// LFO phase integration. Breakpoints do not depend on the playback start time.
export function automationSegments(points,parameter){
 const ordered=points.filter(p=>p.parameter===parameter).sort((a,b)=>a.time-b.time),unique=[];
 for(const p of ordered){if(unique.at(-1)?.time===p.time)unique[unique.length-1]=p;else unique.push(p);}
 const out=[];for(let i=0;i<unique.length;i++){const a=unique[i],b=unique[i+1];out.push(a);if(b&&['smooth','easeIn','easeOut'].includes(a.shape))for(let j=1;j<64;j++){const t=j/64;out.push({parameter,time:a.time+(b.time-a.time)*t,value:a.value+(b.value-a.value)*curve(a.shape,t),shape:'linear'});}}
 return out;
}
export function orderedAutomationValue(points,time,fallback){if(!points.length)return fallback;if(time<points[0].time)return points[0].value;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(time<b.time)return a.shape==='hold'?a.value:a.value+(b.value-a.value)*(time-a.time)/(b.time-a.time);}return points.at(-1).value;}
export function curveAutomationValue(points,parameter,time,fallback){return orderedAutomationValue(automationSegments(points,parameter),time,fallback);}
export function scheduleCurveAutomation(param,points,parameter,position,base,fallback,transform=v=>v,exponential=false){
 const ordered=automationSegments(points,parameter);param.setValueAtTime(transform(orderedAutomationValue(ordered,position,fallback)),base);
 for(let i=0;i<ordered.length;i++){const p=ordered[i];if(p.time<=position)continue;const t=base+p.time-position,previous=ordered[i-1];if(!previous||previous.shape==='hold')param.setValueAtTime(transform(p.value),t);else if(exponential)param.exponentialRampToValueAtTime(transform(p.value),t);else param.linearRampToValueAtTime(transform(p.value),t);}
}
export function integrateAutomation(points,parameter,end,fallback){
 const ordered=automationSegments(points,parameter);if(!ordered.length)return end*fallback;let sum=Math.min(end,ordered[0].time)*ordered[0].value;
 for(let i=1;i<ordered.length;i++){const a=ordered[i-1],b=ordered[i];if(end<=a.time)return sum;const stop=Math.min(end,b.time),last=a.shape==='hold'?a.value:a.value+(b.value-a.value)*(stop-a.time)/(b.time-a.time);sum+=(a.value+last)/2*(stop-a.time);if(end<=b.time)return sum;}
 return sum+Math.max(0,end-ordered.at(-1).time)*ordered.at(-1).value;
}
