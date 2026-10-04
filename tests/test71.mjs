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
const errors=[];page.on('pageerror',e=>errors.push('PAGEERR '+e.message));page.on('console',m=>{if(m.type()==='error'&&!/not valid JSON|プロジェクト形式/.test(m.text()))errors.push('CONSOLE '+m.text());});   // the junk-file rejections log on purpose
await page.goto(base+'/editor.html',{waitUntil:'load'});await page.waitForTimeout(400);
let fails=0;const ok=(n,c)=>{if(!c)fails++;console.log((c?'✅':'❌')+' '+n);};

await page.evaluate(()=>{window.T={
  // 5×5 (100 bytes/cel → base64 padding '=='), 2 layers, 3 frames, a mask, a tag, convert meta
  build(){newDoc(5,5);addLayer();addFrame();addFrame();
    doc.layers.forEach((L,li)=>doc.frames.forEach((f,fi)=>{const c=getCel(li,fi);for(let i=0;i<25;i++)c[i]=rgba((li*50+fi*20+i*7)&255,(i*13)&255,(fi*90)&255,i%3?255:0);}));
    addLayerMask(0);const mk=getMask(doc.layers[0]);for(let i=0;i<25;i++)mk[i]=(i*10)&255;
    doc.tags=[{name:'walk',from:0,to:1,dir:'forward',color:'#ff0000'}];doc.convert={video:{name:'clip.webm',fps:12,from:0,to:1,n:3},params:{dot:3}};
    activeLayer=1;activeFrame=2;setTabName('ADV_H_Sea_01');},
  fp(){const cels={};doc.cels.forEach((v,k)=>cels[k]=Array.from(v));const masks={};doc.masks.forEach((v,k)=>masks[k]=Array.from(v));
    return JSON.stringify({W,H,cels,masks,layers:doc.layers.map(l=>[l.id,l.name,l.maskOn]),frames:doc.frames.map(f=>f.duration),tags:doc.tags,convert:doc.convert,palette,activeLayer,activeFrame});},
  async load(bytes,name){await loadProjectFile(new File([bytes],name),null);}};});

const A=await page.evaluate(async()=>{T.build();const before=T.fp();
  const blob=await projBlob();const u8=new Uint8Array(await blob.arrayBuffer());
  newDoc(2,2);await T.load(u8,'ADV_H_Sea_01.pxproj');const same=T.fp()===before,name=docTabs[curTab].name;
  // size comparison on something realistic: 3 frames of 64×64 16-colour paletted content
  newDoc(64,64);addFrame();addFrame();doc.frames.forEach((f,fi)=>{const c=getCel(0,fi);for(let i=0;i<4096;i++){const q=((i*3+fi*40)>>4)&15;c[i]=rgba(q*16,(q*37)&255,(q*91)&255,255);}});
  const big=new Uint8Array(await (await projBlob()).arrayBuffer());const jsonLen=JSON.stringify(projData()).length;
  return {gz:u8[0]===0x1f&&u8[1]===0x8b,size:big.length,jsonLen,same,name,type:blob.type};});
ok('v2 .pxproj is gzip and much smaller than the old JSON ('+A.size+' vs '+A.jsonLen+' bytes)',A.gz&&A.size<A.jsonLen/2);
ok('v2 round-trip restores pixels, masks, layers, frames, tags, convert, palette, active cel',A.same&&A.name==='ADV_H_Sea_01');

const B=await page.evaluate(async()=>{T.build();const before=T.fp();const txt=JSON.stringify(projData());
  newDoc(2,2);await T.load(new TextEncoder().encode(txt),'old.pxproj');const small=T.fp()===before;
  // the same text through the byte-level big-file decoder (threshold forced to 0)
  const P=parseLegacyProject(new TextEncoder().encode(txt),0);newDoc(2,2);applyProject(P,'old2.pxproj',null);const big=T.fp()===before;
  // and a pretty-printed / BOM variant
  const pretty='﻿'+JSON.stringify(JSON.parse(txt),null,2);const P2=parseLegacyProject(new TextEncoder().encode(pretty),0);newDoc(2,2);applyProject(P2,'old3.pxproj',null);const prettyOk=T.fp()===before;
  return {small,big,prettyOk};});
ok('legacy JSON .pxproj still loads (JSON.parse path)',B.small);
ok('legacy JSON via the byte-level cel decoder (large-file path) gives identical data',B.big);
ok('byte-level decoder copes with BOM + pretty-printed JSON',B.prettyOk);

const Cc=await page.evaluate(async()=>{const u8=new Uint8Array(200);for(let i=0;i<200;i++)u8[i]=i;newDoc(3,3);
  await T.load(u8,'junk.bin');const junk=W===3;
  await T.load(new TextEncoder().encode('{"hello":1}'),'x.json');const notProj=W===3;
  // uncompressed PXPJ container also loads
  T.build();const before=T.fp();const raw=projBinary();newDoc(2,2);await T.load(raw,'raw.pxproj');
  return {junk,notProj,raw:T.fp()===before};});
ok('junk / non-project files are rejected without breaking the document',Cc.junk&&Cc.notProj);
ok('an uncompressed PXPJ container loads too',Cc.raw);

// base64 byte decoder vs atob on awkward lengths
const D=await page.evaluate(()=>{const out=[];for(const n of [1,2,3,4,5,99,100,101]){const src=new Uint8Array(n);for(let i=0;i<n;i++)src[i]=(i*37+n)&255;
  const b=b64FromU8(src);const dec=u8FromB64Bytes(new TextEncoder().encode(b),0,b.length);out.push(dec.length===n&&dec.every((v,i)=>v===src[i]));}return out.every(Boolean);});
ok('byte-level base64 decoder matches for every padding case',D);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
