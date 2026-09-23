export function hitAttackMarker(markers,view,x,y,width,height){
 if(y<0||y>Math.min(18,height)||width<=0)return -1;let found=-1,distance=9;
 markers.forEach((time,i)=>{const px=(time-view.start)/view.span*width;if(px<0||px>width)return;const delta=Math.abs(px-x);if(delta<distance){found=i;distance=delta;}});return found;
}
export function draggedAttackPosition(markers,index,time,duration,sampleRate){
 if(!Number.isInteger(index)||index<0||index>=markers.length||!Number.isFinite(time)||!Number.isFinite(sampleRate)||sampleRate<=0)throw Error('Choose a valid attack marker.');
 const low=Math.max(1,index?Math.floor(markers[index-1]*sampleRate)+1:1),high=Math.min(Math.ceil(duration*sampleRate)-1,index+1<markers.length?Math.ceil(markers[index+1]*sampleRate)-1:Infinity);
 if(low>high)throw Error('There is no sample between the neighboring markers.');return Math.max(low,Math.min(high,Math.round(time*sampleRate)))/sampleRate;
}
