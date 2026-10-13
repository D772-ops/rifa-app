/* DREAMS RIFA - panel de administracion (multi-rifa) */
let PASS = sessionStorage.getItem('rifa_admin_pass')||'';
let DB=null, CUR=null;
const $=id=>document.getElementById(id);
function pad(n){return String(n).padStart(2,'0');}
function esc(s){return (s==null?'':String(s)).replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));}
function cur(){ return (DB&&DB.raffles||[]).find(r=>r.id===CUR)||null; }
function money(n){const r=cur();return (r?r.currency:'')+' '+Number(n||0).toLocaleString('es-CO');}
function fechaLarga(d){ try{ return new Date(d+'T00:00:00').toLocaleDateString('es',{weekday:'long',day:'numeric',month:'long'}); }catch(e){ return d||''; } }
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2800);}
function openModal(h){const m=$('modal');m.innerHTML='<button class="close">×</button>'+h;m.querySelector('.close').onclick=closeModal;$('mbg').classList.add('show');m.classList.add('show');}
function closeModal(){$('modal').classList.remove('show');$('mbg').classList.remove('show');}
$('mbg').onclick=closeModal;

async function api(url,body){
  const opt={headers:{'x-admin-pass':PASS}};
  if(body){opt.method='POST';opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(body);}
  const r=await fetch(url,opt);
  if(r.status===401){ PASS=''; sessionStorage.removeItem('rifa_admin_pass'); renderLogin('Clave incorrecta o sesión expirada'); throw new Error('401'); }
  return r.json();
}
function renderLogin(msg){
  $('app').innerHTML='<div class="login"><h1>🔒 Administración</h1><p>'+(msg||'Ingresa la clave para gestionar tus rifas')+'</p>'+
    '<div class="field"><input id="pw" type="password" placeholder="Clave de administrador"></div>'+
    '<button class="btn primary block" onclick="doLogin()">Entrar</button></div>';
  $('pw').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();}); $('pw').focus();
}
async function doLogin(){
  PASS=$('pw').value;
  try{ const r=await (await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pass:PASS})})).json();
    if(r.ok){ sessionStorage.setItem('rifa_admin_pass',PASS); loadAndRender(); } else renderLogin('Clave incorrecta');
  }catch(e){ renderLogin('Error de conexión'); }
}
function logout(){ PASS=''; sessionStorage.removeItem('rifa_admin_pass'); renderLogin(); }

async function loadAndRender(keep){
  try{ DB=await api('/api/admin/state'); }catch(e){ return; }
  if(!DB.raffles.find(r=>r.id===CUR)) CUR = DB.raffles[0] ? DB.raffles[0].id : null;
  renderShell();
}
function counts(r){ let libre=0,res=0,pag=0,claim=0; for(const k in r.numbers){ const n=r.numbers[k]; if(n.status==='paid')pag++; else if(n.status==='reserved'){res++; if(n.claimed)claim++;} else libre++; } return {libre,res,pag,claim}; }
/* ---------- Pantalla principal ---------- */
function renderShell(){
  $('app').innerHTML=
    '<div class="topbar"><div><h1>🎟️ '+esc(DB.brand.heading||'DREAMS RIFA')+' · Admin</h1>'+
      '<div class="sub">Gestiona todas tus rifas desde aquí</div></div>'+
    '<div class="tools">'+
      '<button class="btn" onclick="openBrand()">🏠 Página principal</button>'+
      '<button class="btn" onclick="logout()">Salir</button>'+
    '</div></div>'+
    '<div class="rtabs" id="rtabs"></div>'+
    '<div id="panel"></div>';
  renderTabs(); renderPanel();
}
function renderTabs(){
  let h='';
  (DB.raffles||[]).forEach(r=>{
    h+='<div class="rtab'+(r.id===CUR?' on':'')+'" onclick="selectRaffle(\''+r.id+'\')">'+
       '<span class="dot '+r.status+'"></span>'+esc(r.name)+'</div>';
  });
  h+='<div class="rtab add" onclick="createRaffle()">+ Crear rifa</div>';
  $('rtabs').innerHTML=h;
}
function selectRaffle(id){ CUR=id; renderTabs(); renderPanel(); }

