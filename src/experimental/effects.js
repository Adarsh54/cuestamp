import {eqTail} from './eq-tail.js';
import {eqTypes} from './eq-modes.js';
import {automationModeSchema,automationMutedSchema,activeAutomation} from './automation-mode.js';
import {automationShape,curveAutomationValue,scheduleCurveAutomation} from './automation-curves.js';
import {connectDistortion} from './distortion.js';
import {connectPhaser} from './phaser.js';
import {connectChorus} from './chorus.js';
import {connectTremolo} from './tremolo.js';
import {effectPointSchema,validateEffectPoints,scheduleEffectParameter} from './effect-automation.js';
import {z} from 'zod';
const base={id:z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),enabled:z.boolean().default(true),automationMode:automationModeSchema.optional(),automationMuted:automationMutedSchema(['makeupDb','driveDb','toneHz','outputDb','rate','depthCents','depthMs','mix','depth','gainDb','width','frequency','q','threshold','ratio','attack','release','knee','time','feedback']),automation:z.array(effectPointSchema).max(2000).default([])};
export const effectSchema=z.discriminatedUnion('kind',[
 z.object({...base,kind:z.literal('distortion'),driveDb:z.number().finite().min(0).max(36).default(12),toneHz:z.number().finite().min(20).max(20000).default(6000),outputDb:z.number().finite().min(-60).max(12).default(-6),mix:z.number().finite().min(0).max(1).default(1)}).strict(),
 z.object({...base,kind:z.literal('phaser'),rate:z.number().finite().min(.05).max(10).default(.5),frequency:z.number().finite().min(20).max(4000).default(1000),depthCents:z.number().finite().min(0).max(2400).default(1200),mix:z.number().finite().min(0).max(1).default(.5),stereoPhase:z.number().finite().min(-180).max(180).default(90),sync:z.boolean().default(false),beats:z.number().finite().min(.125).max(16).default(1)}).strict(),
 z.object({...base,kind:z.literal('chorus'),rate:z.number().finite().min(.05).max(10).default(.8),depthMs:z.number().finite().min(0).max(20).default(3),mix:z.number().finite().min(0).max(1).default(.35),stereoPhase:z.number().finite().min(-180).max(180).default(90),sync:z.boolean().default(false),beats:z.number().finite().min(.125).max(16).default(1)}).strict(),
 z.object({...base,kind:z.literal('tremolo'),rate:z.number().finite().min(.05).max(20).default(4),depth:z.number().finite().min(0).max(1).default(.5),phase:z.number().finite().min(-180).max(180).default(90),stereoPhase:z.number().finite().min(-180).max(180).default(0),sync:z.boolean().default(false),beats:z.number().finite().min(.125).max(16).default(1)}).strict(),
 z.object({...base,kind:z.literal('gain'),gainDb:z.number().finite().min(-96).max(24).default(0),width:z.number().finite().min(0).max(2).default(1),invertLeft:z.boolean().default(false),invertRight:z.boolean().default(false),swap:z.boolean().default(false)}).strict(),
 z.object({...base,kind:z.literal('eq'),type:z.enum(eqTypes).default('peaking'),frequency:z.number().finite().min(20).max(20000).default(1000),q:z.number().finite().min(.1).max(20).default(1),gainDb:z.number().finite().min(-24).max(24).default(0)}).strict(),
 z.object({...base,kind:z.literal('compressor'),threshold:z.number().finite().min(-80).max(0).default(-24),ratio:z.number().finite().min(1).max(20).default(4),attack:z.number().finite().min(0).max(1).default(.003),release:z.number().finite().min(.001).max(1).default(.25),knee:z.number().finite().min(0).max(40).default(15),makeupDb:z.number().finite().min(-24).max(24).default(0)}).strict(),
 z.object({...base,kind:z.literal('delay'),time:z.number().finite().min(.01).max(2).default(.25),feedback:z.number().finite().min(0).max(.9).default(.3),mix:z.number().finite().min(0).max(1).default(.25)}).strict(),
 z.object({...base,kind:z.literal('reverb'),decay:z.number().finite().min(.1).max(8).default(2),mix:z.number().finite().min(0).max(1).default(.2)}).strict(),
]).superRefine(validateEffectPoints);
export const automationSchema=z.object({id:z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),parameter:z.enum(['gainDb','pan']),shape:automationShape.optional(),time:z.number().finite().min(0).max(86400),value:z.number().finite()}).superRefine((p,ctx)=>{const [min,max]=p.parameter==='gainDb'?[-96,12]:[-1,1];if(p.value<min||p.value>max)ctx.addIssue({code:'custom',message:'Automation value outside parameter range.'});});
export const automationValue=curveAutomationValue;
export function scheduleAutomation(param,points,parameter,position,base,fallback){scheduleCurveAutomation(param,points,parameter,position,base,fallback,parameter==='gainDb'?v=>10**(v/20):v=>v,parameter==='gainDb');}
export function effectTail(effects=[],inheritedOff=false){const peak=(e,key)=>Math.max(e[key],...activeAutomation(e,inheritedOff).filter(p=>p.parameter===key).map(p=>p.value));return Math.min(30,effects.filter(e=>e.enabled).reduce((sum,e)=>{if(e.kind==='eq')return sum+eqTail(e,inheritedOff);if(e.kind==='distortion')return sum+(peak(e,'mix')>0?.5:0);if(e.kind==='reverb')return sum+e.decay;if(e.kind==='phaser')return sum+(peak(e,'mix')>0?2:0);if(e.kind==='chorus')return sum+(peak(e,'mix')>0?.025+peak(e,'depthMs')/1000:0);if(e.kind!=='delay'||peak(e,'mix')===0)return sum;const time=peak(e,'time'),feedback=peak(e,'feedback');return sum+time*(feedback>0?Math.ceil(Math.log(.001)/Math.log(feedback))+1:1);},0));}
export function connectEffects(context,input,effects,nodes,{position=0,base=context.currentTime,tempo=120,tempoChanges=[],register}={}){const schedule=(param,effect,key,position,base,transform=v=>v)=>{register?.(effect,key,param,transform,false);scheduleEffectParameter(param,effect,key,position,base,transform);};let output=input;for(const effect of effects||[]){if(!effect.enabled)continue;
 if(effect.kind==='distortion'){output=connectDistortion(context,output,effect,nodes,{position,base,register});}
 else if(effect.kind==='phaser'){output=connectPhaser(context,output,effect,nodes,{position,base,tempo,tempoChanges,register});}
 else if(effect.kind==='chorus'){output=connectChorus(context,output,effect,nodes,{position,base,tempo,tempoChanges,register});}
 else if(effect.kind==='tremolo'){output=connectTremolo(context,output,effect,nodes,{position,base,tempo,tempoChanges,register});}
 else if(effect.kind==='gain'){
  // Force speaker upmix before splitting so mono is present on both channels.
  const stereo=context.createGain(),split=context.createChannelSplitter(2),merge=context.createChannelMerger(2),gain=context.createGain();
  stereo.channelCount=2;stereo.channelCountMode='explicit';stereo.channelInterpretation='speakers';output.connect(stereo).connect(split);
  for(let source=0;source<2;source++)for(let destination=0;destination<2;destination++){
   const coefficient=context.createGain(),sign=(source===0?effect.invertLeft:effect.invertRight)?-1:1;
   schedule(coefficient.gain,effect,'width',position,base,w=>sign*(source===destination?1+w:1-w)/2);
   split.connect(coefficient,source);coefficient.connect(merge,0,effect.swap?1-destination:destination);nodes.push(coefficient);
  }
  register?.(effect,'gainDb',gain.gain,v=>10**(v/20),true);scheduleAutomation(gain.gain,activeAutomation(effect),'gainDb',position,base,effect.gainDb);merge.connect(gain);nodes.push(stereo,split,merge,gain);output=gain;
 }
 else if(effect.kind==='eq'){const filter=context.createBiquadFilter();filter.type=effect.type;schedule(filter.frequency,effect,'frequency',position,base,v=>Math.min(v,context.sampleRate/2-1));schedule(filter.Q,effect,'q',position,base);schedule(filter.gain,effect,'gainDb',position,base);output.connect(filter);nodes.push(filter);output=filter;}
 else if(effect.kind==='compressor'){const compressor=context.createDynamicsCompressor();for(const key of ['threshold','ratio','attack','release','knee'])schedule(compressor[key],effect,key,position,base);const makeup=context.createGain();register?.(effect,'makeupDb',makeup.gain,v=>10**(v/20),true);scheduleCurveAutomation(makeup.gain,activeAutomation(effect),'makeupDb',position,base,effect.makeupDb,v=>10**(v/20),true);output.connect(compressor).connect(makeup);nodes.push(compressor,makeup);output=makeup;}
 else{const dry=context.createGain(),wet=context.createGain(),sum=context.createGain();schedule(dry.gain,effect,'mix',position,base,v=>1-v);schedule(wet.gain,effect,'mix',position,base);output.connect(dry).connect(sum);nodes.push(dry,wet,sum);
  if(effect.kind==='delay'){const delay=context.createDelay(2),feedback=context.createGain();schedule(delay.delayTime,effect,'time',position,base);schedule(feedback.gain,effect,'feedback',position,base);output.connect(delay);delay.connect(feedback).connect(delay);delay.connect(wet).connect(sum);nodes.push(delay,feedback);}
  else{const convolver=context.createConvolver(),length=Math.ceil(context.sampleRate*effect.decay),impulse=context.createBuffer(2,length,context.sampleRate);let seed=9173;for(let c=0;c<2;c++){const data=impulse.getChannelData(c);for(let i=0;i<length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/2147483648-1)*(1-i/length)**3;}}convolver.buffer=impulse;output.connect(convolver).connect(wet).connect(sum);nodes.push(convolver);}
  output=sum;
 }
 }return output;}
