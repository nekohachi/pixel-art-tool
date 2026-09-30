import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import http from 'http';import fs from 'fs';import path from 'path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');const MIME={'.html':'text/html','.js':'text/javascript'};
const server=http.createServer((req,res)=>{let p=req.url.split('?')[0];if(p==='/')p='/editor.html';const fp=path.join(ROOT,p);
  if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'text/plain'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,r));const base=`http://127.0.0.1:${server.address().port}`;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx=await b.newContext({viewport:{width:1024,height:768},hasTouch:true});const page=await ctx.newPage();
const errors=[];page.on('pageerror',e=>errors.push('PAGEERR '+e.message));page.on('console',m=>{if(m.type()==='error')errors.push('CONSOLE '+m.text());});
await page.goto(base+'/editor.html',{waitUntil:'load'});await page.waitForTimeout(400);
const ok=(n,c)=>console.log((c?'✅':'❌')+' '+n);
await page.evaluate(()=>{window.R={open(px,py){window.hit=null;showRadial(px,py,[
    {icon:'a',label:'up',fn:()=>hit='up'},{icon:'b',label:'right',fn:()=>hit='right'},
    {icon:'c',label:'down',fn:()=>hit='down'},{icon:'d',label:'left',fn:()=>hit='left'}]);},
  mv(x,y){document.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:x,clientY:y,bubbles:true}));},
  up(x,y){document.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,clientX:x,clientY:y,bubbles:true}));},
  on(){const it=[...document.querySelectorAll('.radial-item')];const i=it.findIndex(e=>e.classList.contains('on'));return i<0?null:it[i].textContent.slice(1);},
  pos(i){const r=document.querySelectorAll('.radial-item')[i].getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];}};});

// unclamped: flick semantics unchanged
const A=await page.evaluate(()=>{R.open(500,400);const o={};R.mv(500,400-20);o.dead=R.on();R.mv(500,400-120);o.up=R.on();
  R.mv(500-300,400);o.farLeft=R.on();R.mv(500+60,400+60);o.diag=R.on();R.up(500,400-120);return o;});
ok('centre dead zone, then flick up = up, far left = left, diagonal picks the nearest',A.dead===null&&A.up==='up'&&A.farLeft==='left'&&['right','down'].includes(A.diag));

// clamped at the right screen edge: items drawn left of the press point are reachable by hover
const B=await page.evaluate(()=>{const px=innerWidth-4,py=innerHeight/2;R.open(px,py);const o={};
  const [rx,ry]=R.pos(1);o.rightItemLeftOfPress=rx<px;R.mv(rx,ry);o.hoverRight=R.on();
  const [dx,dy]=R.pos(2);R.mv(dx,dy);o.hoverDown=R.on();R.up(dx,dy);o.ran=hit;return o;});
ok('menu clamped inside the screen; hovering the drawn 右/下 items selects them',B.rightItemLeftOfPress&&B.hoverRight==='right'&&B.hoverDown==='down'&&B.ran==='down');

// clamped at the bottom-right corner (like the frame radial in the timeline)
const C=await page.evaluate(()=>{const px=innerWidth-10,py=innerHeight-10;R.open(px,py);const o={};
  o.allOn=[...document.querySelectorAll('.radial-item')].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;});
  const [x,y]=R.pos(1);R.mv(x,y);o.right=R.on();const [x2,y2]=R.pos(2);R.mv(x2,y2);o.down=R.on();R.up(px-40,py);return o;});
ok('bottom-right corner: every item on-screen and 右/下 both hoverable',C.allOn&&C.right==='right'&&C.down==='down');

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length?1:0);
