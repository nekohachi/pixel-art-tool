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
await page.evaluate(()=>{window.T={
  R:packHex('#ff0000',255)>>>0,B:packHex('#0000ff',255)>>>0,G:packHex('#00ff00',255)>>>0,
  // root: base (grey) ; group G = [ red (2,2), blue (3,2) hidden, green (4,2) ]
  setup(){newDoc(8,8);fitView();getCel(0,0).fill(packHex('#808080',255));doc.layers[0].name='base';
    addLayer();doc.layers[1].name='red';getCel(1,0)[2*8+2]=T.R;
    addLayer();doc.layers[2].name='blue';getCel(2,0)[2*8+3]=T.B;doc.layers[2].visible=false;
    addLayer();doc.layers[3].name='green';getCel(3,0)[2*8+4]=T.G;
    selLayers=new Set([1,2,3]);groupLayersSel();selection=null;floating=null;return doc.layers.map(l=>l.name);},
  gi(){return doc.layers.findIndex(l=>l.group);},
  cel(name){const L=doc.layers.find(l=>l.name===name);return doc.cels.get(celKey(L.id,0));},
  at(name,x,y){const c=T.cel(name);return c?c[y*8+x]>>>0:0;},
  C(px,py){const r=stage.getBoundingClientRect();return {x:r.left+panX+(px+0.5)*zoom,y:r.top+panY+(py+0.5)*zoom};},
  rect(x0,y0,x1,y1){selection={mask:selBuf()};for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)selection.mask[y*8+x]=1;computeSelBounds();}};});

// icons
const I=await page.evaluate(()=>{T.setup();const gi=T.gi();const row=$(`#tlGrid .tl-lhead[data-li="${gi}"]`);
  const fico=row.querySelector('.fico');const fw=fico?fico.getBoundingClientRect().width:0;const lk=row.querySelector('.lbtn.lock');const f0=getComputedStyle(lk).filter;
  doc.layers[gi].locked=true;refreshTimeline();const lk2=$(`#tlGrid .tl-lhead[data-li="${gi}"] .lbtn.lock`);const f1=getComputedStyle(lk2).filter;
  doc.layers[gi].locked=false;refreshTimeline();
  return {fico:!!fico,w:fw,noEmoji:!row.querySelector('.lname').textContent.includes('📁'),on:lk2.classList.contains('on'),diff:f0!==f1};});
ok('group rows show the amber folder icon (22px, no emoji); locked vs open lock are styled differently',I.fico&&I.w>=20&&I.noEmoji&&I.on&&I.diff);

// group thumbnail = live composite of visible children
const Th=await page.evaluate(()=>{T.setup();const gi=T.gi();const px=()=>{const cv=$(`#tlGrid .tl-cell[data-l="${gi}"][data-f="0"] canvas.cthumb`);
    const g=cv.getContext('2d');const w=cv.width,h=cv.height;const d=g.getImageData(0,0,w,h).data;const cols={};
    for(let i=0;i<d.length;i+=4)if(d[i+3]){const k=d[i]+','+d[i+1]+','+d[i+2];cols[k]=(cols[k]||0)+1;}return {w,h,cols};};
  const a=px();doc.layers.find(l=>l.name==='blue').visible=true;refreshTimeline();const b2=px();
  doc.layers.find(l=>l.name==='red').visible=false;refreshTimeline();const c=px();
  doc.layers.find(l=>l.name==='red').visible=true;doc.layers.find(l=>l.name==='blue').visible=false;refreshTimeline();
  // painting into a child updates the group thumb for that frame without a full refresh
  activeLayer=doc.layers.findIndex(l=>l.name==='green');getCel(activeLayer,0)[6*8+6]=T.G;updateCelThumb(activeLayer,0);const d=px();
  return {a,b2,c,d};});
ok('group thumb is drawn at thumbnail size and shows only visible children (red+green, no blue)',Th.a.w===40&&Th.a.h===40&&Th.a.cols['255,0,0']&&Th.a.cols['0,255,0']&&!Th.a.cols['0,0,255']);
ok('toggling children updates it (blue appears / red disappears)',Th.b2.cols['0,0,255']&&!Th.c.cols['255,0,0']);
ok('editing a child redraws the enclosing group thumb',(Th.d.cols['0,255,0']||0)>(Th.a.cols['0,255,0']||0));

