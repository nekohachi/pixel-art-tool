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

// test85: performance work — copy-on-write history (snapshots share cel buffers), thumbnail-resolution
// thumbs, coalesced stroke rendering. History must stay exact even though nothing is copied up front.
await page.evaluate(()=>{window.T={R:packHex('#ff0000',255)>>>0,B:packHex('#0000ff',255)>>>0,
  k(){return celKey(doc.layers[activeLayer].id,activeFrame);},
  dot(x,y,c){pushUndo();const cel=activeCel();cel[y*W+x]=c;render();}};});

// 1) stroke A, stroke B, undo → A only; undo → nothing; redo → A
const A=await page.evaluate(()=>{newDoc(8,8);T.dot(1,1,T.R);T.dot(2,2,T.B);const both=activeCel()[9]===T.R&&activeCel()[18]===T.B;
  undo();const a=activeCel()[9]===T.R&&activeCel()[18]===0;undo();const none=activeCel()[9]===0&&activeCel()[18]===0;
  redo();const back=activeCel()[9]===T.R&&activeCel()[18]===0;redo();const both2=activeCel()[9]===T.R&&activeCel()[18]===T.B;
  return {both,a,none,back,both2};});
ok('undo / redo restore exact pixel states across shared snapshots',A.both&&A.a&&A.none&&A.back&&A.both2);

// 2) the snapshot shares the buffer; the first write after pushUndo gets a private copy
const B=await page.evaluate(()=>{newDoc(8,8);getCel(0,0);const before=doc.cels.peek(T.k());pushUndo();const shared=!!before._shared;
  const w=doc.cels.get(T.k());const copied=w!==before&&!w._shared&&doc.cels.peek(T.k())===w;
  w[0]=T.R;const histClean=undoStack[undoStack.length-1].cels[T.k()][0]===0;return {shared,copied,histClean};});
ok('pushUndo marks cels shared; get() copies on first write; history stays untouched',B.shared&&B.copied&&B.histClean);

// 3) masks: paint in mask edit, undo → mask back; per-frame
const C=await page.evaluate(()=>{newDoc(8,8);addCelMask(0,0);const L=doc.layers[0];enterMaskEdit(0,0);pushUndo();maskBuf[3]=0;render();
  const painted=peekMask(L,0)[3]===0;undo();const restored=peekMask(L,0)[3]===255;
  const hist=undoStack.length;getMask(L,0)[4]=0;const histMask=undoStack.length===hist;return {painted,restored,histMask};});
ok('mask edits are undoable; writable mask access never mutates history',C.painted&&C.restored&&C.histMask);

// 4) the two functions that used to hold a cel across pushUndo: colour replace and destructive adjust
const D=await page.evaluate(()=>{newDoc(8,8);const cel=activeCel();cel.fill(T.R);pushUndo();
  setColorHex('#0000ff');replaceColorAt(1,1);const replaced=activeCel()[0]===T.B;undo();const undone=activeCel()[0]===T.R;
  const h=undoStack[undoStack.length-1];const histOK=!h||h.cels[T.k()][0]===T.R;return {replaced,undone,histOK};});
ok('replaceColorAt writes a private copy; undo restores the previous colour',D.replaced&&D.undone&&D.histOK);

// 5) frame / layer ops keep working on shared buffers (dup frame, merge, crop) and undo
const E=await page.evaluate(()=>{newDoc(8,8);activeCel()[0]=T.R;pushUndo();duplicateFrame(0);const dup=getCel(0,1)[0]===T.R&&getCel(0,1)!==getCel(0,0);
  getCel(0,1)[1]=T.B;const indep=getCel(0,0)[1]===0;undo();const back=doc.frames.length===1&&getCel(0,0)[0]===T.R&&getCel(0,0)[1]===0;
  addLayer();activeCel()[5]=T.B;selLayers=new Set([0,1]);mergeLayersSel();const merged=doc.layers.length===1&&getCel(0,0)[5]===T.B&&getCel(0,0)[0]===T.R;
  undo();const unmerged=doc.layers.length===2&&getCel(0,0)[5]===0;cropCanvas(0,0,4,4,'');const cropped=W===4&&getCel(0,0).length===16;undo();
  return {dup,indep,back,merged,unmerged,cropped,restored:W===8&&getCel(0,0)[0]===T.R};});
ok('duplicate / merge / crop on shared buffers behave and undo cleanly',E.dup&&E.indep&&E.back&&E.merged&&E.unmerged&&E.cropped&&E.restored);

// 6) thumbs are thumbnail-sized canvases, group thumbs too; stroke rendering is coalesced
const F=await page.evaluate(()=>new Promise(res=>{newDoc(64,32);addLayer();selLayers=new Set([0,1]);groupLayersSel();addCelMask(0,0);refreshTimeline();
  const cs=[...document.querySelectorAll('#tlGrid canvas.cthumb, #tlGrid canvas.mthumb')];const{tw,th}=thumbSize();
  const sized=cs.length===4&&cs.every(c=>c.width===tw&&c.height===th);
  let n=0;const orig=window.render;window.render=()=>{n++;orig();};for(let i=0;i<10;i++)renderSoon();
  requestAnimationFrame(()=>{window.render=orig;res({sized,n,tw,th});});}));
ok('thumbs are drawn at thumbnail size; 10 renderSoon() calls = 1 recomposite',F.sized&&F.n===1);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
