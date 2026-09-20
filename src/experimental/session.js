import {repeatNotesPlan} from './note-repeat.js';
import {applyMidiImportTiming} from './midi-import-timing.js';
import {musicalNoteShift} from './musical-note-shift.js';
import {compileTempoMap,retimeMidiTracks} from './tempo-map.js';
import {swapProjectSections,replaceProjectSection} from './section-exchange.js';
import {arrangementSectionSchema,arrangementSectionsSchema} from './arrangement-sections.js';
import {transferProjectSection} from './section-transfer.js';
import {repeatProjectSection} from './repeat-section.js';
import {deleteProjectTime} from './delete-time.js';
import {splitRegion,splitCompReferences,splitSelectedRegions} from './region-split.js';
import {insertProjectTime} from './insert-time.js';
import {setAutomationParameterEnabled} from './automation-parameter.js';
import {automationModeSchema,automationMutedSchema} from './automation-mode.js';
import {createSummingGroup} from './summing-group.js';
import {applyAutomationRange} from './automation-range.js';
import {resolveNoteFilter} from './note-filter.js';
import {joinNotesPlan} from './note-join.js';
import {splitNotesPlan} from './note-split.js';
import {sustainLengthPlan} from './sustain-lengths.js';
import {createAudioComp,compAlternativeSchema,saveCompAlternative,savedCompValues} from './audio-comp.js';
import {midiRecordingWindow} from './midi-punch.js';
import {audioRecordingWindow} from './audio-punch.js';
import {transferNotes} from './note-transfer.js';
import {duplicateNotePlan} from './note-cleanup.js';
import {invertNoteEdits} from './note-invert.js';
import {copyChannelSettings} from './channel-settings.js';
import {bouncedRegionTrack,bouncedWholeTrack} from './bounce-in-place.js';
import {arpeggioPlan} from './arpeggio.js';
import {pastedRegions} from './region-clipboard.js';
import {movedRegions,duplicatedRegions,regionIdsForDeletion} from './region-selection.js';
import {samplerTuningSchema} from './sampler-tuning.js';
import {samplerFilterSchema} from './sampler-filter.js';
import {separatedMidiTracks} from './separate-midi.js';
import {velocityRampEdits} from './velocity-ramp.js';
import {joinedMidiRegion} from './join-midi.js';
import {transposeNoteEdits} from './note-transpose.js';
import {scaledMidiRegion} from './midi-region-scale.js';
import {timeScaleNotes} from './note-time-scale.js';
import {reverseNoteEdits} from './note-reverse.js';
import {offsetMasterGain} from './master-gain.js';
import {legatoEdits} from './legato.js';
import {crossfadeRegions} from './region-fades.js';
import {effectAutomationCommand} from './effect-automation.js';
import {scaleNoteEdits} from './scales.js';
import {createChordNotes} from './chords.js';
import {controllerRamp} from './controller-ramp.js';
import {repeatRegion} from './repeat-region.js';
import {duplicateTrack} from './duplicate-track.js';
import {selectedMidiNotes} from './note-selection.js';
import {readMidi,decodeMidiImport} from './midi.js';
import {quantizeNotes,humanizeNotes} from './note-transforms.js';
import {frameRates} from './timecode.js';
import {midiEventSchema} from './midi-events.js';
import {validateRouting} from './routing.js';
import {trimmedRegion,trimmedMidiRegion} from './region-edit.js';
import {effectSchema,automationSchema} from './effects.js';
import {z} from 'zod';
const ident=z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),time=z.number().finite().min(0).max(86400),db=z.number().finite().min(-96).max(12);
const note=z.object({id:ident,mute:z.boolean().default(false),channel:z.number().int().min(0).max(15).default(0),pitch:z.number().int().min(0).max(127),start:time,duration:z.number().positive().max(3600),velocity:z.number().min(0).max(1)});
const region=z.object({id:ident,name:z.string().max(200),assetId:ident.nullable(),mute:z.boolean().default(false),start:time,offset:time,duration:z.number().positive().max(86400),gainDb:db,fadeIn:time,fadeOut:time,fadeInShape:z.enum(['linear','equalPower']).default('linear'),fadeOutShape:z.enum(['linear','equalPower']).default('linear'),reverse:z.boolean(),notes:z.array(note).max(20000),events:z.array(midiEventSchema).max(20000).default([])});
const track=z.object({id:ident,name:z.string().max(200),kind:z.enum(['audio','midi','video','bus']),collapsed:z.boolean().optional(),protected:z.boolean().optional(),automationMode:automationModeSchema.optional(),automationMuted:automationMutedSchema(['gainDb','pan']),gainDb:db,pan:z.number().min(-1).max(1),mute:z.boolean(),solo:z.boolean(),instrument:z.enum(['sine','triangle','square','sawtooth','drumKit','sampler']),sampleAssetId:ident.nullable().default(null),sampleRoot:z.number().int().min(0).max(127).default(60),sampleAttack:z.number().min(0).max(10).default(.005),sampleDecay:z.number().min(0).max(10).default(0),sampleSustain:z.number().min(0).max(1).default(1),sampleRelease:z.number().min(0).max(30).default(.02),...samplerTuningSchema.shape,...samplerFilterSchema.shape,sampleLoop:z.boolean().default(false),sampleLoopStart:time.default(0),sampleLoopEnd:time.nullable().default(null),regions:z.array(region).max(1000),compAlternatives:z.array(compAlternativeSchema).max(32).default([]),output:ident.nullable().default(null),sends:z.array(z.object({busId:ident,gainDb:db,automationMode:automationModeSchema.optional(),automationMuted:automationMutedSchema(['gainDb']),tap:z.enum(['preFader','postFader','postPan']).default('postPan'),automation:z.array(automationSchema.refine(p=>p.parameter==='gainDb','Send automation supports gain only.')).max(2000).default([])})).max(16).default([]),effects:z.array(effectSchema).max(16).default([]),automation:z.array(automationSchema).max(2000).default([])}).superRefine((t,ctx)=>{if(t.collapsed&&t.kind!=='bus')ctx.addIssue({code:'custom',message:'Only bus groups can be collapsed.'});if(t.kind!=='audio'&&t.compAlternatives.length)ctx.addIssue({code:'custom',message:'Comp alternatives require an audio track.'});if(t.sampleLoopEnd!==null&&t.sampleLoopEnd<=t.sampleLoopStart)ctx.addIssue({code:'custom',message:'Sampler loop end must follow its start.'});});
const tempoPoint=z.object({id:ident,beat:z.number().finite().positive().max(432000),bpm:z.number().finite().min(20).max(300)});
export const sessionSchema=z.object({version:z.literal(1),id:ident,title:z.string().max(200),revision:z.number().int().nonnegative(),tempo:z.number().min(20).max(300),tempoChanges:z.array(tempoPoint).max(256).default([]),meter:z.number().int().min(1).max(16),meterDenominator:z.union([z.literal(1),z.literal(2),z.literal(4),z.literal(8),z.literal(16),z.literal(32),z.literal(64)]).default(4),metronomeEnabled:z.boolean().default(false),metronomeRecordEnabled:z.boolean().default(false),countInBars:z.number().int().min(0).max(2).default(0),midiPunchEnabled:z.boolean().default(false),midiPunchStart:time.default(0),midiPunchEnd:time.default(4),audioPunchEnabled:z.boolean().default(false),audioPunchStart:time.default(0),audioPunchEnd:time.default(4),recordWithPlayback:z.boolean().default(false),midiMonitorEnabled:z.boolean().default(false),audioMonitorEnabled:z.boolean().default(false),audioMonitorDb:z.number().min(-60).max(0).default(-18),metronomeDb:z.number().min(-60).max(0).default(-18),masterDb:db,masterAutomationMode:automationModeSchema.optional(),masterAutomationMuted:automationMutedSchema(['gainDb','pan']),masterPan:z.number().min(-1).max(1).default(0),masterAutomation:z.array(automationSchema).max(2000).default([]),masterEffects:z.array(effectSchema).max(16).default([]),loopEnabled:z.boolean().default(false),loopStart:time.default(0),loopEnd:time.default(4),frameRate:z.number().refine(value=>frameRates.includes(value),'Unsupported frame rate.').default(24),tracks:z.array(track).max(128),sections:arrangementSectionsSchema,markers:z.array(z.object({id:ident,name:z.string().max(200),time})).max(1000)}).superRefine((s,ctx)=>{try{compileTempoMap(s);}catch(error){ctx.addIssue({code:'custom',path:['tempoChanges'],message:error.message});}if(new Set(s.tempoChanges.map(p=>p.id)).size!==s.tempoChanges.length)ctx.addIssue({code:'custom',path:['tempoChanges'],message:'Tempo point IDs must be unique.'});});
export const newSession=()=>({version:1,id:crypto.randomUUID(),title:'Untitled session',revision:0,tempo:120,meter:4,masterDb:0,masterPan:0,masterAutomation:[],masterEffects:[],tracks:[],markers:[]});
export const operations=['notes.repeat','tempo.add','tempo.set','tempo.delete','section.add','section.set','section.delete','section.editContent','session.transferSection','session.repeatSection','session.deleteTime','regions.split','session.insertTime','midi.import','master.gain.offset','session.set','track.add','track.createGroup','track.duplicate','track.copySettings','track.comp','comp.save','comp.delete','comp.createTrack','track.move','track.set','track.delete','send.set','send.delete','send.automation.point','send.automation.clear','track.commitBounce','region.commitBounce','region.separateMidi','region.joinMidi','region.timeScale','region.crossfade','region.add','region.extractAudio','region.trim','region.set','regions.paste','regions.duplicate','regions.delete','regions.move','region.move','region.delete','region.split','region.duplicate','region.repeat','event.ramp','event.add','event.set','event.delete','note.add','note.set','note.delete','notes.arpeggiate','notes.timeScale','notes.reverse','notes.legato','notes.scale','notes.chord','notes.velocity','notes.velocityRamp','notes.move','notes.resize','notes.delete','notes.duplicate','notes.quantize','notes.humanize','notes.transpose','notes.invert','notes.mute','notes.split','notes.divide','notes.applySustain','notes.removeDuplicates','notes.join','notes.transfer','marker.add','marker.set','marker.delete','effect.automation.point','effect.automation.set','effect.automation.delete','effect.automation.clear','effect.add','effect.set','effect.delete','effect.move','automation.parameter','automation.range','automation.point','automation.set','automation.delete','automation.clear'];
export const commandSchema=z.object({op:z.enum(operations),target:z.string().max(100).optional(),values:z.record(z.string(),z.union([z.string(),z.number(),z.boolean(),z.null()])).default({})}).strict();
export const batchSchema=z.array(commandSchema).min(1).max(100);
const pick=(values,allowed)=>{for(const key of Object.keys(values))if(!allowed.includes(key))throw Error(`Unsupported field: ${key}`);return values;};
export function applyCommands(input,commands,expectedRevision=input.revision){
 const session=sessionSchema.parse(structuredClone(input));if(session.revision!==expectedRevision)throw Error('The session changed. Run the instruction again.');
 for(const {op,target,values:rawValues} of batchSchema.parse(commands)){
  let v=rawValues;
  const t=session.tracks.find(t=>t.id===target),owner=session.tracks.find(t=>t.regions.some(r=>r.id===target)),r=owner?.regions.find(r=>r.id===target);
  const noteRegion=session.tracks.flatMap(t=>t.regions).find(r=>r.notes.some(n=>n.id===target)),n=noteRegion?.notes.find(n=>n.id===target);
  const effectChains=[session.masterEffects,...session.tracks.map(t=>t.effects)],automationChains=[session.masterAutomation,...session.tracks.flatMap(t=>[t.automation,...t.sends.map(s=>s.automation)])];
  const need=(entity,label)=>{if(!entity)throw Error(`${label} not found: ${target}`);return entity;};
  if(v.filter!==undefined){need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');v=resolveNoteFilter(r,op,v);}
  // Check every operation, so a later unlock or compensating edit cannot bypass protection.
  const protectedContents=session.tracks.filter(t=>t.protected).map(t=>({id:t.id,name:t.name,contents:JSON.stringify([t.regions,t.compAlternatives])}));
  switch(op){
   case 'tempo.add':case 'tempo.set':case 'tempo.delete':{
    const previousTiming={tempo:session.tempo,tempoChanges:structuredClone(session.tempoChanges)};
    if(op==='tempo.add')session.tempoChanges.push(tempoPoint.parse({id:crypto.randomUUID(),...pick(v,['id','beat','bpm'])}));
    else {const point=need(session.tempoChanges.find(p=>p.id===target),'Tempo point');if(op==='tempo.set')Object.assign(point,tempoPoint.parse({...point,...pick(v,['beat','bpm'])}));else {pick(v,[]);session.tempoChanges=session.tempoChanges.filter(p=>p.id!==target);}}
    session.tempoChanges.sort((a,b)=>a.beat-b.beat);compileTempoMap(session);retimeMidiTracks(session.tracks,previousTiming,session);break;
   }
   case 'section.add':session.sections.push(arrangementSectionSchema.parse({id:crypto.randomUUID(),...pick(v,['id','name','start','end'])}));break;
   case 'section.set':{const section=need(session.sections.find(s=>s.id===target),'Arrangement section');Object.assign(section,arrangementSectionSchema.parse({...section,...pick(v,['name','start','end'])}));break;}
   case 'section.delete':need(session.sections.find(s=>s.id===target),'Arrangement section');pick(v,[]);session.sections=session.sections.filter(s=>s.id!==target);break;
   case 'section.editContent':{const section=need(session.sections.find(s=>s.id===target),'Arrangement section'),{start,end}=section;pick(v,v.action==='repeat'?['action','count']:['copy','move'].includes(v.action)?['action','position']:['swap','replace'].includes(v.action)?['action','otherId']:['action']);if(v.action==='repeat')repeatProjectSection(session,{start,end,count:v.count});else if(v.action==='remove')deleteProjectTime(session,{start,end});else if(['copy','move'].includes(v.action))transferProjectSection(session,{mode:v.action,start,end,position:v.position});else if(v.action==='swap')swapProjectSections(session,target,v.otherId);else if(v.action==='replace')replaceProjectSection(session,target,v.otherId);else throw Error('Choose Repeat, Copy, Move, Swap, Replace or Remove section contents.');break;}
   case 'session.transferSection':pick(v,['mode','start','end','position']);transferProjectSection(session,v);break;
   case 'session.repeatSection':pick(v,['start','end','count']);repeatProjectSection(session,v);break;
   case 'session.deleteTime':pick(v,['start','end']);deleteProjectTime(session,v);break;
   case 'session.insertTime':pick(v,['position','duration']);insertProjectTime(session,v);break;
   case 'midi.import':{
    pick(v,['data','start','trackId','minimumDuration','tempoMode']);const destination=v.trackId===undefined?null:need(session.tracks.find(t=>t.id===v.trackId),'Destination track');if(destination&&destination.kind!=='midi')throw Error('MIDI takes require an instrument track.');const start=time.parse(v.start??0),midi=readMidi(decodeMidiImport(v.data));
    if(!midi.tracks.length&&!midi.markers.length&&!(v.tempoMode==='adopt'&&midi.hasTempoEvents))throw Error(midi.hasTempoEvents?'This file contains only tempo information. Choose Use file tempo to import its tempo map.':'This MIDI file has no notes, channel events, markers or tempo information to import.');
    if(session.markers.length+midi.markers.length>1000)throw Error('Import would exceed the 1,000-marker session limit.');
    if(!destination&&session.tracks.length+midi.tracks.length>128)throw Error('Import would exceed the 128-track session limit.');
    if(destination&&destination.regions.length+midi.tracks.length>1000)throw Error('Import would exceed the 1,000-region track limit.');
    const imported=midi.tracks.map(source=>{
     if(source.notes.length>20000||source.events.length>20000)throw Error('Each imported MIDI track supports up to 20,000 notes and 20,000 channel events.');
     const duration=Math.max(.1,time.parse(v.minimumDuration??0),...source.notes.map(n=>n.start+n.duration),...source.events.map(e=>e.start+.001));
     return track.parse({id:crypto.randomUUID(),name:source.name.slice(0,200),kind:'midi',gainDb:0,pan:0,mute:false,solo:false,instrument:'triangle',
      regions:[{id:crypto.randomUUID(),name:source.name.slice(0,200),assetId:null,start:0,offset:0,duration,gainDb:0,fadeIn:0,fadeOut:0,reverse:false,notes:source.notes,events:source.events}],
     });
    });
    const markers=applyMidiImportTiming(session,midi,imported,start,v.tempoMode);
    if(destination)destination.regions.push(...imported.flatMap(t=>t.regions));else session.tracks.push(...imported);session.markers.push(...markers.map(m=>({id:crypto.randomUUID(),...m})));break;
   }
   case 'master.gain.offset':if(target!==undefined&&target!==session.id)throw Error('Target the current session for a master gain adjustment.');pick(v,['deltaDb']);Object.assign(session,offsetMasterGain(session,v.deltaDb));break;
   case 'session.set':{const previousTiming={tempo:session.tempo,tempoChanges:structuredClone(session.tempoChanges)};Object.assign(session,pick(v,['title','tempo','meter','meterDenominator','metronomeEnabled','metronomeRecordEnabled','countInBars','recordWithPlayback','audioPunchEnabled','audioPunchStart','audioPunchEnd','midiPunchEnabled','midiPunchStart','midiPunchEnd','midiMonitorEnabled','audioMonitorEnabled','audioMonitorDb','metronomeDb','masterDb','masterPan','masterAutomationMode','frameRate','loopEnabled','loopStart','loopEnd']));if(v.tempo!==undefined)retimeMidiTracks(session.tracks,previousTiming,session);break;}
   case 'track.add':session.tracks.push(track.parse({id:crypto.randomUUID(),name:'New track',kind:'audio',gainDb:0,pan:0,mute:false,solo:false,instrument:'triangle',regions:[],...pick(v,['id','name','kind','instrument','sampleAssetId','sampleRoot','sampleTune','sampleFineTune','sampleAttack','sampleDecay','sampleSustain','sampleRelease','sampleLoop','sampleLoopStart','sampleLoopEnd','sampleFilterType','sampleFilterCutoff','sampleFilterResonance','sampleFilterKeyTrack'])}));break;
   case 'track.createGroup':createSummingGroup(session,v,value=>track.parse(value));break;
   case 'track.duplicate':{need(t,'Track');pick(v,['id','name','includeRegions']);session.tracks.splice(session.tracks.indexOf(t)+1,0,duplicateTrack(t,v));break;}
   case 'comp.save':saveCompAlternative(session,target,v);break;
   case 'comp.delete':{pick(v,['compId']);savedCompValues(t,v.compId);t.compAlternatives=t.compAlternatives.filter(c=>c.id!==v.compId);break;}
   case 'comp.createTrack':{pick(v,['compId']);createAudioComp(session,target,savedCompValues(t,v.compId));break;}
   case 'track.comp':createAudioComp(session,target,v);break;
   case 'track.copySettings':copyChannelSettings(need(t,'Track'),session.tracks.find(source=>source.id===v.sourceId),v);break;
   case 'track.move':{need(t,'Track');pick(v,['index']);if(!Number.isInteger(v.index)||v.index<0||v.index>=session.tracks.length)throw Error('Track index must be an existing position in the track list.');session.tracks.splice(session.tracks.indexOf(t),1);session.tracks.splice(v.index,0,t);break;}
   case 'track.set':Object.assign(need(t,'Track'),pick(v,['name','gainDb','pan','mute','solo','collapsed','protected','automationMode','instrument','sampleAssetId','sampleRoot','sampleTune','sampleFineTune','sampleAttack','sampleDecay','sampleSustain','sampleRelease','sampleLoop','sampleLoopStart','sampleLoopEnd','sampleFilterType','sampleFilterCutoff','sampleFilterResonance','sampleFilterKeyTrack','output']));break;
   case 'track.delete':need(t,'Track');session.tracks=session.tracks.filter(x=>x!==t);for(const other of session.tracks){if(other.output===target)other.output=null;other.sends=other.sends.filter(s=>s.busId!==target);}break;
   case 'send.set':{need(t,'Track');pick(v,['busId','gainDb','tap','automationMode']);const send=t.sends.find(s=>s.busId===v.busId);if(send){if(v.gainDb!==undefined)send.gainDb=v.gainDb;if(v.tap!==undefined)send.tap=v.tap;if(v.automationMode!==undefined)send.automationMode=v.automationMode;}else t.sends.push({busId:v.busId,gainDb:v.gainDb,tap:v.tap===undefined?'postPan':v.tap,...(v.automationMode===undefined?{}:{automationMode:v.automationMode}),automation:[]});break;}
   case 'send.automation.point':{need(t,'Track');pick(v,['busId','id','time','value','shape']);const send=need(t.sends.find(s=>s.busId===v.busId),'Send');const point=automationSchema.parse({id:v.id??crypto.randomUUID(),parameter:'gainDb',time:v.time,value:v.value,...(v.shape===undefined?{}:{shape:v.shape})});const previous=send.automation.find(p=>p.time===point.time);if(previous){previous.value=point.value;if(v.shape!==undefined)previous.shape=point.shape;}else send.automation.push(point);break;}
   case 'send.automation.clear':{need(t,'Track');pick(v,['busId']);const send=need(t.sends.find(s=>s.busId===v.busId),'Send');send.automation=[];break;}
   case 'send.delete':need(t,'Track');pick(v,['busId']);t.sends=t.sends.filter(s=>s.busId!==v.busId);break;
   case 'region.add':need(t,'Track').regions.push(region.parse({id:crypto.randomUUID(),name:'Region',assetId:null,start:0,offset:0,duration:4,gainDb:0,fadeIn:0,fadeOut:0,reverse:false,notes:[],...pick(v,['id','name','assetId','start','offset','duration'])}));break;
   case 'region.set':Object.assign(need(r,'Region'),pick(v,['name','start','offset','duration','gainDb','fadeIn','fadeOut','fadeInShape','fadeOutShape','reverse','mute']));break;
   case 'region.crossfade':{need(r,'Region');pick(v,['otherRegionId','shape']);if(owner.kind!=='audio')throw Error('Crossfades require audio regions.');const other=owner.regions.find(x=>x.id===v.otherRegionId);for(const edit of crossfadeRegions(r,other,v.shape)){Object.assign(owner.regions.find(x=>x.id===edit.id),edit.values);}break;}
   case 'regions.paste':{for(const copy of pastedRegions(session,v,region))session.tracks.find(t=>t.id===copy.trackId).regions.push(copy.region);break;}
   case 'regions.duplicate':{for(const copy of duplicatedRegions(session,v))session.tracks.find(t=>t.id===copy.trackId).regions.push(copy.region);break;}
   case 'regions.delete':{const ids=regionIdsForDeletion(session,v);for(const track of session.tracks)track.regions=track.regions.filter(r=>!ids.has(r.id));break;}
   case 'regions.move':{const edits=new Map(movedRegions(session,v).map(e=>[e.id,e.start]));for(const track of session.tracks)for(const region of track.regions)if(edits.has(region.id))region.start=edits.get(region.id);break;}
   case 'region.move':{need(r,'Region');pick(v,['trackId','start']);const destination=need(session.tracks.find(t=>t.id===v.trackId),'Destination track');if(destination.kind!==owner.kind||destination.kind==='bus')throw Error('Move regions between tracks of the same type.');if(v.start!==undefined)r.start=v.start;if(destination!==owner){owner.regions=owner.regions.filter(x=>x!==r);destination.regions.push(r);}break;}
   case 'region.delete':need(r,'Region');owner.regions=owner.regions.filter(x=>x!==r);break;
   case 'region.extractAudio':need(r,'Region');if(owner.kind!=='video'||!r.assetId)throw Error('Select a movie region to extract its audio.');pick(v,['name','trackId','regionId']);session.tracks.push(track.parse({...owner,id:v.trackId||crypto.randomUUID(),name:v.name||owner.name+' audio',kind:'audio',regions:[{...structuredClone(r),id:v.regionId||crypto.randomUUID(),notes:[],events:[]}]}));break;
   case 'region.trim':need(r,'Region');pick(v,['start','end']);Object.assign(r,(owner.kind==='midi'?trimmedMidiRegion:trimmedRegion)(r,v.start,v.end));break;
   case 'track.commitBounce':{need(t,'Track');const {track:copy}=bouncedWholeTrack(session,t.id,v);session.tracks.splice(session.tracks.indexOf(t)+1,0,copy);t.mute=true;break;}
   case 'region.commitBounce':{need(r,'Region');const {track:copy,sourceTrackId}=bouncedRegionTrack(session,r.id,v);session.tracks.splice(session.tracks.findIndex(t=>t.id===sourceTrackId)+1,0,copy);r.mute=true;break;}
   case 'region.repeat':{need(r,'Region');pick(v,['count','interval','beats']);owner.regions.push(...repeatRegion(r,v,owner.regions.length,{session,kind:owner.kind}));break;}
   case 'region.duplicate':need(r,'Region');pick(v,['start']);owner.regions.push({...structuredClone(r),id:crypto.randomUUID(),start:v.start??r.start+r.duration,notes:r.notes.map(n=>({...n,id:crypto.randomUUID()})),events:r.events.map(e=>({...e,id:crypto.randomUUID()}))});break;
   case 'regions.split':splitSelectedRegions(session,v);break;
   case 'region.split':{
    need(r,'Region');pick(v,['time']);const {left,right}=splitRegion(r,v.time,owner.kind);Object.assign(r,left);owner.regions.push(right);splitCompReferences(owner,r.id,v.time,right.id);break;
   }
   case 'event.ramp':need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');r.events=controllerRamp(r,v,session);break;
   case 'event.add':need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');r.events.push(midiEventSchema.parse({id:crypto.randomUUID(),...pick(v,['id','type','start','channel','parameter','value'])}));break;
   case 'event.set':{const event=session.tracks.flatMap(t=>t.regions).flatMap(r=>r.events).find(e=>e.id===target);need(event,'MIDI event');Object.assign(event,midiEventSchema.parse({...event,...pick(v,['type','start','channel','parameter','value'])}));break;}
   case 'event.delete':{const owner=session.tracks.flatMap(t=>t.regions).find(r=>r.events.some(e=>e.id===target));need(owner,'MIDI event');owner.events=owner.events.filter(e=>e.id!==target);break;}
   case 'note.add':need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');r.notes.push(note.parse({id:crypto.randomUUID(),pitch:60,start:0,duration:.5,velocity:.8,...pick(v,['id','pitch','start','duration','velocity','channel','mute'])}));break;
   case 'note.set':Object.assign(need(n,'Note'),pick(v,['pitch','start','duration','velocity','channel','mute']));break;
   case 'notes.transfer':transferNotes(session,target,v);break;
   case 'notes.split':case 'notes.divide':{need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');const plan=splitNotesPlan(r,v,op==='notes.split'?'split':'divide',session),changes=new Map(plan.changes.map(c=>[c.id,c.pieces]));r.notes=r.notes.flatMap(n=>changes.has(n.id)?changes.get(n.id).map((p,i)=>({...n,...p,id:i?crypto.randomUUID():n.id})):[n]);break;}
   case 'notes.applySustain':{need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');const plan=sustainLengthPlan(r,v),durations=new Map(plan.edits.map(n=>[n.id,n.duration])),removed=new Set(plan.removedIds);for(const note of r.notes)if(durations.has(note.id))note.duration=durations.get(note.id);r.events=r.events.filter(e=>!removed.has(e.id));break;}
   case 'notes.join':{need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');const plan=joinNotesPlan(r,v),removed=new Set(plan.removedIds),changes=new Map(plan.changes.map(n=>[n.id,n]));r.notes=r.notes.filter(n=>!removed.has(n.id)).map(n=>changes.has(n.id)?{...n,...changes.get(n.id)}:n);break;}
   case 'notes.removeDuplicates':{need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');const removed=new Set(duplicateNotePlan(r,v).removedIds);r.notes=r.notes.filter(n=>!removed.has(n.id));break;}
   case 'notes.mute':{need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');pick(v,['noteId','noteIds','mute']);if(typeof v.mute!=='boolean')throw Error('mute must be true or false.');const notes=selectedMidiNotes(r,v);if(!notes.length)throw Error('Add or select notes first.');for(const note of notes)note.mute=v.mute;break;}
   case 'note.delete':need(n,'Note');noteRegion.notes=noteRegion.notes.filter(x=>x!==n);break;
   case 'notes.repeat':{need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');pick(v,['noteId','noteIds','count','beats','seconds','extend']);const plan=repeatNotesPlan(r,session,v);r.notes.push(...plan.notes);r.duration=plan.duration;break;}
   case 'notes.move':case 'notes.resize':case 'notes.delete':case 'notes.duplicate':{
    need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');
    pick(v,op==='notes.delete'?['noteIds']:['notes.duplicate','notes.resize'].includes(op)?['noteIds','seconds','beats']:['noteIds','seconds','beats','semitones']);
    const notes=selectedMidiNotes(r,v),seconds=v.seconds??0,semitones=v.semitones??0;
    if(!Number.isFinite(seconds)||!Number.isInteger(semitones))throw Error('Use finite seconds and whole semitones.');
    if(v.beats!==undefined&&v.seconds!==undefined)throw Error('Choose beats or seconds, not both.');
    if(v.beats!==undefined){const edited=musicalNoteShift(r,session,notes,v.beats,{resize:op==='notes.resize',semitones});if(op==='notes.duplicate')r.notes.push(...edited.map(n=>({...n,id:crypto.randomUUID()})));else for(let i=0;i<notes.length;i++)Object.assign(notes[i],edited[i]);}
    else if(op==='notes.delete'){const ids=new Set(notes.map(n=>n.id));r.notes=r.notes.filter(n=>!ids.has(n.id));}
    else if(op==='notes.resize')for(const n of notes)n.duration+=seconds;
    else if(op==='notes.duplicate')r.notes.push(...notes.map(n=>({...n,id:crypto.randomUUID(),start:n.start+seconds})));
    else for(const n of notes){n.start+=seconds;n.pitch+=semitones;}
    break;
   }
   case 'region.separateMidi':{need(r,'Region');const copies=separatedMidiTracks(session,owner,r,v);session.tracks.splice(session.tracks.indexOf(owner)+1,0,...copies);r.mute=true;break;}
   case 'region.joinMidi':{need(r,'Region');const plan=joinedMidiRegion(owner,r.id,v);Object.assign(r,plan.region);const removed=new Set(plan.ids.filter(id=>id!==r.id));owner.regions=owner.regions.filter(item=>!removed.has(item.id));break;}
   case 'region.timeScale':need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');Object.assign(r,scaledMidiRegion(r,v,session));break;
   case 'notes.timeScale':{need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');const plan=timeScaleNotes(r,v,session),edits=new Map(plan.edits.map(n=>[n.id,n]));for(const note of r.notes)if(edits.has(note.id))Object.assign(note,edits.get(note.id));r.duration=plan.duration;break;}
   case 'notes.reverse':{need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');const edits=new Map(reverseNoteEdits(r,v,session).map(e=>[e.id,e]));for(const note of r.notes)if(edits.has(note.id))Object.assign(note,edits.get(note.id));break;}
   case 'notes.arpeggiate':{need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');const plan=arpeggioPlan(r,session,v),removed=new Set(plan.removedIds);r.notes=[...r.notes.filter(n=>!removed.has(n.id)),...plan.notes.map(n=>({...n,id:crypto.randomUUID()}))];break;}
   case 'notes.legato':{need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');const edits=new Map(legatoEdits(r,v,session).map(e=>[e.id,e.duration]));for(const note of r.notes)if(edits.has(note.id))note.duration=edits.get(note.id);break;}
   case 'notes.scale':{need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');const edits=new Map(scaleNoteEdits(r,v).map(e=>[e.id,e.pitch]));for(const note of r.notes)if(edits.has(note.id))note.pitch=edits.get(note.id);break;}
   case 'notes.chord':need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');r.notes.push(...createChordNotes(r,v));break;
   case 'notes.invert':{need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');const edits=new Map(invertNoteEdits(r,v).map(e=>[e.id,e.pitch]));for(const note of r.notes)if(edits.has(note.id))note.pitch=edits.get(note.id);break;}
   case 'notes.velocityRamp':{need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');const edits=new Map(velocityRampEdits(r,v).map(e=>[e.id,e.velocity]));for(const note of r.notes)if(edits.has(note.id))note.velocity=edits.get(note.id);break;}
   case 'notes.velocity':{
    need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');pick(v,['noteIds','velocity','delta']);
    if((v.velocity===undefined)===(v.delta===undefined))throw Error('Choose either a velocity or a velocity change.');
    const value=v.velocity??v.delta;if(!Number.isFinite(value)||(v.velocity!==undefined&&(value<0||value>1))||(v.delta!==undefined&&Math.abs(value)>1))throw Error('Velocity must be 0–1; changes must be between -1 and 1.');
    for(const note of selectedMidiNotes(r,{noteIds:v.noteIds}))note.velocity=v.velocity??Math.max(0,Math.min(1,note.velocity+v.delta));break;
   }
   case 'notes.quantize':need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');quantizeNotes(r,v,session);break;
   case 'notes.humanize':need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');humanizeNotes(r,v);break;
   case 'notes.transpose':{need(r,'Region');if(owner.kind!=='midi')throw Error('Choose a MIDI region.');const edits=new Map(transposeNoteEdits(r,v).map(e=>[e.id,e.pitch]));for(const note of r.notes)if(edits.has(note.id))note.pitch=edits.get(note.id);break;}
   case 'effect.automation.point':case 'effect.automation.set':case 'effect.automation.delete':case 'effect.automation.clear':effectAutomationCommand(effectChains.flat(),op,target,v);break;
   case 'effect.add':(target===session.id?session.masterEffects:need(t,'Track').effects).push(effectSchema.parse({id:crypto.randomUUID(),...v}));break;
   case 'effect.set':{const e=effectChains.flat().find(e=>e.id===target);need(e,'Effect');Object.assign(e,effectSchema.parse({...e,...pick(v,[...Object.keys(e).filter(k=>!['id','kind'].includes(k)),'automationMode'])}));break;}
   case 'effect.delete':{const chain=effectChains.find(effects=>effects.some(e=>e.id===target));need(chain,'Effect');chain.splice(chain.findIndex(e=>e.id===target),1);break;}
   case 'effect.move':{const chain=effectChains.find(effects=>effects.some(e=>e.id===target));need(chain,'Effect');pick(v,['index']);if(!Number.isInteger(v.index)||v.index<0||v.index>=chain.length)throw Error('Effect index outside chain.');const [effect]=chain.splice(chain.findIndex(e=>e.id===target),1);chain.splice(v.index,0,effect);break;}
   case 'automation.parameter':setAutomationParameterEnabled(session,target,v);break;
   case 'automation.range':applyAutomationRange(session,target,v);break;
   case 'automation.point':{const points=target===session.id?session.masterAutomation:need(t,'Track').automation;const point=automationSchema.parse({id:crypto.randomUUID(),...pick(v,['id','parameter','time','value','shape'])});const previous=points.find(p=>p.parameter===point.parameter&&p.time===point.time);if(previous){previous.value=point.value;if(v.shape!==undefined)previous.shape=point.shape;}else points.push(point);break;}
   case 'automation.set':{const points=automationChains.find(points=>points.some(p=>p.id===target));need(points,'Automation point');const current=points.find(p=>p.id===target),next=automationSchema.parse({...current,...pick(v,['time','value','shape'])});if(points.some(p=>p.id!==target&&p.parameter===next.parameter&&p.time===next.time))throw Error('An automation point already exists at this time.');Object.assign(current,next);break;}
   case 'automation.delete':{const points=automationChains.find(points=>points.some(p=>p.id===target));need(points,'Automation point');points.splice(points.findIndex(p=>p.id===target),1);break;}
   case 'automation.clear':{const points=target===session.id?session.masterAutomation:need(t,'Track').automation;pick(v,['parameter']);if(!['gainDb','pan'].includes(v.parameter))throw Error('Unknown automation parameter.');for(let i=points.length-1;i>=0;i--)if(points[i].parameter===v.parameter)points.splice(i,1);break;}
   case 'marker.add':session.markers.push({id:crypto.randomUUID(),name:'Marker',...pick(v,['id','name','time'])});break;
   case 'marker.set':Object.assign(need(session.markers.find(m=>m.id===target),'Marker'),pick(v,['name','time']));break;
   case 'marker.delete':if(!session.markers.some(m=>m.id===target))throw Error('Marker not found.');session.markers=session.markers.filter(m=>m.id!==target);break;
  }
  for(const saved of protectedContents){const current=session.tracks.find(t=>t.id===saved.id);if(!current||JSON.stringify([current.regions,current.compAlternatives])!==saved.contents)throw Error(`Unprotect ${saved.name} before editing its contents.`);}
 }
 session.revision++;sessionSchema.parse(session);audioRecordingWindow({...session,audioPunchEnabled:true});midiRecordingWindow({...session,midiPunchEnabled:true});if(session.loopEnd<=session.loopStart)throw Error('Cycle end must follow its start.');validateRouting(session);
 const ids=[session.id,...session.tempoChanges.map(p=>p.id),...session.sections.map(s=>s.id),...session.masterAutomation.map(p=>p.id),...session.masterEffects.flatMap(e=>[e.id,...e.automation.map(p=>p.id)]),...session.tracks.flatMap(t=>[t.id,...(t.compAlternatives||[]).map(c=>c.id),...t.effects.flatMap(e=>[e.id,...e.automation.map(p=>p.id)]),...t.automation.map(p=>p.id),...t.sends.flatMap(s=>s.automation.map(p=>p.id)),...t.regions.flatMap(r=>[r.id,...r.notes.map(n=>n.id),...r.events.map(e=>e.id)])]),...session.markers.map(m=>m.id)];if(new Set(ids).size!==ids.length)throw Error('IDs must be unique.');
 for(const t of session.tracks)for(const r of t.regions){if(r.fadeIn+r.fadeOut>r.duration)throw Error('Fades must fit inside the region.');for(const e of r.events)if(e.start>r.duration+.001)throw Error('MIDI events must fit inside their region.');for(const n of r.notes)if(n.start+n.duration>r.duration+.001)throw Error('Notes must fit inside their region.');}
 return session;
}
export class SessionHistory{
 constructor(session=newSession()){this.session=sessionSchema.parse(session);validateRouting(this.session);this.past=[];this.future=[];}
 execute(commands,revision=this.session.revision){const next=applyCommands(this.session,commands,revision);this.past.push(this.session);if(this.past.length>100)this.past.shift();this.future=[];this.session=next;return next;}
 undo(){if(!this.past.length)return;this.future.push(this.session);this.session={...this.past.pop(),revision:this.session.revision+1};}
 redo(){if(!this.future.length)return;this.past.push(this.session);this.session={...this.future.pop(),revision:this.session.revision+1};}
}
