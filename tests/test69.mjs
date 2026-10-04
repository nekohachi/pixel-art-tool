import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import http from 'http';import fs from 'fs';import path from 'path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');const MIME={'.html':'text/html','.js':'text/javascript'};
const server=http.createServer((req,res)=>{let p=req.url.split('?')[0];if(p==='/')p='/editor.html';const fp=path.join(ROOT,p);
  if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'text/plain'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,r));const base=`http://127.0.0.1:${server.address().port}`;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx=await b.newContext({viewport:{width:1024,height:768},hasTouch:true,isMobile:true});const page=await ctx.newPage();
const errors=[];page.on('pageerror',e=>errors.push('PAGEERR '+e.message));page.on('console',m=>{if(m.type()==='error')errors.push('CONSOLE '+m.text());});
await page.goto(base+'/editor.html',{waitUntil:'load'});await page.waitForTimeout(400);
let fails=0;const ok=(n,c)=>{if(!c)fails++;console.log((c?'✅':'❌')+' '+n);};

// Long-press a cel like a finger: the pressed element must survive until the finger lifts
// (iOS keeps routing the touch to the original target), the menu must open and copy must work.
const A=await page.evaluate(()=>new Promise(res=>{newDoc(8,8);addFrame();addFrame();getCel(0,1)[0]=packHex('#ff0000',255);refreshTimeline();
  activeFrame=0;const cell=$('#tlGrid .tl-cell[data-l="0"][data-f="1"]');const r=cell.getBoundingClientRect();
  const o=(x,y)=>({pointerId:7,pointerType:'touch',isPrimary:true,clientX:x==null?r.left+r.width/2:x,clientY:y==null?r.top+r.height/2:y,bubbles:true,cancelable:true});
  const x0=r.left+r.width/2,y0=r.top+r.height/2;
  cell.dispatchEvent(new PointerEvent('pointerdown',o()));
  setTimeout(()=>{const out={menu:!!document.querySelector('.radial'),items:document.querySelectorAll('.radial-item').length,
      stillInDom:document.contains(cell),active:cell.classList.contains('active'),af:activeFrame};
    // slide straight up to item 0 (コピー) and release — events bubble from the (still attached) cell
    cell.dispatchEvent(new PointerEvent('pointermove',o(x0,y0-120)));out.hi=!!document.querySelector('.radial-item.on');
    cell.dispatchEvent(new PointerEvent('pointerup',o(x0,y0-120)));
    cell.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:x0,clientY:y0-120}));   // the click iOS sends after the release
    setTimeout(()=>{out.closed=!document.querySelector('.radial');out.copied=!!celClip&&(celClip.data[0]>>>0)===(packHex('#ff0000',255)>>>0);
      out.rebuilt=!document.contains(cell)&&!!$('#tlGrid .tl-cell[data-l="0"][data-f="1"]');out.afAfter=activeFrame;res(out);},60);},480);}));
ok('cel long-press opens the 3-item radial with the pressed cell still in the DOM, highlighted',A.menu&&A.items===3&&A.stillInDom&&A.active&&A.af===1);
ok('sliding up highlights コピー; release copies that cel',A.hi&&A.closed&&A.copied);
ok('timeline is rebuilt only after the finger lifts; the trailing click does not re-target',A.rebuilt&&A.afAfter===1);

// Layer / frame radials follow the same rule
const B=await page.evaluate(()=>new Promise(res=>{const head=$('#tlGrid .tl-lhead[data-li="0"] .lname');const r=head.getBoundingClientRect();
  const o=(x,y)=>({pointerId:8,pointerType:'touch',isPrimary:true,clientX:x==null?r.left+r.width/2:x,clientY:y==null?r.top+r.height/2:y,bubbles:true,cancelable:true});
  const el=head.closest('.tl-lhead');head.dispatchEvent(new PointerEvent('pointerdown',o()));
  setTimeout(()=>{const out={menu:!!document.querySelector('.radial'),inDom:document.contains(el)};
    head.dispatchEvent(new PointerEvent('pointerup',o()));setTimeout(()=>{out.closed=!document.querySelector('.radial');out.rebuilt=!document.contains(el);res(out);},40);},480);}));
ok('layer radial: pressed row stays until release, grid rebuilt afterwards',B.menu&&B.inDom&&B.closed&&B.rebuilt);

const C=await page.evaluate(()=>new Promise(res=>{const fn=$('#tlGrid .tl-fnum[data-fi="2"]');const r=fn.getBoundingClientRect();
  const o=(x,y)=>({pointerId:9,pointerType:'touch',isPrimary:true,clientX:x==null?r.left+r.width/2:x,clientY:y==null?r.top+r.height/2:y,bubbles:true,cancelable:true});
  fn.querySelector('.fno').dispatchEvent(new PointerEvent('pointerdown',o()));
  setTimeout(()=>{const out={menu:!!document.querySelector('.radial'),inDom:document.contains(fn),active:fn.classList.contains('active')};
    fn.dispatchEvent(new PointerEvent('pointerup',o()));setTimeout(()=>{out.closed=!document.querySelector('.radial');res(out);},40);},480);}));
ok('frame radial: column highlighted in place, menu closes on release',C.menu&&C.inDom&&C.active&&C.closed);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
