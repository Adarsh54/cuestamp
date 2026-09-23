export function slippedSourceOffset(region,seconds,sourceDuration){
 if(!Number.isFinite(seconds)||!Number.isFinite(sourceDuration)||sourceDuration<=0)throw Error('Source duration and slip amount must be valid.');
 const offset=region.offset+seconds;
 if(offset<0||offset+region.duration>sourceDuration+1e-9)throw Error('The slipped clip must stay inside the original recording.');
 return Math.max(0,offset);
}
export function sourceSlipView(track,region,disabled=false){return track?.kind==='audio'&&region?.assetId?`<form data-source-slip class="daw-region-group"><strong>Slip source</strong><label>Source shift · seconds<input name="seconds" type="number" step="any" value="0" required></label><button ${disabled?'disabled':''}>Slip source</button><small>Positive values use a later part of the original recording; negative values use an earlier part. Clip position, length, fades and playback direction stay fixed.</small></form>`:'';}
export function bindSourceSlip(root,{region,decode,execute,guard,blocked=()=>false,revision}){const form=root.querySelector('[data-source-slip]');if(!form)return;form.onsubmit=guard(async event=>{event.preventDefault();if(blocked())throw Error('Finish the current operation before slipping the source.');const seconds=Number(new FormData(form).get('seconds'));if(!Number.isFinite(seconds))throw Error('Enter a valid source shift.');if(seconds===0)return;const buffer=await decode(region.assetId);if(blocked()||!form.isConnected)throw Error('The editor changed while loading the source. Try again.');const offset=slippedSourceOffset(region,seconds,buffer.duration);execute([{op:'region.set',target:region.id,values:{offset}}],'Slipped audio source',revision);});}

export function draggedSourceOffset(region,seconds,sourceDuration){
 if(!Number.isFinite(seconds)||!Number.isFinite(sourceDuration)||sourceDuration<region.duration)throw Error('Load a source recording long enough for this clip before slip editing.');
 return Math.max(0,Math.min(sourceDuration-region.duration,region.offset+(region.reverse?seconds:-seconds)));
}
