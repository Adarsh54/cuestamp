import {z} from 'zod';
export const zoneVoiceSchema=z.object({gainDb:z.number().finite().min(-60).max(24).default(0),pan:z.number().finite().min(-1).max(1).default(0),tune:z.number().int().min(-48).max(48).default(0),fineTune:z.number().finite().min(-100).max(100).default(0)});
export const zoneVoicePatchSchema=z.object(Object.fromEntries(Object.entries(zoneVoiceSchema.shape).map(([key,schema])=>[key,schema.removeDefault().optional()])));
export const sampleZoneTuningSchema=z.object({sampleZoneTune:zoneVoiceSchema.shape.tune,sampleZoneFineTune:zoneVoiceSchema.shape.fineTune});
export function sampleZoneLevel(settings={}){return 10**(zoneVoiceSchema.shape.gainDb.parse(settings.sampleZoneGainDb)/20);}
export function connectSampleZone(context,input,destination,settings={}){const pan=zoneVoiceSchema.shape.pan.parse(settings.sampleZonePan);if(!pan){input.connect(destination);return null;}const node=context.createStereoPanner();node.pan.value=pan;input.connect(node).connect(destination);return node;}
