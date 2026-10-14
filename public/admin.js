/* DREAMS RIFA - panel de administracion (multi-rifa) */
let PASS = sessionStorage.getItem('rifa_admin_pass')||'';
let DB=null, CUR=null;
const NEON_COLORS=[['Fucsia','#FF00FF'],['Amarillo','#FFE600'],['Azul','#00E5FF'],['Rojo','#FF1744'],['Verde','#39FF14'],['Naranja','#FF6D00'],['Morado','#B026FF'],['Rosa','#FF4FD8']];
let _color='#FF00FF';
let _prizes=[];
const $=id=>document.getElementById(id);
function pad(n){return String(n).padStart(2,'0');}
function esc(s){return (s==null?'':String(s)).replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));}
function cur(){ return (DB&&DB.raffles||[]).find(r=>r.id===CUR)||null; }
function money(n){const r=cur();return (r?r.currency:'')+' '+Number(n||0).toLocaleString('es-CO');}
function fechaLarga(d){ try{ return new Date(d+'T00:00:00').toLocaleDateString('es',{weekday:'long',day:'numeric',month:'long'}); }catch(e){ return d||''; } }
/* Comprime una imagen en el navegador antes de subirla, para que cada imagen
   quepa en su caja de la nube (tope ~100KB). Reduce el tamano y, si hace falta,
   baja la calidad. Devuelve el dataURI listo para enviar. */
function compressImage(file, opts){
  opts = opts || {};
  const maxSide = opts.maxSide || 600;
  const prefer  = opts.type || 'image/png';   // tipo preferido ('image/png' conserva nitidez del QR)
  const quality = opts.quality || 0.92;
  const LIMIT   = 98000;                       // caracteres del dataURI (~ bytes del registro JSONBin)
  return new Promise((resolve, reject)=>{
    const rd = new FileReader();
    rd.onerror = ()=>reject(new Error('No se pudo leer la imagen'));
    rd.onload = ()=>{
      const img = new Image();
      img.onerror = ()=>reject(new Error('Imagen no valida'));
      img.onload = ()=>{
        const render = (side, type, q)=>{
          const sc = Math.min(1, side/Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width*sc)), h = Math.max(1, Math.round(img.height*sc));
          const cv = document.createElement('canvas'); cv.width=w; cv.height=h;
          const cx = cv.getContext('2d');
          if(type==='image/jpeg'){ cx.fillStyle='#fff'; cx.fillRect(0,0,w,h); }  // JPEG no tiene transparencia
          cx.drawImage(img, 0, 0, w, h);
          return cv.toDataURL(type, q);
        };
        let out = render(maxSide, prefer, quality);
        // si pesa de mas, pasamos a JPEG y vamos bajando calidad
        let q = quality;
        while(out.length > LIMIT && q > 0.4){ q -= 0.1; out = render(maxSide, 'image/jpeg', q); }
        // si todavia pesa, reducimos tambien el tamano
        let side = maxSide;
        while(out.length > LIMIT && side > 240){ side = Math.round(side*0.8); out = render(side, 'image/jpeg', 0.7); }
        resolve(out);
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
}
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
    const _c = /^#[0-9a-fA-F]{6}$/.test(r.color||'') ? r.color : '#FF00FF';
    h+='<div class="rtab'+(r.id===CUR?' on':'')+'" onclick="selectRaffle(\''+r.id+'\')" '+
       'style="border-left:4px solid '+_c+(r.id===CUR?';box-shadow:0 0 12px '+_c:'')+'">'+
       '<span class="dot '+r.status+'"></span>'+esc(r.name)+'</div>';
  });
  h+='<div class="rtab add" onclick="createRaffle()">+ Crear rifa</div>';
  h+='<div class="rtab add" onclick="createShowcase()">+ Crear vitrina (solo premios)</div>';
  $('rtabs').innerHTML=h;
}
function selectRaffle(id){ CUR=id; renderTabs(); renderPanel(); }

