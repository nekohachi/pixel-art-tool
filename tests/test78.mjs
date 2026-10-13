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

// cel long-press → マスク creates a mask (from the selection) on that layer; next time it offers マスク編集
const A=await page.evaluate(()=>new Promise(res=>{newDoc(8,8);addFrame();selection={mask:selBuf()};for(let i=0;i<32;i++)selection.mask[i]=1;computeSelBounds();
  const press=(cb)=>{const cell=$('#tlGrid .tl-cell[data-l="0"][data-f="1"]');const r=cell.getBoundingClientRect();const x=r.left+8,y=r.top+r.height/2;
    const o=(px,py)=>({pointerId:3,pointerType:'touch',isPrimary:true,clientX:px,clientY:py,bubbles:true,cancelable:true});
    cell.dispatchEvent(new PointerEvent('pointerdown',o(x,y)));
    setTimeout(()=>{const items=[...document.querySelectorAll('.radial-item')].map(e=>e.textContent);const it=document.querySelectorAll('.radial-item')[3].getBoundingClientRect();
      document.dispatchEvent(new PointerEvent('pointermove',o(it.left+it.width/2,it.top+it.height/2)));document.dispatchEvent(new PointerEvent('pointerup',o(it.left+it.width/2,it.top+it.height/2)));
      setTimeout(()=>cb(items),60);},480);};
  press(items1=>{const mk=getMask(doc.layers[0]);const out={items1,made:!!mk&&mk[0]===255&&mk[40]===0,desel:!selection,frame:activeFrame};
    press(items2=>{out.items2=items2;out.editing=maskEdit===doc.layers[0].id;exitMaskEdit();res(out);});});}));
ok('cel long-press offers マスク (4 items); choosing it masks the layer from the selection',A.items1.length===4&&A.items1[3].includes('マスク')&&A.made&&A.desel&&A.frame===1);
ok('with a mask present the same item becomes マスク編集 and enters mask editing',A.items2[3].includes('マスク編集')&&A.editing);

// Ctrl+click on the mask thumb → selection from the mask; Shift+Ctrl adds; tablet lock ＋ works too
await page.waitForTimeout(300);   // the radial's post-release click guard (220ms)
const B=await page.evaluate(()=>{const mv=()=>$('#tlGrid .tl-cell[data-l="0"][data-f="0"] canvas.mthumb');
  selection=null;mv().dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));
  const out={sel:!!selection&&selection.mask[0]===1&&selection.mask[40]===0,notEditing:maskEdit===null};
  selection={mask:selBuf()};selection.mask[63]=1;computeSelBounds();mv().dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true,shiftKey:true}));
  out.add=selection.mask[63]===1&&selection.mask[0]===1;
  selection=null;stickySel='add';mv().dispatchEvent(new MouseEvent('click',{bubbles:true}));out.tablet=!!selection&&selection.mask[0]===1;stickySel='replace';
  selection=null;mv().dispatchEvent(new MouseEvent('click',{bubbles:true}));out.plainEdits=maskEdit===doc.layers[0].id;exitMaskEdit();return out;});
ok('Ctrl+click on a mask thumb loads it as the selection (no edit mode)',B.sel&&B.notEditing);
ok('Shift+Ctrl adds to the selection; tablet ＋ lock + tap does the same; plain tap still edits',B.add&&B.tablet&&B.plainEdits);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
