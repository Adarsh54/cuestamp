// Captures one forward-moving gesture in timeline seconds. The UI supplies the
// transport position, not wall-clock time, so seek/loop discontinuities reject.
export function createAutomationCapture({start,value,min,max,maxPoints=2000}={}){
 if(![start,value,min,max].every(Number.isFinite)||start<0||start>86400||min>=max||value<min||value>max||!Number.isInteger(maxPoints)||maxPoints<2||maxPoints>2000)throw Error('Invalid automation capture settings.');
 let samples=[{time:start,value}],closed=false;
 const validate=(time,value)=>{if(closed)throw Error('This automation gesture has ended.');if(!Number.isFinite(time)||time<samples.at(-1).time||time>86400)throw Error('Automation recording requires forward timeline movement. End the gesture before seeking or looping.');if(!Number.isFinite(value)||value<min||value>max)throw Error('Automation value is outside the parameter range.');};
 function push(time,value){
  validate(time,value);const next=samples.map(p=>({...p}));
  if(time===next.at(-1).time)next[next.length-1]={time,value};else next.push({time,value});
  // Only remove mathematically collinear samples. Corners and extrema remain;
  // no approximate thinning that could gradually accumulate audible error.
  while(next.length>=3){const [a,b,c]=next.slice(-3),predicted=a.value+(c.value-a.value)*(b.time-a.time)/(c.time-a.time);if(Math.abs(predicted-b.value)>Number.EPSILON*8*Math.max(1,max-min,Math.abs(predicted),Math.abs(b.value)))break;next.splice(-2,1);}
  if(next.length>maxPoints)throw Error('Automation gesture exceeds the point limit. Stop recording this gesture.');
  samples=next;return samples.length;
 }
 return {
  push,
  get count(){return samples.length;},
  get points(){return samples.map(p=>({...p}));},
  finish(time,value=samples.at(-1).value){validate(time,value);if(time<=start)throw Error('An automation gesture needs a positive duration.');push(time,value);closed=true;return samples.map(p=>({...p}));},
  cancel(){closed=true;samples=[];}
 };
}
