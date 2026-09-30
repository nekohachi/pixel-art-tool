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

const A=await page.evaluate(()=>{const mk=(w,h)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;const g=cv.getContext('2d');g.fillStyle='#4488cc';g.fillRect(0,0,w,h);return cv;};
  const out={};openConverter(mk(1920,1080));out.defDot=+$('#cvDot').value;out.defInfo=$('#cvSizeInfo').textContent;
  $('#cvFit64').click();out.d64=[+$('#cvDot').value,convLastResult.gw,convLastResult.gh];
  $('#cvFit128').click();out.d128=[+$('#cvDot').value,convLastResult.gw];
  $('#cvFit256').click();out.d256=[+$('#cvDot').value,convLastResult.gw];
  $('#cvDot').value=4;convRender();out.info4=$('#cvSizeInfo').textContent;out.grid4=[convLastResult.gw,convLastResult.gh];
  out.noCapSlider=!$('#cvCap');closeConverter();
  openConverter(mk(48,32));out.small=[+$('#cvDot').value,convLastResult.gw,convLastResult.gh];closeConverter();
  // old project params with a long-edge cap fold into the coarseness
  openConverter(mk(1920,1080),{dot:1,cap:64});out.legacy=[+$('#cvDot').value,convLastResult.gw];closeConverter();
  return out;});
ok('fresh 1920×1080 opens at ≤256 dots (N=8 → 240×135)',A.defDot===8&&/1920×1080 ÷ 8 → 240×135/.test(A.defInfo));
ok('≤64 / ≤128 / ≤256 presets pick the coarseness (30→64, 15→128, 8→240)',JSON.stringify(A.d64)==='[30,64,36]'&&JSON.stringify(A.d128)==='[15,128]'&&JSON.stringify(A.d256)==='[8,240]');
ok('readout follows the slider: ÷4 → 480×270',/÷ 4 → 480×270/.test(A.info4)&&JSON.stringify(A.grid4)==='[480,270]');
ok('long-edge slider is gone',A.noCapSlider);
ok('a tiny 48×32 source opens at 1:1',JSON.stringify(A.small)==='[1,48,32]');
ok('legacy params {dot:1,cap:64} reopen as N=30 → 64 dots',JSON.stringify(A.legacy)==='[30,64]');

const V=await page.evaluate(()=>{const out={};
  out.short=videoCaptureSize(1920,1080,20);      // 20 frames: fits the budget at native size
  out.long=videoCaptureSize(1920,1080,300);      // 300 frames: scaled down
  out.px=out.long.w*out.long.h*300;out.aspect=Math.abs(out.long.w/out.long.h-16/9)<0.02;
  out.small=videoCaptureSize(160,90,300);return out;});
ok('short clips are captured at native resolution',V.short.w===1920&&V.short.h===1080);
ok('300 frames of 1080p scale down to stay within the pixel budget, keeping the aspect',V.long.w<1920&&V.px<=48e6*1.02&&V.aspect);
ok('small sources are never upscaled',V.small.w===160&&V.small.h===90);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length?1:0);
