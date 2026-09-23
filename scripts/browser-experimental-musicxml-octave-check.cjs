const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'octave-import',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));
  await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));
  await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');
  await page.getByText('Session restored on this device.',{exact:true}).waitFor();
  const result=await page.evaluate(async()=>{
   const {parseMusicxml,musicxmlImportData}=await import('/src/experimental/musicxml-import.js');
   const {decodeMidiImport,readMidi}=await import('/src/experimental/midi.js');
   const direction=(type,size,staff=1)=>`<direction><direction-type><octave-shift type="${type}" size="${size}" number="${staff}"/></direction-type><staff>${staff}</staff></direction>`;
   const note=(step,octave,staff=1,tie='')=>`<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>1</duration>${tie}<voice>${staff}</voice><staff>${staff}</staff></note>`;
   const attributes='<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>';
   const header='<part-list><score-part id="p"><part-name>Piano</part-name></score-part></part-list>';
   const content=attributes+direction('down',8)+note('C',6,1,'<tie type="start"/>')+direction('continue',8)+note('C',6,1,'<tie type="stop"/>')+direction('stop',8)+note('G',4)+'<forward><duration>1</duration></forward><backup><duration>4</duration></backup>'+direction('up',15,2)+note('C',2,2)+direction('stop',15,2)+note('E',3,2);
   const xml=`<score-partwise version="4.0">${header}<part id="p"><measure number="1">${content}</measure></part></score-partwise>`;
   const timewise=`<score-timewise version="4.0">${header}<measure number="1"><part id="p">${content}</part></measure></score-timewise>`;
   const pitches=source=>parseMusicxml(source).tracks[0].notes.map(n=>[n.pitch,n.start,n.duration]);
   const variants=[];
   for(const type of ['up','down'])for(const size of [8,15,22]){
    const source=xml.replace('type="down" size="8"',`type="${type}" size="${size}"`);
    variants.push(pitches(source));
   }
   const transposed=xml.replace('</attributes>','<transpose><diatonic>-1</diatonic><chromatic>-2</chromatic></transpose></attributes>');
   return {xml,notes:pitches(xml),variants,timewise:pitches(timewise),transposed:pitches(transposed),midi:readMidi(decodeMidiImport(musicxmlImportData(xml))).tracks[0].notes.map(n=>[n.pitch,n.start,n.duration])};
  });
  const expected=[[84,0,2],[67,2,1],[36,0,1],[52,1,1]];
  assert.deepEqual(result.notes,expected);assert.deepEqual(result.timewise,expected);
  for(const variant of result.variants)assert.deepEqual(variant,expected);
  assert.deepEqual(result.transposed,expected.map(([pitch,...rest])=>[pitch-2,...rest]));
  const order=notes=>notes.slice().sort((a,b)=>a[0]-b[0]);
  assert.deepEqual(order(result.midi),order(expected.map(([pitch,start,duration])=>[pitch,start/2,duration/2])));
  await page.locator('#daw-files').setInputFiles({name:'octaves.musicxml',mimeType:'application/vnd.recordare.musicxml+xml',buffer:Buffer.from(result.xml)});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:octave-import')).tracks.length===1);
  const imported=await page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:octave-import')).tracks[0].regions[0].notes.map(n=>n.pitch).sort((a,b)=>a-b));
  assert.deepEqual(imported,[36,52,67,84]);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:octave-import')).tracks.length===0);
  assert.deepEqual(errors,[]);
  console.log('Octave notation imports preserve performed pitches, instrument transposition, ties, independent staves, timewise scores and Undo');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
