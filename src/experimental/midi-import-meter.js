import {compileMeterMap} from './meter-map.js';
import {compileTempoMap} from './tempo-map.js';
import {meterFromMidi} from './midi-meter-map.js';
import {meterFromSeconds} from './meter-time-edit.js';

// Called after tempo adoption. Keep preceding signatures; imported signatures
// replace the map from insertion onward, with the last signature continuing.
export function applyMidiImportMeter(session,midi,start,tempoMode='performance',meterMode='preserve'){
 if(!['preserve','adopt'].includes(meterMode))throw Error('Choose Keep session signatures or Use file signatures.');
 if(meterMode==='preserve')return;
 if(!midi.timeSignatures?.length)throw Error('This MIDI file contains no time signatures to adopt.');
 const source=compileMeterMap(meterFromMidi(midi.timeSignatures)),destination=compileMeterMap(session),tempo=compileTempoMap(session),sourceTempo=compileTempoMap(midi),origin=tempo.beatAtTime(start),position=destination.positionAtBeat(origin);
 if(position.beat!==1||position.fraction>1e-8)throw Error('Import time signatures at a project bar boundary.');
 const before=destination.points.map(p=>({...p,time:tempo.timeAtBeat(p.beat)})).filter(p=>p.time<start);
 const imported=source.points.map(p=>({...p,id:crypto.randomUUID(),time:tempoMode==='follow'?tempo.timeAtBeat(origin+p.beat):start+sourceTempo.timeAtBeat(p.beat)}));
 Object.assign(session,meterFromSeconds([...before,...imported],session));
}
