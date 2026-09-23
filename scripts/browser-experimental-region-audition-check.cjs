const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true,args:['--disable-audio-output']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'transpose',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));
  await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));
  await page.route('**/api/daw',r=>{if(r.request().method()==='GET')return r.fulfill({json:{configured:true}});const body=r.request().postDataJSON();requests.push(body);return r.fulfill({json:{revision:body.session.revision,commands:[],action:'audition_selected_regions',regionIds:body.selectedRegionIds,transportEpoch:body.transport.epoch,summary:'Untrusted model summary'}});});
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


  const before=await read();await page.getByRole('button',{name:'Audition selected clips',exact:true}).click();await page.getByRole('button',{name:'Stop audition',exact:true}).waitFor();await page.getByRole('button',{name:'Pause',exact:true}).waitFor();assert.deepEqual(await read(),before);
  await page.locator('[data-touch-mode]').selectOption('touch');await page.locator('[data-mix-gain=t]').evaluate(e=>{e.value='-6';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.getByText('Automation recording needs normal playback with Cycle off.',{exact:true}).waitFor();assert.deepEqual(await read(),before);await page.getByRole('button',{name:'Stop audition',exact:true}).waitFor();await page.locator('[data-touch-mode]').selectOption('static');await page.getByRole('button',{name:'Stop audition',exact:true}).click();await page.getByText('Selected clip audition stopped.',{exact:true}).waitFor();assert.deepEqual(await read(),before);
  await page.locator('#daw-instruction').fill('Audition the selected clips');await page.getByRole('button',{name:'Run instruction',exact:true}).click();await page.getByRole('button',{name:'Stop audition',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('#daw-agent-form button').disabled);assert.equal(requests.at(-1).allowSelectionAudition,true);assert.deepEqual(await read(),before);assert.ok(!(await page.locator('.daw-agent-log').textContent()).includes('Untrusted model summary'));await page.getByRole('button',{name:'Stop audition',exact:true}).click();
  const rendered=await page.evaluate(async()=>{const {SessionHistory}=await import('/src/experimental/session.js');const {selectedRegionsAudition}=await import('/src/experimental/region-audition.js');const {scheduleSession}=await import('/src/experimental/audio-engine.js');const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'audio'}},{op:'track.add',values:{id:'bus',kind:'bus'}},{op:'track.set',target:'t',values:{output:'bus'}},{op:'effect.add',target:'bus',values:{kind:'gain',gainDb:-6}},{op:'region.add',target:'t',values:{id:'selected',assetId:'source',duration:1}},{op:'region.add',target:'t',values:{id:'ignored',assetId:'missing',duration:1}}]);const plan=selectedRegionsAudition(h.session,['selected']),c=new OfflineAudioContext(2,48000,48000),b=c.createBuffer(1,48000,48000);b.getChannelData(0).fill(.2);scheduleSession(c,plan.document,new Map([['source',b]]),0,{baseTime:0});const rendered=await c.startRendering();return Math.max(...rendered.getChannelData(0));});assert.ok(rendered>.01&&rendered<.2);
  assert.deepEqual(errors,[]);console.log('PASS manual and agent selected-clips audition, stop feedback, unchanged session and native audio render through bus excluding missing unselected source.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
