const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage();await page.goto(process.env.CUESTAMP_URL||'http://127.0.0.1:5190/');
 const results=await page.evaluate(async()=>{
  const {SessionHistory}=await import('/src/experimental/session.js'),{scheduleTrackVoices}=await import('/src/experimental/audio-voices.js');
  async function render({open=true,closed=true,muted=false,position=0,separate=false,simultaneous=false}={}){
   const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'midi',instrument:'drumKit'}},{op:'region.add',target:'t',values:{id:'a',duration:1}},{op:'region.add',target:'t',values:{id:'b',start:simultaneous?0:.2,duration:.8}},...(open?[{op:'note.add',target:'a',values:{id:'open',pitch:46,channel:9,start:0,duration:.1}}]:[]),...(closed?[{op:'note.add',target:'b',values:{id:'closed',pitch:42,channel:9,start:0,duration:.1,mute:muted}}]:[])]);
   const c=new OfflineAudioContext(1,48000,48000),track=h.session.tracks[0];
   if(separate){for(const region of track.regions){const voice=scheduleTrackVoices(c,{...track,regions:[region]},new Map(),c.destination,position,0);voice.open(0);}}
   else {const voice=scheduleTrackVoices(c,track,new Map(),c.destination,position,0);voice.open(0);}
   return (await c.startRendering()).getChannelData(0);
  }
  const rms=(a,start,end)=>{let sum=0;for(let i=Math.round(start*48000);i<Math.round(end*48000);i++)sum+=a[i]*a[i];return Math.sqrt(sum/((end-start)*48000));};
  const diff=(a,b,from,to,offset=0)=>{let peak=0;for(let i=Math.round(from*48000);i<Math.round(to*48000);i++)peak=Math.max(peak,Math.abs(a[i]-b[i+offset]));return peak;};
  const mixed=await render(),onlyClosed=await render({open:false}),onlyOpen=await render({closed:false}),muted=await render({muted:true}),seek=await render({position:.202}),separate=await render({separate:true}),simultaneous=await render({simultaneous:true}),sameClosed=await render({open:false,simultaneous:true});
  return {before:diff(mixed,onlyOpen,0,.19),after:diff(mixed,onlyClosed,.21,.8),muted:diff(muted,onlyOpen,0,.9),seek:diff(seek,mixed,0,.6,Math.round(.202*48000)),simultaneous:diff(simultaneous,sameClosed,0,.8),separateTail:rms(separate,.4,.6),mixedTail:rms(mixed,.4,.6)};
 });
 assert.ok(results.before<1e-6);assert.ok(results.after<1e-6);assert.ok(results.muted<1e-6);assert.ok(results.seek<1e-5);assert.ok(results.simultaneous<1e-6);assert.ok(results.separateTail>.001);assert.ok(results.mixedTail<1e-7);
 console.log('PASS: real PCM hi-hat cutoff, muted-hit exclusion, simultaneous priority, track isolation and seek inside choke fade',results);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
