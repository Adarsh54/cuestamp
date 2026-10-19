import {z} from 'zod';
import {samplerFilterSchema,createSamplerFilter} from './sampler-filter.js';
import {isOscillator} from './synth-envelope.js';
import {envelopeEditorView} from './envelope-editor.js';
// Reuse the tested per-voice filter DSP, with independent synth patch settings.
const pairs=Object.keys(samplerFilterSchema.shape).map(key=>[key,key.replace(/^sample/,'synth')]);
export const synthFilterSchema=z.object(Object.fromEntries(pairs.map(([source,key])=>[key,samplerFilterSchema.shape[source]])));
export const synthFilterKeys=Object.keys(synthFilterSchema.shape);
export function synthFilterSettings(settings={}){const s=synthFilterSchema.parse(settings);return Object.fromEntries(pairs.map(([source,key])=>[source,s[key]]));}
export function createSynthFilter(context,settings,pitch,timing){return createSamplerFilter(context,synthFilterSettings(settings),pitch,60,timing);}
export function synthFilterView(track){
 if(track?.kind!=='midi'||!isOscillator(track.instrument))return '';
 const s=synthFilterSchema.parse(track),fields=[['synthFilterCutoff','Cutoff · Hz',20,20000],['synthFilterResonance','Resonance · dB',-20,30],['synthFilterKeyTrack','Key tracking · %',0,100,100],['synthFilterVelocity','Velocity sensitivity · %',0,100,100],['synthFilterEnvDepth','Envelope depth · semitones',-96,96],['synthFilterAttack','Attack · seconds',0,10],['synthFilterDecay','Decay · seconds',0,10],['synthFilterSustain','Sustain · 0–1',0,1],['synthFilterRelease','Release · seconds',0,30]];
 return `<form data-synth-filter><fieldset class="daw-sampler-filter"><legend>Synth filter</legend><label>Filter<select name="synthFilterType">${[['off','Off'],['lowpass','Low-pass'],['highpass','High-pass']].map(([value,label])=>`<option value="${value}" ${s.synthFilterType===value?'selected':''}>${label}</option>`).join('')}</select></label>${fields.map(([key,label,min,max,scale=1])=>`<label>${label}<input name="${key}" type="number" min="${min}" max="${max}" step="any" value="${s[key]*scale}" required></label>`).join('')}${envelopeEditorView({attack:'synthFilterAttack',decay:'synthFilterDecay',sustain:'synthFilterSustain',release:'synthFilterRelease'},'Synth filter envelope graph')}<small>12 dB/octave per note, before the volume envelope. Cutoff is referenced to C4 (MIDI 60); 100% key tracking follows note pitch. Positive depth opens the filter; negative depth closes it. At 100% velocity sensitivity softer notes use less depth. Pitch bend does not move cutoff. The volume envelope still determines how long each note sounds.</small><button type="submit">Apply synth filter</button></fieldset></form>`;
}
export function bindSynthFilter(root,{track,execute,guard,blocked}){
 const form=root.querySelector('[data-synth-filter]');if(!form)return;
 form.onsubmit=guard(event=>{event.preventDefault();if(blocked())throw Error('Finish the current operation before editing the synth filter.');const values=Object.fromEntries(synthFilterKeys.map(key=>[key,key==='synthFilterType'?form.elements.namedItem(key).value:Number(form.elements.namedItem(key).value)/(['synthFilterKeyTrack','synthFilterVelocity'].includes(key)?100:1)]));execute([{op:'track.set',target:track.id,values}],'Updated synth filter');});
}
