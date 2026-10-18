export const drumStepModes=['toggle','velocity','mute'];
export function drumStepNotes(region,pitch,start){return region.notes.filter(n=>n.pitch===pitch&&(n.channel||0)===9&&Math.abs(n.start-start)<.0001);}
export function editDrumStep(region,{pitch,start,mode='toggle',velocity=100,duration}){
 if(!drumStepModes.includes(mode))throw Error('Choose a supported drum step edit mode.');
 const notes=drumStepNotes(region,pitch,start);
 if(mode==='velocity'){
  if(!Number.isInteger(velocity)||velocity<1||velocity>127)throw Error('Velocity must be from 1 to 127.');
  return notes.filter(n=>n.velocity!==velocity/127).map(n=>({op:'note.set',target:n.id,values:{velocity:velocity/127}}));
 }
 if(mode==='mute'){const mute=notes.some(n=>!n.mute);return notes.filter(n=>Boolean(n.mute)!==mute).map(n=>({op:'note.set',target:n.id,values:{mute}}));}
 return notes.length?notes.map(n=>({op:'note.delete',target:n.id})):[{op:'note.add',target:region.id,values:{pitch,start,channel:9,duration,velocity:velocity/127}}];
}
