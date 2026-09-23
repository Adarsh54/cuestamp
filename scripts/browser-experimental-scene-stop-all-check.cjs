const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage();await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:false,user:null}}));await page.goto(process.env.CUESTAMP_URL||'http://127.0.0.1:5190/');
 const result=await page.evaluate(async()=>{
  const {SessionHistory}=await import('/src/experimental/session.js'),{sceneAudition,sceneCellPlan}=await import('/src/experimental/scene-playback.js'),{startSceneTransport}=await import('/src/experimental/scene-transport.js');
  const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'a',kind:'audio'}},{op:'track.add',values:{id:'b',kind:'audio'}},{op:'track.set',target:'a',values:{pan:-1}},{op:'track.set',target:'b',values:{pan:1}},{op:'region.add',target:'a',values:{id:'ar',assetId:'tone',duration:2}},{op:'region.add',target:'b',values:{id:'br',assetId:'tone',duration:2}},{op:'scene.add',values:{id:'s',name:'Both',regionIds:'ar,br'}}]);
  const before=JSON.stringify(h.session),c=new OfflineAudioContext(2,144000,48000),buffer=c.createBuffer(1,96000,48000);buffer.getChannelData(0).fill(.2);
  const p=startSceneTransport(c,{...sceneAudition(h.session,{sceneId:'s',duration:2}),recordPerformance:true},new Map([['tone',buffer]]));
  p.queue(sceneAudition(h.session,{sceneId:'s',duration:2}),'beat');p.stopAll({quantization:'immediate'});
  let gap,launch;const suspended=c.suspend(.8).then(()=>{p.advance();gap=p.sceneState();launch=p.launchCell(sceneCellPlan(h.session,{sceneId:'s',trackId:'a',duration:1,quantization:'immediate'}));return c.resume();});
  const rendered=await c.startRendering();await suspended;const take=p.performance();p.stop();
  return {samples:[.15,.3,.7,1.2,2.2].map(t=>[0,1].map(ch=>rendered.getChannelData(ch)[Math.floor(t*48000)])),gap,launch,take,unchanged:JSON.stringify(h.session)===before};
 });
 assert.ok(result.samples[0].every(v=>v>.01),'both original clips must play');
 assert.ok(result.samples[1].every(v=>Math.abs(v)<1e-7),'both clips must stop together');
 assert.ok(result.samples[2].every(v=>Math.abs(v)<1e-7),'queued scene voices must not restart');
 assert.ok(result.samples[3][0]>.01&&Math.abs(result.samples[3][1])<1e-7,'a new cell must launch after stop-all without restarting the other track');
 assert.ok(result.samples[4].every(v=>Math.abs(v)<1e-7));
 assert.ok(result.gap.cells.every(c=>c.state==='finished'));assert.equal(result.take.events.length,3);assert.ok(result.take.events.filter(e=>e.start===0).every(e=>Math.abs(e.duration-.1)<1e-7));assert.equal(result.unchanged,true);
 console.log('PASS native all-clip stop, canceled queued voices, independent relaunch and recorded silence.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
