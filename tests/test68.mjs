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
const ok=(n,c)=>console.log((c?'✅':'❌')+' '+n);
await page.evaluate(()=>{window.T={
  setup(){while(docTabs.length>1)closeTab(docTabs.length-1);newDoc(8,8);getCel(0,0)[0]=packHex('#ff0000',255);setTabName('A');
    newDocTab(6,6,'B');getCel(0,0)[0]=packHex('#0000ff',255);pushUndo();getCel(0,0)[1]=packHex('#0000ff',255);   // B has history + a last edit
    switchTab(0);},
  img(){const cv=document.createElement('canvas');cv.width=40;cv.height=40;const g=cv.getContext('2d');g.fillStyle='#00ff00';g.fillRect(0,0,40,40);return cv;},
  bypassSwitch(i){saveCurrentTab();curTab=i;loadBundle(docTabs[i]);renderTabs();},   // the buggy path: switching under an open converter
  pix(t){const L=t.doc.layers[0];const c=t.doc.cels.get(celKey(L.id,0));return c?[c[0]>>>0,c[1]>>>0]:[0,0];},
  R:packHex('#ff0000',255)>>>0,B:packHex('#0000ff',255)>>>0,
  state(){saveCurrentTab();return {cur:curTab,names:docTabs.map(t=>t.name),A:[docTabs[0].W,...T.pix(docTabs[0])],B:[docTabs[1].W,...T.pix(docTabs[1])],open:$('#convModal').classList.contains('show'),undoB:docTabs[1].undoStack.length};}};});

// 1) cancelling after a (bypassed) tab switch restores A and leaves B untouched
const C=await page.evaluate(()=>{T.setup();openConverter(T.img());const preview=[W,H];T.bypassSwitch(1);const onB=curTab===1;
  $('#convCancel').click();return {preview,onB,R:T.R,B:T.B,...T.state()};});
const RED=C.R,BLUE=C.B;
ok('converter preview replaced tab A (40×40) and we moved to B',C.preview[0]===40&&C.onB);
ok('cancel returns to tab A and restores it (8×8, red pixel)',C.cur===0&&C.A[0]===8&&C.A[1]===RED);
ok('tab B is untouched (6×6, blue pixels, history kept)',C.B[0]===6&&C.B[1]===BLUE&&C.B[2]===BLUE&&C.undoB===1);

// 2) applying after a bypassed switch lands the conversion in A, B untouched
const A=await page.evaluate(()=>{T.setup();openConverter(T.img());T.bypassSwitch(1);$('#convApply').click();return T.state();});
ok('apply goes to tab A (converted 40×40), B still 6×6 blue',A.cur===0&&A.A[0]===40&&A.B[0]===6&&A.B[1]===BLUE&&!A.open);

// 3) the normal tab switch / new tab / close tab cancel an open converter first
const S=await page.evaluate(()=>{const out={};
  T.setup();openConverter(T.img());switchTab(1);out.sw=T.state();
  switchTab(0);openConverter(T.img());newDocTab(4,4,'C');out.nt=T.state();closeTab(2);
  switchTab(0);openConverter(T.img());closeTab(1);out.cl={cur:curTab,n:docTabs.length,open:$('#convModal').classList.contains('show'),A:[docTabs[0].W,...T.pix(docTabs[0])]};
  return out;});
ok('switchTab under an open converter cancels it and restores A first',!S.sw.open&&S.sw.cur===1&&S.sw.A[0]===8&&S.sw.A[1]===RED&&S.sw.B[0]===6);
ok('newDocTab under an open converter cancels it (A restored, new tab C opened)',!S.nt.open&&S.nt.names[2]==='C'&&S.nt.A[0]===8&&S.nt.A[1]===RED);
ok('closeTab under an open converter cancels it (A restored, B closed)',!S.cl.open&&S.cl.n===1&&S.cl.A[0]===8&&S.cl.A[1]===RED);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length?1:0);