function renderPanel(){
  const r=cur();
  if(!r){ $('panel').innerHTML='<div class="panel" style="text-align:center;color:var(--mut)">No tienes rifas todavía.<br><br><button class="btn primary" onclick="createRaffle()">+ Crear tu primera rifa</button></div>'; return; }
  const c=counts(r);
  const statusTxt={active:'Activa (visible y jugando)',soon:'Próximamente',hidden:'Oculta'};
  const idx=DB.raffles.findIndex(x=>x.id===r.id);
  $('panel').innerHTML=
    '<div class="panel">'+
    '<div class="rhead">'+
      '<div><span class="nm">'+esc(r.name)+'</span> <span class="badge '+r.status+'">'+({active:'ACTIVA',soon:'PRÓXIMA',hidden:'OCULTA'}[r.status])+'</span>'+
        '<div class="sub">'+esc(fechaLarga(r.drawDate))+' · sorteo '+esc(r.drawTime||'')+(r.drawNote?' · '+esc(r.drawNote):'')+'</div></div>'+
      '<div class="tools">'+
        '<button class="btn sm" onclick="moveRaffle(\'up\')" '+(idx<=0?'disabled style=opacity:.4':'')+'>↑</button>'+
        '<button class="btn sm" onclick="moveRaffle(\'down\')" '+(idx>=DB.raffles.length-1?'disabled style=opacity:.4':'')+'>↓</button>'+
        '<button class="btn sm" onclick="openConfig()">⚙️ Config</button>'+
        '<button class="btn sm primary" onclick="openDraw()">🎰 Sorteo</button>'+
        '<button class="btn sm" onclick="openBuyers()">📋 Participantes</button>'+
        '<button class="btn sm" onclick="shareImage()">📲 Imagen</button>'+
      '</div>'+
    '</div>'+
    (c.claim>0?'<div class="alert">🔔 <b>'+c.claim+'</b> pago(s) por confirmar (el cliente marcó “Ya transferí”). Ábrelos en el tablero y confirma.</div>':'')+
    (r.winner?'<div class="alert">🏆 Número ganador: <b>'+r.winner+'</b>'+(r.numbers[r.winner]&&r.numbers[r.winner].buyer?' — '+esc(r.numbers[r.winner].buyer):'')+' <button class="btn sm" style="margin-left:8px" onclick="clearWinner()">Quitar</button></div>':'')+
    '<div class="stats">'+
      '<div class="stat"><div class="n">'+c.libre+'</div><div class="t">Libres</div></div>'+
      '<div class="stat"><div class="n" style="color:var(--res)">'+c.res+'</div><div class="t">Reservados</div></div>'+
      '<div class="stat"><div class="n" style="color:var(--paid)">'+c.pag+'</div><div class="t">Pagados</div></div>'+
      '<div class="stat money"><div class="n">'+money(c.pag*(r.price||0))+'</div><div class="t">Recaudado</div></div>'+
    '</div>'+
    '<div class="board" id="board"></div>'+
    '<div class="legend"><span><i class="i-free"></i>Libre</span><span><i class="i-res"></i>Reservado</span>'+
      '<span><i class="i-paid"></i>Pagado</span><span><i class="i-win"></i>Ganador</span><span>🔔 por confirmar</span>'+
      '<span style="margin-left:auto;color:var(--mut)">Bre-B: '+((r.breb&&r.breb.enabled)?'<b style="color:var(--paid)">activo</b>':'off')+'</span></div>'+
    '<div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">'+
      '<button class="btn" onclick="resetRaffle()">♻️ Reiniciar (nueva ronda)</button>'+
      '<button class="btn danger" onclick="deleteRaffle()">🗑️ Borrar esta rifa</button>'+
    '</div>'+
    '</div>';
  renderBoard();
}
function renderBoard(){
  const r=cur(); let h='';
  for(let i=0;i<100;i++){
    const k=pad(i), n=r.numbers[k]||{status:'available'};
    let cls='cell '+(n.status==='reserved'?'reserved':n.status==='paid'?'paid':'');
    if(r.winner===k) cls+=' winner';
    if(n.claimed && n.status==='reserved') cls+=' claimed';
    const flag = (n.claimed&&n.status==='reserved')?'🔔':(r.winner===k?'🏆':'');
    h+='<div class="'+cls+'" onclick="openNumber(\''+k+'\')">'+(flag?'<span class="flag">'+flag+'</span>':'')+
       '<span class="num">'+k+'</span>'+(n.buyer?'<span class="who">'+esc(n.buyer)+'</span>':'')+'</div>';
  }
  $('board').innerHTML=h;
}
/* ---------- Gestión de un número ---------- */
function openNumber(k){
  const r=cur(); const n=r.numbers[k]||{status:'available'};
  let h='<h2>Número '+k+'</h2>';
  if(n.status==='available'){
    h+='<p class="hint">Este número está libre. Puedes reservarlo manualmente (por ejemplo si alguien te paga en efectivo o por fuera de la app).</p>'+
      '<div class="field"><label>Nombre del participante</label><input id="mbName" placeholder="Nombre"></div>'+
      '<div class="field"><label>Teléfono / WhatsApp (opcional)</label><input id="mbPhone" placeholder="Teléfono"></div>'+
      '<div class="field"><label>Nota (opcional)</label><input id="mbNote" placeholder="Ej: pagó en efectivo"></div>'+
      '<div class="btns"><button class="btn primary" onclick="manualReserve(\''+k+'\')">Reservar</button></div>';
  } else {
    const met={online:'Pago en línea',breb:'Bre-B / transferencia',manual:'Manual'}[n.method]||n.method||'-';
    h+='<div class="info">'+
      '<div><b>'+esc(n.buyer||'(sin nombre)')+'</b> '+
        (n.status==='paid'?'<span class="pill paid">PAGADO</span>':'<span class="pill res">RESERVADO</span>')+'</div>'+
      (n.phone?'<div>📱 '+esc(n.phone)+'</div>':'')+
      '<div>Método: '+esc(met)+'</div>'+
      (n.note?'<div>Nota: '+esc(n.note)+'</div>':'')+
      (n.claimed&&n.status!=='paid'?'<div style="color:var(--pri2);font-weight:700;margin-top:4px">🔔 El cliente dice que ya transfirió</div>':'')+
      '</div>';
    if(n.receipt) h+='<div class="hint">Comprobante enviado:</div><img class="rcpt" src="'+n.receipt+'">';
    h+='<div class="btns">';
    if(n.status!=='paid') h+='<button class="btn ok" onclick="numOp(\'mark-paid\',\''+k+'\')">✅ Confirmar pago</button>';
    else h+='<button class="btn" onclick="numOp(\'mark-unpaid\',\''+k+'\')">↩️ Marcar como no pagado</button>';
    h+='<button class="btn danger" onclick="numOp(\'release\',\''+k+'\')">🗑️ Liberar número</button></div>';
  }
  openModal(h);
}
async function numOp(op,k){
  await api('/api/admin/'+op,{raffle:CUR,number:k});
  closeModal(); await loadAndRender(); toast('Listo');
}
async function manualReserve(k){
  const buyer=$('mbName').value.trim();
  if(!buyer){ toast('Escribe el nombre'); return; }
  const r=await api('/api/admin/reserve',{raffle:CUR,number:k,buyer,phone:$('mbPhone').value.trim(),note:$('mbNote').value.trim()});
  if(r.error){ toast(r.error); return; }
  closeModal(); await loadAndRender(); toast('Número '+k+' reservado');
}

