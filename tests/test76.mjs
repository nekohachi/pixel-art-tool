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
await page.evaluate(()=>{window.T={R:packHex('#ff0000',255)>>>0,B:packHex('#0000ff',255)>>>0,G:packHex('#00ff00',255)>>>0,
  px(x,y){compositeFrame(activeFrame,cctx);const d=cctx.getImageData(x,y,1,1).data;return [d[0],d[1],d[2],d[3]];},
  C(px,py){const r=stage.getBoundingClientRect();return {x:r.left+panX+(px+0.5)*zoom,y:r.top+panY+(py+0.5)*zoom};},
  tap(px,py,id=5){const c=T.C(px,py);const o=t=>({pointerId:id,pointerType:'mouse',isPrimary:true,button:0,buttons:t==='pointerup'?0:1,clientX:c.x,clientY:c.y,bubbles:true,cancelable:true});
    stage.dispatchEvent(new PointerEvent('pointerdown',o('pointerdown')));stage.dispatchEvent(new PointerEvent('pointerup',o('pointerup')));}};});

// 1) alpha lock
const A=await page.evaluate(()=>{newDoc(8,8);fitView();setTool('pencil');brushSize=1;brushSizes.pencil=1;const c=getCel(0,0);c[2*8+2]=T.R;c[3*8+3]=packHex('#ff0000',128);
  toggleAlphaLock(0);setColorHex('#0000ff');opacity=255;T.tap(0,0);T.tap(2,2);opacity=255;T.tap(3,3);
  const out={transparentStays:c[0]===0,recoloured:(c[2*8+2]>>>0)===T.B,alphaKept:(c[3*8+3]>>>24)===128&&(c[3*8+3]&0xff0000)!==0,btn:!!$('#tlGrid .lbtn.lock.alpha')};
  setTool('eraser');T.tap(2,2);out.eraseNoop=(c[2*8+2]>>>0)===T.B;
  setTool('bucket');setColorHex('#00ff00');T.tap(5,5);out.fillNoop=c[5*8+5]===0;T.tap(2,2);out.fillKeeps=(c[2*8+2]>>>0)===T.G;
  toggleAlphaLock(0);setTool('pencil');return out;});
ok('透明保護: paints only on existing pixels, keeps their alpha; eraser/bucket on transparent do nothing',A.transparentStays&&A.recoloured&&A.alphaKept&&A.btn&&A.eraseNoop&&A.fillNoop&&A.fillKeeps);

// 2) clipping
const Cl=await page.evaluate(()=>{newDoc(8,8);getCel(0,0)[0]=T.R;addLayer();getCel(1,0).fill(T.B);const li=1;
  const before=T.px(3,3);toggleClip(li);const inside=T.px(0,0),outside=T.px(3,3);
  const row=$('#tlGrid .tl-lhead[data-li="1"]');const cls=row.classList.contains('clip');
  // thumbnails follow the same rule
  const tw=thumbSize().tw;const g=compositeGroupThumb(null,0,tw,40);let blueAway=0;for(let i=0;i<g.length;i++)if((g[i]>>>0)===T.B)blueAway++;
  toggleClip(li);return {before,inside,outside,cls,thumbClipped:blueAway>0&&blueAway<=25};});
ok('下にクリップ: the layer shows only where the layer below is opaque (composite + thumbnail)',Cl.before[2]===255&&Cl.inside[2]===255&&Cl.outside[3]===0&&Cl.cls&&Cl.thumbClipped);

// 3) pass-through group
const Pt=await page.evaluate(()=>{newDoc(8,8);getCel(0,0).fill(T.R);addLayer();selLayers=new Set([1]);groupLayersSel();const G=doc.layers[activeLayer];
  activeLayer=doc.layers.findIndex(l=>l.name==='レイヤー 2');addAdjustLayer('bright');doc.layers[activeLayer].adj.params.b=-100;
  const scoped=T.px(3,3);G.passThrough=true;const through=T.px(3,3);G.passThrough=false;return {scoped,through};});
ok('通過ON lets an adjustment inside the group reach layers below the group',Pt.scoped[0]>200&&Pt.through[0]<30);

// 4) stamp visible
const St=await page.evaluate(()=>{newDoc(8,8);getCel(0,0)[0]=T.R;addLayer();getCel(1,0)[1]=T.B;doc.layers[1].visible=false;addFrame();getCel(0,1)[2]=T.G;
  activeFrame=0;const n=doc.layers.length;stampVisible();const L=doc.layers[activeLayer];const c0=doc.cels.get(celKey(L.id,0)),c1=doc.cels.get(celKey(L.id,1));
  return {added:doc.layers.length===n+1&&L.name==='結合コピー',f0:(c0[0]>>>0)===T.R&&c0[1]===0,f1:(c1[2]>>>0)===T.G};});
ok('結合コピー: new layer holds the visible composite of every frame (hidden layer excluded)',St.added&&St.f0&&St.f1);

