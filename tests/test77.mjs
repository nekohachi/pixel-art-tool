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
await page.evaluate(()=>{window.T={R:packHex('#ff0000',255)>>>0,B:packHex('#0000ff',255)>>>0,K:packHex('#000000',255)>>>0,
  rotate(deg){const c=xfCentroid(xf.corners),a=deg*Math.PI/180,co=Math.cos(a),si=Math.sin(a);
    xf.corners=xf.corners.map(p=>{const dx=p.x-c.x,dy=p.y-c.y;return{x:c.x+dx*co-dy*si,y:c.y+dx*si+dy*co};});},
  stats(){const c=getCel(0,0);const cols=new Set();let n=0,holes=0;for(let i=0;i<c.length;i++){if(c[i]){n++;cols.add(c[i]>>>0);}}
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;if(!c[i]&&c[i-1]&&c[i+1]&&c[i-W]&&c[i+W])holes++;}return {n,cols:[...cols],holes};},
  selAll(){selection={mask:selBuf()};selection.mask.fill(1);computeSelBounds();}};});

const S=await page.evaluate(()=>{const A=T.R;const out=scale2x(new Uint32Array([A,0,0,A]),2,2);
  const flat=scale2x(new Uint32Array([A,A,A,A]),2,2);return {c1:(out[6]>>>0)===A,c2:(out[9]>>>0)===A,flatAll:[...flat].every(v=>(v>>>0)===A),len:out.length};});
ok('Scale2x: a 2×2 diagonal gets its two connecting corners filled, flat areas stay flat',S.c1&&S.c2&&S.flatAll&&S.len===16);

// filled 12×12 black square + 1px red "eye" + blue outline pixel row, rotated 30°
const R=await page.evaluate(()=>{newDoc(40,40);fitView();const c=getCel(0,0);
  for(let y=12;y<24;y++)for(let x=12;x<24;x++)c[y*40+x]=T.K;c[15*40+15]=T.R;for(let x=12;x<24;x++)c[12*40+x]=T.B;
  const src=T.stats();T.selAll();rotSprite=false;beginTransform();T.rotate(30);applyTransformRender(true);const nn=T.stats();
  rotSprite=true;applyTransformRender(true);const rs=T.stats();commitTransform();const done=T.stats();
  const c2=getCel(0,0);let eye=0;for(let i=0;i<c2.length;i++)if((c2[i]>>>0)===T.R)eye++;
  return {src,nn,rs,done,eye,btnOn:$('#xfRsBtn').classList.contains('on')};});
ok('RotSprite keeps the palette (only the 3 source colours)',R.rs.cols.length===3&&R.rs.cols.every(v=>[R.src.cols].flat().includes(v)));
ok('area is preserved within 10% and no holes inside the rotated square',Math.abs(R.rs.n-R.src.n)/R.src.n<0.1&&R.rs.holes===0);
ok('the deliberate 1px eye survives the rotation (cleanup keeps lone source dots)',R.eye>=1);
ok('commit uses RotSprite and the toggle shows ON',R.done.n===R.rs.n&&R.btnOn);

// a thin diagonal line rotated 20°: RotSprite connects what nearest breaks
const L=await page.evaluate(()=>{newDoc(40,40);const c=getCel(0,0);for(let i=0;i<20;i++)c[(10+i)*40+(10+i)]=T.K;
  const gaps=()=>{const c=getCel(0,0);let pts=[];for(let i=0;i<c.length;i++)if(c[i])pts.push([i%40,(i/40)|0]);
    // count pixels that have no 8-neighbour at all (broken line segments)
    let lone=0;for(const[x,y]of pts){let ok=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;if(c[(y+dy)*40+x+dx])ok=true;}if(!ok)lone++;}return lone;};
  T.selAll();rotSprite=false;beginTransform();T.rotate(20);applyTransformRender(true);const nnLone=gaps(),nnN=T.stats().n;
  rotSprite=true;applyTransformRender(true);const rsLone=gaps(),rsN=T.stats().n;cancelTransform();return {nnLone,rsLone,nnN,rsN};});
ok('thin line at 20°: RotSprite leaves no isolated fragments and keeps the line as dense',L.rsLone===0&&L.rsN>=L.nnN*0.9);

// 90° stays lossless, toggle persists, drag end re-renders with RotSprite
const Q=await page.evaluate(()=>{newDoc(16,16);const c=getCel(0,0);for(let i=0;i<256;i++)c[i]=((i*37)&1)?T.K:(((i*53)&3)?T.R:0);const before=c.slice();
  T.selAll();beginTransform();xfRotateQuarter(1);xfRotateQuarter(1);xfRotateQuarter(1);xfRotateQuarter(1);commitTransform();
  const same=getCel(0,0).every((v,i)=>v===before[i]);
  rotSprite=true;$('#xfRsBtn').click();const off=!rotSprite&&localStorage.getItem('pxeditor-rotsprite')==='0';$('#xfRsBtn').click();
  return {same,off,on:rotSprite};});
ok('four quarter turns with RotSprite return the exact original; toggle persists',Q.same&&Q.off&&Q.on);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
