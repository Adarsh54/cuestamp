import {compileMeterMap} from './meter-map.js';
// Translate decoded MIDI quarter-note positions into bar-anchored signatures.
// Mid-bar signatures cannot be silently rounded without changing the score.
export function meterFromMidi(signatures=[]){
 if(!Array.isArray(signatures)||signatures.length>10000)throw Error('Too many MIDI time signatures.');
 const ordered=[...new Map(signatures.map(p=>{
  if(!p||!Number.isFinite(p.beat)||p.beat<0||p.beat>432000||(p.notated32ndsPerQuarter??8)!==8)throw Error('Unsupported MIDI time-signature position or notation scaling.');
  compileMeterMap({meter:p.numerator,meterDenominator:p.denominator});
  return [p.beat,p];
 })).values()].sort((a,b)=>a.beat-b.beat);
 const first=ordered[0]?.beat===0?ordered.shift():{numerator:4,denominator:4},result={meter:first.numerator,meterDenominator:first.denominator,meterChanges:[]};
 let previousBeat=0,previousBar=1,numerator=first.numerator,denominator=first.denominator;
 for(const p of ordered){
  if(p.numerator===numerator&&p.denominator===denominator)continue;
  const bars=(p.beat-previousBeat)/(numerator*4/denominator),whole=Math.round(bars);
  if(Math.abs(bars-whole)>1e-8||whole<1)throw Error('A MIDI time-signature change falls inside a bar. Import without adopting signatures or adjust its position first.');
  const bar=previousBar+whole;result.meterChanges.push({id:crypto.randomUUID(),bar,numerator:p.numerator,denominator:p.denominator});
  previousBeat=p.beat;previousBar=bar;numerator=p.numerator;denominator=p.denominator;
 }
 compileMeterMap(result);return result;
}
