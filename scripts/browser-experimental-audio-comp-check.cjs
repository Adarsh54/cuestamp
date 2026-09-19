const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true,args:['--disable-audio-output']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'transpose',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));
  await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));
  await page.route('**/api/daw',r=>r.fulfill({json:{configured:false}}));
  await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');
  await page.getByText('Session restored on this device.',{exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('[data-audio-input-refresh]')?.disabled);await page.evaluate(()=>document.fonts.ready);

  await page.getByText('Command harness',{exact:true}).click();await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'t',name:'Vocal takes'}},{op:'region.add',target:'t',values:{id:'a',name:'Take one',assetId:'one',duration:2}},{op:'region.add',target:'t',values:{id:'b',name:'Take two',assetId:'two',duration:2}}]));await page.getByRole('button',{name:'Execute commands',exact:true}).click();await page.locator('[data-region=b]').click();
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:transpose')));
  await page.getByText('Build a comp from takes',{exact:true}).click();const add=page.locator('[data-comp-add]'),create=page.locator('[data-comp-create]');await add.locator('[name=regionId]').selectOption('a');await add.locator('[name=end]').fill('1');await add.getByRole('button',{name:'Add section',exact:true}).click();await add.locator('[name=regionId]').selectOption('b');await add.locator('[name=start]').fill('1');await add.getByRole('button',{name:'Add section',exact:true}).click();await create.locator('[name=name]').fill('Best vocal');await page.locator('.daw-audio-comp').screenshot({path:'/tmp/cuestamp-audio-comp.png'});const before=await read();await create.getByRole('button',{name:'Create comp track',exact:true}).click();const after=await read();assert.equal(after.tracks.length,2);assert.equal(after.tracks[0].mute,true);assert.equal(after.tracks[1].name,'Best vocal');assert.deepEqual(after.tracks[1].regions.map(r=>[r.assetId,r.start,r.offset,r.duration]),[['one',0,0,1],['two',1,1,1]]);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).tracks,before.tracks);await page.getByRole('button',{name:'Redo',exact:true}).click();assert.deepEqual((await read()).tracks,after.tracks);
  const pcm=await page.evaluate(async()=>{const {newSession,applyCommands}=await import('/src/experimental/session.js'),{scheduleSession}=await import('/src/experimental/audio-engine.js');let s=applyCommands(newSession(),[{op:'session.set',values:{masterDb:0}},{op:'track.add',values:{id:'t'}},{op:'region.add',target:'t',values:{id:'a',assetId:'one',duration:2}},{op:'region.add',target:'t',values:{id:'b',assetId:'two',duration:2}},{op:'track.comp',target:'t',values:{segments:JSON.stringify([{regionId:'a',start:0,end:.8},{regionId:'b',start:1,end:2}])}}]);const context=new OfflineAudioContext(2,96000,48000),buffers=new Map();for(const [id,value]of [['one',.2],['two',.6]]){const b=context.createBuffer(2,96000,48000);for(let c=0;c<2;c++)b.getChannelData(c).fill(value);buffers.set(id,b);}scheduleSession(context,s,buffers,0,{baseTime:0});const b=await context.startRendering(),data=b.getChannelData(0);return {first:data[24000],gap:data[43200],second:data[72000],start:data[0]};});assert.ok(Math.abs(pcm.first-.2)<1e-6,JSON.stringify(pcm));assert.equal(pcm.gap,0);assert.ok(Math.abs(pcm.second-.6)<1e-6,JSON.stringify(pcm));assert.equal(pcm.start,0);
  const auditionPcm=await page.evaluate(async()=>{
   const {newSession,applyCommands}=await import('/src/experimental/session.js'),{compAuditionPlan}=await import('/src/experimental/audio-comp.js'),{scheduleSession}=await import('/src/experimental/audio-engine.js');
   const source=applyCommands(newSession(),[{op:'session.set',values:{masterDb:-3}},{op:'track.add',values:{id:'t'}},{op:'track.add',values:{id:'bus',kind:'bus'}},{op:'track.set',target:'t',values:{output:'bus',gainDb:-4}},{op:'effect.add',target:'t',values:{kind:'eq'}},{op:'region.add',target:'t',values:{id:'a',assetId:'one',duration:2}},{op:'region.add',target:'t',values:{id:'b',assetId:'two',duration:2}},{op:'region.set',target:'b',values:{reverse:true}}]);
   const before=JSON.stringify(source),results=[];
   for(const muteSource of [true,false]){
    const values={segments:JSON.stringify([{regionId:'a',start:.25,end:.8},{regionId:'b',start:1,end:1.75}]),muteSource},plan=compAuditionPlan(source,'t',values),final=applyCommands(source,[{op:'track.comp',target:'t',values}]);
    const render=async doc=>{const c=new OfflineAudioContext(2,72000,48000),buffers=new Map();for(const [id,f]of [['one',220],['two',440]]){const b=c.createBuffer(2,96000,48000);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=.2*Math.sin(i/48000*2*Math.PI*f);}buffers.set(id,b);}scheduleSession(c,doc,buffers,plan.position,{baseTime:0});return (await c.startRendering()).getChannelData(0);};
    const a=await render(plan.document),b=await render(final);let error=0,energy=0;for(let i=0;i<a.length;i++){error=Math.max(error,Math.abs(a[i]-b[i]));energy+=a[i]*a[i];}results.push({error,energy});
   }
   return {results,unchanged:before===JSON.stringify(source)};
  });assert.equal(auditionPcm.unchanged,true);for(const result of auditionPcm.results){assert.ok(result.error<1e-7,JSON.stringify(result));assert.ok(result.energy>1);}
  await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();assert.deepEqual((await read()).tracks,after.tracks);assert.deepEqual(errors,[]);console.log('PASS audio comp UI sections/name, source preservation, one-step undo/redo, reload and real PCM take switching, silent gap and edge fade.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
