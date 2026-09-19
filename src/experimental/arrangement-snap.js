import {exactFrameRate} from './timecode.js';
export const arrangementGrids=[['off','Off'],['bar','Bar'],['beat','Beat'],['eighth','1/8 note'],['sixteenth','1/16 note'],['thirtySecond','1/32 note'],['eighthTriplet','1/8 triplet'],['sixteenthTriplet','1/16 triplet'],['frame','Frame'],['second','Second'],['tenth','0.1 second']];
export const defaultArrangementSnap={grid:'sixteenth',alignment:'relative'};
export function arrangementStep(session,grid='sixteenth'){
 if(grid==='off')return 0;
 if(grid==='frame')return 1/exactFrameRate(session.frameRate||24);
 if(grid==='second')return 1;if(grid==='tenth')return .1;
 const beats={bar:session.meter||4,beat:1,eighth:.5,sixteenth:.25,thirtySecond:.125,eighthTriplet:1/3,sixteenthTriplet:1/6}[grid];
 if(beats===undefined)throw Error('Choose a valid arrangement snap grid.');return 60/session.tempo*beats;
}
export function snapArrangementTime(session,time,grid='sixteenth',bypass=false){const step=arrangementStep(session,grid);return bypass||!step?time:Math.round(time/step)*step;}
export function snapArrangementDelta(session,delta,anchor,settings=defaultArrangementSnap,bypass=false){
 if(bypass||settings.grid==='off')return delta;
 if(settings.alignment==='absolute')return snapArrangementTime(session,anchor+delta,settings.grid)-anchor;
 return snapArrangementTime(session,delta,settings.grid);
}
export function arrangementGridSpacing(session,zoom,grid){let pixels=arrangementStep(session,grid)*zoom;if(!pixels)return 0;while(pixels<8)pixels*=2;return pixels;}
export function arrangementSnapView(settings,tool,disabled){const alignment=tool==='scissors'?'absolute':settings.alignment;return `<label>Snap<select data-arrangement-snap aria-label="Arrangement snap" ${disabled?'disabled':''}>${arrangementGrids.map(([value,label])=>`<option value="${value}" ${settings.grid===value?'selected':''}>${label}</option>`).join('')}</select></label><label>Alignment<select data-arrangement-alignment aria-label="Snap alignment" ${disabled||tool==='scissors'||settings.grid==='off'?'disabled':''}><option value="relative" ${alignment==='relative'?'selected':''}>Relative</option><option value="absolute" ${alignment==='absolute'?'selected':''}>Absolute</option></select></label>`;}