/* ---------- Crear / borrar / mover / reiniciar ---------- */
async function createRaffle(){
  openModal('<h2>Crear rifa nueva</h2>'+
    '<div class="field"><label>Nombre de la rifa</label><input id="crName" placeholder="Ej: Rifa de diciembre"></div>'+
    '<p class="hint">Después podrás ponerle precio, fecha de sorteo, premios y datos de pago en “Config”.</p>'+
    '<div class="btns"><button class="btn primary" onclick="doCreateRaffle()">Crear</button></div>');
  setTimeout(()=>$('crName')&&$('crName').focus(),50);
}
async function doCreateRaffle(){
  const name=$('crName').value.trim()||'Nueva rifa';
  const r=await api('/api/admin/raffle/create',{name});
  closeModal(); CUR=r.raffle.id; await loadAndRender(); toast('Rifa creada'); openConfig();
}
async function deleteRaffle(){
  const r=cur();
  if(!confirm('¿Borrar la rifa “'+r.name+'”? Esto elimina su tablero y participantes. No se puede deshacer.')) return;
  await api('/api/admin/raffle/delete',{raffle:CUR}); CUR=null; await loadAndRender(); toast('Rifa borrada');
}
async function moveRaffle(dir){ await api('/api/admin/raffle/move',{raffle:CUR,dir}); await loadAndRender(); }
async function resetRaffle(){
  if(!confirm('¿Reiniciar esta rifa? Se guarda la ronda actual en el historial y el tablero queda en blanco para empezar de nuevo.')) return;
  await api('/api/admin/reset',{raffle:CUR}); await loadAndRender(); toast('Rifa reiniciada');
}
async function clearWinner(){ await api('/api/admin/clear-winner',{raffle:CUR}); await loadAndRender(); }
/* ---------- Configuración de la rifa ---------- */
let _qr='';
function openConfig(){
  const r=cur(); _qr = (r.breb&&r.breb.qrImage)||'';
  const b=r.breb||{};
  const pr=r.prizes||[];
  function pz(i){ const p=pr[i]||{label:'',amount:0,enabled:false};
    return '<div class="row" style="margin-bottom:8px">'+
      '<div style="flex:0 0 34px;display:flex;align-items:center"><input type="checkbox" id="pzEn'+i+'" '+(p.enabled?'checked':'')+' style="width:auto"></div>'+
      '<input id="pzLb'+i+'" placeholder="Premio '+(i+1)+'" value="'+esc(p.label)+'">'+
      '<input id="pzAm'+i+'" type="number" placeholder="Monto" value="'+(p.amount||0)+'" style="flex:0 0 120px">'+
    '</div>'; }
  const h='<h2>⚙️ Configurar rifa</h2>'+
    '<div class="field"><label>Nombre de la rifa</label><input id="cName" value="'+esc(r.name)+'"></div>'+
    '<div class="field"><label>Frase / eslogan</label><input id="cSlogan" value="'+esc(r.slogan||'')+'"></div>'+
    '<div class="field"><label>Estado</label><select id="cStatus">'+
      '<option value="active"'+(r.status==='active'?' selected':'')+'>Activa (visible y jugando)</option>'+
      '<option value="soon"'+(r.status==='soon'?' selected':'')+'>Próximamente (se muestra pero no se juega)</option>'+
      '<option value="hidden"'+(r.status==='hidden'?' selected':'')+'>Oculta (no aparece en la página)</option></select></div>'+
    '<div class="row"><div class="field"><label>Precio por número</label><input id="cPrice" type="number" value="'+(r.price||0)+'"></div>'+
      '<div class="field"><label>Moneda</label><input id="cCurrency" value="'+esc(r.currency||'COP')+'"></div></div>'+
    '<div class="row"><div class="field"><label>Fecha del sorteo</label><input id="cDate" type="date" value="'+esc(r.drawDate||'')+'"></div>'+
      '<div class="field"><label>Hora del sorteo</label><input id="cTime" type="time" value="'+esc(r.drawTime||'')+'"></div></div>'+
    '<div class="field"><label>Nota del sorteo (libre)</label><input id="cNote" value="'+esc(r.drawNote||'')+'" placeholder="Ej: Sorteo cada domingo con la lotería"></div>'+
    '<div class="field"><label>Enlace del grupo de WhatsApp de esta rifa</label><input id="cWhats" value="'+esc(r.whatsapp||'')+'" placeholder="https://chat.whatsapp.com/..."></div>'+
    '<div class="field"><label>Premios</label>'+pz(0)+pz(1)+pz(2)+pz(3)+'<div class="hint">Marca la casilla para que un premio se muestre.</div></div>'+
    '<hr style="border:none;border-top:1px solid var(--line);margin:14px 0">'+
    '<div class="field"><label class="grow"><input type="checkbox" id="bEn" '+(b.enabled?'checked':'')+' style="width:auto"> Aceptar pagos por Bre-B / transferencia en esta rifa</label></div>'+
    '<div class="field"><label>Llave Bre-B</label><input id="bKey" value="'+esc(b.llave||'')+'" placeholder="@tullave o número"></div>'+
    '<div class="field"><label>Nombre de quien recibe</label><input id="bBen" value="'+esc(b.beneficiary||'')+'"></div>'+
    '<div class="field"><label>Negocio / banco (opcional)</label><input id="bBiz" value="'+esc(b.business||'')+'"></div>'+
    '<div class="field"><label class="grow"><input type="checkbox" id="bRcpt" '+(b.requireReceipt?'checked':'')+' style="width:auto"> Pedir que el cliente suba el comprobante</label></div>'+
    '<div class="field"><label>Imagen QR de pago (opcional)</label>'+
      '<div id="qrBox">'+(_qr?'<img class="qr-prev" src="'+_qr+'"><br><button class="btn sm danger" onclick="qrDel()">Quitar QR</button>':'<button class="btn sm" onclick="$(\'qrFile\').click()">Subir imagen QR</button>')+'</div>'+
      '<input id="qrFile" type="file" accept="image/*" style="display:none" onchange="qrPick(event)"></div>'+
    '<div class="btns"><button class="btn primary" onclick="saveConfig()">Guardar cambios</button></div>';
  openModal(h);
}
function qrPick(ev){ const f=ev.target.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>{ _qr=rd.result; const box=$('qrBox'); if(box) box.innerHTML='<img class="qr-prev" src="'+_qr+'"><br><button class="btn sm danger" onclick="qrDel()">Quitar QR</button>'; }; rd.readAsDataURL(f); }
function qrDel(){ _qr=''; const box=$('qrBox'); if(box) box.innerHTML='<button class="btn sm" onclick="$(\'qrFile\').click()">Subir imagen QR</button>'; }
async function saveConfig(){
  const prizes=[0,1,2,3].map(i=>({label:$('pzLb'+i).value.trim(),amount:Number($('pzAm'+i).value)||0,enabled:$('pzEn'+i).checked}));
  const body={ raffle:CUR, name:$('cName').value.trim(), slogan:$('cSlogan').value.trim(), status:$('cStatus').value,
    price:Number($('cPrice').value)||0, currency:$('cCurrency').value.trim()||'COP',
    drawDate:$('cDate').value, drawTime:$('cTime').value, drawNote:$('cNote').value.trim(), whatsapp:$('cWhats').value.trim(),
    prizes,
    breb:{ enabled:$('bEn').checked, llave:$('bKey').value.trim(), beneficiary:$('bBen').value.trim(),
      business:$('bBiz').value.trim(), requireReceipt:$('bRcpt').checked, qrImage:_qr } };
  const r=await api('/api/admin/raffle/update',body);
  if(r.error){ toast(r.error); return; }
  closeModal(); await loadAndRender(); toast('Cambios guardados');
}
/* ---------- Marca / página principal ---------- */
let _logo='', _groups=[];
function openBrand(){
  const b=DB.brand; _logo=b.logo||''; _groups=(b.groups||[]).map(g=>({name:g.name,url:g.url}));
  const h='<h2>🏠 Página principal</h2>'+
    '<div class="field"><label>Logo</label><div id="lgBox"></div>'+
      '<input id="lgFile" type="file" accept="image/*" style="display:none" onchange="lgPick(event)"></div>'+
    '<div class="field"><label>Título (nombre grande)</label><input id="brH" value="'+esc(b.heading||'')+'"></div>'+
    '<div class="field"><label>Frase bajo el título</label><input id="brS" value="'+esc(b.slogan||'')+'"></div>'+
    '<div class="field"><label>Texto de bienvenida</label><input id="brI" value="'+esc(b.intro||'')+'"></div>'+
    '<div class="field"><label>Grupos de WhatsApp (se muestran en la página principal)</label><div id="grBox"></div>'+
      '<button class="btn sm" style="margin-top:8px" onclick="grAdd()">+ Agregar grupo</button></div>'+
    '<div class="btns"><button class="btn primary" onclick="saveBrand()">Guardar</button></div>';
  openModal(h); renderLogoBox(); renderGroups();
}
function renderLogoBox(){
  const box=$('lgBox'); if(!box) return;
  box.innerHTML=(_logo?'<img class="qr-prev" style="width:150px;background:transparent" src="'+_logo+'"><br>':'')+
    '<button class="btn sm" onclick="$(\'lgFile\').click()">Subir logo</button> '+
    '<button class="btn sm" onclick="lgDefault()">Usar logo DREAMS</button> '+
    (_logo?'<button class="btn sm danger" onclick="lgDel()">Quitar</button>':'');
}
function lgPick(ev){ const f=ev.target.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>{ _logo=rd.result; renderLogoBox(); }; rd.readAsDataURL(f); }
function lgDefault(){ _logo='/logo.png'; renderLogoBox(); }
function lgDel(){ _logo=''; renderLogoBox(); }
function renderGroups(){
  const box=$('grBox'); if(!box) return; let h='';
  _groups.forEach((g,i)=>{ h+='<div class="row" style="margin-bottom:8px">'+
    '<input value="'+esc(g.name)+'" placeholder="Nombre del grupo" oninput="_groups['+i+'].name=this.value">'+
    '<input value="'+esc(g.url)+'" placeholder="https://chat.whatsapp.com/..." oninput="_groups['+i+'].url=this.value">'+
    '<button class="btn sm danger" style="flex:0 0 auto" onclick="grDel('+i+')">✕</button></div>'; });
  if(!_groups.length) h='<div class="hint">Aún no agregaste grupos.</div>';
  box.innerHTML=h;
}
function grAdd(){ _groups.push({name:'',url:''}); renderGroups(); }
function grDel(i){ _groups.splice(i,1); renderGroups(); }
async function saveBrand(){
  const groups=_groups.map(g=>({name:(g.name||'').trim(),url:(g.url||'').trim()})).filter(g=>g.name||g.url);
  const r=await api('/api/admin/brand',{logo:_logo,heading:$('brH').value.trim(),slogan:$('brS').value.trim(),intro:$('brI').value.trim(),groups});
  if(r.error){ toast(r.error); return; }
  closeModal(); await loadAndRender(); toast('Página principal guardada');
}
/* ---------- Sorteo ---------- */
function openDraw(){
  const r=cur();
  const h='<h2>🎰 Sorteo — '+esc(r.name)+'</h2>'+
    (r.winner?'<div class="info" style="margin-bottom:12px">Ganador actual: <b>'+r.winner+'</b>'+(r.numbers[r.winner]&&r.numbers[r.winner].buyer?' — '+esc(r.numbers[r.winner].buyer):'')+'</div>':'')+
    '<p class="hint">Elige cómo sacar el ganador:</p>'+
    '<div class="btns" style="flex-direction:column">'+
      '<button class="btn primary" onclick="doDraw({onlyPaid:true})">🎲 Al azar entre los PAGADOS</button>'+
      '<button class="btn" onclick="doDraw({})">🎲 Al azar entre TODOS los 00-99</button>'+
    '</div>'+
    '<div class="field" style="margin-top:14px"><label>O escribe el número ganador (ej: de la lotería)</label>'+
      '<div class="row"><input id="dwNum" type="number" min="0" max="99" placeholder="00-99">'+
      '<button class="btn primary" style="flex:0 0 auto" onclick="doDrawManual()">Fijar</button></div></div>'+
    (r.winner?'<div class="btns"><button class="btn danger" onclick="clearWinner();closeModal()">Quitar ganador</button></div>':'');
  openModal(h);
}
async function doDraw(opt){
  const r=await api('/api/admin/draw',Object.assign({raffle:CUR},opt));
  if(r.error){ toast(r.error); return; }
  closeModal(); await loadAndRender(); toast('🏆 Ganador: '+r.winner+(r.buyer?' ('+r.buyer+')':''));
}
async function doDrawManual(){ const n=$('dwNum').value; if(n==='') { toast('Escribe un número'); return; } await doDraw({number:n}); }