// group selected + selection → nudge moves every visible child, hidden stays
const Mv=await page.evaluate(()=>{T.setup();activeLayer=T.gi();T.rect(1,1,5,3);nudgeStep(2,0,true);
  return {red:T.at('red',4,2)===T.R&&T.at('red',2,2)===0,green:T.at('green',6,2)===T.G,blue:T.at('blue',3,2)===T.B&&T.at('blue',5,2)===0,base:T.at('base',2,2)!==0,
    selMoved:selection.mask[2*8+3]===1&&selection.mask[2*8+1]===0,noGroupCel:!doc.cels.has(celKey(doc.layers[T.gi()].id,0))};});
ok('nudge with a group active moves red & green together, hidden blue and the base stay',Mv.red&&Mv.green&&Mv.blue&&Mv.base&&Mv.selMoved&&Mv.noGroupCel);

const Dr=await page.evaluate(()=>{T.setup();activeLayer=T.gi();T.rect(1,1,5,3);setTool('move');
  const a=T.C(3,2),b2=T.C(3,5);beginMove(3,2);doMove({clientX:b2.x,clientY:b2.y});endMove(false);
  const out={red:T.at('red',2,5)===T.R,green:T.at('green',4,5)===T.G,blue:T.at('blue',3,2)===T.B};
  undo();out.undone=T.at('red',2,2)===T.R&&T.at('green',4,2)===T.G&&T.at('red',2,5)===0;return out;});
ok('drag-move of a group selection moves both visible children down 3; undo restores both',Dr.red&&Dr.green&&Dr.blue&&Dr.undone);

const Wl=await page.evaluate(()=>{T.setup();activeLayer=T.gi();selection=null;const b2=T.C(1,1);beginMove(0,0);doMove({clientX:b2.x,clientY:b2.y});endMove(false);
  return {red:T.at('red',3,3)===T.R,green:T.at('green',5,3)===T.G,blue:T.at('blue',3,2)===T.B,base:T.at('base',0,0)!==0};});
ok('no selection: moving a group shifts every visible child layer, not the base',Wl.red&&Wl.green&&Wl.blue&&Wl.base);

const Dc=await page.evaluate(()=>{T.setup();activeLayer=T.gi();T.rect(2,2,2,2);copySelectionPixels();const clip=pixClip.data[0]>>>0;
  T.rect(1,1,5,3);deleteSelection();return {clip:clip===T.R,red:T.at('red',2,2)===0,green:T.at('green',4,2)===0,blue:T.at('blue',3,2)===T.B};});
ok('copy from a group takes its composite; delete clears only visible children',Dc.clip&&Dc.red&&Dc.green&&Dc.blue);

const Gd=await page.evaluate(()=>{T.setup();activeLayer=T.gi();T.rect(1,1,2,2);const n=doc.cels.size;
  beginTransform();const noXf=!xf;pixClip={w:1,h:1,x:0,y:0,data:new Uint32Array([T.R])};pasteSelectionPixels();
  setTool('pencil');const c=T.C(0,0);stage.dispatchEvent(new PointerEvent('pointerdown',{pointerId:2,pointerType:'mouse',isPrimary:true,button:0,buttons:1,clientX:c.x,clientY:c.y,bubbles:true}));
  stage.dispatchEvent(new PointerEvent('pointerup',{pointerId:2,pointerType:'mouse',isPrimary:true,button:0,buttons:0,clientX:c.x,clientY:c.y,bubbles:true}));
  return {noXf,noGroupCel:!doc.cels.has(celKey(doc.layers[T.gi()].id,0)),same:doc.cels.size===n};});
ok('transform / paste / paint on a group are refused and never create a stray group cel',Gd.noXf&&Gd.noGroupCel&&Gd.same);

console.log('ERRORS:',errors.length?JSON.stringify(errors):'none');
await b.close();server.close();process.exit(errors.length||fails?1:0);
