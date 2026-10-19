import {synthEnvelope} from './synth-envelope.js';
import {scheduleSamplerEnvelope} from './sampler-envelope.js';
// The original oscillator voice has a short attack and an in-note release.
// Schedule its remaining envelope at the original note age when seeking.
export function scheduleOscillatorEnvelope(param,start,age,duration,velocity,settings={}){
 if(settings.synthEnvelopeEnabled){scheduleSamplerEnvelope(param,start,age,duration,velocity*.18,synthEnvelope(settings));return;}
 const attack=Math.min(.008,duration/3),releaseStart=Math.max(attack,duration-.02),peak=velocity*.18;
 const level=age<attack?peak*age/attack:age<releaseStart?peak:peak*Math.max(0,(duration-age)/(duration-releaseStart));
 param.setValueAtTime(level,start);
 if(age<attack)param.linearRampToValueAtTime(peak,start+attack-age);
 if(age<releaseStart)param.setValueAtTime(peak,start+releaseStart-age);
 if(age<duration)param.linearRampToValueAtTime(0,start+duration-age);
}
