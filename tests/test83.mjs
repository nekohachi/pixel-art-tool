// test83: masks are per cel (layer × frame). Cel / mask-thumb menus act on one frame; the layer menu on every frame.
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
  px(fi,x,y){compositeFrame(fi,cctx);const d=cctx.getImageData(x,y,1,1).data;return d[3];},
  setup(){newDoc(8,8);addFrame();addFrame();doc.frames.forEach((f,fi)=>getCel(0,fi).fill(packHex('#ff0000',255)));activeFrame=0;selFrames=new Set([0]);refreshTimeline();},
  frames(){return maskFramesOf(doc.layers[0]);},
  thumbs(){return [...document.querySelectorAll('#tlGrid .tl-cell[data-l="0"] canvas.mthumb')].map(c=>+c.parentNode.dataset.f);},
  // long-press an element (touch), read the ring, pick item i (or just release when i<0)
  press(el,i,cb){const r=el.getBoundingClientRect();const x=r.left+8,y=r.top+r.height/2;
    const o=(px,py)=>({pointerId:3,pointerType:'touch',isPrimary:true,clientX:px,clientY:py,bubbles:true,cancelable:true});
    el.dispatchEvent(new PointerEvent('pointerdown',o(x,y)));
    setTimeout(()=>{const items=[...document.querySelectorAll('.radial-item')].map(e=>e.textContent);let tx=x,ty=y;
      if(i>=0){const it=document.querySelectorAll('.radial-item')[i].getBoundingClientRect();tx=it.left+it.width/2;ty=it.top+it.height/2;
        document.dispatchEvent(new PointerEvent('pointermove',o(tx,ty)));}
      document.dispatchEvent(new PointerEvent('pointerup',o(tx,ty)));setTimeout(()=>cb(items),60);},480);},
  leftSel(){selection={mask:selBuf()};for(let y=0;y<8;y++)for(let x=0;x<4;x++)selection.mask[y*8+x]=1;computeSelBounds();}};});

// 1) cel long-press → マスク: mask on that frame only, thumb only in that column, compositing per frame
const A=await page.evaluate(()=>new Promise(res=>{T.setup();T.leftSel();
  T.press($('#tlGrid .tl-cell[data-l="0"][data-f="1"]'),3,items=>{
    res({items,frames:T.frames(),thumbs:T.thumbs(),f1l:T.px(1,1,1),f1r:T.px(1,6,1),f0r:T.px(0,6,1),f0l:T.px(0,1,1),desel:!selection,af:activeFrame});});}));
ok('cel long-press マスク masks frame 2 only (left half visible)',A.items[3].includes('マスク')&&JSON.stringify(A.frames)==='[1]'&&A.f1l===255&&A.f1r===0&&A.desel&&A.af===1);
ok('other frames are untouched and show no mask thumb',A.f0l===255&&A.f0r===255&&JSON.stringify(A.thumbs)==='[1]');

// 2) mask thumb long-press → per-frame ring; 削除 removes only this frame's mask; undo brings it back
await page.waitForTimeout(300);
const B=await page.evaluate(()=>new Promise(res=>{setMask(doc.layers[0],0,new Uint8Array(64).fill(255));refreshTimeline();
  T.press($('#tlGrid .tl-cell[data-l="0"][data-f="1"] canvas.mthumb'),4,items=>{const after=T.frames();undo();res({items,after,undone:T.frames()});});}));
ok('mask-thumb menu has 5 per-frame items; 削除 drops only frame 2',B.items.length===5&&B.items[4].includes('削除')&&JSON.stringify(B.after)==='[0]'&&JSON.stringify(B.undone)==='[0,1]');

// 3) layer menu マスク: no masks → every frame gets one; with masks → all-frame ring; 削除 全F clears all
await page.waitForTimeout(300);
const C=await page.evaluate(()=>new Promise(res=>{T.setup();T.leftSel();addLayerMask(0);const all=T.frames();const thumbs=T.thumbs();
  const f2l=T.px(2,1,1),f2r=T.px(2,6,1);
  openLayerMaskRadial(0,400,300);const ring=[...document.querySelectorAll('.radial-item')].map(e=>e.textContent);
  document.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,clientX:400,clientY:300,bubbles:true}));
  setTimeout(()=>{deleteMaskAll(0);res({all,thumbs,f2l,f2r,ring,none:T.frames()});},40);}));
ok('layer menu マスク creates a mask on every frame (3 thumbs, selection applied to all)',JSON.stringify(C.all)==='[0,1,2]'&&C.thumbs.length===3&&C.f2l===255&&C.f2r===0);
ok('layer with masks → all-frame ring (編集/選択から全F/無効/適用 全F/削除 全F); 削除 全F clears every frame',
  ['編集','選択から全F','無効','適用 全F','削除 全F'].every(x=>C.ring.some(t=>t.includes(x)))&&!C.ring.some(t=>t.includes('全Fに追加'))&&C.none.length===0);
const C2=await page.evaluate(()=>{T.setup();setMask(doc.layers[0],1,new Uint8Array(64).fill(255));
  openLayerMaskRadial(0,400,300);const ring=[...document.querySelectorAll('.radial-item')].map(e=>e.textContent);
  document.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,clientX:400,clientY:300,bubbles:true}));
  addLayerMask(0);const frames=T.frames();const kept=getMask(doc.layers[0],1)[0]===255;
  selection=null;applyMaskAll(0);return {ring,frames,kept,gone:T.frames().length};});
