/* DREAMS RIFA - cliente (pagina principal + tablero de rifa) */
let HOME=null, S=null, RID=null, sel=null, payMode='manual';
const $=id=>document.getElementById(id);
function pad(n){return String(n).padStart(2,'0');}
function money(c,n){return (c||'')+' '+Number(n||0).toLocaleString('es-CO');}
function esc(s){return (s==null?'':String(s)).replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));}
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),3000);}
function closeModal(){$('modal').classList.remove('show');$('mbg').classList.remove('show');}
$('mbg').onclick=closeModal;
const WA_SVG='<svg class="wa" viewBox="0 0 32 32" fill="#25D366"><path d="M16 3C9 3 3.5 8.5 3.5 15.5c0 2.4.7 4.6 1.8 6.5L3 29l7.2-2.3c1.8 1 3.9 1.5 6 1.5 6.9 0 12.5-5.5 12.5-12.5S23 3 16 3zm0 22.6c-1.9 0-3.7-.5-5.3-1.5l-.4-.2-4.3 1.4 1.4-4.2-.2-.4c-1-1.6-1.6-3.5-1.6-5.5C5.8 9.8 10.4 5.3 16 5.3s10.2 4.5 10.2 10.2S21.6 25.6 16 25.6zm5.7-7.6c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2s-.8 1-1 1.2c-.2.2-.4.2-.7.1-1.8-.9-3-1.6-4.2-3.6-.3-.5.3-.5.8-1.6.1-.2 0-.4 0-.5s-.7-1.7-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4s-1 1-1 2.5 1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6 2 .8 2.7.9 3.7.8.6-.1 1.8-.7 2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"/></svg>';

function fechaLarga(d){ try{ return new Date(d+'T00:00:00').toLocaleDateString('es',{weekday:'long',day:'numeric',month:'long'}); }catch(e){ return d||''; } }

