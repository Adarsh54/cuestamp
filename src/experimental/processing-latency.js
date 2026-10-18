import {validateRouting} from './routing.js';
// Routing-only model: intentional echoes, reverb tails and filter phase are not
// plug-in processing latency. Compressor timing is overridable for host calibration.
export function createProcessingLatencyPlan(session,sampleRate,{compressorFrames=Math.floor(.006*sampleRate)}={}){
 if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>384000)throw Error('Choose a valid latency-planning sample rate.');
 if(!Number.isSafeInteger(compressorFrames)||compressorFrames<0||compressorFrames>sampleRate)throw Error('Invalid measured compressor latency.');
 validateRouting(session);
 const channels=session.tracks.filter(track=>track.kind!=='video'),byId=new Map(channels.map(track=>[track.id,track])),incoming=new Map(channels.map(track=>[track.id,[]])),edges=[];
 const latency=effect=>!effect.enabled?0:effect.kind==='compressor'?compressorFrames:effect.kind==='limiter'?Math.round(effect.lookaheadMs*sampleRate/1000):0;
 for(const track of channels){edges.push({from:track.id,to:track.output||null,kind:'output'});for(const send of track.sends||[])edges.push({from:track.id,to:send.busId,kind:'send'});}
 for(const edge of edges)if(edge.to!==null)incoming.get(edge.to).push(edge);
 const tracks=new Map();
 function channel(id){if(tracks.has(id))return tracks.get(id);const track=byId.get(id),inputFrames=Math.max(0,...incoming.get(id).map(edge=>channel(edge.from).outputFrames));let outputFrames=inputFrames;
  const effects=(track.effects||[]).map(effect=>{const inputFrames=outputFrames,latencyFrames=latency(effect);outputFrames+=latencyFrames;return {id:effect.id,inputFrames,latencyFrames,outputFrames};});
  const value={id,inputFrames,outputFrames,effects};tracks.set(id,value);return value;
 }
 for(const track of channels)channel(track.id);
 const masterInputFrames=Math.max(0,...edges.filter(edge=>edge.to===null).map(edge=>tracks.get(edge.from).outputFrames));let totalFrames=masterInputFrames;
 const masterEffects=(session.masterEffects||[]).map(effect=>{const inputFrames=totalFrames,latencyFrames=latency(effect);totalFrames+=latencyFrames;return {id:effect.id,inputFrames,latencyFrames,outputFrames:totalFrames};});
 const routes=edges.map(edge=>({...edge,delayFrames:(edge.to===null?masterInputFrames:tracks.get(edge.to).inputFrames)-tracks.get(edge.from).outputFrames}));
 const sidechains=[];
 for(const owner of [...channels,{id:null,effects:session.masterEffects||[]}])for(const effect of owner.effects||[]){
  if(!effect.enabled||effect.kind!=='gate'||!effect.sidechainTrackId)continue;
  const target=(owner.id===null?masterEffects:tracks.get(owner.id).effects).find(row=>row.id===effect.id),source=tracks.get(effect.sidechainTrackId);
  sidechains.push({effectId:effect.id,sourceId:effect.sidechainTrackId,delayFrames:target.inputFrames-source.inputFrames});
 }
 return {sampleRate,compressorFrames,tracks:channels.map(track=>tracks.get(track.id)),master:{inputFrames:masterInputFrames,outputFrames:totalFrames,effects:masterEffects},routes,sidechains,totalFrames,seconds:totalFrames/sampleRate};
}