ok('ring offers 全Fに追加 when some frames lack a mask; it fills only the missing frames; 適用 全F bakes them all',
  C2.ring.some(t=>t.includes('全Fに追加'))&&JSON.stringify(C2.frames)==='[0,1,2]'&&C2.kept&&C2.gone===0);

// 4) frame ops carry masks: duplicate copies, delete shifts, move reorders, insert shifts
const D=await page.evaluate(()=>{T.setup();const L=doc.layers[0];const m=n=>new Uint8Array(64).fill(n);
  setMask(L,0,m(10));setMask(L,2,m(30));
  duplicateFrame(0);const dup=[T.frames().join(','),getMask(L,1)[0],getMask(L,3)[0]];   // 10,10,-,30
  deleteFrame(1);const del=[T.frames().join(','),getMask(L,2)[0]];                      // 10,-,30
  moveFrame(2,0);const mv=[T.frames().join(','),getMask(L,0)[0],getMask(L,1)[0]];      // 30,10,-
  insertFrameAt(0,null);const ins=[T.frames().join(','),getMask(L,1)[0],getMask(L,2)[0]];// -,30,10,-
  selFrames=new Set([1]);dupFramesSel();const ds=[T.frames().join(','),getMask(L,2)[0]];    // -,30,30,10,-
  return {dup,del,mv,ins,ds};});
ok('duplicateFrame copies the frame mask and shifts the rest',D.dup[0]==='0,1,3'&&D.dup[1]===10&&D.dup[2]===30);
ok('deleteFrame drops that mask and reindexes',D.del[0]==='0,2'&&D.del[1]===30);
ok('moveFrame reorders masks with the frames',D.mv[0]==='0,1'&&D.mv[1]===30&&D.mv[2]===10);
ok('insertFrameAt shifts masks; duplicating via the frame menu copies the mask',D.ins[0]==='1,2'&&D.ins[1]===30&&D.ins[2]===10&&D.ds[0]==='1,2,3'&&D.ds[1]===30);

// 5) mask editing is bound to a frame: paint goes to that frame's mask; changing frame follows (or leaves) the mask
const E=await page.evaluate(()=>{T.setup();const L=doc.layers[0];setMask(L,0,new Uint8Array(64).fill(255));setMask(L,1,new Uint8Array(64).fill(255));
  enterMaskEdit(0,0);const e0=maskEdit===L.id&&maskEditFi===0&&activeCel()===maskBuf;
  maskBuf[5]=0;render();const painted=getMask(L,0)[5]===0&&getMask(L,1)[5]===255;
  gotoFrame(1);const followed=maskEdit===L.id&&maskEditFi===1&&activeCel()===maskBuf&&maskBuf[5]===grey32(255);
  gotoFrame(2);const left=maskEdit===null&&activeCel()===getCel(0,2);
  return {e0,painted,followed,left};});
ok('mask edit targets one frame; moving to a frame with a mask follows it, to one without leaves editing',E.e0&&E.painted&&E.followed&&E.left);

// 6) legacy layer-wide masks spread to every frame on load; v2 round trip keeps per-frame keys
const F=await page.evaluate(async()=>{T.setup();const d={frames:doc.frames,masks:new Map([['7',new Uint8Array(64).fill(77)]])};migrateMasks(d);
  const keys=[...d.masks.keys()].sort();const distinct=d.masks.get('7:0')!==d.masks.get('7:1')&&d.masks.get('7:2')[0]===77;
  setMask(doc.layers[0],2,new Uint8Array(64).fill(99));const back=await parseProjectBytes(projBinary());
  return {keys,distinct,rt:[...back.masks.keys()],v:back.masks.get(doc.layers[0].id+':2')[0]};});
ok('old one-per-layer masks migrate to layerId:frame on every frame',JSON.stringify(F.keys)==='["7:0","7:1","7:2"]'&&F.distinct);
ok('project file keeps per-frame mask keys',F.rt.length===1&&F.rt[0].endsWith(':2')&&F.v===99);

// 7) layer ops: duplicate copies all frame masks, merge bakes per frame, delete clears; crop resizes all
const G=await page.evaluate(()=>{T.setup();const L=doc.layers[0];T.leftSel();addLayerMask(0);
  selLayers=new Set([0]);dupLayersSel();const nl=doc.layers[1];const dupOK=maskFramesOf(nl).length===3&&getMask(nl,2)!==getMask(L,2);
  getCel(1,1).fill(packHex('#00ff00',255));selLayers=new Set([0,1]);mergeLayersSel();
  const merged=doc.layers.length===1&&maskFramesOf(doc.layers[0]).length===0&&T.px(1,1,1)===255&&T.px(1,6,1)===0;
  addLayer();T.leftSel();addLayerMask(1);cropCanvas(0,0,4,4,'');const cropped=maskFramesOf(doc.layers[1]).length===3&&getMask(doc.layers[1],0).length===16;
  selLayers=new Set([1]);deleteLayersSel();const cleared=doc.masks.size===0;return {dupOK,merged,cropped,cleared};});
ok('duplicate copies every frame mask; merge bakes per frame; crop resizes all; delete clears',G.dupOK&&G.merged&&G.cropped&&G.cleared);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
