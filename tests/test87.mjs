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

// test87: 補正 (smoothed pen) — stabilised stroke, palette-quantised anti-aliasing, Alt inversion, button/persistence
await page.evaluate(()=>{window.T={
  BG:packHex('#f4f4f4',255)>>>0,FG:packHex('#1a1c2c',255)>>>0,
  setup(fill){newDoc(32,32);fitView();setTool('pencil');brushSize=1;brushSizes.pencil=1;setColorHex('#1a1c2c');opacity=255;shiftHeld=false;ctrlHeld=false;altHeld=false;stickyPen=null;penHold=null;pixelPerfect=false;
    if(fill)getCel(0,0).fill(T.BG);},
  C(px,py){const r=stage.getBoundingClientRect();return {x:r.left+panX+px*zoom,y:r.top+panY+py*zoom};},   // float image coords
  ev(type,px,py,id=3){const c=T.C(px,py);const o={pointerId:id,pointerType:'mouse',isPrimary:true,button:0,buttons:type==='pointerup'?0:1,clientX:c.x,clientY:c.y,bubbles:true,cancelable:true};
    stage.dispatchEvent(new PointerEvent(type,o));},
  drag(pts){T.ev('pointerdown',pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)T.ev('pointermove',pts[i][0],pts[i][1]);const l=pts[pts.length-1];T.ev('pointerup',l[0],l[1]);},
  jitter(){const pts=[];for(let x=3;x<=28;x++)pts.push([x+0.5,12.3+(x-3)*3.4/25+(x%2?0.8:-0.8)]);return pts;},   // gentle slope 12.3→15.7 with ±0.8 wobble
  stats(){const c=getCel(0,0);const rows=new Set();let fg=0,mid=0;const mids=new Set(),cols={};
    for(let i=0;i<c.length;i++){const p=c[i]>>>0;if(p===T.BG||p===0)continue;const y=(i/32)|0;
      if(p===T.FG){fg++;rows.add(y);cols[i%32]=(cols[i%32]||0)+1;}else{mid++;mids.add('#'+((p&255)<<16|(p>>8&255)<<8|(p>>16&255)).toString(16).padStart(6,'0'));}}
    const thick=Object.values(cols).filter(n=>n>1).length;   // columns where the solid line is more than 1px tall
    return {rows:[...rows].sort(),fg,mid,mids:[...mids],thick};}};});

// 1) jittery stroke: without 補正 it spans 2–3 rows; with 補正 it settles into one row with palette in-between tones on the fringe
const A=await page.evaluate(()=>{T.setup(true);setSmoothPen(false);T.drag(T.jitter());const raw=T.stats();
  T.setup(true);setSmoothPen(true);T.drag(T.jitter());const sm=T.stats();setSmoothPen(false);
  return {raw,sm,inPal:sm.mids.every(h=>palette.includes(h))};});
ok('raw stroke wobbles across rows (several columns 2px+ tall)',A.raw.rows.length>=5&&A.raw.thick>=5&&A.raw.mid===0);
ok('補正 stroke: a 1px line without wobble (rows 12–15, ≤1 thick column), fringe uses palette colours strictly between brush and background',
  A.sm.rows.length<=4&&A.sm.thick<=1&&A.sm.fg>=20&&A.sm.mid>0&&A.inPal&&!A.sm.mids.includes('#1a1c2c')&&!A.sm.mids.includes('#f4f4f4'));

// 2) over transparent: no fringe at all (crisp), still one row
const B=await page.evaluate(()=>{T.setup(false);setSmoothPen(true);T.drag(T.jitter());const s=T.stats();setSmoothPen(false);return s;});
ok('over transparent pixels the fringe is dropped: only brush pixels, 1px line',B.mid===0&&B.rows.length<=4&&B.thick<=1&&B.fg>=20);

// 3) Alt inverts: off+Alt → smoothed; on+Alt → raw. A tap still draws a dot
const C=await page.evaluate(()=>{T.setup(true);setSmoothPen(false);altHeld=true;T.drag(T.jitter());const a=T.stats();
  T.setup(true);setSmoothPen(true);altHeld=true;T.drag(T.jitter());const b=T.stats();altHeld=false;
  T.setup(true);T.drag([[5.5,5.5]]);const dot=(getCel(0,0)[5*32+5]>>>0)===T.FG;setSmoothPen(false);return {a:a.thick,b:b.thick,dot};});
ok('Alt held inverts the mode for that stroke; a tap draws a dot',C.a<=1&&C.b>=5&&C.dot);

// 4) button toggles + persists; Shift line still wins over 補正
const D=await page.evaluate(()=>{setSmoothPen(false);$('#penSmoothBtn').click();const on=smoothPen&&localStorage.getItem('pxeditor-smoothpen')==='1'&&$('#penSmoothBtn').classList.contains('on');
  T.setup(true);shiftHeld=true;T.drag([[2.5,2.5],[10.5,9.5],[20.5,2.5]]);shiftHeld=false;const s=T.stats();   // straight line 2,2 → 20,2
  $('#penSmoothBtn').click();return {on,off:!smoothPen,line:s.rows.length===1&&s.rows[0]===2&&s.mid===0};});
ok('補正 button toggles and persists; Shift straight line takes precedence',D.on&&D.off&&D.line);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
