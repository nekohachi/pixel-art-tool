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

// test89: selecting a mask switches main/sub colours to black/white; leaving the mask restores the previous colours
const A=await page.evaluate(()=>{newDoc(8,8);setColorHex('#ff0000');subColor=packHex('#00ff00',255);updateSubColorUI();
  addCelMask(0,0);enterMaskEdit(0,0);const inMask=toHex(color)==='#000000'&&toHex(subColor)==='#ffffff'&&$('#curColor').style.background!=='';
  swapColors();const swapped=toHex(color)==='#ffffff'&&toHex(subColor)==='#000000';
  exitMaskEdit();const back=toHex(color)==='#ff0000'&&toHex(subColor)==='#00ff00';
  // leaving by picking another layer (no explicit exit) restores too
  enterMaskEdit(0,0);addLayer();render();const back2=maskEdit===null&&toHex(color)==='#ff0000';
  // a colour picked while on the mask is kept while there, and the old colours still come back afterwards
  activeLayer=0;enterMaskEdit(0,0);setColorHex('#808080');const grey=toHex(color)==='#808080';exitMaskEdit();const back3=toHex(color)==='#ff0000';
  return {inMask,swapped,back,back2,grey,back3};});
ok('mask selected → black/white (X swaps); back to the image → previous colours, whichever way the mask is left',A.inMask&&A.swapped&&A.back&&A.back2&&A.grey&&A.back3);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
