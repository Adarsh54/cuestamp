import {StreamCapture} from './stream-capture.js';
class StreamCaptureProcessor extends AudioWorkletProcessor {
 constructor(options){super();this.capture=new StreamCapture(options.processorOptions,(data,transfer)=>this.port.postMessage(data,transfer||[]));this.port.onmessage=event=>{if(event.data==='ack')this.capture.acknowledge();if(event.data==='stop')this.capture.stop();};}
 process(inputs,outputs){this.capture.process(inputs[0]||[],currentFrame,outputs[0]?.[0]?.length||128);return this.capture.active;}
}
registerProcessor('cuestamp-stream-capture',StreamCaptureProcessor);
