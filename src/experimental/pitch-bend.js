import {z} from 'zod';
export const pitchBendRangeSchema=z.number().finite().min(0).max(96).default(2);
export function pitchBendCents(value,range=2){
 if(!Number.isFinite(range)||range<0||range>128.27)throw Error('Invalid pitch-bend sensitivity.');const semitones=range;
 if(!Number.isInteger(value)||value<0||value>16383)throw Error('Pitch bend must be a 14-bit MIDI value.');
 return (value-8192)/(value<8192?8192:8191)*semitones*100;
}
export function pitchBendView(track){return track?.kind==='midi'?`<form data-pitch-bend-range class="daw-cycle"><label>Pitch-bend range · ± semitones<input name="range" type="number" min="0" max="96" step="any" required value="${track.pitchBendRange??2}"></label><button>Apply bend range</button><small>Applies to synth and sampler playback, export audio, and MIDI monitoring. RPN 0 messages override this default per MIDI channel. Drums ignore bends. MIDI files retain raw bend events; match this range in your external instrument.</small></form>`:'';}
export function bindPitchBend(root,{track,execute,guard}){const form=root.querySelector('[data-pitch-bend-range]');if(form)form.onsubmit=guard(event=>{event.preventDefault();if(!form.elements.range.value.trim())throw Error('Enter a pitch-bend range.');execute([{op:'track.set',target:track.id,values:{pitchBendRange:pitchBendRangeSchema.parse(Number(form.elements.range.value))}}],'Updated pitch-bend range');});}
