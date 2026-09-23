const positions=new WeakMap();
export function updateScorePosition(root,time){
 let state=positions.get(root);if(!state){state={time:null,events:[],index:0,active:new Set(),panel:null};positions.set(root,state);}
 const previous=new Set(state.active),rewind=time===null||state.time===null||time<state.time;
 if(rewind){state.index=0;state.active.clear();}
 state.time=time;
 if(time!==null&&Number.isFinite(time)&&state.panel?.isConnected){
  while(state.index<state.events.length&&state.events[state.index].time<=time){const event=state.events[state.index++];if(event.start)state.active.add(event.element);else state.active.delete(event.element);}
 }
 for(const element of previous)if(!state.active.has(element))element.removeAttribute('data-score-current');
 for(const element of state.active)if(!previous.has(element))element.setAttribute('data-score-current','true');
}
export function indexScorePosition(root,panel){
 const time=positions.get(root)?.time??null;
 const events=[...panel.querySelectorAll('[data-score-start]')].flatMap(element=>[{time:Number(element.dataset.scoreStart),start:true,element},{time:Number(element.dataset.scoreEnd),start:false,element}]).filter(e=>Number.isFinite(e.time)).sort((a,b)=>a.time-b.time||Number(a.start)-Number(b.start));
 positions.set(root,{time:null,events,index:0,active:new Set(),panel});updateScorePosition(root,time);
}