// 5) linked cels
const Lk=await page.evaluate(()=>{newDoc(8,8);addFrame();addFrame();activeFrame=1;getCel(0,1)[0]=T.R;toggleLinked(0);const L=doc.layers[0];
  const out={shared:getCel(0,0)===getCel(0,2)&&(getCel(0,2)[0]>>>0)===T.R,key:doc.cels.has(L.id+':link')&&!doc.cels.has(celKey(L.id,1)),badge:$('#tlGrid .tl-lhead[data-li="0"]').classList.contains('linked')};
  getCel(0,2)[5]=T.B;out.editAnywhere=(getCel(0,0)[5]>>>0)===T.B;
  duplicateFrame(0);deleteFrame(1);moveFrame(0,2);insertFrameAt(1,null);out.survivesFrameOps=doc.cels.has(L.id+':link')&&(getCel(0,3)[5]>>>0)===T.B;
  refreshTimeline();out.thumbShown=(()=>{const cv=$('#tlGrid .tl-cell[data-l="0"][data-f="3"] canvas.cthumb');const d=cv.getContext('2d').getImageData(5,0,1,1).data;return d[2]===255;})();
  toggleLinked(0);out.unlinked=!L.linked&&getCel(0,0)!==getCel(0,1)&&(getCel(0,1)[5]>>>0)===T.B&&!doc.cels.has(L.id+':link');
  // project round-trip keeps a linked layer
  toggleLinked(0);const raw=projBinary();return {...out,raw:Array.from(raw)};});
const Lk2=await page.evaluate(async raw=>{const P=await parseProjectBytes(new Uint8Array(raw));applyProject(P,'x.pxproj',null);const L=doc.layers[0];return L.linked&&doc.cels.has(L.id+':link')&&(getCel(0,2)[5]>>>0)===T.B;},Lk.raw);
ok('全F共通: one shared cel for every frame, edits show everywhere, survives dup/delete/move/insert of frames',Lk.shared&&Lk.key&&Lk.badge&&Lk.editAnywhere&&Lk.survivesFrameOps&&Lk.thumbShown);
ok('unlink materialises per-frame copies; the link survives a .pxproj round-trip',Lk.unlinked&&Lk2);

// 6) colour label (via the nested radial, selected by a plain tap)
const Lb=await page.evaluate(()=>new Promise(res=>{newDoc(8,8);openLabelRadial(0,400,300);
  const items=document.querySelectorAll('.radial-item');const it=items[4].getBoundingClientRect();   // 5th colour = blue
  document.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,clientX:it.left+it.width/2,clientY:it.top+it.height/2,bubbles:true}));
  setTimeout(()=>{const row=$('#tlGrid .tl-lhead[data-li="0"]');res({n:items.length,color:doc.layers[0].color,band:row.style.getPropertyValue('--lbl'),closed:!document.querySelector('.radial'),expect:LABEL_COLORS[4]});},30);}));
ok('色ラベル: tapping a colour in the sub-menu labels the row (band shown)',Lb.n===8&&Lb.color===Lb.expect&&Lb.band===Lb.expect&&Lb.closed);

// 7) group transform moves every visible child
// (the box hugs the opaque pixels of all children: red at x=1, blue at x=6 → box x 1..6, so a flip swaps them)
const Gt=await page.evaluate(()=>{newDoc(8,8);addLayer();getCel(1,0)[2*8+1]=T.R;addLayer();getCel(2,0)[5*8+6]=T.B;selLayers=new Set([1,2]);groupLayersSel();
  selection={mask:selBuf()};for(let i=0;i<64;i++)selection.mask[i]=1;computeSelBounds();beginTransform();const parts=xf?xf.parts.length:0;
  xfFlip(true);commitTransform();const r=doc.layers.find(l=>l.name==='レイヤー 2'),bl=doc.layers.find(l=>l.name==='レイヤー 3');
  const rc=doc.cels.get(celKey(r.id,0)),bc=doc.cels.get(celKey(bl.id,0));
  return {parts,red:(rc[2*8+6]>>>0)===T.R&&rc[2*8+1]===0,blue:(bc[5*8+1]>>>0)===T.B&&bc[5*8+6]===0,noGroupCel:!doc.cels.has(celKey(doc.layers[activeLayer].id,0))};});
ok('Ctrl+T on a group transforms every visible child together (flip moved both pixels)',Gt.parts===2&&Gt.red&&Gt.blue&&Gt.noGroupCel);

// 8) menus: main ring has その他; sub ring lists the new switches; lock long-press offers 透明保護
const Mn=await page.evaluate(()=>new Promise(res=>{newDoc(8,8);openRadial('layer',0,400,300);const main=[...document.querySelectorAll('.radial-item')].map(e=>e.textContent);
  document.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,clientX:400,clientY:300,bubbles:true}));
  setTimeout(()=>{openLayerMoreRadial(0,400,300);const more=[...document.querySelectorAll('.radial-item')].map(e=>e.textContent);
    document.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,clientX:400,clientY:300,bubbles:true}));
    setTimeout(()=>{const lk=$('#tlGrid .tl-lhead[data-li="0"] .lbtn.lock');const r=lk.getBoundingClientRect();
      lk.dispatchEvent(new PointerEvent('pointerdown',{pointerId:2,pointerType:'touch',clientX:r.left+5,clientY:r.top+5,bubbles:true,cancelable:true}));
      setTimeout(()=>{const lockMenu=[...document.querySelectorAll('.radial-item')].map(e=>e.textContent);
        document.dispatchEvent(new PointerEvent('pointerup',{pointerId:2,clientX:r.left+5,clientY:r.top+5,bubbles:true}));res({main,more,lockMenu});},480);},40);},40);}));
ok('layer menu: main ring ends with その他; sub ring has 結合コピー/クリップ/全F共通/色ラベル; lock long-press offers 透明保護',
  Mn.main.some(t=>t.includes('その他'))&&Mn.main.length<=10&&['結合コピー','下にクリップ','全F共通','色ラベル'].every(x=>Mn.more.some(t=>t.includes(x)))&&Mn.lockMenu.some(t=>t.includes('透明保護')));

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
