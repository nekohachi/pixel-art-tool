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
await page.evaluate(()=>{window.T={K:packHex('#000000',255)>>>0,R:packHex('#ff0000',255)>>>0,
  ring(){newDoc(40,40);fitView();setTool('pencil');brushSize=1;brushSizes.pencil=1;opacity=255;setColorHex('#000000');const c=getCel(0,0);
    strokeEllipse(c,9,11,29,29);setColorHex('#ff0000');floodFill(c,19,20);selection={mask:selBuf()};selection.mask.fill(1);computeSelBounds();},
  rot(deg){const c=xfCentroid(xf.corners),a=deg*Math.PI/180,co=Math.cos(a),si=Math.sin(a);xf.corners=xf.corners.map(p=>{const dx=p.x-c.x,dy=p.y-c.y;return{x:c.x+dx*co-dy*si,y:c.y+dx*si+dy*co};});},
  c(){return JSON.stringify(xf.corners.map(p=>[Math.round(p.x*100)/100,Math.round(p.y*100)/100]));},
  key(k,m={}){document.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true,cancelable:true},m)));},
  stats(){const c=getCel(0,0);let n=0,deg2=0,lonely=0,Ls=0;const is=(x,y)=>x>=0&&y>=0&&x<40&&y<40&&(c[y*40+x]>>>0)===T.K;
    for(let y=0;y<40;y++)for(let x=0;x<40;x++){if(!is(x,y))continue;n++;let d=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if((dx||dy)&&is(x+dx,y+dy))d++;}
      if(d===2)deg2++;if(d===0)lonely++;const u=is(x,y-1),dn=is(x,y+1),l=is(x-1,y),r=is(x+1,y);
      if((u&&r&&!is(x+1,y-1))||(r&&dn&&!is(x+1,y+1))||(dn&&l&&!is(x-1,y+1))||(l&&u&&!is(x-1,y-1)))Ls++;}
    const seen=new Uint8Array(1600),st=[];for(let i=0;i<40;i++){st.push(i,1560+i,i*40,i*40+39);}let leak=0;
    while(st.length){const j=st.pop();if(seen[j]||(c[j]>>>0)===T.K)continue;seen[j]=1;if((c[j]>>>0)===T.R)leak++;const x=j%40,y=(j/40)|0;
      if(x>0)st.push(j-1);if(x<39)st.push(j+1);if(y>0)st.push(j-40);if(y<39)st.push(j+40);}return {n,deg2,lonely,Ls,leak};}};});

// 1) nudging during a transform moves the rotated box (rotation kept), one history step per press
const A=await page.evaluate(()=>{T.ring();beginTransform();T.rot(30);const c0=xf.corners.map(p=>({x:p.x,y:p.y}));
  T.key('ArrowRight');T.key('ArrowRight');T.key('ArrowDown');
  const moved=xf.corners.every((p,i)=>Math.abs(p.x-(c0[i].x+2))<1e-9&&Math.abs(p.y-(c0[i].y+1))<1e-9);const still=!!xf;
  T.key('z',{ctrlKey:true});const back1=xf.corners.every((p,i)=>Math.abs(p.x-(c0[i].x+2))<1e-9&&Math.abs(p.y-c0[i].y)<1e-9);
  nudgeStep(-1,0,true);const dpad=xf.corners.every((p,i)=>Math.abs(p.x-(c0[i].x+1))<1e-9);   // the D-pad buttons go through nudgeStep
  T.key('Enter');return {moved,still,back1,dpad,committed:!xf};});
ok('arrow keys / D-pad during a transform move the rotated box 1px (rotation kept), each press undoable',A.moved&&A.still&&A.back1&&A.dpad&&A.committed);

// 2) RotSprite+ : L-corner cleanup on 1px strokes
const B=await page.evaluate(()=>{T.ring();const src=T.stats();beginTransform();T.rot(25);rotSprite=true;applyTransformRender(true);const rs=T.stats();
  // same without the line pass, for comparison
  xfEach((cel,P)=>{cel.set(P.base);const fm=selBuf(),sm=new Int32Array(W*H);xfStamp(cel,P,fm,true,sm);rsCleanup(cel,fm,sm,P);});const plain=T.stats();
  cancelTransform();return {src,rs,plain};});
console.log('   stats src/plain/RotSprite+:',JSON.stringify(B.src),JSON.stringify(B.plain),JSON.stringify(B.rs));
ok('RotSprite+ removes the L-corner doubles the plain pass leaves on a rotated 1px ring (fewer Ls, more clean pixels)',B.rs.Ls<B.plain.Ls&&B.rs.deg2/B.rs.n>B.plain.deg2/B.plain.n);
ok('…while keeping the ring closed (no fill leaks) and no isolated pixels',B.rs.leak===0&&B.rs.lonely===0);

// 3) deliberate corners survive: a square outline rotated by 0° (identity) keeps all 4 corner pixels
const Cc=await page.evaluate(()=>{newDoc(16,16);const c=getCel(0,0);for(let i=4;i<12;i++){c[4*16+i]=T.K;c[11*16+i]=T.K;c[i*16+4]=T.K;c[i*16+11]=T.K;}
  selection={mask:selBuf()};selection.mask.fill(1);computeSelBounds();rotSprite=true;beginTransform();applyTransformRender(true);
  const corners=[[4,4],[11,4],[4,11],[11,11]].every(([x,y])=>(getCel(0,0)[y*16+x]>>>0)===T.K);cancelTransform();return corners;});
ok('intended corners (an L in the source) are kept',Cc);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
