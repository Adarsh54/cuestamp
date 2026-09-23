const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage();await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:false,user:null}}));await page.goto(process.env.CUESTAMP_URL||'http://127.0.0.1:5190/');
 const result=await page.evaluate(async()=>{
  const {SessionHistory}=await import('/src/experimental/session.js'),{scheduleSession}=await import('/src/experimental/audio-engine.js');
  const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'a',kind:'audio'}},{op:'track.add',values:{id:'b',kind:'midi',instrument:'sine'}},{op:'track.add',values:{id:'bus',kind:'bus'}},{op:'track.set',target:'a',values:{pan:-1,output:'bus'}},{op:'track.set',target:'b',values:{pan:1}},{op:'effect.add',target:'a',values:{kind:'delay',time:.2,feedback:0,mix:1}},{op:'effect.add',target:'bus',values:{kind:'gain',gainDb:-6}},{op:'region.add',target:'a',values:{id:'ar',assetId:'positive',duration:2}},{op:'region.add',target:'b',values:{id:'br',duration:2}},{op:'note.add',target:'br',values:{pitch:69,start:0,duration:2,velocity:.7}}]);
  const before=JSON.stringify(h.session),c=new OfflineAudioContext(2,96000,48000),buffers=new Map();for(const [id,value] of [['positive',.2],['negative',-.2]]){const b=c.createBuffer(1,96000,48000);b.getChannelData(0).fill(value);buffers.set(id,b);}
  const graph=scheduleSession(c,h.session,buffers,0,{baseTime:0,endPosition:2}),source=h.session.tracks[0].regions[0],errors=[];
  try{graph.replaceTrackRegions('a',[{...source,assetId:'missing'}],{when:.4});}catch(e){errors.push(e.message);}
  graph.replaceTrackRegions('a',[{...source,assetId:'negative',duration:1}],{when:.5,duration:.4});
  try{graph.replaceTrackRegions('a',[source],{when:.6});}catch(e){errors.push(e.message);}
  try{graph.replaceTrackRegions('bus',[source],{when:.6});}catch(e){errors.push(e.message);}
  const rendered=await c.startRendering(),left=rendered.getChannelData(0),right=rendered.getChannelData(1),sample=t=>left[Math.floor(t*48000)],rms=t=>{let power=0;for(let i=Math.floor(t*48000);i<Math.floor((t+.1)*48000);i++)power+=right[i]**2;return Math.sqrt(power/4800);};
  graph.collectVoices();graph.stop();graph.stop();try{graph.replaceTrackRegions('a',[source],{when:3});}catch(e){errors.push(e.message);}
  return {left:[sample(.4),sample(.55),sample(.65),sample(.8),sample(1.2)],right:[rms(.3),rms(.8)],unchanged:before===JSON.stringify(h.session),errors};
 });
 assert.ok(result.left[0]>.01&&result.left[0]<.2);
 assert.ok(result.left[1]>.01&&result.left[2]>.01,'existing delay history must continue after the clip handoff');
 assert.ok(result.left[3]<-.01,'new clip must enter the same delayed mixer path');
 assert.ok(Math.abs(result.left[4])<1e-8,'cell duration ends its voices while letting delay finish');
 assert.ok(result.right[0]>.01);assert.ok(Math.abs(result.right[0]-result.right[1])<1e-6,'other MIDI track must continue unchanged');
 assert.equal(result.unchanged,true);assert.match(result.errors[0],/Missing audio/);assert.match(result.errors[1],/pending clip/);assert.match(result.errors[2],/audio or MIDI/);assert.match(result.errors[3],/stopped/);
 const stopped=await page.evaluate(async()=>{
  const {SessionHistory}=await import('/src/experimental/session.js'),{scheduleSession}=await import('/src/experimental/audio-engine.js'),h=new SessionHistory();
  h.execute([{op:'track.add',values:{id:'a',kind:'audio'}},{op:'track.add',values:{id:'b',kind:'audio'}},{op:'track.set',target:'a',values:{pan:-1}},{op:'track.set',target:'b',values:{pan:1}},{op:'effect.add',target:'a',values:{kind:'delay',time:.2,feedback:0,mix:1}},{op:'region.add',target:'a',values:{id:'ar',assetId:'positive',duration:2}},{op:'region.add',target:'b',values:{id:'br',assetId:'positive',duration:2}}]);
  const c=new OfflineAudioContext(2,96000,48000),buffers=new Map();for(const [id,value] of [['positive',.2],['negative',-.2]]){const b=c.createBuffer(1,96000,48000);b.getChannelData(0).fill(value);buffers.set(id,b);}
  const graph=scheduleSession(c,h.session,buffers,0,{baseTime:0,endPosition:2}),source=h.session.tracks[0].regions[0];
  graph.replaceTrackRegions('a',[{...source,assetId:'negative'}],{when:.5});
  graph.stopTrackRegions('a',{when:.2});
  const suspended=c.suspend(.3),rendering=c.startRendering();await suspended;
  graph.collectVoices();graph.replaceTrackRegions('a',[{...source,assetId:'negative'}],{when:.8,duration:.2});
  await c.resume();const rendered=await rendering,at=(channel,t)=>rendered.getChannelData(channel)[Math.floor(t*48000)];graph.stop();
  return {left:[.3,.45,.75,1.1,1.3].map(t=>at(0,t)),right:[.3,1.1].map(t=>at(1,t))};
 });
 assert.ok(stopped.left[0]>.01,'old effect tail survives the track stop');
 assert.ok(Math.abs(stopped.left[1])<1e-8&&Math.abs(stopped.left[2])<1e-8,'pending launch must remain canceled');
 assert.ok(stopped.left[3]<-.01,'track can launch again after stop cleanup');assert.ok(Math.abs(stopped.left[4])<1e-8);
 assert.ok(stopped.right[0]>.01);assert.ok(Math.abs(stopped.right[0]-stopped.right[1])<1e-8);
 console.log('PASS independent track voice replacement, persistent delay/bus state, unaffected MIDI playback, failed/pending launch guards and cleanup.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
