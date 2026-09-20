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
 console.log('PASS Touch/Latch UI release, held readback, multi-lane stop/undo/discard, Escape; actual offline audio override/return. Physical/realtime audio not tested.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
