import {z} from 'zod';
import {midiParameterState} from './midi-parameter-state.js';
const options=z.object({start:z.number().finite().min(0),channel:z.number().int().min(0).max(15).default(0),range:z.number().finite().min(0).max(96)}).strict();
export function midiBendRangePlan(region,values,defaultRange=2){
 const v=options.parse(values);if(v.start>=region.duration)throw Error('Place the range change before the region ends.');
 const {state,restore}=midiParameterState(region,v.start,v.channel,defaultRange),cents=Math.round(v.range*100);
 const messages=[[101,0],[100,0],[6,Math.floor(cents/100)],[38,cents%100],...restore];
 return {before:state.range,range:cents/100,events:messages.map(([parameter,value])=>({type:'controlChange',parameter,value,start:v.start,channel:v.channel}))};
}
export function bendRangeChangeView(){return `<details data-bend-change-panel><summary>Pitch-bend range change</summary><form data-bend-change><label>Position in region · seconds<input name="start" type="number" min="0" step="any" value="0" required></label><label>Channel<input name="channel" type="number" min="1" max="16" step="1" value="1" required></label><label>Range · ± semitones<input name="range" type="number" min="0" max="96" step="0.01" value="2" required></label><output></output><button>Add range change</button></form><p class="muted">Changes bend sensitivity from this position on this channel, including held notes. Later sensitivity events still apply. Rounded to the nearest cent. Drums ignore bends. Undo removes the entire change.</p></details>`;}
export function bindBendRangeChange(root,{track,region,execute,guard}){
 const form=root.querySelector('[data-bend-change]');if(!form||!region)return;const f=form.elements,button=form.querySelector('button'),output=form.querySelector('output');f.range.value=track.pitchBendRange??2;
 const read=k=>f[k].value.trim()?Number(f[k].value):NaN,values=()=>({start:read('start'),channel:read('channel')-1,range:read('range')});
 const update=()=>{try{const plan=midiBendRangePlan(region,values(),track.pitchBendRange);output.textContent=`±${plan.before.toFixed(2)} → ±${plan.range.toFixed(2)} semitones. Adds six MIDI controller events; existing notes and bends stay unchanged.`;button.disabled=false;}catch(error){output.textContent=error.message;button.disabled=true;}};
 form.oninput=update;form.onsubmit=guard(e=>{e.preventDefault();update();if(!button.disabled)execute([{op:'midi.bendRange',target:region.id,values:values()}],'Added pitch-bend range change');});update();
}
