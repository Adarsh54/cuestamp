// Butterworth high/low-pass sections, with separate state per feedback channel.
class Biquad {
 constructor(rate,frequency,highpass){
  const w=2*Math.PI*Math.min(frequency,rate*.49)/rate,c=Math.cos(w),a=Math.sin(w)/Math.SQRT2,d=1+a;
  this.b0=(1+(highpass?c:-c))/(2*d);this.b1=(highpass?-(1+c):1-c)/d;this.b2=this.b0;
  this.a1=-2*c/d;this.a2=(1-a)/d;this.z1=0;this.z2=0;
 }
 process(x){const y=this.b0*x+this.z1;this.z1=this.b1*x-this.a1*y+this.z2;this.z2=this.b2*x-this.a2*y;return y;}
}
export class DelayToneFilter {
 constructor(rate,low,high){
  if(!Number.isFinite(rate)||rate<=0||!Number.isFinite(low)||!Number.isFinite(high)||low<20||high>20000||low>=high)throw Error('Invalid delay filter cutoffs.');
  this.highpass=new Biquad(rate,low,true);this.lowpass=new Biquad(rate,high,false);
 }
 process(value){return this.lowpass.process(this.highpass.process(value));}
}
