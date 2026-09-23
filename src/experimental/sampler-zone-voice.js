import {z} from 'zod';
export const zoneVoiceSchema=z.object({gainDb:z.number().finite().min(-60).max(24).default(0),pan:z.number().finite().min(-1).max(1).default(0),tune:z.number().int().min(-48).max(48).default(0),fineTune:z.number().finite().min(-100).max(100).default(0)});
export const zoneVoicePatchSchema=z.object(Object.fromEntries(Object.entries(zoneVoiceSchema.shape).map(([key,schema])=>[key,schema.removeDefault().optional()])));
export const sampleZoneTuningSchema=z.object({sampleZoneTune:zoneVoiceSchema.shape.tune,sampleZoneFineTune:zoneVoiceSchema.shape.fineTune,sampleGroupTune:zoneVoiceSchema.shape.tune,sampleGroupFineTune:zoneVoiceSchema.shape.fineTune});
export function sampleZoneLevel(settings={}){return 10**((zoneVoiceSchema.shape.gainDb.parse(settings.sampleZoneGainDb)+zoneVoiceSchema.shape.gainDb.parse(settings.sampleGroupGainDb))/20);}
export function connectSampleZone(context,input,destination,settings={}){const pan=zoneVoiceSchema.shape.pan.parse(settings.sampleZonePan);if(!pan&&!settings.sampleGroupId){input.connect(destination);return null;}const node=context.createStereoPanner();node.pan.value=pan;input.connect(node).connect(destination);return node;}

export function sampleGroupDestination(context,destination,settings,groups,keyPrefix=''){if(!settings.sampleGroupId)return destination;const key=JSON.stringify([keyPrefix,settings.sampleGroupId]);if(!groups.has(key)){const node=context.createStereoPanner();node.pan.value=settings.sampleGroupPan??0;node.connect(destination);groups.set(key,node);}return groups.get(key);}
