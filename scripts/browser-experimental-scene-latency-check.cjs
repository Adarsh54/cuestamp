const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage();await page.route('**/__scene-latency-test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto('http://127.0.0.1:5190/__scene-latency-test');
 const results=await page.evaluate(async()=>{const {SessionHistory}=await import('/src/experimental/session.js'),{sceneAudition,sceneCellPlan}=await import('/src/experimental/scene-playback.js'),{startSceneTransport}=await import('/src/experimental/scene-transport.js');
  const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'audio'}},{op:'region.add',target:'t',values:{id:'positive',assetId:'plus',duration:4}},{op:'region.add',target:'t',values:{id:'negative',assetId:'minus',start:5,duration:4}},{op:'scene.add',values:{id:'a',name:'Positive',regionIds:'positive'}},{op:'scene.add',values:{id:'b',name:'Negative',regionIds:'negative'}},...Array.from({length:16},()=>({op:'effect.add',target:'t',values:{kind:'compressor',ratio:1,threshold:0,knee:0}}))]);
  const results=[];
  for(const mode of ['scene','cell']){
   const context=new OfflineAudioContext(2,48000*3,48000),buffers=new Map();for(const [id,value]of [['plus',.25],['minus',-.25]]){const b=context.createBuffer(1,48000*4,48000);b.getChannelData(0).fill(value);buffers.set(id,b);}
   const before=JSON.stringify(h.session),transport=startSceneTransport(context,{...sceneAudition(h.session,{sceneId:'a',duration:4}),recordPerformance:true},buffers);let switchAt,stopAt;
   if(mode==='scene')switchAt=transport.queue(sceneAudition(h.session,{sceneId:'b',duration:4}),'beat').position;
   else{switchAt=transport.launchCell(sceneCellPlan(h.session,{sceneId:'b',trackId:'t',duration:3,quantization:'beat'})).position;stopAt=transport.stopCell({trackId:'t',quantization:'bar'}).position;}
   const pcm=(await context.startRendering()).getChannelData(0);transport.stop();const first=pcm.findIndex(v=>v>1e-6),negative=pcm.findIndex(v=>v< -1e-6),last=pcm.findLastIndex(v=>Math.abs(v)>1e-6);
   results.push({mode,base:transport.base,switchAt,stopAt,first,negative,last,expectedFirst:Math.round(transport.base*48000),expectedSwitch:Math.round((transport.base+switchAt)*48000),expectedStop:stopAt===undefined?null:Math.round((transport.base+stopAt)*48000)-1,events:transport.performance().events,unchanged:before===JSON.stringify(h.session)});
  }return results;
 });
 for(const row of results){assert.ok(Math.abs(row.first-row.expectedFirst)<=1,JSON.stringify(row));assert.ok(Math.abs(row.negative-row.expectedSwitch)<=1,JSON.stringify(row));if(row.expectedStop!==null)assert.ok(Math.abs(row.last-row.expectedStop)<=1,JSON.stringify(row));assert.ok(row.unchanged);assert.ok(row.events.some(e=>e.sceneId==='b'&&e.start===row.switchAt));}
 console.log(results);console.log('PASS native scene/cell audio switches and cell stop align with audible beats and recorded performance times');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
