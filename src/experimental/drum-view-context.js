import {z} from 'zod';
import {patternBar} from './pattern-bars.js';
const ident=z.string().min(1).max(100);
export const drumViewContextSchema=z.object({sessionId:ident,revision:z.number().int().nonnegative(),trackId:ident,regionId:ident,bar:z.number().int().min(1),pitch:z.number().int().min(0).max(127),velocity:z.number().int().min(1).max(127),every:z.number().int().min(1).max(128),offset:z.number().int().min(0).max(127)}).strict();
export function validateDrumViewContext(session,context){
 if(context===undefined)return;
 const v=drumViewContextSchema.parse(context);
 if(v.sessionId!==session.id||v.revision!==session.revision)throw Error('The drum view is from a different session revision.');
 const track=session.tracks.find(t=>t.id===v.trackId),region=track?.regions.find(r=>r.id===v.regionId);
 if(track?.kind!=='midi'||track.instrument!=='drumKit'||!region)throw Error('The drum view must reference a drum-kit region on its track.');
 if(patternBar(region,session,v.bar-1).index!==v.bar-1)throw Error('The displayed drum bar no longer exists.');
 if(v.offset>=v.every)throw Error('The displayed drum offset exceeds its fill interval.');
}
export function captureDrumView(root,session,track,region){
 const form=root?.querySelector('[data-drum-row-form]'),velocity=root?.querySelector('[data-pattern-velocity]');
 if(!form||!track||!region||!velocity)return undefined;
 const fields=form.elements,context={sessionId:session.id,revision:session.revision,trackId:track.id,regionId:region.id,bar:Number(form.dataset.bar),pitch:Number(fields.pitch.value),velocity:Number(velocity.value),every:Number(fields.every.value),offset:Number(fields.first.value)-1};
 try{validateDrumViewContext(session,context);return context;}catch{return undefined;}
}
