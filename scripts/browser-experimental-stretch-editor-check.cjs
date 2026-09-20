const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'stretch-test',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));
 await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));await page.route('**/api/daw',r=>r.fulfill({json:{configured:false}}));
 await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');
 const rate=48000,frames=rate*2,wav=Buffer.alloc(44+frames*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(frames*2,40);for(let i=0;i<frames;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/rate)*12000),44+i*2);
 await page.locator('#daw-files').setInputFiles({name:'tone.wav',mimeType:'audio/wav',buffer:wav});
 const session=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:stretch-test')));
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:stretch-test'))?.tracks?.length===1);
 const original=(await session()).tracks[0].regions[0];await page.locator(`[data-region="${original.id}"]`).click();
 await page.locator('[data-audio-stretch-panel] > summary').click();await page.locator('[data-audio-stretch] [name=percent]').fill('150');await page.getByRole('button',{name:'Stretch to new track',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:stretch-test'))?.tracks?.length===2);
 let s=await session();assert.equal(s.tracks[0].regions[0].mute,true);const stretched=s.tracks[1].regions[0];assert.ok(Math.abs(stretched.duration-3)<1e-4);assert.notEqual(stretched.assetId,original.assetId);
 await page.locator('[data-action=undo]').click();s=await session();assert.equal(s.tracks.length,1);assert.equal(s.tracks[0].regions[0].mute,false);
 await page.locator('[data-action=redo]').click();await page.reload();await page.locator(`[data-region="${stretched.id}"]`).waitFor();assert.equal((await session()).tracks.length,2);
 const stored=await page.evaluate(async id=>{const {assetStore}=await import('/src/experimental/media-store.js');const records=await assetStore('stretch-test','readonly'),file=records.find(r=>r.id===id)?.file;if(!file)return null;const ctx=new AudioContext();try{const audio=await ctx.decodeAudioData(await file.arrayBuffer());return {duration:audio.duration,peak:audio.getChannelData(0).reduce((p,v)=>Math.max(p,Math.abs(v)),0),count:records.length};}finally{await ctx.close();}},stretched.assetId);assert.ok(stored);assert.ok(Math.abs(stored.duration-3)<1e-4);assert.ok(stored.peak>.1);assert.equal(stored.count,2);
 assert.deepEqual(errors,[]);console.log('PASS: import, stretch editor, new asset, duration, original preservation, undo/redo and reload.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
