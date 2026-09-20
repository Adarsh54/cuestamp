import {createPitchBendState} from './pitch-bend-state.js';
// Read the state after existing same-time events; inserted messages follow them.
export function midiParameterState(region,start,channel,defaultRange=2){
 const state=createPitchBendState(defaultRange),rpn=[127,127],nrpn=[127,127];let registered=true;
 for(const e of [...region.events].filter(e=>e.channel===channel&&e.start<=start).sort((a,b)=>a.start-b.start)){
  state.push(e);if(e.type!=='controlChange')continue;
  const p=e.parameter;if(p===101||p===100){rpn[p===101?0:1]=e.value;registered=true;}if(p===99||p===98){nrpn[p===99?0:1]=e.value;registered=false;}if(p===121){rpn[0]=rpn[1]=nrpn[0]=nrpn[1]=127;registered=true;}
 }
 return {state,restore:registered?[[101,rpn[0]],[100,rpn[1]]]:[[99,nrpn[0]],[98,nrpn[1]]]};
}
