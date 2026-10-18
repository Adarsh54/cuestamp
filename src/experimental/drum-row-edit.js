import {z} from 'zod';
import {patternBar} from './pattern-bars.js';
import {regionBeatTiming} from './tempo-map.js';
export function editDrumRow(region,session,values){
 const base={bar:z.number().int().min(1),pitch:z.number().int().min(0).max(127)};
 const actions={fill:z.object({...base,action:z.literal('fill'),every:z.number().int().min(1).max(128),offset:z.number().int().min(0).max(127).default(0),velocity:z.number().int().min(1).max(127)}).strict(),clear:z.object({...base,action:z.literal('clear')}).strict(),mute:z.object({...base,action:z.literal('mute')}).strict(),unmute:z.object({...base,action:z.literal('unmute')}).strict(),velocity:z.object({...base,action:z.literal('velocity'),velocity:z.number().int().min(1).max(127)}).strict()};
 if(!actions[values.action])throw Error('Choose Fill, Clear, Mute, Unmute or Set velocity.');
 const v=actions[values.action].parse(values),pattern=patternBar(region,session,v.bar-1),timing=regionBeatTiming(region,session);
 if(pattern.index!==v.bar-1)throw Error('Choose a bar inside this region.');
 if(v.action==='fill'&&v.offset>=v.every)throw Error('The starting offset must be smaller than the fill interval.');
 const cells=pattern.cells.filter(c=>c.time<region.duration),first=cells[0],last=cells.at(-1);
 if(!first||!last)throw Error('Choose a bar inside this region.');
 const end=Math.min(region.duration,last.time+timing.durationAtBeat(timing.beatAtTime(last.time),last.beats));
 const hits=region.notes.filter(n=>n.pitch===v.pitch&&(n.channel??0)===9&&n.start>=first.time&&n.start<end);
 if(['mute','unmute','velocity'].includes(v.action))return hits.map(n=>({op:'note.set',target:n.id,values:v.action==='velocity'?{velocity:v.velocity/127}:{mute:v.action==='mute'}}));
 const commands=hits.map(n=>({op:'note.delete',target:n.id}));
 if(v.action==='fill')for(let i=v.offset;i<cells.length;i+=v.every){const cell=cells[i],duration=Math.min(region.duration-cell.time,timing.durationAtBeat(timing.beatAtTime(cell.time),cell.beats));commands.push({op:'note.add',target:region.id,values:{pitch:v.pitch,channel:9,start:cell.time,duration,velocity:v.velocity/127}});}
 return commands;
}
