import { createRequire } from 'module';
const require = createRequire('/opt/node-tools/node_modules/');
const { chromium } = require('playwright');
import http from 'http';import fs from 'fs';import path from 'path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');const MIME={'.html':'text/html','.js':'text/javascript'};
const server=http.createServer((req,res)=>{let p=req.url.split('?')[0];if(p==='/')p='/editor.html';const fp=path.join(ROOT,p);
  if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'text/plain'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,r));const base=`http://127.0.0.1:${server.address().port}`;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx=await b.newContext({viewport:{width:1024,height:768},hasTouch:true});const page=await ctx.newPage();
const errors=[];page.on('pageerror',e=>errors.push('PAGEERR '+e.message));page.on('console',m=>{if(m.type()==='error')errors.push('CONSOLE '+m.text());});
let fails=0;const ok=(n,c)=>{if(!c)fails++;console.log((c?'✅':'❌')+' '+n);};
// A long-press on Android Chrome surfaces as a `contextmenu` event; the page must cancel it
// everywhere except text fields.
const fire=sel=>page.evaluate(sel=>{const el=document.querySelector(sel);if(!el)return 'missing '+sel;
  const ev=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});el.dispatchEvent(ev);return ev.defaultPrevented;},sel);

await page.goto(base+'/editor.html',{waitUntil:'load'});await page.waitForTimeout(400);
for(const sel of ['body','.stage','#grpPen','.tl-lhead','.tl-cell','#fps','button'])ok('editor: long-press menu suppressed on '+sel,(await fire(sel))===true);
ok('editor: text field keeps its menu',(await fire('#syncApiKey'))===false);
ok('editor: no page errors',errors.length===0);if(errors.length)console.log(errors);

errors.length=0;await page.goto(base+'/index.html',{waitUntil:'load'});await page.waitForTimeout(400);
for(const sel of ['body','.viewport','button'])ok('index: long-press menu suppressed on '+sel,(await fire(sel))===true);
ok('index: no page errors',errors.length===0);if(errors.length)console.log(errors);
await b.close();server.close();console.log(fails?`${fails} FAILED`:'ALL PASSED');process.exit(fails?1:0);
