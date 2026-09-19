import {z} from 'zod';
export const samplerFilterSchema=z.object({sampleFilterType:z.enum(['off','lowpass','highpass']).default('off'),sampleFilterCutoff:z.number().finite().min(20).max(20000).default(20000),sampleFilterResonance:z.number().finite().min(-20).max(30).default(0),sampleFilterKeyTrack:z.number().finite().min(0).max(1).default(0)});
export function samplerFilterConfig(settings,pitch,root,sampleRate){
 const s=samplerFilterSchema.parse(settings);if(s.sampleFilterType==='off')return null;
 if(!Number.isFinite(pitch)||!Number.isFinite(root)||!Number.isFinite(sampleRate)||sampleRate<100)throw Error('Invalid sampler filter pitch or sample rate.');
 return {type:s.sampleFilterType,frequency:Math.max(20,Math.min(20000,sampleRate/2*.9999,s.sampleFilterCutoff*2**((pitch-root)/12*s.sampleFilterKeyTrack))),resonance:s.sampleFilterResonance};
}
export function createSamplerFilter(context,settings,pitch,root){
 const config=samplerFilterConfig(settings,pitch,root,context.sampleRate);if(!config)return null;
 const filter=context.createBiquadFilter();filter.type=config.type;filter.frequency.value=config.frequency;filter.Q.value=config.resonance;return filter;
}
export function samplerFilterView(track){const s=samplerFilterSchema.parse(track);return `<fieldset class="daw-sampler-filter"><legend>Sample filter</legend><label>Filter<select name="filterType">${[['off','Off'],['lowpass','Low-pass'],['highpass','High-pass']].map(([v,label])=>`<option value="${v}" ${s.sampleFilterType===v?'selected':''}>${label}</option>`).join('')}</select></label><label>Cutoff · Hz<input name="filterCutoff" type="number" min="20" max="20000" step="any" value="${s.sampleFilterCutoff}" required></label><label>Resonance · dB<input name="filterResonance" type="number" min="-20" max="30" step="any" value="${s.sampleFilterResonance}" required></label><label>Key tracking · %<input name="filterKeyTrack" type="number" min="0" max="100" step="any" value="${s.sampleFilterKeyTrack*100}" required></label><small>12 dB/octave per voice, before the volume envelope. At 100% tracking, cutoff follows note pitch relative to the root note. Pitch bend does not move cutoff. Off preserves the original sound.</small></fieldset>`;}
