import {z} from 'zod';
import {validateMeterObservation} from './meter-context.js';
import {validateTransportState} from './agent-transport.js';
export const meterResetSchema=z.object({effectId:z.string().min(1).max(100)}).strict();
export function validateMeterReset(session,value,transport,observation){
 const action=meterResetSchema.parse(value);validateTransportState(transport,session);
 if(!transport?.playing)throw Error('Play audio before resetting limiter peak hold.');
 const meters=validateMeterObservation(observation,session);
 if(meters?.mode!=='linear'||!meters.limiters?.some(row=>row.id===action.effectId&&row.heldOutputPeaksDbtp))throw Error('Choose a limiter with an observed live peak hold.');
 return action;
}
export function performMeterReset(session,value,{transport,observation,expectedEpoch,currentEpoch,expectedPlayback,playback,expectedMeters,signal}){
 signal?.throwIfAborted();
 if(expectedEpoch!==currentEpoch||!playback||playback!==expectedPlayback||playback.meters!==expectedMeters)throw Error('Playback changed while planning. Run the instruction again.');
 const action=validateMeterReset(session,value,transport,observation);
 if(!playback.readEffectMeters?.()?.get(action.effectId)?.heldOutputPeaksDbtp)throw Error('Limiter readings are unavailable. Play audio again.');
 if(!playback.resetEffectMeters?.(action.effectId))throw Error('Limiter peak hold could not be reset.');
 return 'Limiter peak hold reset. Playback continues unchanged.';
}
