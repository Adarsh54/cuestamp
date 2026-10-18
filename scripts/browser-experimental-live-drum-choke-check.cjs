const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{const page=await browser.newPage();await page.goto(process.env.CUESTAMP_URL||'http://127.0.0.1:5190/');const results=await page.evaluate(async()=>{
 const {createLiveMidiMonitor}=await import('/src/experimental/live-midi-monitor.js'),{scheduleTrackVoices}=await import('/src/experimental/audio-voices.js'),{SessionHistory}=await import('/src/experimental/session.js');
 const rate=48000;
 const reference=async(notes,separate=false)=>{const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'midi',instrument:'drumKit'}},{op:'region.add',target:'t',values:{id:'r',duration:1}},...notes.map(n=>({op:'note.add',target:'r',values:{duration:.1,channel:9,...n}}))]);const c=new OfflineAudioContext(1,rate,rate),t=h.session.tracks[0];if(separate){for(const note of t.regions[0].notes)scheduleTrackVoices(c,{...t,regions:[{...t.regions[0],notes:[note]}]},new Map(),c.destination,0,0).open(0);}else scheduleTrackVoices(c,t,new Map(),c.destination,0,0).open(0);return(await c.startRendering()).getChannelData(0);};
 const results=[];
 for(const [name,pitch,velocity,simultaneous,reverse,independent] of [['closed',42,100],['pedal',44,100],['retrigger',46,100],['zero velocity',42,0],['simultaneous open hits',46,100,true,false],['simultaneous closed first',42,100,true,true],['simultaneous open first',42,100,true,false],['separate kit',42,100,false,false,true]]){
  const c=new OfflineAudioContext(1,rate,rate),monitor=createLiveMidiMonitor(c,{instrument:'drumKit'}),other=independent?createLiveMidiMonitor(c,{instrument:'drumKit'}):monitor;
  if(reverse)other.push([0x93,pitch,velocity]);monitor.push([0x99,46,100]);let at=0,rendering;
  if(simultaneous){if(!reverse)other.push([0x93,pitch,velocity]);rendering=c.startRendering();}
  else{const pause=c.suspend(.2);rendering=c.startRendering();await pause;at=c.currentTime;other.push([0x93,pitch,velocity]);await c.resume();}
  const live=(await rendering).getChannelData(0);monitor.stop();if(independent)other.stop();
  const notes=[{pitch:46,start:0,velocity:100/127},...(velocity?[{pitch,start:at,velocity:velocity/127}]:[])],expected=await reference(notes,independent);let maximum=0;for(let i=0;i<live.length;i++)maximum=Math.max(maximum,Math.abs(live[i]-expected[i]));results.push({name,maximum});
 }
 return results;
});for(const result of results)assert.ok(result.maximum<1e-6,JSON.stringify(result));console.log('PASS live drum choke matches recorded rendering, including pedal, retrigger, zero velocity, simultaneous ordering and independent kits.',results);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
