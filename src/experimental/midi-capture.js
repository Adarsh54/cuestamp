import {eventFromBytes} from './midi-events.js';
export function createMidiCapture(startedAt,{maxSeconds=600,maxItems=20000,chaseAtStart=false}={}){
 const notes=[],events=[],held=new Map();let noteCount=0,closed=false,chased=false,preCount=0;const preHeld=new Map(),preEvents=new Map();
 const seconds=time=>Math.max(0,Math.min(maxSeconds,(time-startedAt)/1000));
 function endNote(note,end){notes.push({...note,duration:Math.min(maxSeconds-note.start,Math.max(.001,end-note.start))});}
 function chase(){if(chased)return;chased=true;if(!chaseAtStart)return;for(const [key,queue]of preHeld){held.set(key,queue.map(n=>({...n,start:0})));noteCount+=queue.length;}events.push(...preEvents.values());preHeld.clear();preEvents.clear();}
 return {
  push(data,time){
   if(closed||!Number.isFinite(time))return false;
   const status=data?.[0],type=status>>4,channel=status&15,length=type===12||type===13?2:3;
   if(status<128||status>=240||data?.length!==length||[...data].slice(1).some(n=>!Number.isInteger(n)||n<0||n>127))return true;
   const a=data[1],b=data[2]||0,start=seconds(time),key=channel+':'+a;
   if(time<startedAt){if(!chaseAtStart||chased)return true;if(type===9&&b){if(preCount>=maxItems)return false;const queue=preHeld.get(key)||[];queue.push({id:crypto.randomUUID(),pitch:a,channel,start:0,velocity:b/127});preHeld.set(key,queue);preCount++;}else if(type===8||(type===9&&!b)){const queue=preHeld.get(key);if(queue?.length){queue.shift();preCount--;}if(!queue?.length)preHeld.delete(key);}else{const event=eventFromBytes(type,channel,a,b,0);if(event){const eventKey=type+':'+channel+':'+(type===10||type===11?a:0);if(!preEvents.has(eventKey)&&preEvents.size>=maxItems)return false;preEvents.set(eventKey,event);}}return true;}
   chase();if(time-startedAt>=maxSeconds*1000)return false;
   if(type===9&&b){
    if(noteCount>=maxItems)return false;noteCount++;
    const queue=held.get(key)||[];queue.push({id:crypto.randomUUID(),pitch:a,channel,start,velocity:b/127});held.set(key,queue);
   }else if(type===8||(type===9&&!b)){
    const queue=held.get(key),note=queue?.shift();if(note)endNote(note,start);if(!queue?.length)held.delete(key);
   }else {
    const event=eventFromBytes(type,channel,a,b,start);if(event){if(events.length>=maxItems)return false;events.push(event);}
   }
   return true;
  },
  finish(time){
   if(!closed){closed=true;if(time>=startedAt)chase();const end=seconds(time);for(const queue of held.values())for(const note of queue)endNote(note,Math.max(end,note.start));held.clear();}
   return {notes:[...notes].sort((a,b)=>a.start-b.start),events:[...events].sort((a,b)=>a.start-b.start)};
  },
  get count(){return noteCount+events.length;},
 };
}
