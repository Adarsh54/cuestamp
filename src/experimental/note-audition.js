import {z} from 'zod';
import {selectedMidiNotes} from './note-selection.js';
import {audibleSources,createRoutedTailReader} from './routing.js';
import {effectTail} from './effects.js';
import {compileMidiControllers} from './midi-controller-timeline.js';
export const noteAuditionSchema=z.object({regionId:z.string().min(1).max(100),noteIds:z.array(z.string().min(1).max(100)).min(1).max(20000).nullable()}).strict();
export function selectedNotesAudition(session,value,captured=[]){
 const options=noteAuditionSchema.parse(value),ids=options.noteIds??captured;
 if(!ids.length)throw Error('Select notes to play first.');
 const track=session.tracks.find(t=>t.kind==='midi'&&t.regions.some(r=>r.id===options.regionId)),region=track?.regions.find(r=>r.id===options.regionId);
 if(!region)throw Error('Choose a MIDI region to audition.');
 const notes=selectedMidiNotes(region,{noteIds:ids.join(',')}).filter(n=>!n.mute&&n.velocity>0&&n.start<region.duration);
 if(!notes.length||region.mute||!audibleSources(session).some(t=>t.id===track.id))throw Error('Selected notes are not audible with the current mute and solo settings.');
 const document=structuredClone(session);
 for(const t of document.tracks)t.regions=t.id===track.id?[{...structuredClone(region),notes:structuredClone(notes)}]:[];
 document.loopEnabled=false;document.metronomeEnabled=false;
 const timelines=new Map();let last=0;
 for(const note of notes){const channel=note.channel??0;if(!timelines.has(channel))timelines.set(channel,compileMidiControllers((region.events||[]).filter(e=>(e.channel??0)===channel),track.pitchBendRange));last=Math.max(last,timelines.get(channel).sustainedEnd(note,region.duration));}
 const end=Math.min(86400,region.start+last+createRoutedTailReader(document)(track)+effectTail(document.masterEffects,document.masterAutomationMode==='off'));
 return {kind:'regionSelection',document,position:region.start+Math.min(...notes.map(n=>n.start)),end,label:`Playing ${notes.length} selected ${notes.length===1?'note':'notes'} through the current mixer`,options:{regionId:region.id,noteIds:[...ids]}};
}
