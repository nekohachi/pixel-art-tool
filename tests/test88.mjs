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

// test88: mask editing shows no red overlay (hidden pixels just vanish); a new layer joins the active layer's group
const A=await page.evaluate(()=>{newDoc(8,8);fitView();getCel(0,0).fill(packHex('#ff0000',255));addCelMask(0,0);enterMaskEdit(0,0);
  peekMask(doc.layers[0],0).fill(0,0,8);   // hide the top row
  maskBuf=null;maskBufFromMask();render();
  const sx=Math.round(panX+2*zoom+zoom/2),sy=Math.round(panY+zoom/2);const d=vctx.getImageData(sx,sy,1,1).data;   // pixel (2,0): hidden
  const d2=vctx.getImageData(sx,Math.round(panY+3*zoom+zoom/2),1,1).data;   // pixel (2,3): visible red
  exitMaskEdit();return {hidden:[d[0],d[1],d[2]],shown:[d2[0],d2[1],d2[2]],editing:maskEdit===null};});
ok('while editing a mask, hidden pixels show the checker (no red tint) and visible ones the image',
  A.hidden[0]<80&&Math.abs(A.hidden[0]-A.hidden[2])<20&&A.shown[0]>200&&A.shown[1]<40);

const B=await page.evaluate(()=>{newDoc(8,8);addLayer();addLayer();selLayers=new Set([1,2]);groupLayersSel();   // G = [L2, L3, header]
  const G=doc.layers[activeLayer];const iB=doc.layers.findIndex(l=>l.name==='レイヤー 2');
  activeLayer=iB;selLayers=new Set([iB]);addLayer();const nl=doc.layers[activeLayer];
  const inGroup=nl.parent===G.id&&activeLayer===iB+1&&doc.layers.indexOf(G)>activeLayer;
  activeLayer=doc.layers.indexOf(G);addLayer();const top=doc.layers[activeLayer];const outside=!top.parent&&activeLayer===doc.layers.indexOf(G)+1;
  activeLayer=iB;dupLayerFn();const dupIn=doc.layers[activeLayer].parent===G.id;
  return {inGroup,outside,dupIn};});
ok('new layer from inside a group joins the group right above the current layer; from the group header it goes above the group',B.inGroup&&B.outside&&B.dupIn);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
