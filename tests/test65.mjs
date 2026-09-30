import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import http from 'http';import fs from 'fs';import path from 'path';
const ROOT='/home/user/pixel-art-tool';const MIME={'.html':'text/html','.js':'text/javascript'};
const server=http.createServer((req,res)=>{let p=req.url.split('?')[0];if(p==='/')p='/editor.html';const fp=path.join(ROOT,p);
  if(!fs.existsSync(fp)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'text/plain'});fs.createReadStream(fp).pipe(res);});
await new Promise(r=>server.listen(0,r));const base=`http://127.0.0.1:${server.address().port}`;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx=await b.newContext({viewport:{width:1024,height:768}});const page=await ctx.newPage();
const errors=[];page.on('pageerror',e=>errors.push('PAGEERR '+e.message));page.on('console',m=>{if(m.type()==='error')errors.push('CONSOLE '+m.text());});
await page.goto(base+'/editor.html',{waitUntil:'load'});await page.waitForTimeout(400);
const ok=(n,c)=>console.log((c?'✅':'❌')+' '+n);

const t0=Date.now();
const R=await page.evaluate(async()=>{const cv=document.createElement('canvas');cv.width=2400;cv.height=1200;const g=cv.getContext('2d');
  const gr=g.createLinearGradient(0,0,2400,0);gr.addColorStop(0,'#ff0000');gr.addColorStop(1,'#0000ff');g.fillStyle=gr;g.fillRect(0,0,2400,1200);
  const out={max:+$('#cvDot').max};
  openConverter(cv);$('#cvFitMax').click();out.fitMax=+$('#cvDot').value;out.info=$('#cvSizeInfo').textContent;
  $('#cvColors').value=16;
  const p=convParams();const r=Converter.convert(cv,p);out.size=[r.gw,r.gh];
  applyConvertResult(r,cv,p);out.doc=[W,H,doc.layers.length];closeConverter();
  return out;});
ok('coarseness slider reaches 128 (long-edge slider removed)',R.max===128);
ok('「最大」= 1 dot per px; readout says 2400×1200 ÷ 1 → 1980×990 (capped)',R.fitMax===1&&/2400×1200 ÷ 1 → 1980×990/.test(R.info)&&/上限/.test(R.info));
ok('a 2400×1200 source converts to 1980×990 and becomes the document',JSON.stringify(R.size)==='[1980,990]'&&R.doc[0]===1980&&R.doc[1]===990);
ok('conversion time acceptable ('+((Date.now()-t0)/1000).toFixed(1)+'s)',Date.now()-t0<30000);

const S=await page.evaluate(()=>{const out={};newDoc(8,8);openSize('resize');$('#newW').value=1980;$('#newH').value=1080;$('#sizeOk').click();out.resize=[W,H];
  out.inputMax=[$('#newW').max,$('#newH').max];setTool('crop');crop={x0:0,y0:0,x1:2000,y1:1500};out.crop=[cropRect().w,cropRect().h];setTool('pencil');
  newDoc(16,16);return out;});
ok('size dialog accepts 1980×1080 (limit 2048)',JSON.stringify(S.resize)==='[1980,1080]'&&S.inputMax.join()==='2048,2048');
ok('crop box may reach 2000×1500',JSON.stringify(S.crop)==='[2000,1500]');

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length?1:0);
