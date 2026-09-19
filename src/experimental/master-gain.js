// Offset the master fader and its active dB curve together, after all inserts.
// In Off mode, retained automation is untouched.
// Return new values so callers can validate before committing a single edit.
export function offsetMasterGain(session,deltaDb){
 if(!Number.isFinite(deltaDb)||deltaDb<-108||deltaDb>108)throw Error('Master gain offset must be between −108 and 108 dB.');
 const shift=value=>{const next=value+deltaDb;if(next<-96-1e-9||next>12+1e-9)throw Error('This adjustment would move master volume or its automation outside −96 to +12 dB.');return Math.max(-96,Math.min(12,next));};
 return {masterDb:shift(session.masterDb),masterAutomation:(session.masterAutomation||[]).map(p=>session.masterAutomationMode!=='off'&&p.parameter==='gainDb'?{...p,value:shift(p.value)}:{...p})};
}
