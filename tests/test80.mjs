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
await page.goto(base+'/editor.html',{waitUntil:'load'});await page.waitForLoadState();await page.waitForTimeout(400);
let fails=0;const ok=(n,c)=>{if(!c)fails++;console.log((c?'✅':'❌')+' '+n);};
await page.evaluate(()=>{window.T={R:packHex('#ff0000',255)>>>0,B:packHex('#0000ff',255)>>>0,
  c(){return JSON.stringify(xf.corners.map(p=>[p.x,p.y]));},
  all(){selection={mask:selBuf()};selection.mask.fill(1);computeSelBounds();}};});

const A=await page.evaluate(()=>{newDoc(16,16);const c=getCel(0,0);for(let y=5;y<9;y++)for(let x=5;x<9;x++)c[y*16+x]=T.R;c[2*16+13]=T.B;   // blob + a far dot
  T.all();beginTransform();const whole=T.c();cancelTransform();
  selection={mask:selBuf()};for(let y=3;y<11;y++)for(let x=3;x<11;x++)selection.mask[y*16+x]=1;computeSelBounds();beginTransform();const inSel=T.c();
  commitTransform();const same=(getCel(0,0)[5*16+5]>>>0)===T.R&&(getCel(0,0)[2*16+13]>>>0)===T.B&&selection.mask[5*16+5]===1&&selection.mask[2*16+13]===0;
  return {whole,inSel,same};});
ok('whole-canvas selection: the box hugs all opaque pixels (blob + far dot)',A.whole==='[[5,2],[14,2],[14,9],[5,9]]');
ok('a marquee larger than the content: the box shrinks to the pixels inside it',A.inSel==='[[5,5],[9,5],[9,9],[5,9]]'&&A.same);

const B=await page.evaluate(()=>{newDoc(16,16);const c=getCel(0,0);c[0]=T.R;selection={mask:selBuf()};for(let i=100;i<120;i++)selection.mask[i]=1;computeSelBounds();
  const n=undoStack.length;beginTransform();return {noXf:!xf,undoSame:undoStack.length===n};});
ok('a selection with no pixels inside refuses to start (no undo entry)',B.noXf&&B.undoSame);

const Cc=await page.evaluate(()=>{newDoc(16,16);addLayer();getCel(1,0)[4*16+2]=T.R;addLayer();getCel(2,0)[12*16+10]=T.B;selLayers=new Set([1,2]);groupLayersSel();
  T.all();beginTransform();const c=T.c();cancelTransform();return c;});
ok('with a group active the box spans the opaque pixels of every visible child',Cc==='[[2,4],[11,4],[11,13],[2,13]]');

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
