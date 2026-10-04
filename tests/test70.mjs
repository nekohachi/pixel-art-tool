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
await page.evaluate(()=>{window.touchEv=(type,x,y)=>{const t=new Touch({identifier:1,target:document.body,clientX:x,clientY:y});
  const ev=new TouchEvent(type,{touches:type==='touchend'?[]:[t],changedTouches:[t],bubbles:true,cancelable:true});document.dispatchEvent(ev);return ev.defaultPrevented;};});

// iOS scenario: after the cel menu opens, the browser turns a sideways slide into a pan:
// pointercancel arrives, only touch events keep coming. The menu must still select 貼付 / 消去.
const A=await page.evaluate(()=>new Promise(res=>{newDoc(8,8);addFrame();getCel(0,0)[0]=packHex('#00ff00',255);refreshTimeline();celClip=null;
  const cell=$('#tlGrid .tl-cell[data-l="0"][data-f="0"]');const r=cell.getBoundingClientRect();const x0=r.left+r.width/2,y0=r.top+r.height/2;
  const o=(x,y)=>({pointerId:5,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,bubbles:true,cancelable:true});
  cell.dispatchEvent(new PointerEvent('pointerdown',o(x0,y0)));
  setTimeout(()=>{const out={menu:!!document.querySelector('.radial')};
    cell.dispatchEvent(new PointerEvent('pointercancel',o(x0,y0)));out.survivesCancel=!!document.querySelector('.radial');
    // item 2 (消去) sits lower-left: slide there with touch events only
    const it=document.querySelectorAll('.radial-item')[2].getBoundingClientRect();
    out.prevented=touchEv('touchmove',it.left+it.width/2,it.top+it.height/2);
    out.hi=(document.querySelector('.radial-item.on')||{}).textContent||null;
    touchEv('touchend',it.left+it.width/2,it.top+it.height/2);
    setTimeout(()=>{out.closed=!document.querySelector('.radial');out.cleared=(getCel(0,0)[0]>>>0)===0;res(out);},60);},480);}));
ok('menu stays open through pointercancel (browser pan takeover)',A.menu&&A.survivesCancel);
ok('touchmove is cancelled (no scroll) and drives the highlight to 消去',A.prevented&&A.hi&&A.hi.includes('消去'));
ok('touchend runs the item and closes the menu',A.closed&&A.cleared);

// mouse / pen path unchanged
const B=await page.evaluate(()=>new Promise(res=>{getCel(0,0)[0]=packHex('#00ff00',255);celClip=null;
  const cell=$('#tlGrid .tl-cell[data-l="0"][data-f="0"]');const r=cell.getBoundingClientRect();const x0=r.left+r.width/2,y0=r.top+r.height/2;
  const o=(x,y)=>({pointerId:6,pointerType:'mouse',isPrimary:true,clientX:x,clientY:y,bubbles:true,cancelable:true});
  cell.dispatchEvent(new PointerEvent('pointerdown',o(x0,y0)));
  setTimeout(()=>{document.dispatchEvent(new PointerEvent('pointermove',o(x0,y0-120)));const hi=(document.querySelector('.radial-item.on')||{}).textContent||'';
    document.dispatchEvent(new PointerEvent('pointerup',o(x0,y0-120)));setTimeout(()=>res({hi,closed:!document.querySelector('.radial'),copied:!!celClip}),40);},480);}));
ok('mouse: slide up = コピー, release copies and closes',B.hi.includes('コピー')&&B.closed&&B.copied);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
