const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const {writeMidi}=await import('../src/experimental/midi.js');
 const {newSession}=await import('../src/experimental/session.js');
 const source={...newSession(),keySignature:{sharps:-2,mode:'minor'},keyChanges:[{id:'modulation',beat:8,sharps:3,mode:'major'}]};
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'key-test',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));
  await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));
  await page.route('**/api/daw',r=>r.fulfill({json:{configured:false}}));
  await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');
  await page.getByText('MIDI signature import',{exact:true}).click();
  await page.locator('[data-midi-import-key]').selectOption('adopt');
  await page.locator('#daw-files').setInputFiles({name:'modulations.mid',mimeType:'audio/midi',buffer:Buffer.from(writeMidi(source))});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:key-test'))?.keyChanges?.length===1);
  const session=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:key-test')));
  assert.deepEqual((await session()).keySignature,source.keySignature);
  await page.locator('[data-key-panel] > summary').click();
  const form=page.locator('[data-key-change]');await form.locator('[name=beat]').fill('12');await form.locator('[name=key]').selectOption('-1:major');await form.getByRole('button',{name:'Apply',exact:true}).click();
  assert.equal((await session()).keyChanges[0].beat,12);assert.equal((await session()).keyChanges[0].sharps,-1);
  const add=page.locator('[data-key-change-new]');await add.locator('[name=beat]').fill('16');await add.getByRole('button',{name:'Add key change',exact:true}).click();assert.equal((await session()).keyChanges.length,2);
  await page.locator('[data-key-change-delete]').last().click();assert.equal((await session()).keyChanges.length,1);
  await page.locator('[data-action=undo]').click();assert.equal((await session()).keyChanges.length,2);
  await page.reload();await page.locator('[data-key-panel]').waitFor();assert.equal((await session()).keyChanges.length,2);assert.deepEqual(errors,[]);
  await page.getByText('Command harness',{exact:true}).click();
  const commands=[...(await session()).keyChanges.map(p=>({op:'keyChange.delete',target:p.id})),{op:'key.set',values:{sharps:0,mode:'major'}},{op:'keyChange.add',values:{id:'follow-key',beat:4,sharps:1,mode:'minor'}},{op:'track.add',values:{id:'follow-track',kind:'midi'}},{op:'region.add',target:'follow-track',values:{id:'follow-region',duration:4}},...[0,3].map((start,i)=>({op:'note.add',target:'follow-region',values:{id:'follow-note'+i,start,duration:.5,pitch:64,velocity:.8}}))];
  await page.locator('#daw-json').fill(JSON.stringify(commands));await page.locator('[data-action=json]').click();await page.locator('[data-region=follow-region]').click();
  const pitches=async()=>(await session()).tracks[0].regions[0].notes.map(n=>n.pitch);
  await page.getByText('Transpose notes',{exact:true}).first().click();const transpose=page.locator('[data-transpose-form]');await transpose.locator('[name=mode]').selectOption('diatonic');await transpose.locator('[name=followKey]').check();await transpose.locator('[name=amount]').fill('1');await transpose.getByRole('button',{name:'Transpose notes',exact:true}).click();assert.deepEqual(await pitches(),[65,66]);
  await page.getByText('Key & scale',{exact:true}).click();const scale=page.locator('[data-scale-form]');await scale.locator('[name=followKey]').check();await scale.locator('[name=direction]').selectOption('up');assert.equal(await scale.locator('[name=root]').isDisabled(),true);await scale.getByRole('button',{name:'Apply scale',exact:true}).click();assert.deepEqual(await pitches(),[65,66]);assert.deepEqual(errors,[]);
  await page.getByText('Reassign MIDI channel',{exact:true}).click();const remap=page.locator('[data-midi-channel-remap]');await remap.locator('[name=scope]').selectOption('track');await remap.locator('[name=to]').selectOption({value:'5'});await remap.getByRole('button',{name:'Reassign channel',exact:true}).click();assert.ok((await session()).tracks[0].regions[0].notes.every(n=>n.channel===5));await page.locator('[data-action=undo]').click();assert.ok((await session()).tracks[0].regions[0].notes.every(n=>n.channel===0));assert.deepEqual(errors,[]);
  console.log('PASS: MIDI key-map import, key-change edit/add/remove, undo, reload persistence and note-onset key-following controls and MIDI channel reassignment.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
