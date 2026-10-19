import {z} from 'zod';
import {isOscillator} from './synth-envelope.js';
export const synthTuningSchema=z.object({synthTranspose:z.number().int().min(-48).max(48).default(0),synthFineTune:z.number().finite().min(-100).max(100).default(0)});
export function synthFrequency(pitch,settings={}){
 if(!Number.isFinite(pitch)||pitch<0||pitch>127)throw Error('Invalid synth note pitch.');
 const s=synthTuningSchema.parse(settings);return 440*2**((pitch-69+s.synthTranspose+s.synthFineTune/100)/12);
}
export function synthTuningView(track){if(track?.kind!=='midi'||!isOscillator(track.instrument))return '';const s=synthTuningSchema.parse(track);return `<form data-synth-tuning><fieldset class="daw-sampler-filter"><legend>Synth tuning</legend><label>Transpose · semitones<input name="synthTranspose" type="number" min="-48" max="48" step="1" value="${s.synthTranspose}" required></label><label>Fine tune · cents<input name="synthFineTune" type="number" min="-100" max="100" step="any" value="${s.synthFineTune}" required></label><small>Tunes this instrument without moving MIDI notes. Pitch bend adds to this tuning. Filter key tracking still follows the written note. Audio exports include tuning; MIDI files retain the original notes.</small><button type="submit">Apply synth tuning</button></fieldset></form>`;}
export function bindSynthTuning(root,{track,execute,guard,blocked}){const form=root.querySelector('[data-synth-tuning]');if(!form)return;form.onsubmit=guard(event=>{event.preventDefault();if(blocked())throw Error('Finish the current operation before tuning the synth.');const values=Object.fromEntries(Object.keys(synthTuningSchema.shape).map(key=>[key,Number(form.elements.namedItem(key).value)]));execute([{op:'track.set',target:track.id,values}],'Updated synth tuning');});}