/* ---------- Participantes ---------- */
function openBuyers(){
  const r=cur();
  const rows=Object.entries(r.numbers).filter(([,n])=>n.status!=='available').sort((a,b)=>a[0]-b[0]);
  let body='';
  if(!rows.length) body='<tr><td colspan="4" style="color:var(--mut)">Aún no hay participantes.</td></tr>';
  rows.forEach(([k,n])=>{ body+='<tr><td><b>'+k+'</b></td><td>'+esc(n.buyer||'-')+(n.phone?'<br><span class="mini">'+esc(n.phone)+'</span>':'')+'</td>'+
    '<td>'+(n.status==='paid'?'<span class="pill paid">Pagado</span>':'<span class="pill res">Reservado</span>')+(n.claimed&&n.status!=='paid'?' 🔔':'')+'</td>'+
    '<td><button class="btn sm" onclick="closeModal();openNumber(\''+k+'\')">Ver</button></td></tr>'; });
  const paid=rows.filter(([,n])=>n.status==='paid').length;
  openModal('<h2>📋 Participantes — '+esc(r.name)+'</h2>'+
    '<p class="hint">'+rows.length+' reservados · '+paid+' pagados · recaudado '+money(paid*(r.price||0))+'</p>'+
    '<div class="tablewrap"><table><thead><tr><th>N°</th><th>Participante</th><th>Estado</th><th></th></tr></thead><tbody>'+body+'</tbody></table></div>');
}
/* ---------- Imagen para compartir ---------- */
function roundRect(c,x,y,w,h,r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
function shareImage(){
  const r=cur(); if(!r){ return; }
  const W=1080,P=48,cols=10,gap=12;
  const gridW=W-P*2, cell=(gridW-gap*(cols-1))/cols;
  const topH=360, legendH=120, gridH=cell*10+gap*9, H=topH+gridH+legendH;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const x=cv.getContext('2d');
  const bg=x.createLinearGradient(0,0,W,H); bg.addColorStop(0,'#1a0020'); bg.addColorStop(.5,'#0A000A'); bg.addColorStop(1,'#20002a');
  x.fillStyle=bg; x.fillRect(0,0,W,H); x.textAlign='center';
  x.font='900 72px Segoe UI,Arial,sans-serif';
  const lg=x.createLinearGradient(0,60,0,140); lg.addColorStop(0,'#FF66DD'); lg.addColorStop(.5,'#FF00FF'); lg.addColorStop(1,'#FFD700');
  x.fillStyle=lg; x.shadowColor='rgba(255,0,255,.6)'; x.shadowBlur=24;
  x.fillText((r.name||'DREAMS RIFA').toUpperCase(),W/2,120); x.shadowBlur=0;
  if(r.slogan){ x.font='italic 34px Segoe UI,Arial,sans-serif'; x.fillStyle='#FFD700'; x.fillText(r.slogan,W/2,170); }
  const ps=(r.prizes||[]).filter(p=>p&&p.enabled);
  if(ps[0]){ x.font='800 44px Segoe UI,Arial,sans-serif'; x.fillStyle='#FFE766'; x.shadowColor='rgba(255,215,0,.5)'; x.shadowBlur=16;
    x.fillText('🏆 '+money(ps[0].amount),W/2,236); x.shadowBlur=0;
    x.font='28px Segoe UI,Arial,sans-serif'; x.fillStyle='#c89bd6'; x.fillText(ps[0].label,W/2,276); }
  x.font='26px Segoe UI,Arial,sans-serif'; x.fillStyle='#f7eaff';
  x.fillText('Valor por numero: '+money(r.price)+'  •  Sorteo '+(r.drawTime||''),W/2,318);
  x.fillText(fechaLarga(r.drawDate),W/2,350);
  const gy=topH;
  for(let i=0;i<100;i++){ const k=pad(i),n=r.numbers[k]||{status:'available'};
    const col=i%10, row=Math.floor(i/10);
    const cx=P+col*(cell+gap), cyy=gy+row*(cell+gap);
    let fill='#2a0e33',bd='#4A004A',tc='#f7eaff';
    if(n.status==='reserved'){fill='#3a2e12';bd='#FFD700';tc='#FFD700';}
    else if(n.status==='paid'){fill='#0f3528';bd='#22c186';tc='#22c186';}
    x.fillStyle=fill; x.strokeStyle=bd; x.lineWidth=2;
    roundRect(x,cx,cyy,cell,cell,12); x.fill(); x.stroke();
    x.fillStyle=tc; x.font='700 '+Math.round(cell*0.42)+'px Segoe UI,Arial,sans-serif';
    x.textBaseline='middle'; x.fillText(k,cx+cell/2,cyy+cell/2); x.textBaseline='alphabetic';
  }
  const ly=gy+gridH+60; x.font='24px Segoe UI,Arial,sans-serif';
  x.fillStyle='#f7eaff'; x.fillText('Libre',W*0.2,ly); x.fillStyle='#FFD700'; x.fillText('Reservado',W*0.5,ly); x.fillStyle='#22c186'; x.fillText('Pagado',W*0.8,ly);
  const url=cv.toDataURL('image/png');
  const a=document.createElement('a'); a.href=url; a.download='rifa-'+(r.name||'tablero').replace(/[^a-z0-9]/gi,'_')+'.png'; a.click();
  toast('Imagen descargada 📲');
}

/* ---------- Arranque ---------- */
if(PASS) loadAndRender(); else renderLogin();


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

