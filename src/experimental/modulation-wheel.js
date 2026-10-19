import {upperMidiTime} from './midi-controller-timeline.js';
export function scheduleModulationWheel(voice,points,localStart,when,end){if(!voice.setModulation)return;const index=upperMidiTime(points,localStart);voice.setModulation(points[index-1]?.value??0,when);for(let i=index;i<points.length&&points[i].time<end;i++)voice.setModulation(points[i].value,when+points[i].time-localStart);}
