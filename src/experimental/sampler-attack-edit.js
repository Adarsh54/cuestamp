export function editSampleAttacks(markers,operation,time,selected,buffer){
 const rate=buffer.sampleRate,length=buffer.length;
 if(!Array.isArray(markers)||!Number.isFinite(rate)||rate<=0||!Number.isInteger(length)||length<2||!['add','move','remove'].includes(operation))throw Error('Choose valid source attack markers.');
 const frames=markers.map(t=>Math.round(t*rate));
 if(frames.some(f=>!Number.isFinite(f)||f<=0||f>=length)||new Set(frames).size!==frames.length)throw Error('Attack markers must be unique and inside the source.');
 const previous=Math.round(selected*rate),index=frames.indexOf(previous);
 if(operation!=='add'&&index<0)throw Error('Select an attack marker first.');
 if(operation==='remove')frames.splice(index,1);
 else{const frame=Math.round(time*rate);if(!Number.isFinite(time)||!Number.isFinite(frame)||frame<=0||frame>=length)throw Error('Place the attack inside the source, away from its endpoints.');if(operation==='move')frames.splice(index,1);if(frames.includes(frame))throw Error('An attack already exists at this source sample.');frames.push(frame);}
 if(frames.length>10000)throw Error('Use at most 10,000 attack markers.');
 return frames.sort((a,b)=>a-b).map(f=>f/rate);
}
