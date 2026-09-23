import {sampleZoneTuningSchema} from './sampler-zone-voice.js';
import {z} from 'zod';
export const samplerTuningSchema=z.object({sampleTune:z.number().int().min(-48).max(48).default(0),sampleFineTune:z.number().finite().min(-100).max(100).default(0)});
export function samplerPlaybackRate(pitch,root,settings={}){const s=samplerTuningSchema.parse(settings),z=sampleZoneTuningSchema.parse(settings);return 2**((pitch-root+s.sampleTune+z.sampleZoneTune+z.sampleGroupTune+(s.sampleFineTune+z.sampleZoneFineTune+z.sampleGroupFineTune)/100)/12);}
export function samplerTuningView(track){const s=samplerTuningSchema.parse(track);return `<label>Tune · semitones<input name="tune" type="number" min="-48" max="48" step="1" value="${s.sampleTune}" required></label><label>Fine tune · cents<input name="fineTune" type="number" min="-100" max="100" step="any" value="${s.sampleFineTune}" required></label>`;}
