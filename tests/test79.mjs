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
await page.evaluate(()=>{window.T={
  setup(){newDoc(16,16);fitView();const c=getCel(0,0);for(let y=4;y<12;y++)for(let x=4;x<12;x++)c[y*16+x]=packHex('#ff0000',255);c[4*16+4]=packHex('#0000ff',255);
    selection={mask:selBuf()};for(let y=4;y<12;y++)for(let x=4;x<12;x++)selection.mask[y*16+x]=1;computeSelBounds();shiftHeld=false;ctrlHeld=false;altHeld=false;beginTransform();},
  C(px,py){const r=stage.getBoundingClientRect();return {x:r.left+panX+px*zoom,y:r.top+panY+py*zoom};},
  drag(hit,from,to){const a=T.C(from[0],from[1]),b2=T.C(to[0],to[1]);startXfDrag(hit,a.x,a.y);
    document.dispatchEvent(new PointerEvent('pointermove',{pointerId:9,clientX:b2.x,clientY:b2.y,bubbles:true}));
    document.dispatchEvent(new PointerEvent('pointerup',{pointerId:9,clientX:b2.x,clientY:b2.y,bubbles:true}));},
  c(){return JSON.stringify(xf.corners.map(p=>[Math.round(p.x*100)/100,Math.round(p.y*100)/100]));},
  key(k,m={}){document.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true,cancelable:true},m)));},
  blueAt(){const c=getCel(0,0);for(let i=0;i<256;i++)if((c[i]>>>0)===(packHex('#0000ff',255)>>>0))return [i%16,i>>4];return null;}};});

const A=await page.evaluate(()=>{T.setup();const c0=T.c(),u0=undoStack.length;
  T.drag({mode:'rotate'},[8,0],[16,8]);const c1=T.c();                 // 90° drag
  T.drag({mode:'corner',idx:0},[4,4],[2,2]);const c2=T.c();            // scale
  xfRotateQuarter(1);const c3=T.c();
  T.key('z',{ctrlKey:true});const a=T.c();T.key('z',{ctrlKey:true});const bb=T.c();T.key('z',{ctrlKey:true});const cc=T.c();
  const stillXf=!!xf,u1=undoStack.length,blue=T.blueAt();
  T.key('z',{ctrlKey:true});const dd=T.c();                            // nothing left: stays
  T.key('y',{ctrlKey:true});const r1=T.c();T.key('Z',{ctrlKey:true,shiftKey:true});const r2=T.c();
  T.drag({mode:'move'},[8,8],[9,8]);const afterNew=T.c();T.key('y',{ctrlKey:true});const noRedo=T.c();
  return {steps:[c0,c1,c2,c3],a,bb,cc,dd,r1,r2,stillXf,sameUndo:u0===u1,blue,afterNew,noRedo};});
ok('each drag / 90° turn is one step: three Ctrl+Z walk the box back to the start',A.a===A.steps[2]&&A.bb===A.steps[1]&&A.cc===A.steps[0]);
ok('undoing inside the transform never touches the document history or leaves the transform',A.stillXf&&A.sameUndo&&JSON.stringify(A.blue)==='[4,4]');
ok('at the first state Ctrl+Z is a no-op; Ctrl+Y / Ctrl+Shift+Z redo; a new drag clears redo',A.dd===A.steps[0]&&A.r1===A.steps[1]&&A.r2===A.steps[2]&&A.afterNew!==A.steps[2]&&A.noRedo===A.afterNew);

const B=await page.evaluate(()=>{cancelTransform();T.setup();xfFlip(true);$('#undoBtn').click();const back=T.c();
  const corners0='[[4,4],[12,4],[12,12],[4,12]]';commitTransform();const n=undoStack.length;undo();return {back:back===corners0,docUndo:undoStack.length===n-1,noXf:!xf};});
ok('the undo button works the same way during a transform; after commit, undo is the normal document undo',B.back&&B.docUndo&&B.noXf);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
