import {activeAutomation} from './automation-mode.js';
import {automationShape,scheduleCurveAutomation} from './automation-curves.js';
import {z} from 'zod';
const field=(label,min,max,step)=>({label,min,max,step});
export const effectParameters={
 gate:{threshold:field('Threshold · dB',-96,0,.5),reductionDb:field('Closed reduction · dB',-96,0,.5),hysteresis:field('Hysteresis · dB below threshold',0,24,.5),attack:field('Attack · seconds',0,1,.001),hold:field('Hold · seconds',0,2,.01),release:field('Release · seconds',.001,3,.01)},
 distortion:{driveDb:field('Drive · dB',0,36,.5),toneHz:field('Tone cutoff · Hz',20,20000,10),outputDb:field('Wet output · dB',-60,12,.5),mix:field('Wet mix',0,1,.01)},
 phaser:{rate:field('Rate · Hz',.05,10,.05),frequency:field('Center frequency · Hz',20,4000,10),depthCents:field('Sweep depth · cents',0,2400,10),mix:field('Wet mix',0,1,.01)},
 chorus:{rate:field('Rate · Hz',.05,10,.05),depthMs:field('Delay modulation · ms',0,20,.1),mix:field('Wet mix',0,1,.01)},
 tremolo:{rate:field('Free rate · Hz',.05,20,.05),depth:field('Depth · 0–1',0,1,.01)},
 gain:{gainDb:field('Gain · dB',-96,24,.5),width:field('Width · 0 mono / 1 stereo',0,2,.01)},
 eq:{frequency:field('Frequency · Hz',20,20000,10),q:field('Q',.1,20,.1),gainDb:field('Gain · dB',-24,24,.5)},
 compressor:{threshold:field('Threshold · dB',-80,0,.5),ratio:field('Ratio',1,20,.1),attack:field('Attack · seconds',0,1,.001),release:field('Release · seconds',.001,1,.01),knee:field('Knee · dB',0,40,.5),makeupDb:field('Makeup gain · dB',-24,24,.5)},
 delay:{time:field('Delay · seconds',.01,2,.01),feedback:field('Feedback',0,.9,.01),mix:field('Wet mix',0,1,.01)},
 reverb:{mix:field('Wet mix',0,1,.01)},
};
export const effectPointSchema=z.object({id:z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),parameter:z.enum([...new Set(Object.values(effectParameters).flatMap(Object.keys))]),shape:automationShape.optional(),time:z.number().finite().min(0).max(86400),value:z.number().finite()}).strict();
export function validateEffectPoints(effect,ctx){
 for(const parameter of effect.automationMuted||[])if(!Object.hasOwn(effectParameters[effect.kind],parameter))ctx.addIssue({code:'custom',message:'Muted automation parameter is not supported by this effect.'});
 const seen=new Set();for(const [i,p]of effect.automation.entries()){
  const spec=effectParameters[effect.kind][p.parameter],key=p.parameter+':'+p.time;
  if(!spec||p.value<spec.min||p.value>spec.max)ctx.addIssue({code:'custom',path:['automation',i],message:'Unsupported effect parameter or automation value outside its range.'});
  if(seen.has(key))ctx.addIssue({code:'custom',path:['automation',i],message:'An effect automation point already exists at this time.'});seen.add(key);
 }
}
// Values are linear in their displayed units. EQ gain is already a dB AudioParam.
export function scheduleEffectParameter(param,effect,key,position,base,transform=v=>v){
 scheduleCurveAutomation(param,activeAutomation(effect),key,position,base,effect[key],transform);
}
export function effectAutomationCommand(effects,op,target,values){
 const effect=effects.find(e=>op==='effect.automation.point'||op==='effect.automation.clear'?e.id===target:e.automation.some(p=>p.id===target));if(!effect)throw Error('Effect or automation point not found.');
 const allowed=op==='effect.automation.point'?['id','parameter','time','value','shape']:op==='effect.automation.set'?['time','value','shape']:op==='effect.automation.clear'?['parameter']:[];
 if(Object.keys(values).some(k=>!allowed.includes(k)))throw Error('Unsupported effect automation field.');
 const points=effect.automation;
 if(op==='effect.automation.clear'){if(!Object.hasOwn(effectParameters[effect.kind],values.parameter))throw Error('Unknown effect automation parameter.');effect.automation=points.filter(p=>p.parameter!==values.parameter);}
 else if(op==='effect.automation.delete')points.splice(points.findIndex(p=>p.id===target),1);
 else if(op==='effect.automation.set'){const current=points.find(p=>p.id===target);Object.assign(current,effectPointSchema.parse({...current,...values}));}
 else{const point=effectPointSchema.parse({id:crypto.randomUUID(),...values}),previous=points.find(p=>p.parameter===point.parameter&&p.time===point.time);if(previous){previous.value=point.value;if(values.shape!==undefined)previous.shape=point.shape;}else points.push(point);}
}
