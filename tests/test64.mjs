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

// record a 2s webm in-page: solid red → green → blue thirds, 160×90
const rec=await page.evaluate(()=>new Promise(res=>{const cv=document.createElement('canvas');cv.width=160;cv.height=90;const g=cv.getContext('2d');
  const stream=cv.captureStream(20);const mr=new MediaRecorder(stream,{mimeType:'video/webm'});const chunks=[];
  mr.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  mr.onstop=()=>{const blob=new Blob(chunks,{type:'video/webm'});window.testVideo=new File([blob],'clip.webm',{type:'video/webm'});res({size:blob.size});};
  const t0=performance.now();const tick=()=>{const t=(performance.now()-t0)/1000;g.fillStyle=t<0.66?'#ff0000':t<1.33?'#00ff00':'#0000ff';g.fillRect(0,0,160,90);
    if(t<2.0)requestAnimationFrame(tick);else mr.stop();};
  mr.start(100);tick();}));
ok('MediaRecorder produced a webm ('+rec.size+' bytes)',rec.size>1000);

const meta=await page.evaluate(()=>new Promise(res=>{openVideoImport(window.testVideo,false);
  const t0=Date.now();const poll=()=>{if(videoSrc&&videoSrc.duration>0)res({shown:$('#videoModal').classList.contains('show'),dur:videoSrc.duration,info:$('#vidInfo').textContent,count:$('#vidCount').textContent,isVid:isVideoFile(window.testVideo)});
    else if(Date.now()-t0>8000)res({timeout:true,info:$('#vidInfo').textContent});else setTimeout(poll,50);};poll();}));
ok('video dialog opens and reads the duration (~2s) even from a MediaRecorder webm',meta.shown&&meta.dur>1.5&&meta.dur<3&&meta.isVid);
ok('dialog shows name/size/length and the planned frame count',/clip\.webm/.test(meta.info)&&/160×90/.test(meta.info)&&/フレーム/.test(meta.count));

const plan=await page.evaluate(()=>{$('#vidFps').value=5;updateVideoCount();const p=videoPlan();
  $('#vidFrom').value=0.5;$('#vidTo').value=1.5;updateVideoCount();const p2=videoPlan();
  $('#vidFps').value=30;$('#vidTo').value=videoSrc.duration;updateVideoCount();const big=$('#vidCount').textContent;
  $('#vidFps').value=5;$('#vidFrom').value=0;$('#vidTo').value=videoSrc.duration;updateVideoCount();return {p,p2,big};});
ok('frame count = duration × fps',plan.p.fps===5&&plan.p.n===Math.floor(meta.dur*5+1e-6));
ok('start/end range narrows the extraction (1s @5fps = 5 frames)',plan.p2.n===5&&plan.p2.from===0.5);

const conv=await page.evaluate(()=>new Promise(res=>{$('#vidOk').click();
  const t0=Date.now();const poll=()=>{if(convSeq&&$('#convModal').classList.contains('show'))res({n:convSeq.frames.length,w:convSeq.w,h:convSeq.h,title:$('#convTitle').textContent,
      seqRow:$('#cvSeqRow').style.display!=='none',max:+$('#cvSeqFrame').max,modalClosed:!$('#videoModal').classList.contains('show'),isVideo:!!convSeq.video,
      f0:[...convSeq.frames[0].data.slice(0,3)],fl:[...convSeq.frames[convSeq.frames.length-1].data.slice(0,3)]});
    else if(Date.now()-t0>15000)res({timeout:true});else setTimeout(poll,100);};poll();}));
ok('切り出し → converter opens in sequence mode with the video title',!conv.timeout&&conv.title.includes('動画')&&conv.seqRow&&conv.max===conv.n&&conv.modalClosed&&conv.isVideo);
ok('frames extracted at 5 fps (~10) at native size',conv.n>=8&&conv.n<=11&&conv.w===160&&conv.h===90);
ok('first frame is red, last frame is blue (real seeking, not one repeated frame)',conv.f0[0]>180&&conv.f0[2]<80&&conv.fl[2]>180&&conv.fl[0]<80);

const applied=await page.evaluate(async()=>{$('#cvDot').value=5;await applyConvertSeq(convParams());
  const L=doc.layers[0];const rgb=v=>[v&255,(v>>8)&255,(v>>16)&255];const n=doc.frames.length;
  const c0=doc.cels.get(celKey(L.id,0)),cl=doc.cels.get(celKey(L.id,n-1));
  return {n,W,H,dur:doc.frames[0].duration,p0:rgb(c0[0]),pl:rgb(cl[0]),conv:doc.convert,pal:palette.length};});
ok('apply converts every frame with the shared rules into a multi-frame doc',applied.n===conv.n&&applied.W===32&&applied.H===18&&applied.dur===200);
ok('frame colours survive (red first, blue last), shared small palette',applied.p0[0]>150&&applied.pl[2]>150&&applied.pal<=17);
ok('doc.convert records the video (no pixels) for 再調整',applied.conv.video&&applied.conv.video.n===conv.n&&!applied.conv.gif&&JSON.stringify(applied.conv).length<400);

const re=await page.evaluate(()=>new Promise(res=>{reopenConverter();setTimeout(()=>{const open=$('#convModal').classList.contains('show');
  const out={open,n:convSeq?convSeq.frames.length:0,dot:+$('#cvDot').value};$('#convCancel').click();
  videoSeqCache=null;reopenConverter();out.noCacheStillOk=!$('#convModal').classList.contains('show')&&doc.frames.length>1;res(out);},300);}));
ok('再調整 reopens the cached video sequence with the saved params',re.open&&re.n===conv.n&&re.dot===5);
ok('without the cache 再調整 just explains (document untouched)',re.noCacheStillOk);

const route=await page.evaluate(()=>{const out={};
  const orig=openVideoImport;let got=null;openVideoImport=(f,nt)=>{got={name:f.name,nt};};
  openDroppedFile(new File([new Uint8Array(10)],'a.mp4',{type:'video/mp4'}));out.drop=got;
  got=null;openDroppedFile(new File([new Uint8Array(10)],'b.png',{type:'image/png'}));out.pngNotVideo=got===null;
  openVideoImport=orig;out.accept=$('#fileConv').accept;return out;});
ok('dropping a video routes to the video import (new tab); PNG does not',route.drop&&route.drop.name==='a.mp4'&&route.drop.nt===true&&route.pngNotVideo);
ok('file picker accepts video',route.accept.includes('video/*'));

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length?1:0);
