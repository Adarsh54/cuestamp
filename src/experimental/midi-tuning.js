import {z} from 'zod';
import {midiParameterState} from './midi-parameter-state.js';
const options=z.object({start:z.number().finite().min(0),channel:z.number().int().min(0).max(15).default(0),semitones:z.number().int().min(-64).max(63),cents:z.number().finite().min(-100).max(100)}).strict();
export function midiTuningPlan(region,values){
 const v=options.parse(values);if(v.start>=region.duration)throw Error('Place the tuning change before the region ends.');
 const {state,restore}=midiParameterState(region,v.start,v.channel),fine=Math.max(0,Math.min(16383,Math.round(8192+v.cents*8192/100)));
 const cents=(fine-8192)*100/8192,messages=[[101,0],[100,2],[6,v.semitones+64],[100,1],[6,fine>>7],[38,fine&127],...restore];
 return {before:state.tuningCents,cents,total:v.semitones*100+cents,events:messages.map(([parameter,value])=>({type:'controlChange',parameter,value,start:v.start,channel:v.channel}))};
}
export function midiTuningView(){return `<details data-midi-tuning-panel><summary>Channel tuning change</summary><form data-midi-tuning><label>Position in region · seconds<input name="start" type="number" min="0" step="any" value="0" required></label><label>Channel<input name="channel" type="number" min="1" max="16" step="1" value="1" required></label><label>Coarse · semitones<input name="semitones" type="number" min="-64" max="63" step="1" value="0" required></label><label>Fine · cents<input name="cents" type="number" min="-100" max="100" step="any" value="0" required></label><output></output><button>Add tuning change</button></form><p class="muted">Tunes this channel from the chosen position, including held notes. Note pitches in the piano roll stay unchanged. Fine tuning rounds to MIDI resolution; +100 cents becomes +99.9878. Later tuning messages still apply. Set both values to zero to restore equal temperament. Drums ignore tuning.</p></details>`;}
export function bindMidiTuning(root,{region,execute,guard}){
 const form=root.querySelector('[data-midi-tuning]');if(!form||!region)return;const f=form.elements,button=form.querySelector('button'),output=form.querySelector('output');
 const read=k=>f[k].value.trim()?Number(f[k].value):NaN,values=()=>({start:read('start'),channel:read('channel')-1,semitones:read('semitones'),cents:read('cents')});
 const update=()=>{try{const plan=midiTuningPlan(region,values());output.textContent=`${plan.before.toFixed(4)} → ${plan.total.toFixed(4)} cents from equal temperament. Fine tuning: ${plan.cents.toFixed(4)} cents.`;button.disabled=false;}catch(error){output.textContent=error.message;button.disabled=true;}};
 form.oninput=update;form.onsubmit=guard(e=>{e.preventDefault();update();if(!button.disabled)execute([{op:'midi.tuning',target:region.id,values:values()}],'Added channel tuning change');});update();
}
