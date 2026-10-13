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
await page.evaluate(()=>{window.T={K:packHex('#000000',255)>>>0,R:packHex('#ff0000',255)>>>0,B:packHex('#0000ff',255)>>>0,
  // 40×40: black ellipse outline r=10, red fill, one blue dot inside
  setup(){newDoc(40,40);fitView();setTool('pencil');brushSize=1;brushSizes.pencil=1;opacity=255;setColorHex('#000000');const c=getCel(0,0);
    strokeEllipse(c,9,11,29,29);setColorHex('#ff0000');floodFill(c,19,20);c[16*40+15]=T.B;
    selection={mask:selBuf()};selection.mask.fill(1);computeSelBounds();shiftHeld=false;ctrlHeld=false;altHeld=false;},
  rot(deg){const c=xfCentroid(xf.corners),a=deg*Math.PI/180,co=Math.cos(a),si=Math.sin(a);xf.corners=xf.corners.map(p=>{const dx=p.x-c.x,dy=p.y-c.y;return{x:c.x+dx*co-dy*si,y:c.y+dx*si+dy*co};});},
  ringStats(){const c=getCel(0,0);let n=0,deg2=0,lonely=0,cols=new Set();const is=(x,y)=>x>=0&&y>=0&&x<40&&y<40&&(c[y*40+x]>>>0)===T.K;
    for(let y=0;y<40;y++)for(let x=0;x<40;x++){if(c[y*40+x])cols.add(c[y*40+x]>>>0);if(!is(x,y))continue;n++;let d=0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if((dx||dy)&&is(x+dx,y+dy))d++;}if(d===2)deg2++;if(d===0)lonely++;}
    // red reachable from the border without crossing black = halo
    const seen=new Uint8Array(1600),st=[];for(let i=0;i<40;i++){st.push(i,1560+i,i*40,i*40+39);}let halo=0;
    while(st.length){const j=st.pop();if(seen[j]||(c[j]>>>0)===T.K)continue;seen[j]=1;if((c[j]>>>0)===T.R)halo++;const x=j%40,y=(j/40)|0;
      if(x>0)st.push(j-1);if(x<40-1)st.push(j+1);if(y>0)st.push(j-40);if(y<40-1)st.push(j+40);}
    let blue=0;for(let i=0;i<1600;i++)if((c[i]>>>0)===T.B)blue++;return {n,deg2,lonely,halo,blue,cols:cols.size};}};});

const A=await page.evaluate(()=>{T.setup();const src=T.ringStats();beginTransform();T.rot(25);
  rotSprite=true;xfLines=false;applyTransformRender(true);const rs=T.ringStats();
  xfLines=true;applyTransformRender(true);const ln=T.ringStats();commitTransform();const done=T.ringStats();
  return {src,rs,ln,done};});
ok('source ring: closed outline, no leaks',A.src.halo===0&&A.src.lonely===0);
ok('線整形: rotated outline is at least as clean as the ellipse tool drew it (degree-2 ratio), none isolated, palette kept',A.ln.deg2/A.ln.n>=A.src.deg2/A.src.n-0.05&&A.ln.lonely===0&&A.ln.cols===3);
ok('線整形 is cleaner than RotSprite on this ring (more degree-2 pixels)',A.ln.deg2/A.ln.n>A.rs.deg2/A.rs.n);
ok('no red leaks outside the closed outline; the blue dot survives; commit = preview',A.ln.halo===0&&A.ln.blue>=1&&JSON.stringify(A.done)===JSON.stringify(A.ln));

const B=await page.evaluate(()=>{newDoc(300,300);getCel(0,0).fill(T.R);selection={mask:selBuf()};selection.mask.fill(1);computeSelBounds();
  xfLines=true;beginTransform();const tmp=new Uint32Array(300*300);const r=lineArtTransform(tmp,xf.parts[0],null);cancelTransform();
  newDoc(8,8);getCel(0,0).fill(T.R);selection={mask:selBuf()};selection.mask.fill(1);computeSelBounds();beginTransform();const r2=lineArtTransform(new Uint32Array(64),xf.parts[0],null);cancelTransform();
  return {big:r,noStroke:r2};});
ok('falls back to RotSprite for huge patches and for patches without strokes',B.big===false&&B.noStroke===false);

const Cc=await page.evaluate(()=>{xfLines=false;rotSprite=true;xfModeLabel();const l0=$('#xfRsBtn').textContent;$('#xfRsBtn').click();const l1=$('#xfRsBtn').textContent;const p1=localStorage.getItem('pxeditor-xflines');
  $('#xfRsBtn').click();const l2=$('#xfRsBtn').textContent;$('#xfRsBtn').click();const l3=$('#xfRsBtn').textContent;return {l0,l1,p1,l2,l3};});
ok('mode button cycles RotSprite → 線整形β → 最近傍 → RotSprite and persists',Cc.l0==='RotSprite'&&Cc.l1==='線整形β'&&Cc.p1==='1'&&Cc.l2==='最近傍'&&Cc.l3==='RotSprite');

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
