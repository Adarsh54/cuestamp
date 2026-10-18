// Convert additive/composite MusicXML meters to the session's single fraction.
// Preserve the largest written beat unit denominator rather than reducing 6/8
// to 3/4. Grouping accents/engraving are not represented in the session yet.
export function musicxmlMeter(pairs){
 if(!Array.isArray(pairs)||!pairs.length||pairs.length>32)throw Error('Unsupported MusicXML time signature.');
 const groups=pairs.map(({beats,denominator})=>{
  if(typeof beats!=='string'||!/^\s*\d+\s*(?:\+\s*\d+\s*)*$/.test(beats))throw Error('Invalid MusicXML meter numerator.');
  if(typeof denominator==='string'&&!/^\s*\d+\s*$/.test(denominator))throw Error('Invalid MusicXML meter denominator.');
  const terms=beats.split('+').map(Number),unit=Number(denominator);
  if(terms.some(n=>!Number.isInteger(n)||n<1||n>32)||![1,2,4,8,16,32].includes(unit))throw Error('Unsupported MusicXML time signature.');
  return {beats:terms.reduce((a,b)=>a+b,0),denominator:unit};
 });
 const denominator=Math.max(...groups.map(g=>g.denominator));
 const beats=groups.reduce((sum,g)=>sum+g.beats*denominator/g.denominator,0);
 if(beats>32)throw Error('MusicXML meter exceeds 32 beats per measure.');
 return {beats,denominator};
}
export function musicxmlTime(time){
 const nodes=[...time.children].filter(n=>n.localName!=='interchangeable');
 if(time.hasAttribute('number'))throw Error('Per-staff MusicXML time signatures are not supported.');
 if(!nodes.length||nodes.length%2)throw Error('Unsupported MusicXML time signature.');
 const pairs=[];
 for(let i=0;i<nodes.length;i+=2){
  if(nodes[i].localName!=='beats'||nodes[i+1].localName!=='beat-type')throw Error('MusicXML time requires ordered beats and beat-type pairs.');
  pairs.push({beats:nodes[i].textContent.trim(),denominator:nodes[i+1].textContent.trim()});
 }
 return musicxmlMeter(pairs);
}
