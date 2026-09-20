const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.testAudioTime=0;window.AudioContext=class extends OfflineAudioContext{constructor(){super(2,48000,48000);}get currentTime(){return window.testAudioTime;}async resume(){}};});
 await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'touch-test',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));
 await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));await page.route('**/api/daw',r=>r.fulfill({json:{configured:false}}));
 await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');
 await page.getByText('Command harness',{exact:true}).click();
 await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',name:'Test',start:0,duration:20}}]));await page.locator('[data-action=json]').click();
 const session=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:touch-test')));
 assert.equal((await session()).tracks.length,1);
 await page.locator('[data-touch-mode]').selectOption('touch');await page.locator('[data-action=play]').click();await page.getByRole('button',{name:'Pause',exact:true}).waitFor();
 const input=async(time,value)=>page.evaluate(({time,value})=>{window.testAudioTime=time;const el=document.querySelector('[data-mix-gain="t"]');el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},{time,value});
 await input(1,-6);await input(2,-12);await page.evaluate(()=>{window.testAudioTime=3;document.querySelector('[data-mix-gain="t"]').dispatchEvent(new Event('change',{bubbles:true}));});
 await page.getByText('Recorded Touch automation',{exact:true}).first().waitFor();assert.ok((await session()).tracks[0].automation.length>=4);assert.equal(await page.locator('[data-action=play]').textContent(),'Pause');
 const revision=(await session()).revision;await input(4,-3);await page.locator('[data-mix-gain="t"]').dispatchEvent('keydown',{key:'Escape'});assert.equal((await session()).revision,revision);
 await input(5,-9);await page.evaluate(()=>window.testAudioTime=6);await page.locator('[data-action=stop]').click();assert.equal((await session()).revision,revision+1);assert.equal(await page.locator('[data-action=play]').textContent(),'Play');
 await page.locator('[data-action=undo]').click();assert.equal((await session()).tracks[0].automation.some(p=>p.time>4),false);
 // Latch several lanes, retain them through repaint, and save/discard whole passes.
 await page.locator('[data-touch-mode]').selectOption('latch');await page.locator('[data-action=play]').click();await page.getByRole('button',{name:'Pause',exact:true}).waitFor();
 const latchRevision=(await session()).revision;await input(7,-15);await page.locator('[data-mix-gain="t"]').dispatchEvent('change');
 assert.equal((await session()).revision,latchRevision);assert.equal(await page.locator('[data-mix-gain="t"]').inputValue(),'-15');
 await page.evaluate(()=>{window.testAudioTime=8;const el=document.querySelector('[data-mix-pan="t"]');el.value='.5';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.getByText('2 automation lanes recording',{exact:true}).waitFor();assert.equal(await page.locator('[data-mix-gain="t"]').inputValue(),'-15');
 await page.evaluate(()=>window.testAudioTime=12);await page.locator('[data-action=stop]').click();assert.equal((await session()).revision,latchRevision+1);assert.ok((await session()).tracks[0].automation.some(p=>p.parameter==='pan'&&p.time>5&&p.value===.5));
 await page.locator('[data-action=undo]').click();assert.equal((await session()).tracks[0].automation.some(p=>p.parameter==='pan'),false);
 await page.locator('[data-action=play]').click();await page.getByRole('button',{name:'Pause',exact:true}).waitFor();await input(13,-5);await page.locator('[data-mix-gain="t"]').dispatchEvent('change');const discardRevision=(await session()).revision;await page.locator('[data-touch-cancel]').click();await page.locator('[data-action=stop]').click();assert.equal((await session()).revision,discardRevision);
 // Automated controls follow transport, without overwriting an in-progress drag.
 await page.locator('[data-touch-mode]').selectOption('static');
 await page.locator('#daw-json').evaluate(el=>el.closest('details').open=true);
 await page.locator('#daw-json').fill(JSON.stringify([{op:'automation.clear',target:'t',values:{parameter:'gainDb'}},{op:'automation.point',target:'t',values:{parameter:'gainDb',time:0,value:-24}},{op:'automation.point',target:'t',values:{parameter:'gainDb',time:10,value:0}},{op:'marker.add',values:{id:'seek-test',name:'Seek test',time:5}}]));await page.locator('[data-action=json]').click();
 await page.locator('[data-action=play]').click();await page.getByRole('button',{name:'Pause',exact:true}).waitFor();await page.evaluate(()=>window.testAudioTime=18.025);
 await page.waitForFunction(()=>Math.abs(Number(document.querySelector('[data-mix-gain="t"]').value)+12)<.01);
 await page.locator('[data-mix-gain="t"]').dispatchEvent('pointerdown');const clock=await page.locator('[data-clock]').textContent();await page.evaluate(()=>{document.querySelector('[data-mix-gain="t"]').value='-7';window.testAudioTime=20.025;});
 // Wait for a confirmed timer tick, then ensure it respected the held control.
 await page.waitForFunction(old=>document.querySelector('[data-clock]').textContent!==old,clock);assert.equal(await page.locator('[data-mix-gain="t"]').inputValue(),'-7');
 await page.locator('[data-mix-gain="t"]').dispatchEvent('pointerup');await page.waitForFunction(()=>document.querySelector('[data-mix-gain="t"]').parentElement.querySelector('output').textContent==='-7.2 dB');
 await page.locator('[data-marker-jump="seek-test"]').first().click();assert.equal(await page.locator('[data-mix-gain="t"]').inputValue(),'-12');
 // Write starts both selected-channel lanes without touching either fader.
 await page.locator('[data-touch-mode]').selectOption('write');const beforeWrite=await session();await page.locator('[data-action=play]').click();await page.getByRole('button',{name:'Pause',exact:true}).waitFor();await page.getByText('2 automation lanes recording',{exact:true}).waitFor();
 await page.evaluate(()=>window.testAudioTime=22.05);await page.locator('[data-action=stop]').click();const afterWrite=await session();assert.equal(afterWrite.revision,beforeWrite.revision+1);assert.equal(await page.locator('[data-touch-mode]').inputValue(),'touch');
 assert.ok(afterWrite.tracks[0].automation.some(p=>p.parameter==='gainDb'&&p.time>6&&p.value===-12));assert.ok(afterWrite.tracks[0].automation.some(p=>p.parameter==='pan'&&p.time>6));await page.locator('[data-action=undo]').click();assert.deepEqual((await session()).tracks,beforeWrite.tracks);
 // Discarding an active Write pass leaves playback running in Touch.
 await page.locator('[data-touch-mode]').selectOption('write');await page.locator('[data-action=play]').click();await page.getByRole('button',{name:'Pause',exact:true}).waitFor();await page.locator('[data-touch-cancel]').click();assert.equal(await page.locator('[data-touch-mode]').inputValue(),'touch');await page.locator('[data-action=stop]').click();assert.deepEqual((await session()).tracks,beforeWrite.tracks);
 // Range Trim changes the curve only within the requested passage.
 await page.getByText('Trim curve over a time range',{exact:true}).click();const trimForm=page.locator('[data-auto-trim]'),beforeTrim=await session();await trimForm.locator('[name=start]').fill('2');await trimForm.locator('[name=end]').fill('8');await trimForm.locator('[name=amount]').fill('3');await trimForm.getByRole('button',{name:'Apply trim',exact:true}).click();
 const trimValues=await page.evaluate(async()=>{const {curveAutomationValue}=await import('/src/experimental/automation-curves.js');const s=JSON.parse(localStorage.getItem('cuestamp-experimental:touch-test'));return [1,5,9].map(t=>curveAutomationValue(s.tracks[0].automation,'gainDb',t,0));});for(const [i,v]of [-21.6,-9,-2.4].entries())assert.ok(Math.abs(trimValues[i]-v)<1e-8,JSON.stringify({trimValues,expected:[-21.6,-9,-2.4],before:beforeTrim.tracks[0].automation,after:(await session()).tracks[0].automation}));await page.locator('[data-action=undo]').click();assert.deepEqual((await session()).tracks,beforeTrim.tracks);
 // Verify actual rendered audio separately from the UI's controllable clock.
 const rendered=await page.evaluate(async()=>{
  const {scheduleSession}=await import('/src/experimental/audio-engine.js'),{newSession,SessionHistory}=await import('/src/experimental/session.js');
  const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'a',kind:'audio'}},{op:'region.add',target:'a',values:{assetId:'constant',start:0,duration:1}}]);
  const ctx=new OfflineAudioContext(2,48000,48000),source=ctx.createBuffer(1,48000,48000);source.getChannelData(0).fill(.2);
  const p=scheduleSession(ctx,h.session,new Map([['constant',source]]),0,{baseTime:0});
  const pause=ctx.suspend(.25);const rendering=ctx.startRendering();await pause;p.automation.set('a','gainDb',-20);
  const pause2=ctx.suspend(.5);await ctx.resume();await pause2;p.automation.release('a','gainDb',.1);await ctx.resume();const buffer=await rendering,d=buffer.getChannelData(0);
  return [.1,.4,.8].map(t=>d[Math.floor(t*48000)]);
 });
 assert.ok(Math.abs(rendered[1]/rendered[0]-.1)<.001);assert.ok(Math.abs(rendered[2]/rendered[0]-1)<.001);assert.deepEqual(errors,[]);
 const trimRatios=await page.evaluate(async()=>{
  const {scheduleSession}=await import('/src/experimental/audio-engine.js'),{newSession,SessionHistory}=await import('/src/experimental/session.js');const h=new SessionHistory(newSession());
  h.execute([{op:'track.add',values:{id:'audio',kind:'audio'}},{op:'region.add',target:'audio',values:{assetId:'signal',start:0,duration:1}},{op:'automation.point',target:'audio',values:{parameter:'gainDb',time:0,value:-24}},{op:'automation.point',target:'audio',values:{parameter:'gainDb',time:1,value:-12}}]);
  const original=structuredClone(h.session);h.execute([{op:'automation.trimRecord',target:'audio',values:{parameter:'gainDb',samples:JSON.stringify([{time:.2,value:3},{time:.6,value:6}]),returnSeconds:.2}}]);const rendered=[];
  for(const session of [original,h.session]){const ctx=new OfflineAudioContext(2,48000,48000),buffer=ctx.createBuffer(1,48000,48000);buffer.getChannelData(0).fill(.2);scheduleSession(ctx,session,new Map([['signal',buffer]]),0,{baseTime:0});const output=await ctx.startRendering();rendered.push([.1,.4,.7,.9].map(t=>output.getChannelData(0)[Math.round(t*48000)]));}
  return rendered[1].map((v,i)=>v/rendered[0][i]);
 });
 for(const [i,offset]of [0,4.5,3,0].entries())assert.ok(Math.abs(trimRatios[i]-10**(offset/20))<.001);
 console.log('PASS range Trim UI/undo; Write start/stop/undo/discard; automated fader playback/seek/drag protection; Touch/Latch UI release, held readback, multi-lane stop/undo/discard, Escape; actual offline audio override/return and changing Trim render. Physical/realtime audio not tested.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
