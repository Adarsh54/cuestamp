import test from 'node:test';import assert from 'node:assert/strict';import {scorePrintDocument} from '../src/experimental/score-print.js';
test('print document escapes titles, sizes vector pages and creates explicit page breaks',()=>{
 const html=scorePrintDocument('<script>alert(1)</script>',['<svg id="one"/>','<svg id="two"/>']);assert.ok(!html.includes('<script>'));assert.match(html,/<title>&lt;script&gt;/);assert.equal((html.match(/<section/g)||[]).length,2);assert.match(html,/size:210mm 297mm/);assert.match(html,/break-after:page/);assert.match(scorePrintDocument('Letter',['<svg/>'],'Letter'),/size:215.9mm 279.4mm/);
});
test('print rejects unsupported paper and empty notation',()=>{assert.throws(()=>scorePrintDocument('Title',[]),/no printable/);assert.throws(()=>scorePrintDocument('Title',['<svg/>'],'unknown'),/A4 or Letter/);});
