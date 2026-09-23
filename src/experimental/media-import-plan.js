import {applyCommands} from './session.js';
export function mediaDestination(session,trackId,kind='audio'){
 if(!['audio','video'].includes(kind))throw Error('Choose an audio or movie destination.');
 if(trackId===undefined){if(session.tracks.length>=128)throw Error('The session already has 128 tracks.');return null;}
 const destination=session.tracks.find(t=>t.id===trackId);
 if(!destination||destination.kind!==kind)throw Error(`Choose an existing ${kind} track or a new track.`);
 if(destination.protected)throw Error(`Unprotect ${destination.name} before adding media or recording.`);
 if(destination.regions.length>=1000)throw Error('This track already has 1,000 regions. Choose another track.');
 return destination;
}
export function mediaImportPlan(session,{trackId,kind='audio',assetId,name,start,duration,hardwareRecording,markers=[]}){
 const destination=mediaDestination(session,trackId,kind),id=destination?.id||crypto.randomUUID(),regionId=crypto.randomUUID(),commands=[];
 if(!destination)commands.push({op:'track.add',values:{id,name:name.replace(/\.[^.]+$/,'').slice(0,200),kind}});
 commands.push({op:'region.add',target:id,values:{id:regionId,name:name.slice(0,200),assetId,start,duration,...(hardwareRecording?{hardwareRecording:JSON.stringify(hardwareRecording)}:{})}});
 if(markers.length)commands.push({op:'markers.import',values:{markers:JSON.stringify(markers),start}});
 // Validate before storing new media. Execution still revalidates against current state.
 applyCommands(session,commands);
 return {commands,trackId:id,regionId};
}

export function recordedMediaPlan(session,settings){
 const plan=mediaImportPlan(session,settings);
 plan.message='Recorded take added to the timeline.';
 if(session.audioRecordMode==='cycle'&&Number.isFinite(settings.cycleDuration)&&settings.duration>settings.cycleDuration+1e-9){const commands=[...plan.commands,{op:'region.cycleTakes',target:plan.regionId,values:{duration:settings.cycleDuration,start:settings.start}}];applyCommands(session,commands);return {...plan,commands,cycleTakes:true,message:'Cycle recording saved as selectable takes.'};}
 if(session.audioRecordMode!=='takes'||!settings.trackId)return plan;
 const source=session.tracks.find(t=>t.id===settings.trackId),overlap=source.regions.filter(r=>r.assetId&&r.start<settings.start+settings.duration&&settings.start<r.start+r.duration);
 if(!overlap.length)return plan;
 const groups=new Set(overlap.filter(r=>r.takeGroup).map(r=>r.takeGroup.id));let command;
 if(groups.size===1&&overlap.every(r=>r.takeGroup))command={op:'takes.append',target:source.id,values:{groupId:[...groups][0],regionId:plan.regionId}};
 else if(!groups.size&&Math.max(settings.start,...overlap.map(r=>r.start))<Math.min(settings.start+settings.duration,...overlap.map(r=>r.start+r.duration)))command={op:'takes.create',target:source.id,values:{regionIds:[...overlap.map(r=>r.id),plan.regionId].join(','),name:source.name.slice(0,194)+' takes',activeRegionId:plan.regionId}};
 else {plan.message='Recording saved as a separate layer: overlapping regions span different take groups or intervals. Group the intended takes manually.';return plan;}
 const commands=[...plan.commands,command];applyCommands(session,commands);return {...plan,commands,message:'Recorded take saved and selected in its take group.'};
}
