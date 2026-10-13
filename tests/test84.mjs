import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import http from 'http';import fs from 'fs';import path from 'path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');const MIME={'.html':'text/html','.js':'text/javascript'};
const server=http.createServer((req,res)=>{let p=req.url.split('?')[0];if(p==='/')p='/editor.html';const fp=path.join(ROOT,p);
  if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'text/plain'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,r));const base=`http://127.0.0.1:${server.address().port}`;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx=await b.newContext({viewport:{width:1024,height:768}});const page=await ctx.newPage();
const errors=[];page.on('pageerror',e=>errors.push('PAGEERR '+e.message));page.on('console',m=>{if(m.type()==='error')errors.push('CONSOLE '+m.text());});
await page.goto(base+'/editor.html',{waitUntil:'load'});await page.waitForTimeout(400);
let fails=0;const ok=(n,c)=>{if(!c)fails++;console.log((c?'✅':'❌')+' '+n);};

// test84: the flip / quarter-turn menu while transforming opens only from a long-press OUTSIDE the image
// (or on the timeline's empty space), never from a slow hold inside the image.
await page.evaluate(()=>{window.T={
  setup(){newDoc(8,8);fitView();getCel(0,0)[3*8+3]=packHex('#ff0000',255);selection={mask:selBuf()};selection.mask.fill(1);computeSelBounds();beginTransform();},
  // touch-hold `el` at client (x,y) for 500ms, report the ring (if any), then release
  hold(el,x,y){return new Promise(res=>{const o={pointerId:7,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,bubbles:true,cancelable:true};
    el.dispatchEvent(new PointerEvent('pointerdown',o));
    setTimeout(()=>{const items=[...document.querySelectorAll('.radial-item')].map(e=>e.textContent);
      document.dispatchEvent(new PointerEvent('pointerup',o));el.dispatchEvent(new PointerEvent('pointerup',o));setTimeout(()=>res(items),60);},520);});},
  pt(px,py){const r=stage.getBoundingClientRect();return {x:r.left+panX+px*zoom,y:r.top+panY+py*zoom};}};});

// 1) hold inside the image (a slow move start) → no menu, box unchanged
const A=await page.evaluate(async()=>{T.setup();const c0=JSON.stringify(xf.corners);const p=T.pt(4,4);const items=await T.hold(stage,p.x,p.y);
  return {items,same:JSON.stringify(xf.corners)===c0,still:!!xf};});
ok('holding still inside the image opens nothing',A.items.length===0&&A.same&&A.still);

// 2) hold outside the image → flip / rotate ring
await page.waitForTimeout(300);
const B=await page.evaluate(async()=>{const p=T.pt(-6,-6);const items=await T.hold(stage,p.x,p.y);return {items,still:!!xf};});
ok('holding outside the image opens the 左右反転/上下反転/90° ring',B.items.length===5&&B.items.some(t=>t.includes('左右反転'))&&B.still);

// 3) hold on the timeline's empty space → same ring; on a cell → not this ring
await page.waitForTimeout(300);
const C=await page.evaluate(async()=>{const sc=document.querySelector('.tl-scroll');const r=sc.getBoundingClientRect();
  const items=await T.hold(sc,r.right-6,r.bottom-6);   // bottom-right corner: below / right of every row
  const cell=$('#tlGrid .tl-cell[data-l="0"][data-f="0"]');const cr=cell.getBoundingClientRect();
  await new Promise(r=>setTimeout(r,300));
  const cellItems=await T.hold(cell,cr.left+6,cr.top+cr.height/2);
  return {items,cellItems,target:document.elementFromPoint(r.right-6,r.bottom-6).className,still:!!xf};});
ok('holding the empty timeline area opens the same ring',C.items.length===5&&C.items.some(t=>t.includes('上下反転'))&&C.still);
ok('a cell long-press still opens the cel menu, not the transform ring',!C.cellItems.some(t=>t.includes('左右反転')));

// 4) outside the transform, timeline empty space does nothing
await page.waitForTimeout(300);
const D=await page.evaluate(async()=>{cancelTransform();const sc=document.querySelector('.tl-scroll');const r=sc.getBoundingClientRect();
  return await T.hold(sc,r.right-6,r.bottom-6);});
ok('without a transform the timeline empty space opens nothing',D.length===0);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
