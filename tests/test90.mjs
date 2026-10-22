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

// test90: warp mode (Photoshop-style 4×4 Bézier mesh) inside free transform
await page.evaluate(()=>{window.T={R:packHex('#ff0000',255)>>>0,B:packHex('#1a1c2c',255)>>>0,
  setup(){newDoc(32,32);fitView();const c=getCel(0,0);for(let y=8;y<16;y++)for(let x=8;x<16;x++)c[y*32+x]=T.R;for(let x=8;x<16;x++)c[11*32+x]=T.B;   // 8×8 block with a dark stripe
    selection={mask:selBuf()};selection.mask.fill(1);computeSelBounds();rotSprite=false;beginTransform();},
  px(){const c=getCel(0,0);const out=[];for(let i=0;i<c.length;i++)if(c[i])out.push(i);return out;},
  bbox(){const c=getCel(0,0);let x0=99,y0=99,x1=-1,y1=-1;for(let i=0;i<c.length;i++)if(c[i]){const x=i%32,y=(i/32)|0;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}return {x0,y0,x1,y1};},
  holes(){const c=getCel(0,0);let n=0;for(let y=1;y<31;y++)for(let x=1;x<31;x++){const i=y*32+x;if(!c[i]&&c[i-1]&&c[i+1]&&c[i-32]&&c[i+32])n++;}return n;}};});

// 1) entering warp keeps the image identical; the mesh has 16 points; button lit
const A=await page.evaluate(()=>{T.setup();const before=JSON.stringify(T.px());enterWarp();
  return {same:JSON.stringify(T.px())===before,n:xf.warp.length,on:$('#xfWarpBtn').classList.contains('on'),corner:xf.warp[15].x===16&&xf.warp[15].y===16};});
ok('warp starts as the identity mesh (16 points on the box), image unchanged, button lit',A.same&&A.n===16&&A.on&&A.corner);

// 2) pulling the bottom-right corner stretches the image (no holes), undo brings it back, redo re-applies
const B=await page.evaluate(()=>{const before=JSON.stringify(T.px());xfMark();xf.warp[15]={x:28,y:28};xf.warp[14]={x:24,y:28};xf.warp[11]={x:28,y:24};applyTransformRender(true);
  const bb=T.bbox(),holes=T.holes(),n=T.px().length;const warped=JSON.stringify(T.px());
  xfUndo();const undone=JSON.stringify(T.px())===before;xfRedo();const redone=JSON.stringify(T.px())===warped;
  return {bb,holes,n,undone,redone,stripe:(getCel(0,0)[11*32+8]>>>0)===T.B};});
ok('dragging a corner stretches the image beyond the box without holes; xf undo / redo restore the mesh',
  B.bb.x1>=24&&B.bb.y1>=24&&B.bb.x0===8&&B.holes===0&&B.n>64&&B.undone&&B.redone&&B.stripe);

// 3) hit test: a control point → warp drag; inside the mesh → move; outside → none (no rotate)
const C=await page.evaluate(()=>{const p=xfLocal(xf.warp[5]);const h1=xfHitTest(p.x,p.y);const c=xfLocal({x:12,y:12});const h2=xfHitTest(c.x,c.y);
  const o=xfLocal({x:2,y:2});const h3=xfHitTest(o.x,o.y);return {h1,h2,h3};});
ok('hit test: control point / inside / outside',C.h1.mode==='warp'&&C.h1.idx===5&&C.h2.mode==='move'&&C.h3.mode==='none');

// 4) back to free transform bakes the warp: image identical, box = bbox of the warped image; then a flip still works; commit keeps pixels
const D=await page.evaluate(()=>{const warped=JSON.stringify(T.px());const bb=T.bbox();exitWarp();
  const same=JSON.stringify(T.px())===warped&&!xf.warp&&xf.srcW===bb.x1-bb.x0+1&&xf.corners[0].x===bb.x0&&xf.corners[2].y===bb.y1+1;
  xfFlip(true);const flipped=JSON.stringify(T.px())!==warped&&T.bbox().x0===bb.x0;xfUndo();const back=JSON.stringify(T.px())===warped&&!xf.warp;
  xfUndo();const backInWarp=!!xf.warp&&JSON.stringify(T.px())===warped;commitTransform();return {same,flipped,back,backInWarp,done:!xf&&JSON.stringify(T.px())===warped};});
ok('leaving warp bakes it into the box (undo returns to the mesh); flip works after; commit keeps the result',D.same&&D.flipped&&D.back&&D.backInWarp&&D.done);

// 5) with RotSprite on, warp still renders (no exceptions, pixels present); nudge moves the mesh
const E=await page.evaluate(()=>{T.setup();rotSprite=true;enterWarp();xf.warp[0]={x:4,y:4};applyTransformRender(true);const n=T.px().length;
  const before=T.bbox();xfNudge(2,0,true);const after=T.bbox();rotSprite=false;cancelTransform();return {n,moved:after.x0===before.x0+2&&xf===null};});
ok('RotSprite + warp renders; arrow nudge moves the whole mesh',E.n>64&&E.moved);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
