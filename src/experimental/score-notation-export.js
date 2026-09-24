import {z} from 'zod';
import {scoreDisplayTiming,scoreDisplayGrids} from './score-display-timing.js';
import {scorePitchView} from './score-transposition.js';
import {resolveMusicxmlRegion,exportRegionMusicxml,exportScoreMusicxml} from './musicxml.js';
const view={pitchMode:z.enum(['written','concert']).default('written'),displayGrid:z.enum(Object.keys(scoreDisplayGrids)).default('off')};
export const regionNotationExportSchema=z.object({regionId:z.string().min(1).max(100),...view}).strict();
export const scoreNotationExportSchema=z.object({trackIds:z.array(z.string().min(1).max(100)).min(1).max(128),...view}).strict();
export function prepareRegionNotationExport(session,value){
 const options=regionNotationExportSchema.parse(value),notation=scoreDisplayTiming(session,options.displayGrid),{track,region}=resolveMusicxmlRegion(notation,options.regionId),display=scorePitchView(notation,track,options.pitchMode);
 return {...options,name:region.name,xml:exportRegionMusicxml(display.session,display.track,region)};
}
export function prepareScoreNotationExport(session,value){
 const options=scoreNotationExportSchema.parse(value),notation=scoreDisplayTiming(session,options.displayGrid),display=scorePitchView(notation,null,options.pitchMode);
 return {...options,xml:exportScoreMusicxml(display.session,options.trackIds)};
}
