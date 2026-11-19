/* ═══════════════════════════════════════════════════════════════════════
   NATURAL ORDER — widgets.js
   Widget engines used by more than one chapter.  Chapters load it with
     <script src="../shared/widgets.js" defer></script>
   Each engine is self-discovering and idempotent: it finds its elements by
   a data-* attribute, skips ones already initialised, and registers its
   init function with book.js so it runs again whenever an ibox opens.
   Chapter-specific widget code stays in the chapter's own <script>.
   ═══════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════
   SELF-DISCOVERING LOG-LOG PLOT ENGINE
   Initialises any <canvas data-plot-cfg='...'> in the DOM.
   Safe to call multiple times — already-initialised canvases
   are skipped via canvas._plotInited flag.
   Called: on page load, on toggleIbox open, and by the editor
   after paste (via runChapterScripts → window.initAllPlots).
   ════════════════════════════════════════════════════════════════ */
(function(){
function _sup(n){const m={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻'};return String(n).split('').map(c=>m[c]||c).join('');}
const _C={BG:'#faf7f2',GRID:'#ece5d8',GRIDF:'#f4efea',AXIS:'#5a3a1a',MUT:'#6a5a4a',DOT:'#7a2e10',LINE:'#D85A30',FIT:'#1D9E75'};
const _PL=68,_PR=18,_PT=22,_PB=54;
function _ns(range,t){const r=range/t,m=Math.pow(10,Math.floor(Math.log10(r))),n=r/m;return(n<1.5?1:n<3.5?2:n<7.5?5:10)*m;}

function _buildPlot(canvas,cfg){
  const key=canvas.id.replace('cv-','');
  const slider=document.getElementById('sl-'+key);
  const svalEl=document.getElementById('sv-'+key);
  const eqEl=document.getElementById('eq-'+key);
  const revBtn=document.getElementById('rb-'+key);
  const ansEl=document.getElementById('ans-'+key);
  const ctx=canvas.getContext('2d');
  const W=canvas.width,H=canvas.height,PW=W-_PL-_PR,PH=H-_PT-_PB;
  let isLL=false,revealed=false;
  const logXC=cfg.data.reduce((s,d)=>s+Math.log10(d.x),0)/cfg.data.length;
  const logYC=cfg.data.reduce((s,d)=>s+Math.log10(d.y),0)/cfg.data.length;

  function dots(xP,yP,lbl){cfg.data.forEach(pt=>{const px=xP(pt.x),py=yP(pt.y);ctx.fillStyle='rgba(122,46,16,0.12)';ctx.beginPath();ctx.arc(px+1,py+1,5.5,0,Math.PI*2);ctx.fill();ctx.fillStyle=_C.DOT;ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,0.5)';ctx.beginPath();ctx.arc(px-1.5,py-1.5,2,0,Math.PI*2);ctx.fill();if(lbl&&pt.label){ctx.fillStyle=_C.MUT;ctx.font='11px system-ui,sans-serif';ctx.textAlign='left';ctx.fillText(pt.label,px+8,py+4);}});}

  function drawLinear(){
    const xMax=Math.max(...cfg.data.map(d=>d.x))*1.12,yMax=Math.max(...cfg.data.map(d=>d.y))*1.12;
    const xP=x=>_PL+x/xMax*PW,yP=y=>_PT+PH-y/yMax*PH;
    ctx.fillStyle=_C.BG;ctx.fillRect(0,0,W,H);
    const xS=_ns(xMax,5),yS=_ns(yMax,5);
    ctx.strokeStyle=_C.GRID;ctx.lineWidth=0.8;
    for(let v=xS;v<xMax*1.01;v+=xS){ctx.beginPath();ctx.moveTo(xP(v),_PT);ctx.lineTo(xP(v),_PT+PH);ctx.stroke();}
    for(let v=yS;v<yMax*1.01;v+=yS){const py=yP(v);if(py<_PT-1||py>_PT+PH+1)continue;ctx.beginPath();ctx.moveTo(_PL,py);ctx.lineTo(_PL+PW,py);ctx.stroke();}
    ctx.strokeStyle=_C.AXIS;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(_PL,_PT);ctx.lineTo(_PL,_PT+PH+5);ctx.moveTo(_PL-5,_PT+PH);ctx.lineTo(_PL+PW,_PT+PH);ctx.stroke();
    ctx.fillStyle=_C.MUT;ctx.font='11px system-ui,sans-serif';ctx.textAlign='center';
    for(let v=xS;v<xMax*1.01;v+=xS){const px=xP(v),l=v>=1000?(v/1000).toFixed(0)+'k':v.toFixed(v<1?2:0);ctx.fillText(l,px,_PT+PH+16);ctx.strokeStyle=_C.MUT;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px,_PT+PH);ctx.lineTo(px,_PT+PH+4);ctx.stroke();}
    ctx.textAlign='right';
    for(let v=yS;v<yMax*1.01;v+=yS){const py=yP(v);if(py<_PT-1||py>_PT+PH+1)continue;const l=v>=1000?(v/1000).toFixed(0)+'k':v.toFixed(v<1?2:0);ctx.fillStyle=_C.MUT;ctx.fillText(l,_PL-5,py+4);ctx.strokeStyle=_C.MUT;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(_PL,py);ctx.lineTo(_PL-4,py);ctx.stroke();}
    ctx.fillStyle=_C.AXIS;ctx.font='italic 13px Georgia,"Book Antiqua",serif';ctx.textAlign='center';
    ctx.fillText(cfg.xLabel,_PL+PW/2,_PT+PH+38);ctx.save();ctx.translate(13,_PT+PH/2);ctx.rotate(-Math.PI/2);ctx.fillText(cfg.yLabel,0,0);ctx.restore();
    dots(xP,yP,false);
  }

  function drawLogLog(){
    const slope=revealed?cfg.trueSlope:parseFloat(slider?slider.value:cfg.defaultSlope);
    const logB=logYC-slope*logXC;
    const lxMn=Math.log10(cfg.xMin),lxMx=Math.log10(cfg.xMax),lyMn=Math.log10(cfg.yMin),lyMx=Math.log10(cfg.yMax);
    const xP=x=>_PL+(Math.log10(x)-lxMn)/(lxMx-lxMn)*PW;
    const yP=y=>_PT+PH-(Math.log10(Math.max(cfg.yMin*0.01,y))-lyMn)/(lyMx-lyMn)*PH;
    ctx.fillStyle=_C.BG;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle=_C.GRIDF;ctx.lineWidth=0.6;
    for(let d=Math.floor(lxMn);d<Math.ceil(lxMx);d++){for(let m=2;m<=9;m++){const x=Math.pow(10,d)*m;if(x<cfg.xMin*.5||x>cfg.xMax*2)continue;ctx.beginPath();ctx.moveTo(xP(x),_PT);ctx.lineTo(xP(x),_PT+PH);ctx.stroke();}}
    for(let d=Math.floor(lyMn);d<Math.ceil(lyMx);d++){for(let m=2;m<=9;m++){const y=Math.pow(10,d)*m;if(y<cfg.yMin*.5||y>cfg.yMax*2)continue;const py=yP(y);if(py<_PT-2||py>_PT+PH+2)continue;ctx.beginPath();ctx.moveTo(_PL,py);ctx.lineTo(_PL+PW,py);ctx.stroke();}}
    ctx.strokeStyle=_C.GRID;ctx.lineWidth=1;
    for(let d=Math.floor(lxMn);d<=Math.ceil(lxMx);d++){const x=Math.pow(10,d);if(x<cfg.xMin*.3||x>cfg.xMax*3)continue;ctx.beginPath();ctx.moveTo(xP(x),_PT);ctx.lineTo(xP(x),_PT+PH);ctx.stroke();}
    for(let d=Math.floor(lyMn);d<=Math.ceil(lyMx);d++){const y=Math.pow(10,d);if(y<cfg.yMin*.3||y>cfg.yMax*3)continue;const py=yP(y);if(py<_PT-2||py>_PT+PH+2)continue;ctx.beginPath();ctx.moveTo(_PL,py);ctx.lineTo(_PL+PW,py);ctx.stroke();}
    ctx.strokeStyle=_C.AXIS;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(_PL,_PT);ctx.lineTo(_PL,_PT+PH+5);ctx.moveTo(_PL-5,_PT+PH);ctx.lineTo(_PL+PW,_PT+PH);ctx.stroke();
    ctx.fillStyle=_C.MUT;ctx.font='11px system-ui,sans-serif';ctx.textAlign='center';
    for(let d=Math.floor(lxMn);d<=Math.ceil(lxMx);d++){const x=Math.pow(10,d);if(x<cfg.xMin*.3||x>cfg.xMax*3)continue;const l=d===0?'1':d===1?'10':'10'+_sup(d);ctx.fillStyle=_C.MUT;ctx.fillText(l,xP(x),_PT+PH+16);ctx.strokeStyle=_C.MUT;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(xP(x),_PT+PH);ctx.lineTo(xP(x),_PT+PH+4);ctx.stroke();}
    ctx.textAlign='right';
    for(let d=Math.floor(lyMn);d<=Math.ceil(lyMx);d++){const y=Math.pow(10,d);if(y<cfg.yMin*.3||y>cfg.yMax*3)continue;const py=yP(y);if(py<_PT-2||py>_PT+PH+2)continue;const l=d===0?'1':d===1?'10':'10'+_sup(d);ctx.fillStyle=_C.MUT;ctx.fillText(l,_PL-5,py+4);ctx.strokeStyle=_C.MUT;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(_PL,py);ctx.lineTo(_PL-4,py);ctx.stroke();}
    ctx.fillStyle=_C.AXIS;ctx.font='italic 13px Georgia,"Book Antiqua",serif';ctx.textAlign='center';
    ctx.fillText('log '+cfg.xLabelShort,_PL+PW/2,_PT+PH+38);ctx.save();ctx.translate(13,_PT+PH/2);ctx.rotate(-Math.PI/2);ctx.fillText('log '+cfg.yLabelShort,0,0);ctx.restore();
    ctx.save();ctx.beginPath();ctx.rect(_PL,_PT,PW,PH);ctx.clip();
    ctx.strokeStyle=revealed?_C.FIT:_C.LINE;ctx.lineWidth=revealed?2.5:2;ctx.setLineDash(revealed?[]:[7,5]);
    ctx.beginPath();ctx.moveTo(_PL,_PT+PH-(slope*lxMn+logB-lyMn)/(lyMx-lyMn)*PH);ctx.lineTo(_PL+PW,_PT+PH-(slope*lxMx+logB-lyMn)/(lyMx-lyMn)*PH);
    ctx.stroke();ctx.setLineDash([]);ctx.restore();
    if(revealed){ctx.fillStyle=_C.FIT;ctx.font='bold 12px system-ui,sans-serif';ctx.textAlign='left';ctx.fillText('slope = '+cfg.trueSlope.toFixed(2)+'  ✓',_PL+8,_PT+16);}
    const p=revealed?cfg.trueSlope:parseFloat(slider?slider.value:cfg.defaultSlope);
    const pStr=(p<0?'−':'')+Math.abs(p).toFixed(2);
    if(eqEl)eqEl.innerHTML=cfg.eqSymY+' ∝ ('+cfg.eqSymX+')<sup>'+pStr+'</sup>';
    if(svalEl)svalEl.textContent=pStr;
    dots(xP,yP,true);
  }

  function draw(){isLL?drawLogLog():drawLinear();}

  canvas._plotToggle=function(checked){
    isLL=checked;
    if(!isLL){revealed=false;if(revBtn)revBtn.textContent='Reveal best fit';if(ansEl)ansEl.style.display='none';if(slider)slider.value=cfg.defaultSlope;}
    draw();
  };
  canvas._plotDraw=draw;
  if(slider)slider.addEventListener('input',()=>{if(!revealed&&isLL)draw();});
  if(revBtn)revBtn.addEventListener('click',()=>{
    revealed=!revealed;
    revBtn.textContent=revealed?'Hide best fit':'Reveal best fit';
    if(ansEl)ansEl.style.display=revealed?'inline':'none';
    if(slider&&revealed)slider.value=cfg.trueSlope;
    draw();
  });
  draw();
}

function initAllPlots(){
  document.querySelectorAll('canvas[data-plot-cfg]').forEach(function(canvas){
    if(canvas._plotInited)return;
    try{
      var raw=canvas.getAttribute('data-plot-cfg');
      var cfg=JSON.parse(raw);
      _buildPlot(canvas,cfg);
      canvas._plotInited=true;
    }catch(e){console.warn('Plot init error:',canvas.id,e);}
  });
}

window.initAllPlots=initAllPlots;

window.toggleLL=function(key){
  var cb=document.getElementById('ll-'+key);
  var panel=document.getElementById('llp-'+key);
  var canvas=document.getElementById('cv-'+key);
  if(!cb||!canvas)return;
  if(panel)panel.classList.toggle('active',cb.checked);
  if(canvas._plotToggle)canvas._plotToggle(cb.checked);
};

initAllPlots();
})();
if (window.NaturalOrder && NaturalOrder.registerWidget)
  NaturalOrder.registerWidget(window.initAllPlots);