/* ===================== PAGINA PRINCIPAL ===================== */
function applyBrand(b){
  const img=$('logoImg'), txt=$('logoTxt');
  if(b && b.logo){ img.src=b.logo; img.classList.remove('hidden'); txt.classList.add('hidden'); img.onerror=()=>{ img.classList.add('hidden'); txt.textContent=b.heading||'DREAMS RIFA'; txt.classList.remove('hidden'); }; }
  else { txt.textContent=(b&&b.heading)||'DREAMS RIFA'; txt.classList.remove('hidden'); img.classList.add('hidden'); }
  const sl=$('brandSlogan'); if(b&&b.slogan){ sl.textContent=b.slogan; sl.style.display=''; } else sl.style.display='none';
  const intro=$('brandIntro'); if(b&&b.intro){ intro.textContent=b.intro; intro.style.display=''; } else intro.style.display='none';
}
async function loadHome(){
  try{ HOME = await (await fetch('/api/home')).json(); }catch(e){ toast('Sin conexión'); return; }
  applyBrand(HOME.brand);
  document.title=(HOME.brand&&HOME.brand.heading)||'DREAMS RIFA';
  renderCards();
  renderGroups();
}
function renderCards(){
  const box=$('rcards'); box.innerHTML='';
  const list=(HOME.raffles||[]);
  if(list.length===0){ box.innerHTML='<div class="empty">Aún no hay rifas publicadas. Vuelve pronto 💜</div>'; return; }
  list.forEach(r=>{
    const soon = r.status==='soon';
    const card=document.createElement(soon?'div':'button');
    card.className='rcard'+(soon?' soon':'');
    if(!soon) card.onclick=()=>openRaffle(r.id);
    const badge = soon ? '<span class="rbadge soon">⏰ Próximamente</span>' : '<span class="rbadge on">● Abierta</span>';
    const slo = r.slogan ? '<div class="rslo">'+esc(r.slogan)+'</div>' : '';
    const prize = r.prize ? '<div class="rmeta">🏆 Premio mayor: <span class="rprize">'+money(r.currency,r.prize.amount)+'</span></div>' : '';
    const chips = '<div class="rchips">'+
      '<span class="chip">🎫 <b>'+money(r.currency,r.price)+'</b></span>'+
      '<span class="chip">📅 <b>'+fechaLarga(r.drawDate)+'</b></span>'+
      '<span class="chip">🕒 <b>'+esc(r.drawTime||'')+'</b></span>'+
      (r.drawNote?'<span class="chip">'+esc(r.drawNote)+'</span>':'')+
      '</div>';
    const go = soon ? '' : '<span class="rgo">Participar →</span>';
    card.innerHTML='<div class="rtop"><span class="rname">'+esc(r.name)+'</span>'+badge+'</div>'+slo+prize+chips+'<div class="rmeta">'+r.counts.libre+' libres • '+r.counts.res+' reservados • '+r.counts.pag+' pagados</div>'+go;
    box.appendChild(card);
  });
}
function renderGroups(){
  const wrap=$('waWrap'); wrap.innerHTML='';
  const g=(HOME.brand&&HOME.brand.groups)||[];
  if(g.length===0) return;
  let html='<div class="sectitle">Grupos oficiales de WhatsApp</div><div class="groups">';
  g.forEach(x=>{ if(!x.url) return; html+='<a class="gbtn" href="'+esc(x.url)+'" target="_blank" rel="noopener">'+WA_SVG+'<span>'+esc(x.name||'Grupo de WhatsApp')+'</span></a>'; });
  html+='</div>';
  wrap.innerHTML=html;
}
function goHome(){ RID=null; history.replaceState({},'','/'); $('board-view').classList.add('hidden'); $('home').classList.remove('hidden'); loadHome(); }
function openRaffle(id){ RID=id; history.replaceState({},'','/?r='+id); $('home').classList.add('hidden'); $('board-view').classList.remove('hidden'); loadBoard(); }
/* ===================== TABLERO DE UNA RIFA ===================== */
async function loadBoard(){
  try{ S = await (await fetch('/api/state/'+RID)).json(); }catch(e){ toast('Sin conexión'); return; }
  if(S.error){ toast('Esta rifa ya no existe'); goHome(); return; }
  document.title=(S.name||'DREAMS RIFA');
  renderPrizes();
  const wa=$('waBtn');
  if(S.whatsapp){ wa.href=S.whatsapp; wa.classList.remove('hidden'); $('waBtnLabel').textContent='Unirme al grupo de «'+(S.name||'la rifa')+'»'; }
  else wa.classList.add('hidden');
  $('banner').innerHTML='<b>'+esc(S.name)+'</b> &nbsp;•&nbsp; Valor por número <b>'+money(S.currency,S.price)+'</b> &nbsp;•&nbsp; Sorteo <b>'+esc(S.drawTime||'')+'</b> del <b>'+fechaLarga(S.drawDate)+'</b>'+(S.drawNote?' &nbsp;•&nbsp; '+esc(S.drawNote):'');
  renderBoard();
}
function renderPrizes(){
  const box=$('prizes'); box.innerHTML='';
  (S.prizes||[]).forEach((p,i)=>{
    const d=document.createElement('div');
    d.className='prize'+(i===0?' main':'');
    d.innerHTML='<span class="pl">'+(i===0?'\u{1F3C6} ':'\u2728 ')+esc(p.label)+'</span><span class="pa">'+money(S.currency,p.amount)+'</span>';
    box.appendChild(d);
  });
}
function renderBoard(){
  const b=$('board'); b.innerHTML='';
  for(let i=0;i<100;i++){
    const k=pad(i), n=S.numbers[k];
    const c=document.createElement('div');
    c.className='cell '+n.status+(S.winner===k?' winner':'');
    c.textContent=k;
    if(n.status==='available') c.onclick=()=>choose(k);
    b.appendChild(c);
  }
}
function methodsAvailable(){
  const m=[];
  if(S.breb && S.breb.enabled) m.push('breb');
  if(S.mp) m.push('online');
  m.push('manual');
  return m;
}
function choose(k){ sel=k; payMode=methodsAvailable()[0]; openForm(); }
function openForm(){
  const m=methodsAvailable();
  const labels={breb:['⚡','Bre-B / Nequi<br>(QR)'],online:['💳','Tarjeta / PSE<br>(automático)'],manual:['🤝','Pago directo<br>(coordinar)']};
  let opts='';
  if(m.length>1){
    opts='<label style="font-size:13px;color:var(--mut)">¿Cómo quieres pagar?</label><div class="pay-opts">';
    m.forEach(x=>{ opts+='<div class="pay-opt'+(x===payMode?' on':'')+'" id="opt_'+x+'" onclick="setPay(\''+x+'\')"><span class="big">'+labels[x][0]+'</span>'+labels[x][1]+'</div>'; });
    opts+='</div>';
  }
  $('modal').innerHTML =
    '<h2>Participar con el número <span class="pick">'+sel+'</span></h2>'+
    '<div class="field"><label>Tu nombre (como aparece en Nequi o tu banco)</label><input id="i_name" placeholder="Nombre y apellido"></div>'+
    '<div class="field"><label>WhatsApp</label><input id="i_phone" placeholder="Ej: 300 123 4567"></div>'+
    opts+
    '<button class="btn primary" id="go" onclick="submitReserve()">'+goLabel()+'</button>'+
    '<button class="btn ghost" onclick="closeModal()">Cancelar</button>'+
    '<div class="note">El número queda <b>reservado</b> a tu nombre. Coordina tu pago con el organizador para confirmarlo.</div>';
  $('mbg').classList.add('show'); $('modal').classList.add('show');
}
function goLabel(){ if(payMode==='online') return 'Reservar y pagar'; if(payMode==='breb') return 'Reservar y generar QR'; return 'Reservar número'; }
function setPay(m){ payMode=m; document.querySelectorAll('.pay-opt').forEach(e=>e.classList.remove('on')); const el=$('opt_'+m); if(el) el.classList.add('on'); $('go').textContent=goLabel(); }
async function submitReserve(){
  const buyer=$('i_name').value.trim(); const phone=$('i_phone').value.trim();
  if(!buyer){ toast('Escribe tu nombre'); return; }
  $('go').disabled=true; $('go').textContent='Procesando...';
  let r;
  try{ r = await (await fetch('/api/reserve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({raffle:RID,number:sel,buyer,phone,method:payMode})})).json(); }
  catch(e){ toast('Error de conexión'); $('go').disabled=false; return; }
  if(r.error){ toast(r.error); $('go').disabled=false; loadBoard(); return; }
  if(r.payUrl){ window.location.href = r.payUrl; return; }
  if(r.method==='breb' && r.breb){ brebScreen(r.number, r.breb); loadBoard(); return; }
  closeModal(); loadBoard();
  if(r.warn) toast(r.warn); else toast('Número '+r.number+' reservado. Coordina tu pago para confirmarlo.');
}
/* ===== Flujo de pago Bre-B / Nequi ===== */
let claimReceipt='';
function brebScreen(num, b){
  claimReceipt='';
  const qr = b.qrImage ? '<img class="qr-img" src="'+b.qrImage+'" alt="QR Bre-B">' : '<div class="benef">El organizador aún no cargó el QR. Usa la <b>llave Bre-B</b> de abajo para transferir.</div>';
  const llave = b.llave ? '<div class="llave"><span>'+esc(b.llave)+'</span><button class="copybtn" onclick="copyLlave(\''+esc(b.llave)+'\')">Copiar</button></div>' : '';
  $('modal').innerHTML=
    '<div class="qr-box">'+
    '<span class="badge-breb">⚡ Bre-B</span>'+
    '<h2 style="margin-top:8px">Paga el número <span class="pick">'+num+'</span></h2>'+ qr +
    '<div class="amount">'+money(b.currency,b.amount)+'</div>'+
    (b.llave?'<div style="font-size:12px;color:var(--mut)">Llave Bre-B</div>':'')+llave+
    '<div class="benef">'+(b.business?'<div><b>'+esc(b.business)+'</b></div>':'')+(b.beneficiary?'<div>Titular: <b>'+esc(b.beneficiary)+'</b></div>':'')+'</div>'+
    '<ol class="steps">'+
      '<li>Abre tu app bancaria o <b>Nequi</b> y escanea el QR (o usa la opción Bre-B / Llaves).</li>'+
      '<li>Si no puedes escanear, copia la <b>llave Bre-B</b> y pégala en tu app.</li>'+
      '<li>Transfiere el <b>valor exacto</b>: '+money(b.currency,b.amount)+'.</li>'+
      '<li>Vuelve aquí y pulsa <b>“Ya transferí”</b> para avisar al organizador.</li>'+
    '</ol>'+
    (b.requireReceipt
      ? '<div class="field"><label>Adjunta el comprobante (obligatorio)</label><input type="file" accept="image/*" id="rc" onchange="readReceipt(this)"></div>'
      : '<div class="field"><label>Comprobante (opcional, ayuda a confirmar más rápido)</label><input type="file" accept="image/*" id="rc" onchange="readReceipt(this)"></div>')+
    '<button class="btn primary" id="claimBtn" onclick="doClaim(\''+num+'\','+(b.requireReceipt?'true':'false')+')">Ya transferí</button>'+
    '<button class="btn ghost" onclick="closeModal();loadBoard()">Lo haré luego</button>'+
    '<div class="note">Tu número <b>'+num+'</b> queda reservado. El organizador confirmará tu pago; mientras tanto no se liberará.</div>'+
    '</div>';
}
function copyLlave(v){ navigator.clipboard.writeText(v).then(()=>toast('Llave copiada')).catch(()=>toast('Copia manual: '+v)); }
function readReceipt(inp){ const f=inp.files[0]; if(!f) return; if(f.size>5*1024*1024){ toast('Imagen muy grande (máx 5MB)'); inp.value=''; return; } const fr=new FileReader(); fr.onload=()=>{ claimReceipt=fr.result; toast('Comprobante listo'); }; fr.readAsDataURL(f); }
async function doClaim(num, requireReceipt){
  if(requireReceipt && !claimReceipt){ toast('Adjunta el comprobante para continuar'); return; }
  const btn=$('claimBtn'); btn.disabled=true; btn.textContent='Enviando...';
  try{ await fetch('/api/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({raffle:RID,number:num, receipt:claimReceipt||undefined})}); }catch(e){}
  closeModal(); loadBoard();
  toast('¡Gracias! Avisamos al organizador. Tu número '+num+' quedará confirmado pronto.');
}
/* ===== Imagen para compartir en WhatsApp (del tablero de la rifa) ===== */
function countStatus(){ let libre=0,res=0,pag=0; for(let i=0;i<100;i++){const s=S.numbers[pad(i)].status; if(s==='paid')pag++; else if(s==='reserved')res++; else libre++;} return {libre,res,pag}; }
function rr(x,X,Y,w,h,r){x.beginPath();x.moveTo(X+r,Y);x.arcTo(X+w,Y,X+w,Y+h,r);x.arcTo(X+w,Y+h,X,Y+h,r);x.arcTo(X,Y+h,X,Y,r);x.arcTo(X,Y,X+w,Y,r);x.closePath();}
function shareImage(){
  if(!S){ toast('Espera, cargando...'); return; }
  const W=1080, pad0=48, cols=10, gap=12;
  const gridW=W-pad0*2, cell=(gridW-gap*(cols-1))/cols;
  const topH=360, legendH=150, gridH=cell*10+gap*9;
  const H=topH+gridH+legendH;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const x=cv.getContext('2d');
  const bg=x.createLinearGradient(0,0,W,H); bg.addColorStop(0,'#1a0020'); bg.addColorStop(.5,'#0A000A'); bg.addColorStop(1,'#20002a');
  x.fillStyle=bg; x.fillRect(0,0,W,H); x.textAlign='center';
  x.font='900 72px Segoe UI,Arial,sans-serif';
  const lg=x.createLinearGradient(0,60,0,140); lg.addColorStop(0,'#FF66DD'); lg.addColorStop(.5,'#FF00FF'); lg.addColorStop(1,'#FFD700');
  x.fillStyle=lg; x.shadowColor='rgba(255,0,255,.6)'; x.shadowBlur=24;
  x.fillText((S.name||'DREAMS RIFA').toUpperCase(),W/2,120); x.shadowBlur=0;
  if(S.slogan){ x.font='italic 34px Segoe UI,Arial,sans-serif'; x.fillStyle='#FFD700'; x.fillText(S.slogan,W/2,170); }
  const ps=(S.prizes||[]);
  if(ps[0]){ x.font='800 44px Segoe UI,Arial,sans-serif'; x.fillStyle='#FFE766'; x.shadowColor='rgba(255,215,0,.5)'; x.shadowBlur=16;
    x.fillText('\u{1F3C6} '+money(S.currency,ps[0].amount),W/2,236); x.shadowBlur=0;
    x.font='28px Segoe UI,Arial,sans-serif'; x.fillStyle='#c89bd6'; x.fillText(ps[0].label,W/2,276); }
  x.font='26px Segoe UI,Arial,sans-serif'; x.fillStyle='#f7eaff';
  x.fillText('Valor por numero: '+money(S.currency,S.price)+'  \u2022  Sorteo '+(S.drawTime||''),W/2,318);
  x.fillText(fechaLarga(S.drawDate),W/2,350);
  const gy=topH;
  for(let i=0;i<100;i++){
    const k=pad(i), s=S.numbers[k].status, win=(S.winner===k);
    const cx=pad0+(i%10)*(cell+gap), cy=gy+Math.floor(i/10)*(cell+gap);
    let fill='#2a0e33',bd='#4A004A',tc='#e9c9f3';
    if(s==='reserved'){fill='#3a2e05';bd='#FFD700';tc='#FFD700';}
    else if(s==='paid'){fill='#0f3528';bd='#22c186';tc='#5ef0b8';}
    if(win){bd='#FF00FF';}
    x.fillStyle=fill; x.strokeStyle=bd; x.lineWidth=win?6:3;
    rr(x,cx,cy,cell,cell,16); x.fill(); x.stroke();
    x.fillStyle=tc; x.font='700 '+Math.floor(cell*0.42)+'px Segoe UI,Arial,sans-serif';
    x.textBaseline='middle'; x.fillText(k,cx+cell/2,cy+cell/2); x.textBaseline='alphabetic';
  }
  const c=countStatus(), ly=gy+gridH+56;
  x.font='30px Segoe UI,Arial,sans-serif'; x.textAlign='center'; x.fillStyle='#e9c9f3';
  x.fillText('\u2B1C Libres: '+c.libre+'    \u{1F7E8} Reservados: '+c.res+'    \u{1F7E9} Pagados: '+c.pag,W/2,ly);
  x.font='24px Segoe UI,Arial,sans-serif'; x.fillStyle='#c89bd6';
  x.fillText('Escribe al organizador para apartar tu numero \u2022 '+money(S.currency,S.price)+' c/u',W/2,ly+44);
  cv.toBlob(function(blob){
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=(S.name||'rifa').replace(/\s+/g,'_')+'_'+(S.drawDate||'')+'.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
    toast('Imagen lista. Comp\u00e1rtela en WhatsApp \u{1F4F2}');
  },'image/png');
}
$('shareBtn').onclick=shareImage;

/* ===================== ARRANQUE ===================== */
const qs=new URLSearchParams(location.search);
if(qs.get('pago')==='ok') setTimeout(()=>toast('¡Pago recibido! Tu número quedará marcado como pagado.'),500);
else if(qs.get('pago')==='pendiente') setTimeout(()=>toast('Pago pendiente de confirmación.'),500);
const startR = qs.get('r');
if(startR){ RID=startR; $('home').classList.add('hidden'); $('board-view').classList.remove('hidden'); loadHome(); loadBoard(); }
else { loadHome(); }
setInterval(()=>{ if(RID) loadBoard(); else loadHome(); }, 20000);

