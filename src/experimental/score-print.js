const papers={A4:{format:'A4_P',width:210,height:297},Letter:{format:'Letter_P',width:215.9,height:279.4}};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function scorePrintDocument(title,svgs,paper='A4'){
 const size=papers[paper];if(!size)throw Error('Choose A4 or Letter paper.');if(!svgs.length)throw Error('The score has no printable pages.');
 return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title><style>@page{size:${size.width}mm ${size.height}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#ddd}.score-print-page{width:${size.width}mm;height:${size.height}mm;background:white;margin:12px auto;break-after:page;overflow:hidden}.score-print-page:last-child{break-after:auto}.score-print-page svg{display:block;width:100%;height:100%}@media print{html,body{background:white}.score-print-page{margin:0}}</style></head><body>${svgs.map(svg=>`<section class="score-print-page">${svg}</section>`).join('')}</body></html>`;
}
export async function openScorePrint(root,{xml,title,paper='A4',signal}){
 signal?.throwIfAborted();const size=papers[paper];if(!size)throw Error('Choose A4 or Letter paper.');
 const doc=root.ownerDocument,dialog=doc.createElement('dialog');dialog.dataset.scorePrint='';dialog.setAttribute('aria-label','Print score');dialog.style.cssText='width:min(960px,94vw);height:88vh;max-width:94vw;padding:16px;';
 const heading=doc.createElement('h2');heading.textContent='Print score';
 const status=doc.createElement('p');status.setAttribute('role','status');status.textContent='Preparing printable pages…';
 const actions=doc.createElement('div');actions.className='button-row';
 const print=doc.createElement('button');print.textContent='Print / Save as PDF';print.type='button';print.disabled=true;
 const close=doc.createElement('button');close.textContent='Close';close.type='button';
 const frame=doc.createElement('iframe');frame.title='Printable score pages';frame.style.cssText='display:block;width:100%;height:calc(100% - 140px);border:1px solid #777;margin-top:12px;background:white';
 const surface=doc.createElement('div');surface.style.cssText=`position:fixed;left:-10000px;top:0;width:${size.width/25.4*96}px;`;
 actions.append(print,close);dialog.append(heading,status,actions,frame);doc.body.append(dialog,surface);
 let renderer=null,closed=false;
 const cleanup=()=>{if(closed)return;closed=true;signal?.removeEventListener('abort',cleanup);renderer?.clear();surface.remove();dialog.remove();};
 signal?.addEventListener('abort',cleanup,{once:true});dialog.addEventListener('close',cleanup,{once:true});close.onclick=()=>dialog.close();dialog.showModal();
 try{
  const module=await import('opensheetmusicdisplay');if(closed||!root.isConnected){cleanup();return;}
  const Display=module.OpenSheetMusicDisplay??module.default?.OpenSheetMusicDisplay;
  renderer=new Display(surface,{autoResize:false,backend:'svg',pageFormat:size.format,drawTitle:true,drawPartNames:true});
  await renderer.load(xml);if(closed||!root.isConnected){cleanup();return;}
  renderer.Zoom=1;renderer.render();renderer.renderRemaining?.();
  const pages=[...surface.querySelectorAll('svg')].map(svg=>{const copy=svg.cloneNode(true);copy.setAttribute('preserveAspectRatio','xMidYMin meet');return new XMLSerializer().serializeToString(copy);});
  const html=scorePrintDocument(title,pages,paper);
  frame.onload=()=>{if(closed)return;print.disabled=false;status.textContent=`${pages.length} ${pages.length===1?'page':'pages'} · ${paper}. Choose Save as PDF in the print dialog to download a PDF.`;};
  print.onclick=()=>{frame.contentWindow.focus();frame.contentWindow.print();};frame.srcdoc=html;
  renderer.clear();renderer=null;surface.remove();
 }catch(error){if(!closed)cleanup();throw error;}
}
