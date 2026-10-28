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

// test91: 選択範囲の変更 — expand / contract / border / smooth with a live stepper bar, from the outside long-press ring
await page.evaluate(()=>{window.T={
  block(x0,y0,w,h){newDoc(32,32);fitView();const m=selBuf();for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)m[y*32+x]=1;selection={mask:m};computeSelBounds();},
  count(){return selection?selection.mask.reduce((a,b)=>a+b,0):0},
  has(x,y){return !!(selection&&selection.mask[y*32+x]);},
  // long-press outside the image (touch), read ring, pick item by label (or release)
  press(label){return new Promise(res=>{const r=stage.getBoundingClientRect();const x=r.left+panX-30,y=r.top+panY-30;
    const o=(px,py)=>({pointerId:9,pointerType:'touch',isPrimary:true,button:0,buttons:1,clientX:px,clientY:py,bubbles:true,cancelable:true});
    stage.dispatchEvent(new PointerEvent('pointerdown',o(x,y)));
    setTimeout(()=>{const els=[...document.querySelectorAll('.radial-item')];const items=els.map(e=>e.textContent);let tx=x,ty=y;
      const it=els.find(e=>e.textContent.includes(label));if(it){const b=it.getBoundingClientRect();tx=b.left+b.width/2;ty=b.top+b.height/2;document.dispatchEvent(new PointerEvent('pointermove',o(tx,ty)));}
      document.dispatchEvent(new PointerEvent('pointerup',o(tx,ty)));stage.dispatchEvent(new PointerEvent('pointerup',Object.assign(o(tx,ty),{buttons:0})));setTimeout(()=>res(items),60);},480);});}};});

// 1) exact morphology: 8×8 block
const A=await page.evaluate(()=>{T.block(8,8,8,8);const out={};
  openSelMod('expand');out.expand1=T.count()===100&&T.has(7,7)&&T.has(16,16);selModStep(1);out.expand2=T.count()===(12*12-4)&&!T.has(6,6)&&T.has(7,6);commitSelMod();out.committed=T.count()===140;
  undo();out.undone=T.count()===64;
  openSelMod('contract');out.contract1=T.count()===36&&!T.has(8,8)&&T.has(9,9);cancelSelMod();out.cancelled=T.count()===64;
  openSelMod('border');out.border1=T.count()===28&&T.has(8,8)&&!T.has(9,9)&&T.has(15,15);cancelSelMod();
  return out;});
ok('expand 1 → 10×10 (diagonals included), expand 2 → octagon-ish 140; commit is undoable; cancel restores',A.expand1&&A.expand2&&A.committed&&A.undone&&A.cancelled);
ok('contract 1 → 6×6; border 1 → the inner 1px ring',A.contract1&&A.border1);

// 2) Photoshop edge rule: contracting a selection that touches the canvas edge keeps the edge; smooth fills a notch and shaves a spike
const B=await page.evaluate(()=>{T.block(0,0,8,8);openSelMod('contract');const edge=T.has(0,0)&&!T.has(7,7)&&T.has(6,6)&&T.count()===49;cancelSelMod();
  T.block(8,8,12,12);selection.mask[12*32+8]=0;selection.mask[8*32+20]=1;computeSelBounds();   // 1px notch on the left edge, 1px spike on the right
  openSelMod('smooth');const sm=T.has(8,12)&&!T.has(20,8);cancelSelMod();return {edge,sm};});
ok('contract keeps the canvas edge; smooth 1 fills a 1px notch and removes a 1px spike',B.edge&&B.sm);

// 3) the ring: outside long-press with a selection offers コピー/拡張/縮小/境界線/滑らか/反転/解除; 拡張 opens the bar with a live preview
const C=await page.evaluate(async()=>{T.block(8,8,8,8);const items=await T.press('拡張');
  const bar=$('#selModBar').classList.contains('show')&&$('#selModLabel').textContent==='拡張'&&T.count()===100;
  $('#selModPlus').click();const plus=$('#selModVal').textContent==='2 px';$('#selModOk').click();const done=!$('#selModBar').classList.contains('show')&&T.count()===140;
  return {items,bar,plus,done};});
ok('outside long-press ring lists the modify items; 拡張 opens the stepper bar with live preview; ＋ and ✓ work',
  ['コピー','拡張','縮小','境界線','滑らか','反転','解除'].every(x=>C.items.some(t=>t.includes(x)))&&C.bar&&C.plus&&C.done);

// 4) keyboard on the bar: arrows step, Esc cancels; the bar goes away if the selection is dropped
const D=await page.evaluate(()=>{T.block(8,8,8,8);openSelMod('contract');
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));const two=selMod&&selMod.n===2&&T.count()===16;
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));const esc=!selMod&&T.count()===64;
  openSelMod('expand');deselect();updateSelModVisible();const gone=!selMod&&!$('#selModBar').classList.contains('show')&&!selection;return {two,esc,gone};});
ok('arrow keys step the amount, Esc cancels, deselect closes the bar',D.two&&D.esc&&D.gone);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
