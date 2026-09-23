const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true,args:['--disable-audio-output']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'transpose',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));
  await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));
  await page.route('**/api/daw',r=>{if(r.request().method()==='GET')return r.fulfill({json:{configured:true}});const body=r.request().postDataJSON();requests.push(body);return r.fulfill({json:{revision:body.session.revision,commands:[],...(body.instruction==='Audition Verse'?{action:'audition_scene',audition:{sceneId:'verse',duration:2},transportEpoch:body.transport.epoch}:{}),summary:'Scene test response.'}});});
  await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');
  await page.getByText('Session restored on this device.',{exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('[data-audio-input-refresh]')?.disabled);await page.evaluate(()=>document.fonts.ready);
  await page.getByText('Command harness',{exact:true}).click();
  await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'t',name:'Lead',kind:'midi',instrument:'sine'}},{op:'region.add',target:'t',values:{id:'r',duration:4}},...[60,64,67].map((pitch,i)=>({op:'note.add',target:'r',values:{id:'n'+i,pitch,start:0,duration:2,velocity:.7,channel:0}}))]));
  await page.getByRole('button',{name:'Execute commands',exact:true}).click();await page.locator('[data-region=r]').click();




  await page.locator('#daw-json').evaluate(e=>e.closest('details').open=true);
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:transpose')));
  await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'other',name:'Other instrument',kind:'midi'}},{op:'region.add',target:'other',values:{id:'other-region',duration:4}}]));
  await page.getByRole('button',{name:'Execute commands',exact:true}).click();
  await page.locator('[data-region=r]').click();await page.locator('[data-region=other-region]').click({modifiers:['Control']});
  await page.getByText('2 regions selected',{exact:true}).waitFor();


  const before=await read();await page.locator('#daw-json').evaluate(e=>e.closest('details').open=true);await page.locator('#daw-json').fill(JSON.stringify([{op:'scene.add',values:{id:'verse',name:'Verse',regionIds:'r,other-region'}},{op:'scene.cell.set',target:'verse',values:{regionId:'other-region',loop:false}}]));await page.getByRole('button',{name:'Execute commands',exact:true}).click();let saved=await read();assert.equal(saved.scenes[0].name,'Verse');assert.deepEqual(saved.scenes[0].cells,[{regionId:'r',loop:true},{regionId:'other-region',loop:false}]);assert.deepEqual(saved.tracks,before.tracks);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).scenes,[]);await page.getByRole('button',{name:'Redo',exact:true}).click();await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();assert.deepEqual((await read()).scenes,saved.scenes);
  await page.locator('#daw-scenes summary').click();
  await page.locator('[data-scene-cell="verse"][data-scene-track="t"]').click();
  await page.locator('[data-scene-assign] input[name=loop]').uncheck();
  await page.getByRole('button',{name:'Assign clip',exact:true}).click();
  assert.equal((await read()).scenes[0].cells.find(c=>c.regionId==='r').loop,false);
  await page.getByRole('button',{name:'Remove clip',exact:true}).click();
  assert.equal((await read()).scenes[0].cells.length,1);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  assert.equal((await read()).scenes[0].cells.length,2);
  await page.locator('[data-scene-create] input').fill('Chorus');
  await page.getByRole('button',{name:'Create scene',exact:true}).click();
  assert.equal((await read()).scenes.length,2);
  await page.locator('[data-scene-select]').filter({hasText:'Chorus'}).click();
  await page.locator('[data-scene-rename] input').fill('Final chorus');
  await page.getByRole('button',{name:'Rename scene',exact:true}).click();
  await page.getByRole('button',{name:'Move left',exact:true}).click();
  assert.equal((await read()).scenes[0].name,'Final chorus');
  await page.locator('#daw-scenes').scrollIntoViewIfNeeded();
  await page.screenshot({path:'/tmp/cuestamp-scene-grid.png'});
  await page.getByRole('button',{name:'Delete scene',exact:true}).click();
  assert.equal((await read()).scenes.length,1);
  assert.deepEqual((await read()).tracks,before.tracks);
  const stable=await read();
  await page.locator('[data-scene-audition] input').fill('2');
  await page.getByRole('button',{name:'Audition scene',exact:true}).click();
  await page.getByRole('button',{name:'Stop scene audition',exact:true}).waitFor();
  assert.deepEqual(await read(),stable);
  await page.getByRole('button',{name:'Stop scene audition',exact:true}).click();
  await page.getByText('Scene audition stopped.',{exact:true}).waitFor();
  await page.locator('[data-scene-audition] input').fill('0.2');
  await page.getByRole('button',{name:'Audition scene',exact:true}).click();
  await page.getByText('Scene audition stopped.',{exact:true}).waitFor();
  await page.locator('#daw-instruction').fill('Audition Verse');
  await page.getByRole('button',{name:'Run instruction',exact:true}).click();
  await page.getByRole('button',{name:'Stop scene audition',exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('#daw-agent-form button').disabled);
  assert.equal(requests.at(-1).allowSceneAudition,true);
  await page.getByRole('button',{name:'Stop scene audition',exact:true}).click();
  assert.deepEqual(await read(),stable);
  const audio=await page.evaluate(async()=>{
   const {SessionHistory}=await import('/src/experimental/session.js'),{sceneAudition}=await import('/src/experimental/scene-playback.js'),{scheduleSession}=await import('/src/experimental/audio-engine.js');
   const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'loop',kind:'audio'}},{op:'track.add',values:{id:'once',kind:'audio'}},{op:'track.add',values:{id:'bus',kind:'bus'}},{op:'track.set',target:'loop',values:{pan:-1,output:'bus'}},{op:'track.set',target:'once',values:{pan:1}},{op:'effect.add',target:'bus',values:{kind:'gain',gainDb:-6}},{op:'region.add',target:'loop',values:{id:'a',assetId:'source',start:20,duration:.5}},{op:'region.add',target:'once',values:{id:'b',assetId:'source',start:40,duration:.5}},{op:'region.add',target:'loop',values:{id:'ignored',assetId:'missing',duration:1}},{op:'scene.add',values:{id:'s',name:'Sound',regionIds:'a,b'}},{op:'scene.cell.set',target:'s',values:{regionId:'b',loop:false}}]);
   const p=sceneAudition(h.session,{sceneId:'s',duration:1.25}),c=new OfflineAudioContext(2,96000,48000),b=c.createBuffer(1,24000,48000);b.getChannelData(0).fill(.2);scheduleSession(c,p.document,new Map([['source',b]]),0,{baseTime:0,endPosition:p.end});const rendered=await c.startRendering();return [0,1].map(channel=>[.1,.6,1.1,1.4].map(t=>rendered.getChannelData(channel)[Math.floor(t*48000)]));
  });
  assert.ok(audio[0][0]>.01&&audio[0][0]<audio[1][0]*.6);
  assert.ok(audio[0][1]>.01&&audio[0][2]>.01);
  assert.equal(audio[1][1],0);assert.equal(audio[1][2],0);
  assert.equal(audio[0][3],0);assert.equal(audio[1][3],0);
  await page.locator('[data-scene-cell="verse"][data-scene-track="t"]').click();
  await page.locator('[data-scene-assign] input[name=loop]').check();
  await page.getByRole('button',{name:'Assign clip',exact:true}).click();
  const beforePlace=await read();
  await page.locator('[data-scene-place] input[name=position]').fill('0');
  await page.locator('[data-scene-place] input[name=duration]').fill('5');
  await page.getByRole('button',{name:'Place scene',exact:true}).click();
  await page.getByText('The scene overlaps existing clips on Lead. Choose an empty range or allow overlap.',{exact:true}).waitFor();
  assert.deepEqual(await read(),beforePlace);
  await page.locator('[data-scene-place] input[name=position]').fill('20');
  await page.getByRole('button',{name:'Place scene',exact:true}).click();
  const placed=await read();
  assert.deepEqual(placed.tracks[0].regions.slice(1).map(r=>[r.start,r.duration]),[[20,4],[24,1]]);
  assert.equal(placed.tracks[1].regions.length,2);
  assert.deepEqual(placed.tracks[0].regions[0],beforePlace.tracks[0].regions[0]);
  assert.deepEqual(placed.scenes,beforePlace.scenes);
  await page.locator('#daw-scenes').scrollIntoViewIfNeeded();
  await page.screenshot({path:'/tmp/cuestamp-scene-arrangement.png'});
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  assert.deepEqual((await read()).tracks,beforePlace.tracks);
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();
  assert.deepEqual((await read()).tracks,placed.tracks);
  assert.deepEqual(errors,[]);console.log('PASS scene grid, manual/agent audition, native stereo render, placement/trim, overlap rejection, undo/redo and reload.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
