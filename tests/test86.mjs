// test86: cloud sync packs all tabs as one binary container (no base64-in-JSON); stroke composite cache;
// light frame switching. All must be exact: same pixels back, same composite as the full path.
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
await page.goto(base+'/editor.html',{waitUntil:'load'},);await page.waitForTimeout(400);
let fails=0;const ok=(n,c)=>{if(!c)fails++;console.log((c?'✅':'❌')+' '+n);};

// 1) two tabs with masks / linked layer / tags round-trip through the binary cloud pack
const A=await page.evaluate(async()=>{while(docTabs.length>1)closeTab(docTabs.length-1);newDocTab(8,8,'A');getCel(0,0)[3]=packHex('#ff0000',255);addFrame();addLayer();setLinked(doc.layers[1],true);getCel(1,1)[7]=packHex('#00ff00',255);
  addCelMask(0,1);peekMask(doc.layers[0],1)[2]=0;doc.tags=[{name:'t',from:0,to:1,dir:'forward'}];
  newDocTab(4,4,'B');getCel(0,0)[0]=packHex('#0000ff',128);const want=JSON.stringify([...docTabs.find(t=>t.name==='A').doc.cels.keys()].sort());
  const packed=await cloudPack();const bin=packed.startsWith('tabs:')&&JSON.parse(packed.slice(5)).tabs.every(p=>p.startsWith('bin:'));
  newDocTab(2,2,'C');await cloudUnpackApply(packed);
  const t0=docTabs.find(t=>t.name==='A'),t1=docTabs.find(t=>t.name==='B');
  return {bin,tabs:docTabs.length,names:docTabs.map(t=>t.name).slice(-2).join(),keys:JSON.stringify([...t0.doc.cels.keys()].sort())===want,
    red:(t0.doc.cels.peek(celKey(t0.doc.layers[0].id,0))[3]>>>0)===packHex('#ff0000',255)>>>0,
    linked:t0.doc.layers[1].linked&&(t0.doc.cels.peek(t0.doc.layers[1].id+':link')[7]>>>0)===packHex('#00ff00',255)>>>0,
    mask:t0.doc.masks.get(t0.doc.layers[0].id+':1')[2]===0&&t0.doc.masks.get(t0.doc.layers[0].id+':1')[3]===255,
    tag:t0.doc.tags[0].name==='t',blue:(t1.doc.cels.peek(celKey(t1.doc.layers[0].id,0))[0]>>>0)===packHex('#0000ff',128)>>>0,cur:docTabs[curTab].name==='B',W:t1.W===4};});
ok('cloud pack is binary+gzip and round-trips tabs, cels, linked cel, per-frame mask, tags, current tab',
  A.bin&&A.tabs===3&&A.names==='A,B'&&A.keys&&A.red&&A.linked&&A.mask&&A.tag&&A.blue&&A.cur&&A.W);

// 2) legacy JSON snapshot still loads
const B=await page.evaluate(async()=>{const snap={v:1,curTab:0,tabs:[{name:'L',W:2,H:2,activeLayer:0,activeFrame:0,palette:null,layers:[{id:1,name:'x',visible:true,opacity:255,locked:false}],frames:[{id:2,duration:100}],
  cels:{'1:0':b64FromU32(new Uint32Array([0xff0000ff,0,0,0]))},masks:{'1':b64FromU8(new Uint8Array([255,0,255,0]))}}]};
  const str=await gzPack(snap);await cloudUnpackApply(str);
  return {name:docTabs[0].name,px:(getCel(0,0)[0]>>>0)===0xff0000ff,mask:!!peekMask(doc.layers[0],0)&&peekMask(doc.layers[0],0)[1]===0};});
ok('legacy JSON cloud snapshot still loads (and its layer-wide mask migrates)',B.name==='L'&&B.px&&B.mask);

