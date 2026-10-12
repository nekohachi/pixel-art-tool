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
  px(x,y){compositeFrame(0,cctx);const d=cctx.getImageData(x,y,1,1).data;return [d[0],d[1],d[2],d[3]];},
  // A (red, root) ; group G = [ B (blue, left half) , adj inside G ]
  setup(){newDoc(8,8);getCel(0,0).fill(packHex('#ff0000',255));setTabName('t');
    addLayer();const B=getCel(1,0);for(let y=0;y<8;y++)for(let x=0;x<4;x++)B[y*8+x]=packHex('#0000ff',255);
    selLayers=new Set([1]);groupLayersSel();   // G = [B, header]; activeLayer = header
    return doc.layers.map(l=>l.name);}};});

const A=await page.evaluate(()=>{T.setup();const G=doc.layers[activeLayer];
  activeLayer=doc.layers.findIndex(l=>l.name==='レイヤー 2');addAdjustLayer('bright');const adj=doc.layers[activeLayer];adj.adj.params.b=-100;   // inside G, above B
  const inG=adj.parent===G.id;const left=T.px(1,1),right=T.px(6,1);
  // same adjustment at the root (above everything) darkens A too
  adj.parent=undefined;delete adj.parent;doc.layers.splice(doc.layers.indexOf(adj),1);doc.layers.push(adj);const r2=T.px(6,1);
  return {inG,left,right,r2,names:doc.layers.map(l=>(l.parent?'  ':'')+l.name)};});
ok('adjustment created inside a group stays in the group',A.inG);
ok('inside a group it darkens only the group (B black, A outside still red)',A.left[0]<30&&A.left[2]<30&&A.right[0]>200);
ok('moved to the root it affects everything below',A.r2[0]<30);

const B2=await page.evaluate(()=>{T.setup();const G=doc.layers[activeLayer];G.opacity=128;const p=T.px(1,1);G.opacity=255;
  return p;});
ok('group opacity applies to the group as a whole (blue over red → ~50/50 mix)',Math.abs(B2[0]-128)<8&&Math.abs(B2[2]-127)<8&&B2[3]===255);

const C=await page.evaluate(()=>{newDoc(8,8);getCel(0,0).fill(packHex('#ff0000',255));
  selection={mask:selBuf()};for(let y=0;y<8;y++)for(let x=0;x<4;x++)selection.mask[y*8+x]=1;computeSelBounds();
  addAdjustLayer('bright');const adj=doc.layers[activeLayer];adj.adj.params.b=-100;const mk=getMask(adj);
  return {hasMask:!!mk,m0:mk&&mk[0],m5:mk&&mk[5],desel:!selection,left:T.px(1,1),right:T.px(6,1),thumb:!!$('#tlGrid .tl-cell canvas.mthumb')};});
ok('creating an adjustment layer with a selection auto-masks it to the selection (and deselects)',C.hasMask&&C.m0===255&&C.m5===0&&C.desel&&C.thumb);
ok('the masked adjustment only affects inside the mask',C.left[0]<30&&C.right[0]>200);

const D=await page.evaluate(()=>{const adj=doc.layers[activeLayer];adj.opacity=128;const half=T.px(1,1);adj.opacity=255;
  const mk=getMask(adj);mk[0]=128;const soft=T.px(0,0);mk[0]=255;toggleMask(activeLayer);const off=T.px(6,1);toggleMask(activeLayer);
  return {half,soft,off};});
ok('adjustment opacity and soft mask values blend partially; 無効 disables the mask',D.half[0]>100&&D.half[0]<160&&D.soft[0]>100&&D.soft[0]<160&&D.off[0]<30);

const E=await page.evaluate(()=>{newDoc(8,8);getCel(0,0).fill(packHex('#ff0000',255));selection=null;addAdjustLayer('bright');const adj=doc.layers[activeLayer];
  const noMask=!getMask(adj);addLayerMask(activeLayer);const added=!!getMask(adj);
  enterMaskEdit(activeLayer);const editing=maskEdit===adj.id&&activeCel()===maskBuf;
  // painting on the mask is allowed while editing it
  fitView();setTool('eraser');brushSize=1;brushSizes.eraser=1;
  const r=stage.getBoundingClientRect();const c={x:r.left+panX+2.5*zoom,y:r.top+panY+2.5*zoom};
  const o=t=>({pointerId:4,pointerType:'mouse',isPrimary:true,button:0,buttons:t==='pointerup'?0:1,clientX:c.x,clientY:c.y,bubbles:true,cancelable:true});
  stage.dispatchEvent(new PointerEvent('pointerdown',o('pointerdown')));stage.dispatchEvent(new PointerEvent('pointerup',o('pointerup')));
  const painted=getMask(adj)[2*8+2]===0&&getMask(adj)[0]===255;exitMaskEdit();
  applyMask(activeLayer);const kept=!!getMask(adj);setTool('pencil');return {noMask,added,editing,painted,kept};});
ok('adjustment layers accept a mask via マスク追加, mask editing redirects painting to it',E.noMask&&E.added&&E.editing&&E.painted);
ok('適用 (bake) is refused for an adjustment mask',E.kept);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
