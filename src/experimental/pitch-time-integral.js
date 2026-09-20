// Range sums avoid subtracting two large prefix totals when a quiet/low-pitched
// passage follows an extreme bend. A seek queries only O(log N) complete spans.
export function compilePitchTimeIntegral(points){
 const rates=points.map(p=>2**(p.cents/1200));let size=1;while(size<points.length)size*=2;const tree=new Float64Array(size*2);
 for(let i=0;i<points.length-1;i++)tree[size+i]=(points[i+1].time-points[i].time)*rates[i];
 for(let i=size-1;i>0;i--)tree[i]=tree[i*2]+tree[i*2+1];
 const index=time=>{let lo=0,hi=points.length;while(lo<hi){const mid=(lo+hi)>>>1;if(points[mid].time<=time)lo=mid+1;else hi=mid;}return Math.max(0,lo-1);};
 const sum=(from,to)=>{let total=0;for(let left=from+size,right=to+size;left<right;left>>=1,right>>=1){if(left&1)total+=tree[left++];if(right&1)total+=tree[--right];}return total;};
 return (start,end)=>{
  if(end<=start)return 0;const first=index(start),last=index(end);if(first===last)return (end-start)*rates[first];
  return (points[first+1].time-start)*rates[first]+sum(first+1,last)+(end-points[last].time)*rates[last];
 };
}
