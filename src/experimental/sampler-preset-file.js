import {exportArchive,importArchive} from './archive.js';
import {newSession} from './session.js';
import {samplerPresetSchema} from './sampler-presets.js';
export const samplerPresetArchiveLimit=523*1024*1024;
export async function exportSamplerPresetFile(preset,files){const copy=samplerPresetSchema.parse(structuredClone(preset));return exportArchive({...newSession(),title:copy.name,samplerPresets:[copy]},files,undefined,{format:'cuestamp-sampler'});}
export async function importSamplerPresetFile(data){if(data.byteLength>samplerPresetArchiveLimit)throw Error('Sampler archive is too large.');const {session,records}=await importArchive(data,{format:'cuestamp-sampler'});return {preset:{...session.samplerPresets[0],id:crypto.randomUUID()},records};}
export const samplerPresetFilename=preset=>(preset.name.replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'instrument')+'.cuestamp-sampler.zip';
