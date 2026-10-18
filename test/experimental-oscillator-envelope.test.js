import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleOscillatorEnvelope} from '../src/experimental/oscillator-envelope.js';
const schedule=(age,duration=1)=>{const events=[],param={setValueAtTime:(value,time)=>events.push(['set',value,time]),linearRampToValueAtTime:(value,time)=>events.push(['ramp',value,time])};scheduleOscillatorEnvelope(param,5,age,duration,1);return events;};
test('seeking into sustain retains gain and the original release time',()=>{assert.deepEqual(schedule(.5),[['set',.18,5],['set',.18,5.48],['ramp',0,5.5]]);});
test('seeking into attack resumes its slope without retriggering',()=>{const events=schedule(.004);assert.equal(events[0][1],.09);assert.equal(events[1][0],'ramp');assert.ok(Math.abs(events[1][2]-5.004)<1e-12);});
test('seeking into release keeps the decaying level and remaining end',()=>{const events=schedule(.99);assert.ok(Math.abs(events[0][1]-.09)<1e-12);assert.deepEqual(events.slice(1),[['ramp',0,5.01]]);});
test('short notes retain their original envelope when entered mid-note',()=>{const events=schedule(.005,.006);assert.ok(Math.abs(events[0][1]-.045)<1e-12);assert.deepEqual(events.slice(1),[['ramp',0,5.001]]);});
