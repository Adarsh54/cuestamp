// Signature points are anchored to one-based bars; musical time is measured in
// quarter notes independently of each signature's denominator.
export function compileMeterMap({meter=4,meterDenominator=4,meterChanges=[]}={}){
 const denominators=[1,2,4,8,16,32,64],valid=(numerator,denominator)=>Number.isInteger(numerator)&&numerator>=1&&numerator<=32&&denominators.includes(denominator);
 if(!valid(meter,meterDenominator)||!Array.isArray(meterChanges)||meterChanges.length>256)throw Error('Use 1–32 beats, a power-of-two denominator from 1–64, and at most 256 signature changes.');
 const changes=meterChanges.map(p=>{if(!p||!Number.isInteger(p.bar)||p.bar<2||p.bar>10000000||!valid(p.numerator,p.denominator))throw Error('Signature changes need a whole bar from 2 and a supported time signature.');return {...p};}).sort((a,b)=>a.bar-b.bar);
 const points=[{bar:1,beat:0,numerator:meter,denominator:meterDenominator}];
 for(const p of changes){const previous=points.at(-1);if(p.bar===previous.bar)throw Error('Only one signature change can occupy a bar.');const beat=previous.beat+(p.bar-previous.bar)*previous.numerator*4/previous.denominator;if(beat>432000)throw Error('Signature changes exceed the musical timeline.');points.push({bar:p.bar,beat,numerator:p.numerator,denominator:p.denominator,...(p.id===undefined?{}:{id:p.id})});}
 for(const p of points)Object.freeze(p);Object.freeze(points);
 const find=(value,key)=>{if(!Number.isFinite(value))throw Error('Choose a finite musical position.');let lo=0,hi=points.length;while(lo<hi){const mid=(lo+hi)>>1;if(points[mid][key]<=value)lo=mid+1;else hi=mid;}return points[Math.max(0,lo-1)];};
 const signatureAtBar=bar=>{if(!Number.isInteger(bar)||bar<1||bar>10000000)throw Error('Choose a whole bar from 1.');return find(bar,'bar');};
 const barStart=bar=>{const p=signatureAtBar(bar);return p.beat+(bar-p.bar)*p.numerator*4/p.denominator;};
 return Object.freeze({points,hasChanges:points.length>1,signatureAtBar,signatureAtBeat:beat=>find(beat,'beat'),barStart,
  positionAtBeat(quarterBeat){if(!Number.isFinite(quarterBeat)||quarterBeat<0)throw Error('Choose a nonnegative musical position.');const p=find(quarterBeat,'beat'),units=(quarterBeat-p.beat)*p.denominator/4,barOffset=Math.floor(units/p.numerator),within=units-barOffset*p.numerator;return {bar:p.bar+barOffset,beat:Math.floor(within)+1,fraction:within-Math.floor(within)};},
  beatAtPosition(bar,beat=1,fraction=0){const p=signatureAtBar(bar);if(!Number.isInteger(beat)||beat<1||beat>p.numerator||!Number.isFinite(fraction)||fraction<0||fraction>=1)throw Error(`Use beats 1–${p.numerator} and a fraction from 0 up to 1.`);return barStart(bar)+(beat-1+fraction)*4/p.denominator;}
 });
}
