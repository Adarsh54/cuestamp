const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'percussion-layers',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));
 await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));
 await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');
 await page.getByText('Session restored on this device.',{exact:true}).waitFor();
 const result=await page.evaluate(async()=>{
  const {parseMusicxml,musicxmlMidi}=await import('/src/experimental/musicxml-import.js');
  const {readMidi}=await import('/src/experimental/midi.js');
  const base=`<score-partwise version="4.0"><part-list><score-part id="p"><part-name>Drum part</part-name><score-instrument id="kick"><instrument-name>Kick</instrument-name></score-instrument><score-instrument id="snare"><instrument-name>Snare</instrument-name></score-instrument><midi-instrument id="kick"><midi-channel>10</midi-channel><midi-unpitched>37</midi-unpitched></midi-instrument><midi-instrument id="snare"><midi-channel>10</midi-channel><midi-unpitched>39</midi-unpitched></midi-instrument></score-part></part-list><part id="p"><measure number="1"><attributes><divisions>4</divisions><transpose><chromatic>12</chromatic></transpose></attributes><note><unpitched><display-step>F</display-step><display-octave>5</display-octave></unpitched><duration>4</duration><instrument id="kick"/></note><note><unpitched/><duration>4</duration><instrument id="snare"/></note><note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note></measure></part></score-partwise>`;
  const xml=base.replace('</note>','</note><note><chord/><unpitched/><duration>2</duration><instrument id="kick"/></note>');
  const score=parseMusicxml(xml),midi=readMidi(musicxmlMidi(score).buffer),rejected=[];
  for(const invalid of [xml.replace('midi-unpitched>37','midi-unpitched>0'),xml.replace('midi-unpitched>39','midi-unpitched>129'),xml.replace('<instrument id="kick"/>','<instrument id="absent"/>'),xml.replace('<instrument id="kick"/>',''),xml.replace('<unpitched/>','<unpitched/><pitch><step>C</step><octave>4</octave></pitch>')]){
   try{parseMusicxml(invalid);rejected.push(false);}catch{rejected.push(true);}
  }
  const single=new DOMParser().parseFromString(xml,'application/xml');
  single.querySelector('midi-instrument[id="snare"]').remove();
  for(const n of single.querySelectorAll('note instrument'))n.remove();
  const fallback=parseMusicxml(new XMLSerializer().serializeToString(single));
  if(fallback.tracks[0].notes[0].pitch!==36||fallback.tracks[0].notes[1].pitch!==36)throw Error('Single-instrument fallback failed');
  return {xml,score,midi,rejected};
 });
 assert.deepEqual(result.score.tracks[0].notes.map(n=>n.pitch),[36,36,38,72]);
 assert.deepEqual(result.midi.tracks[1].notes.map(n=>[n.pitch,n.channel,n.start]),[[36,9,0],[38,9,.5]]);
 assert.equal(result.midi.tracks[0].notes[0].pitch,72);
 assert.deepEqual(result.midi.tracks[2].notes.map(n=>[n.pitch,n.channel,n.start,n.duration]),[[36,9,0,.25]]);
 assert.equal(result.midi.tracks[1].notes[0].duration,.5);
 assert.ok(result.rejected.every(Boolean));
 await page.locator('#daw-files').setInputFiles({name:'percussion.musicxml',mimeType:'application/vnd.recordare.musicxml+xml',buffer:Buffer.from(result.xml)});
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:percussion-layers')).tracks.length===3);
 const session=await page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:percussion-layers')));
 assert.deepEqual(session.tracks.map(t=>t.instrument),['triangle','drumKit','drumKit']);
 assert.deepEqual(session.tracks[1].regions[0].notes.map(n=>n.pitch),[36,38]);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:percussion-layers')).tracks.length===0);
 await page.getByRole('button',{name:'Redo',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:percussion-layers')).tracks.length===3);
 await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:percussion-layers')));
 assert.equal(restored.tracks[1].regions[0].notes[0].duration,.5);
 assert.equal(restored.tracks[2].regions[0].notes[0].duration,.25);
 assert.deepEqual(errors,[]);
 console.log('PASS: nested drum-hit duration preservation, separate editable layers, UI import, Undo/Redo and reload');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