function renderPanel(){
  const r=cur();
  if(!r){ $('panel').innerHTML='<div class="panel" style="text-align:center;color:var(--mut)">No tienes rifas todavía.<br><br><button class="btn primary" onclick="createRaffle()">+ Crear tu primera rifa</button></div>'; return; }
  if(r.mode==='showcase'){ return renderShowcasePanel(r); }
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
function renderShowcasePanel(r){
  const idx=DB.raffles.findIndex(x=>x.id===r.id);
  const prizes=(r.prizes||[]).filter(p=>p&&p.enabled);
  const badge={active:'ACTIVA',soon:'PRÓXIMA',hidden:'OCULTA'}[r.status]||'';
  const img = r.lotteryImage ? '<img src="'+r.lotteryImage+'" style="max-width:260px;width:100%;border-radius:12px;margin:4px 0">' : '<div class="hint">Aún no has subido la imagen de la lotería. Ábrela en “Config”.</div>';
  const boxes = prizes.length
    ? '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px">'+prizes.map((p,i)=>
        '<div style="flex:1 1 160px;min-width:150px;border:1px solid var(--line);border-radius:12px;padding:12px;background:rgba(255,255,255,.03)">'+
          '<div style="font-weight:700">'+(i===0?'\u{1F3C6} ':'\u2728 ')+esc(p.label||'Premio '+(i+1))+'</div>'+
          '<div style="color:var(--pri2);font-weight:800;margin-top:4px">'+money(p.amount)+'</div>'+
        '</div>').join('')+'</div>'
    : '<div class="hint">Aún no agregas premios. Ábrelos en “Config”.</div>';
  $('panel').innerHTML=
    '<div class="panel">'+
    '<div class="rhead">'+
      '<div><span class="nm">'+esc(r.name)+'</span> <span class="badge '+r.status+'">'+badge+'</span> <span class="badge soon">\u{1F3B0} VITRINA</span>'+
        '<div class="sub">'+esc(fechaLarga(r.drawDate))+' · sorteo '+esc(r.drawTime||'')+(r.drawNote?' · '+esc(r.drawNote):'')+'</div></div>'+
      '<div class="tools">'+
        '<button class="btn sm" onclick="moveRaffle(\'up\')" '+(idx<=0?'disabled style=opacity:.4':'')+'>↑</button>'+
        '<button class="btn sm" onclick="moveRaffle(\'down\')" '+(idx>=DB.raffles.length-1?'disabled style=opacity:.4':'')+'>↓</button>'+
        '<button class="btn sm" onclick="openConfig()">⚙️ Config</button>'+
      '</div>'+
    '</div>'+
    '<p class="hint">Esta publicación es una <b>vitrina de premios</b>: muestra la imagen de la lotería y los premios, sin tablero de números. Edita todo en “Config” y luego <b>descárgala como imagen</b> para compartirla por WhatsApp.</p>'+
    '<div style="text-align:center">'+img+'</div>'+
    boxes+
    '<div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">'+
      '<button class="btn primary" onclick="downloadShowcaseImage()">\u2B07\uFE0F Descargar imagen</button>'+
      '<button class="btn danger" onclick="deleteRaffle()">\u{1F5D1}\uFE0F Borrar esta vitrina</button>'+
    '</div>'+
    '</div>';
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
async function createShowcase(){
  openModal('<h2>Crear vitrina de premios</h2>'+
    '<p class="hint">Una vitrina muestra <b>solo los premios</b> y la imagen de la lotería, sin tablero de números para reservar. Ideal para loterías que no quieres montar número por número.</p>'+
    '<div class="field"><label>Nombre</label><input id="crName" placeholder="Ej: Lotería de Boyacá"></div>'+
    '<div class="btns"><button class="btn primary" onclick="doCreateShowcase()">Crear vitrina</button></div>');
  setTimeout(()=>$('crName')&&$('crName').focus(),50);
}
async function doCreateShowcase(){
  const name=$('crName').value.trim()||'Nueva vitrina';
  const r=await api('/api/admin/raffle/create',{name,mode:'showcase'});
  closeModal(); CUR=r.raffle.id; await loadAndRender(); toast('Vitrina creada'); openConfig();
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
let _qr='', _lot='';
function openConfig(){
  const r=cur(); _qr = (r.breb&&r.breb.qrImage)||''; _lot = r.lotteryImage||'';
  _color = /^#[0-9a-fA-F]{6}$/.test(r.color||'') ? r.color : '#FF00FF';
  const b=r.breb||{};
  const mode = (r.mode==='showcase')?'showcase':'numbers';
  _prizes = (r.prizes||[]).map(p=>({label:p.label||'',amount:p.amount||0,enabled:!!p.enabled}));
  if(!_prizes.length) _prizes.push({label:'',amount:0,enabled:true});
  const h='<h2>⚙️ Configurar '+(mode==='showcase'?'vitrina':'rifa')+'</h2>'+
    '<div class="field"><label>Tipo de publicación</label><select id="cMode" onchange="applyTypeUI()">'+
      '<option value="numbers"'+(mode==='numbers'?' selected':'')+'>Rifa con números (tablero para reservar)</option>'+
      '<option value="showcase"'+(mode==='showcase'?' selected':'')+'>Solo premios (vitrina con imagen de lotería)</option>'+
      '</select><div class="hint">La <b>vitrina</b> solo muestra la imagen de la lotería y los premios, sin tablero de números.</div></div>'+
    '<div class="field"><label>Nombre</label><input id="cName" value="'+esc(r.name)+'"></div>'+
    '<div class="field"><label>Frase / eslogan</label><input id="cSlogan" value="'+esc(r.slogan||'')+'"></div>'+
    '<div class="field"><label>Color neón</label><div id="colorBox"></div></div>'+
    '<div class="field"><label>Estado</label><select id="cStatus">'+
      '<option value="active"'+(r.status==='active'?' selected':'')+'>Activa (visible)</option>'+
      '<option value="soon"'+(r.status==='soon'?' selected':'')+'>Próximamente (se muestra pero no se juega)</option>'+
      '<option value="hidden"'+(r.status==='hidden'?' selected':'')+'>Oculta (no aparece en la página)</option></select></div>'+
    '<div id="showOnly"><div class="field"><label>Imagen de la lotería</label>'+
      '<div id="lotBox">'+(_lot?'<img class="qr-prev" src="'+_lot+'"><br><button class="btn sm danger" onclick="lotDel()">Quitar imagen</button>':'<button class="btn sm" onclick="$(\'lotFile\').click()">Subir imagen de la lotería</button>')+'</div>'+
      '<input id="lotFile" type="file" accept="image/*" style="display:none" onchange="lotPick(event)">'+
      '<div class="hint">Sube la imagen de la lotería (como cuando subes el QR). Se muestra arriba de los premios.</div></div></div>'+
    '<div id="numOnly"><div class="row"><div class="field"><label>Precio por número</label><input id="cPrice" type="number" value="'+(r.price||0)+'"></div>'+
      '<div class="field"><label>Moneda</label><input id="cCurrency" value="'+esc(r.currency||'COP')+'"></div></div></div>'+
    '<div class="row"><div class="field"><label>Fecha del sorteo</label><input id="cDate" type="date" value="'+esc(r.drawDate||'')+'" oninput="autoRelHint()"></div>'+
      '<div class="field"><label>Hora del sorteo</label><input id="cTime" type="time" value="'+esc(r.drawTime||'')+'" oninput="autoRelHint()"></div></div>'+
    '<div class="field"><label>Nota del sorteo (libre)</label><input id="cNote" value="'+esc(r.drawNote||'')+'" placeholder="Ej: Sorteo cada domingo con la lotería"></div>'+
    '<div id="numOnly2"><div class="field"><label>Liberar automáticamente los números reservados SIN pago antes del sorteo</label>'+
      '<div class="row" style="align-items:center">'+
        '<input id="cAutoRel" type="number" min="0" max="1440" step="1" style="flex:0 0 120px" value="'+(Number(r.autoReleaseMin)||0)+'" oninput="autoRelHint()">'+
        '<span style="color:var(--mut)">minutos antes del sorteo</span>'+
      '</div>'+
      '<div class="hint" id="autoRelHint"></div>'+
      '<div class="hint">Escribe los minutos que quieras (ej: 5, 20, 90). Pon <b>0</b> para desactivar y liberar los números tú misma. Solo libera los <b>reservados sin comprobante</b>: NO toca los pagados ni los que esperan aprobación.</div></div></div>'+
    '<div class="field"><label>Enlace del grupo de WhatsApp</label><input id="cWhats" value="'+esc(r.whatsapp||'')+'" placeholder="https://chat.whatsapp.com/..."></div>'+
    '<div class="field"><label>Premios (hasta 10)</label><div id="prizeBox"></div>'+
      '<button type="button" class="btn sm" style="margin-top:8px" onclick="prizeAdd()">+ Agregar premio</button>'+
      '<div class="hint">Marca la casilla de cada premio que quieras mostrar. El nombre y el valor son editables.</div></div>'+
    '<div id="numOnly3"><hr style="border:none;border-top:1px solid var(--line);margin:14px 0">'+
    '<div class="field"><label class="grow"><input type="checkbox" id="bEn" '+(b.enabled?'checked':'')+' style="width:auto"> Aceptar pagos por Bre-B / transferencia</label></div>'+
    '<div class="field"><label>Llave Bre-B</label><input id="bKey" value="'+esc(b.llave||'')+'" placeholder="@tullave o número"></div>'+
    '<div class="field"><label>Nombre de quien recibe</label><input id="bBen" value="'+esc(b.beneficiary||'')+'"></div>'+
    '<div class="field"><label>Negocio / banco (opcional)</label><input id="bBiz" value="'+esc(b.business||'')+'"></div>'+
    '<div class="field"><label class="grow"><input type="checkbox" id="bRcpt" '+(b.requireReceipt?'checked':'')+' style="width:auto"> Pedir que el cliente suba el comprobante</label></div>'+
    '<div class="field"><label>Imagen QR de pago (opcional)</label>'+
      '<div id="qrBox">'+(_qr?'<img class="qr-prev" src="'+_qr+'"><br><button class="btn sm danger" onclick="qrDel()">Quitar QR</button>':'<button class="btn sm" onclick="$(\'qrFile\').click()">Subir imagen QR</button>')+'</div>'+
      '<input id="qrFile" type="file" accept="image/*" style="display:none" onchange="qrPick(event)"></div></div>'+
    '<div class="btns"><button class="btn primary" onclick="saveConfig()">Guardar cambios</button></div>';
  openModal(h); renderColorBox(); renderPrizeBox(); autoRelHint(); applyTypeUI();
}
function applyTypeUI(){
  const mode=(($('cMode')||{}).value)||'numbers', show=(mode==='showcase');
  ['numOnly','numOnly2','numOnly3'].forEach(id=>{ const el=$(id); if(el) el.style.display=show?'none':''; });
  const so=$('showOnly'); if(so) so.style.display=show?'':'none';
}
function lotPick(ev){ const f=ev.target.files[0]; if(!f) return; toast('Preparando imagen...'); compressImage(f,{maxSide:800,type:'image/jpeg',quality:0.85}).then(d=>{ _lot=d; const box=$('lotBox'); if(box) box.innerHTML='<img class="qr-prev" src="'+_lot+'"><br><button class="btn sm danger" onclick="lotDel()">Quitar imagen</button>'; toast('Imagen lista. No olvides Guardar.'); }).catch(e=>toast(e.message||'No se pudo cargar la imagen')); }
function lotDel(){ _lot=''; const box=$('lotBox'); if(box) box.innerHTML='<button class="btn sm" onclick="$(\'lotFile\').click()">Subir imagen de la lotería</button>'; }
function autoRelHint(){
  const box=$('autoRelHint'); if(!box) return;
  const mins=Number(($('cAutoRel')||{}).value)||0;
  const date=($('cDate')||{}).value||'', time=($('cTime')||{}).value||'20:00';
  if(mins<=0){ box.innerHTML='⛔ Liberación automática <b>desactivada</b>.'; return; }
  if(!date){ box.innerHTML='Primero pon la fecha y hora del sorteo para calcular la hora.'; return; }
  const base=new Date(date+'T'+(/^\d{2}:\d{2}$/.test(time)?time:'20:00')+':00');
  if(isNaN(base.getTime())){ box.innerHTML=''; return; }
  const rel=new Date(base.getTime()-mins*60000);
  const p=n=>String(n).padStart(2,'0');
  const hhmm=p(rel.getHours())+':'+p(rel.getMinutes());
  const sameDay=rel.toDateString()===base.toDateString();
  const dstr=sameDay?'':(' del '+rel.toLocaleDateString('es',{day:'numeric',month:'long'}));
  box.innerHTML='✅ Los números sin pago se liberarán <b>desde las '+hhmm+dstr+'</b> (es decir, '+mins+' min antes del sorteo).';
}
function renderPrizeBox(){
  const box=$('prizeBox'); if(!box) return;
  box.innerHTML=_prizes.map((p,i)=>
    '<div class="row" style="margin-bottom:8px">'+
      '<div style="flex:0 0 30px;display:flex;align-items:center"><input type="checkbox" '+(p.enabled?'checked':'')+' style="width:auto" onchange="_prizes['+i+'].enabled=this.checked"></div>'+
      '<input placeholder="Premio '+(i+1)+'" value="'+esc(p.label)+'" oninput="_prizes['+i+'].label=this.value">'+
      '<input type="number" placeholder="Monto" value="'+(p.amount||0)+'" style="flex:0 0 110px" oninput="_prizes['+i+'].amount=Number(this.value)||0">'+
      '<button type="button" class="btn sm danger" style="flex:0 0 auto" onclick="prizeDel('+i+')">✕</button>'+
    '</div>'
  ).join('');
}
function prizeAdd(){ if(_prizes.length>=10){ toast('Máximo 10 premios'); return; } _prizes.push({label:'',amount:0,enabled:true}); renderPrizeBox(); }
function prizeDel(i){ _prizes.splice(i,1); if(!_prizes.length) _prizes.push({label:'',amount:0,enabled:true}); renderPrizeBox(); }
function renderColorBox(){
  const box=$('colorBox'); if(!box) return;
  box.innerHTML=NEON_COLORS.map(([nm,hex])=>
    '<button type="button" title="'+nm+'" onclick="pickColor(\''+hex+'\')" '+
    'style="width:34px;height:34px;border-radius:50%;margin:4px;cursor:pointer;'+
    'background:'+hex+';box-shadow:0 0 10px '+hex+';'+
    'border:'+(_color.toLowerCase()===hex.toLowerCase()?'3px solid #fff':'2px solid rgba(255,255,255,.25)')+'"></button>'
  ).join('');
}
function pickColor(hex){ _color=hex; renderColorBox(); }
function qrPick(ev){ const f=ev.target.files[0]; if(!f) return; toast('Preparando imagen...'); compressImage(f,{maxSide:620,type:'image/png',quality:0.92}).then(d=>{ _qr=d; const box=$('qrBox'); if(box) box.innerHTML='<img class="qr-prev" src="'+_qr+'"><br><button class="btn sm danger" onclick="qrDel()">Quitar QR</button>'; toast('QR listo. No olvides Guardar cambios.'); }).catch(e=>toast(e.message||'No se pudo cargar la imagen')); }
function qrDel(){ _qr=''; const box=$('qrBox'); if(box) box.innerHTML='<button class="btn sm" onclick="$(\'qrFile\').click()">Subir imagen QR</button>'; }
async function saveConfig(){
  const prizes=_prizes.map(p=>({label:(p.label||'').trim(),amount:Number(p.amount)||0,enabled:!!p.enabled}));
  const mode=(($('cMode')||{}).value)==='showcase'?'showcase':'numbers';
  const body={ raffle:CUR, name:$('cName').value.trim(), slogan:$('cSlogan').value.trim(), color:_color, status:$('cStatus').value,
    mode, lotteryImage:_lot,
    price:Number($('cPrice').value)||0, currency:$('cCurrency').value.trim()||'COP',
    drawDate:$('cDate').value, drawTime:$('cTime').value, drawNote:$('cNote').value.trim(), whatsapp:$('cWhats').value.trim(),
    autoReleaseMin:Number(($('cAutoRel')||{}).value)||0,
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
function lgPick(ev){ const f=ev.target.files[0]; if(!f) return; toast('Preparando imagen...'); compressImage(f,{maxSide:380,type:'image/png',quality:0.92}).then(d=>{ _logo=d; renderLogoBox(); toast('Logo listo. No olvides Guardar.'); }).catch(e=>toast(e.message||'No se pudo cargar la imagen')); }
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
  const ps=(r.prizes||[]).filter(p=>p&&p.enabled);
  const nSec=Math.max(0,ps.length-1), SEC=48;
  const topH=360+nSec*SEC, legendH=120, gridH=cell*10+gap*9, H=topH+gridH+legendH;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const x=cv.getContext('2d');
  const bg=x.createLinearGradient(0,0,W,H); bg.addColorStop(0,'#1a0020'); bg.addColorStop(.5,'#0A000A'); bg.addColorStop(1,'#20002a');
  x.fillStyle=bg; x.fillRect(0,0,W,H); x.textAlign='center';
  x.font='900 72px Segoe UI,Arial,sans-serif';
  const lg=x.createLinearGradient(0,60,0,140); lg.addColorStop(0,'#FF66DD'); lg.addColorStop(.5,'#FF00FF'); lg.addColorStop(1,'#FFD700');
  x.fillStyle=lg; x.shadowColor='rgba(255,0,255,.6)'; x.shadowBlur=24;
  x.fillText((r.name||'DREAMS RIFA').toUpperCase(),W/2,120); x.shadowBlur=0;
  if(r.slogan){ x.font='italic 34px Segoe UI,Arial,sans-serif'; x.fillStyle='#FFD700'; x.fillText(r.slogan,W/2,170); }
  if(ps[0]){ x.font='800 44px Segoe UI,Arial,sans-serif'; x.fillStyle='#FFE766'; x.shadowColor='rgba(255,215,0,.5)'; x.shadowBlur=16;
    x.fillText('🏆 '+money(ps[0].amount),W/2,236); x.shadowBlur=0;
    x.font='28px Segoe UI,Arial,sans-serif'; x.fillStyle='#c89bd6'; x.fillText(ps[0].label,W/2,276); }
  let sy=316;
  for(let i=1;i<ps.length;i++){
    x.font='700 30px Segoe UI,Arial,sans-serif'; x.fillStyle='#FFE766'; x.shadowColor='rgba(255,215,0,.35)'; x.shadowBlur=10;
    x.fillText('✨ '+ps[i].label+': '+money(ps[i].amount),W/2,sy); x.shadowBlur=0;
    sy+=SEC;
  }
  x.font='26px Segoe UI,Arial,sans-serif'; x.fillStyle='#f7eaff';
  x.fillText('Valor por numero: '+money(r.price)+'  •  Sorteo '+(r.drawTime||''),W/2,318+nSec*SEC);
  x.fillText(fechaLarga(r.drawDate),W/2,350+nSec*SEC);
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

/* ---------- Imagen de la vitrina (solo premios, sin tablero) ---------- */
function downloadShowcaseImage(){
  const r=cur(); if(!r){ return; }
  const W=1080;
  const ps=(r.prizes||[]).filter(p=>p&&p.enabled);
  const cols=ps.length>=2?2:1;
  const rows=Math.ceil(ps.length/cols);
  const headH=200;
  const doDraw=(img)=>{
    const P=48;
    let dw=0, dh=0, imgH=0;
    if(img){
      const sc=Math.min((W-P*2)/img.width, 520/img.height);
      dw=img.width*sc; dh=img.height*sc; imgH=dh+30;
    }
    const pillH=70;
    const boxGap=24, boxW=(W-P*2-boxGap*(cols-1))/cols, boxH=150;
    const prizesH = ps.length? (50 + rows*(boxH+boxGap)) : 0;
    const H=headH+imgH+pillH+prizesH+90+40;
    const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const x=cv.getContext('2d');
    const bg=x.createLinearGradient(0,0,W,H); bg.addColorStop(0,'#1a0020'); bg.addColorStop(.5,'#0A000A'); bg.addColorStop(1,'#20002a');
    x.fillStyle=bg; x.fillRect(0,0,W,H);
    x.strokeStyle='#FFD700'; x.lineWidth=6; roundRect(x,16,16,W-32,H-32,24); x.stroke();
    x.textAlign='center';
    x.font='900 70px Segoe UI,Arial,sans-serif';
    const lg=x.createLinearGradient(0,60,0,140); lg.addColorStop(0,'#FF66DD'); lg.addColorStop(.5,'#FF00FF'); lg.addColorStop(1,'#FFD700');
    x.fillStyle=lg; x.shadowColor='rgba(255,0,255,.6)'; x.shadowBlur=24;
    x.fillText((r.name||'DREAMS RIFA').toUpperCase(),W/2,120); x.shadowBlur=0;
    if(r.slogan){ x.font='italic 34px Segoe UI,Arial,sans-serif'; x.fillStyle='#FFD700'; x.fillText(r.slogan,W/2,172); }
    let y=headH;
    if(img){
      const dx=(W-dw)/2, dy=y;
      x.save(); roundRect(x,dx,dy,dw,dh,20); x.clip(); x.drawImage(img,dx,dy,dw,dh); x.restore();
      x.strokeStyle='#FFD700'; x.lineWidth=4; roundRect(x,dx,dy,dw,dh,20); x.stroke();
      y+=dh+30;
    }
    const fecha=fechaLarga(r.drawDate);
    const pillTxt=fecha+(r.drawTime?('  \u2022  sorteo '+r.drawTime):'');
    x.font='700 30px Segoe UI,Arial,sans-serif';
    const pw=x.measureText(pillTxt).width+70, px=(W-pw)/2;
    const pg=x.createLinearGradient(px,0,px+pw,0); pg.addColorStop(0,'#FFD700'); pg.addColorStop(1,'#FFE766');
    x.fillStyle=pg; roundRect(x,px,y,pw,52,26); x.fill();
    x.fillStyle='#1a0020'; x.fillText(pillTxt,W/2,y+34);
    y+=70;
    if(ps.length){
      x.font='800 36px Segoe UI,Arial,sans-serif'; x.fillStyle='#FFE766'; x.fillText('PREMIOS',W/2,y+6); y+=50;
      for(let i=0;i<ps.length;i++){
        const col=i%cols, row=Math.floor(i/cols);
        const bx=P+col*(boxW+boxGap), by=y+row*(boxH+boxGap);
        x.fillStyle='rgba(255,255,255,.04)'; roundRect(x,bx,by,boxW,boxH,18); x.fill();
        x.strokeStyle='#FFD700'; x.lineWidth=3; roundRect(x,bx,by,boxW,boxH,18); x.stroke();
        x.fillStyle='#f7eaff'; x.font='700 30px Segoe UI,Arial,sans-serif';
        x.fillText((i===0?'\ud83c\udfc6 ':'\u2728 ')+(ps[i].label||('Premio '+(i+1))),bx+boxW/2,by+58);
        x.shadowColor='rgba(255,0,255,.5)'; x.shadowBlur=16; x.fillStyle='#FF66DD'; x.font='900 42px Segoe UI,Arial,sans-serif';
        x.fillText(money(ps[i].amount),bx+boxW/2,by+112); x.shadowBlur=0;
      }
      y+=rows*(boxH+boxGap);
    }
    x.fillStyle='rgba(247,234,255,.6)'; x.font='22px Segoe UI,Arial,sans-serif';
    x.fillText('DREAMS RIFA  \u2022  rifa-diaria.onrender.com',W/2,H-46);
    const url=cv.toDataURL('image/png');
    const a=document.createElement('a'); a.href=url; a.download='vitrina-'+((r.name||'dreams').replace(/[^a-z0-9]/gi,'_').toLowerCase())+'.png'; a.click();
    toast('Imagen descargada \ud83d\udcf2');
  };
  if(r.lotteryImage){
    const im=new Image();
    im.onload=()=>doDraw(im);
    im.onerror=()=>doDraw(null);
    im.src=r.lotteryImage;
  } else { doDraw(null); }
}

/* ---------- Arranque ---------- */
if(PASS) loadAndRender(); else renderLogin();