// 3) stroke composite cache == full composite, in the cases it applies; refused where neighbours depend on the layer
const C=await page.evaluate(()=>{newDoc(16,16);const R=packHex('#ff0000',255),G=packHex('#00ff00',160),Bl=packHex('#0000ff',255);
  getCel(0,0).fill(R);addLayer();addLayer();doc.layers[2].opacity=128;for(let i=0;i<64;i++)getCel(2,0)[i]=Bl;
  activeLayer=1;for(let i=32;i<200;i++)getCel(1,0)[i]=G;addCelMask(1,0);peekMask(doc.layers[1],0).fill(0,0,100);
  const full=()=>{strokeCache=null;return compositeGroup(null,0);};
  beginStrokeCache();const has=!!strokeCache;getCel(1,0)[150]=R;   // paint during the stroke
  const cached=strokeComposite(0);const ref=full();let same=cached&&cached.length===ref.length;if(same)for(let i=0;i<ref.length;i++)if(cached[i]!==ref[i]){same=false;break;}
  endStrokeCache();
  // refusals
  activeLayer=2;doc.layers[2].clip=true;activeLayer=1;beginStrokeCache();const refuseClip=!strokeCache;doc.layers[2].clip=false;
  addAdjustLayer('bright');activeLayer=1;beginStrokeCache();const refuseAdj=!strokeCache;endStrokeCache();
  return {has,same,refuseClip,refuseAdj};});
ok('stroke cache composite equals the full composite (opacity + per-frame mask); refused under clip / adjustment',C.has&&C.same&&C.refuseClip&&C.refuseAdj);

// 4) frame switch moves the highlight without rebuilding the grid; mask-edit frame change still rebuilds
const D=await page.evaluate(()=>{newDoc(8,8);addFrame();addFrame();gotoFrame(0);const g=$('#tlGrid').firstChild;gotoFrame(1);
  const light=$('#tlGrid').firstChild===g&&$('#tlGrid .tl-cell.active').dataset.f==='1'&&$('#tlGrid .tl-fnum.active').dataset.fi==='1';
  addCelMask(0,1);enterMaskEdit(0,1);const g2=$('#tlGrid').firstChild;gotoFrame(2);const rebuilt=$('#tlGrid').firstChild!==g2&&maskEdit===null;
  return {light,rebuilt};});
ok('gotoFrame keeps the grid DOM and moves the highlight; leaving a mask-edit frame rebuilds',D.light&&D.rebuilt);

// 5) autosave: one record per tab; reload restores tabs, order and the current tab; worker packing is used
const E=await page.evaluate(async()=>{while(docTabs.length>1)closeTab(docTabs.length-1);newDocTab(6,6,'P');getCel(0,0)[1]=packHex('#ff0000',255);newDocTab(5,5,'Q');getCel(0,0)[2]=packHex('#00ff00',255);
  switchTab(1);autosaveDirty=true;await autosaveNow();const uids=docTabs.map(t=>t.uid);
  const db=await idbOpen();const keys=await new Promise(r=>{const rq=db.transaction(IDB_STORE).objectStore(IDB_STORE).getAllKeys();rq.onsuccess=()=>r(rq.result);});db.close();
  newDocTab(2,2,'Z');docTabs.splice(0,docTabs.length-1);curTab=0;renderTabs();   // forget everything, then reload from IndexedDB
  const okLoad=await autosaveLoad();
  const names=docTabs.map(t=>t.name).join();const P=docTabs.find(t=>t.name==='P'),Q=docTabs.find(t=>t.name==='Q');
  const worker=!!getPackWorker();
  return {keys:keys.filter(k=>String(k).startsWith('tab:')).length,meta:keys.includes(IDB_META),uidsKept:JSON.stringify(docTabs.map(t=>t.uid))===JSON.stringify(uids),okLoad,names,cur:docTabs[curTab]&&docTabs[curTab].name,
    px:(P.doc.cels.peek(celKey(P.doc.layers[0].id,0))[1]>>>0)===packHex('#ff0000',255)>>>0&&(Q.doc.cels.peek(celKey(Q.doc.layers[0].id,0))[2]>>>0)===packHex('#00ff00',255)>>>0,worker};});
ok('autosave writes tab records + meta and restores tabs / order / current tab; pack worker available',
  E.keys===3&&E.meta&&E.uidsKept&&E.okLoad&&E.names.endsWith('P,Q')&&E.cur==='P'&&E.px&&E.worker);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
