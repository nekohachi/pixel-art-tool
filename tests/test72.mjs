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
let fails=0;const ok=(n,c)=>{if(!c)fails++;console.log((c?'✅':'❌')+' '+n);};
await page.evaluate(()=>{window.T={
  setup(){newDoc(32,32);fitView();setTool('pencil');brushSize=1;brushSizes.pencil=1;setColorHex('#ff0000');opacity=255;shiftHeld=false;ctrlHeld=false;stickyPen=null;penHold=null;lastStrokeEnd=null;},
  C(px,py){const r=stage.getBoundingClientRect();return {x:r.left+panX+(px+0.5)*zoom,y:r.top+panY+(py+0.5)*zoom};},
  ev(type,px,py,id=3){const c=T.C(px,py);const o={pointerId:id,pointerType:'mouse',isPrimary:true,button:0,buttons:type==='pointerup'?0:1,clientX:c.x,clientY:c.y,bubbles:true,cancelable:true};
    stage.dispatchEvent(new PointerEvent(type,o));},
  drag(pts){T.ev('pointerdown',pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)T.ev('pointermove',pts[i][0],pts[i][1]);const l=pts[pts.length-1];T.ev('pointerup',l[0],l[1]);},
  set(){const c=getCel(0,0),out=[];for(let i=0;i<c.length;i++)if(c[i])out.push([i%32,(i/32)|0]);return out;},
  rows(){const c=getCel(0,0),m={};for(let i=0;i<c.length;i++)if(c[i]){const y=(i/32)|0;m[y]=(m[y]||0)+1;}return Object.values(m);}};});

// Shift: a wobbly drag becomes one straight line from press to release
const A=await page.evaluate(()=>{T.setup();shiftHeld=true;T.drag([[2,2],[6,9],[10,3],[20,12]]);shiftHeld=false;
  const px=T.set();const onLine=px.every(([x,y])=>Math.abs((y-2)-(x-2)*10/18)<0.75);return {n:px.length,onLine,ends:px.some(p=>p[0]===2&&p[1]===2)&&px.some(p=>p[0]===20&&p[1]===12),end:JSON.stringify(lastStrokeEnd)};});
ok('Shift+drag draws a straight line press→release (intermediate wobble ignored)',A.onLine&&A.ends&&A.n>=19);
ok('the stroke end is remembered',A.end==='{"x":20,"y":12}');

// Shift+tap joins from the last stroke end (Photoshop)
const B=await page.evaluate(()=>{T.setup();T.drag([[2,2],[6,2]]);shiftHeld=true;T.drag([[6,10]]);shiftHeld=false;
  const px=T.set();return {join:px.some(p=>p[0]===6&&p[1]===6)&&px.some(p=>p[0]===6&&p[1]===10),rows:T.rows()};});
ok('Shift+tap continues a line from the previous stroke end',B.join);

// Ctrl: snaps to a clean slope and re-snaps while dragging; 2:1 line has uniform 2px runs
const Cc=await page.evaluate(()=>{T.setup();ctrlHeld=true;T.ev('pointerdown',2,2);T.ev('pointermove',12,12);const mid=JSON.stringify(penLine.cur);
  T.ev('pointermove',22,11);const later=JSON.stringify(penLine.cur);T.ev('pointerup',22,11);ctrlHeld=false;
  const rows=T.rows();return {mid,later,rows,uniform:rows.every(r=>r===2),end:JSON.stringify(lastStrokeEnd)};});
ok('Ctrl: first 45° (1:1) then re-snapped to 2:1 as the drag changes angle (until release)',Cc.mid==='{"x":12,"y":12,"ratio":"1:1"}'&&Cc.later==='{"x":21,"y":11,"ratio":"2:1"}');
ok('a snapped 2:1 line is perfectly regular (every row 2px)',Cc.uniform&&Cc.rows.length===10&&Cc.end==='{"x":21,"y":11}');

const D=await page.evaluate(()=>{const r=[];r.push(snapCleanLine(0,0,30,4).ratio,snapCleanLine(0,0,30,0).ratio,snapCleanLine(0,0,3,30).ratio,snapCleanLine(0,0,-20,7).x<0);
  const s=snapCleanLine(0,0,30,4);r.push(s.x===31&&s.y===3);return r;});
ok('snap table: 30,4→8:1 (4 runs, ends 31,3), flat→1:0, steep→1:8, negatives kept',D[0]==='8:1'&&D[1]==='1:0'&&D[2]==='1:8'&&D[3]===true&&D[4]===true);

const C2=await page.evaluate(()=>{T.setup();ctrlHeld=true;T.drag([[3,1],[8,16]]);ctrlHeld=false;const c=getCel(0,0),cols={};
  for(let i=0;i<c.length;i++)if(c[i]){const x=i%32;cols[x]=(cols[x]||0)+1;}return Object.values(cols);});
ok('a steep 1:3 line is regular too (every column 3px)',C2.every(v=>v===3)&&C2.length===5);

// Escape/undo cleanliness: the line replaces only its own pixels (base restored each move)
const E=await page.evaluate(()=>{T.setup();getCel(0,0)[5*32+5]=packHex('#00ff00',255);shiftHeld=true;T.drag([[0,0],[5,5],[10,0]]);shiftHeld=false;
  const c=getCel(0,0);return {keep:(c[5*32+5]>>>0)===(packHex('#00ff00',255)>>>0),noDiag:!c[3*32+3]};});
ok('preview redraws from the untouched copy: earlier pixels kept, abandoned angles leave nothing',E.keep&&E.noDiag);

// tablet buttons: same place as +/-, hold = momentary, tap = lock, visible only for pencil/eraser
const F=await page.evaluate(()=>{T.setup();const out={};
  out.shown=$('#penMod').classList.contains('show')&&!$('#selMod').classList.contains('show');
  out.samePos=$('#penMod').style.left===$('#selMod').style.left&&$('#penMod').style.top===$('#selMod').style.top;
  const btn=$('#penSnapBtn');const o={pointerId:9,pointerType:'touch',bubbles:true,cancelable:true};
  btn.dispatchEvent(new PointerEvent('pointerdown',o));out.held=penLineMode()==='snap'&&btn.classList.contains('on');
  btn.dispatchEvent(new PointerEvent('pointerup',o));out.locked=stickyPen==='snap'&&penLineMode()==='snap';
  btn.dispatchEvent(new PointerEvent('pointerdown',o));btn.dispatchEvent(new PointerEvent('pointerup',o));out.unlocked=stickyPen===null;
  setTool('select');out.hiddenForSelect=!$('#penMod').classList.contains('show')&&$('#selMod').classList.contains('show');
  setTool('eraser');out.eraser=$('#penMod').classList.contains('show');setTool('pencil');return out;});
ok('直線/斜め buttons replace +/- at the same spot for pencil & eraser only',F.shown&&F.samePos&&F.hiddenForSelect&&F.eraser);
ok('hold = momentary, quick tap = lock / unlock',F.held&&F.locked&&F.unlocked);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
