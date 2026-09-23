import {z} from 'zod';
export const hardwareRecordingOptions=z.object({autoFinish:z.boolean().default(true),tailSeconds:z.number().finite().min(0).max(30).default(2)}).strict();
export function hardwareCaptureDuration(playbackDuration,options={}){
 const settings=hardwareRecordingOptions.parse(options);if(!settings.autoFinish)return null;
 if(!Number.isFinite(playbackDuration)||playbackDuration<=0)throw Error('Hardware playback needs a finite duration for automatic recording.');
 const duration=playbackDuration+settings.tailSeconds;
 if(duration>600)throw Error('Automatic hardware capture, including its tail, must fit within 10 minutes. Shorten the part or turn off automatic finish.');
 return duration;
}
