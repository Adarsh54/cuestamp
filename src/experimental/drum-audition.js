import {z} from 'zod';
import {drumDuration} from './drums.js';
import {patternBar} from './pattern-bars.js';
import {audibleSources,retainGateSources} from './routing.js';
import {audibleAssets} from './media-refs.js';
import {sessionDuration} from './audio-engine.js';
export const drumAuditionSchema=z.object({trackId:z.string(),regionId:z.string(),pitch:z.number().int().min(0).max(127),velocity:z.number().int().min(1).max(127),bar:z.number().int().min(1)}).strict();
export function drumAuditionPlan(session,values){
 const v=drumAuditionSchema.parse(values),track=session.tracks.find(t=>t.id===v.trackId),region=track?.regions.find(r=>r.id===v.regionId);
 if(track?.kind!=='midi'||track.instrument!=='drumKit'||!region)throw Error('Choose a drum-kit region.');
 const bar=patternBar(region,session,v.bar-1);
 if(bar.index!==v.bar-1||!bar.cells.length)throw Error('Choose a bar inside the drum region.');
 if(region.mute||!audibleSources(session).some(t=>t.id===track.id))return null;
 const local=bar.cells[0].time,position=region.start+local,duration=Math.min(drumDuration(v.pitch),86400-position);
 if(duration<=0)return null;
 const document=structuredClone(session);
 for(const t of document.tracks)t.regions=t.id===track.id?[{...structuredClone(region),notes:[{id:'drum-audition-note',pitch:v.pitch,channel:9,start:local,duration,velocity:v.velocity/127,mute:false}],duration:local+duration,fadeIn:0,fadeOut:0}]:[];
 document.loopEnabled=false;document.metronomeEnabled=false;
 const end=Math.min(86400,position+10,sessionDuration(document));retainGateSources(document,session);
 return {document,position,end,assets:audibleAssets(document)};
}
