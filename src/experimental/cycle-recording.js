export function cycleRecordingWindow(session){
 if(session?.audioRecordMode!=='cycle')return null;
 const start=session.loopStart,end=session.loopEnd,duration=end-start;
 if(!session.loopEnabled||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>86400||duration<.1||duration>600)throw Error('Cycle recording needs an enabled cycle range between 0.1 seconds and 10 minutes.');
 if(session.audioPunchEnabled)throw Error('Disable audio punch before cycle recording.');
 return {start,playbackStart:start,duration:Math.min(600,duration*64,86400-start),cycleDuration:duration,punch:false};
}
export function cycleRecordingFrames(window,sampleRate){
 if(!window.cycleDuration)return null;
 const period=Math.max(1,Math.round(window.cycleDuration*sampleRate));
 return {period,maxFrames:Math.min(period*64,Math.round(600*sampleRate),Math.floor((86400-window.start)*sampleRate))};
}
