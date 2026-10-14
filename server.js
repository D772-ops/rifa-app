// ============================================================
//  DREAMS RIFA  |  Multi-rifa  (varias rifas en simultaneo)
//  - Pagina principal:  /          (logo + botones de cada rifa + grupos WhatsApp)
//  - Tablero de rifa:    /?r=ID     (elegir numero y pagar)
//  - Vista ADMIN:        /admin     (gestion completa, con clave)
// ============================================================
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ---------- Cargar .env (sin dependencias) ---------- */
function loadEnv(){
  const f = path.join(__dirname, '.env');
  if(!fs.existsSync(f)) return;
  for(const line of fs.readFileSync(f,'utf8').split('\n')){
    const t = line.trim();
    if(!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if(i<0) continue;
    const k = t.slice(0,i).trim();
    const v = t.slice(i+1).trim();
    if(!(k in process.env)) process.env[k] = v;
  }
}
loadEnv();

process.env.TZ = process.env.TZ || 'America/Bogota';

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || ('http://localhost:'+PORT)).replace(/\/$/,'');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const MP_TOKEN = process.env.MP_ACCESS_TOKEN || '';

/* ---------- Base de datos (archivo JSON) ---------- */
const DB_FILE = path.join(__dirname, 'db.json');
function pad(n){ return String(n).padStart(2,'0'); }
function today(){ const d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function blankNumbers(){ const o={}; for(let i=0;i<100;i++) o[pad(i)]={status:'available'}; return o; }
function uid(){ return 'r'+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36); }

function defaultPrizes(){
  return [
    { label:'Ultimas dos cifras', amount:1400000, enabled:true },
    { label:'Primeras dos cifras', amount:100000, enabled:true },
    { label:'Cifras del medio', amount:100000, enabled:true },
    { label:'Cifras de union (primera y ultima)', amount:100000, enabled:true }
  ];
}
function defaultBreb(){
  return { enabled:false, llave:'', beneficiary:'', business:'', qrImage:'', qrBin:'', requireReceipt:false };
}
function newRaffle(name){
  return {
    id: uid(),
    name: name || 'Nueva rifa',
    slogan: 'La suerte tambien se gana',
    color: '#FF00FF',            // color neon de la rifa (acento visual)
    status: 'active',            // 'active' = visible y jugable | 'soon' = proximamente | 'hidden' = oculta
    currency: 'COP',
    price: 5000,
    drawDate: today(),           // la fecha la eliges tu (diaria, semanal, mensual, lo que quieras)
    drawTime: '20:00',
    drawNote: '',                // texto libre, ej: 'Sorteo semanal cada domingo'
    whatsapp: '',                // enlace del grupo de WhatsApp de esta rifa
    autoReleaseMin: 0,           // liberar numeros reservados sin pago X minutos antes del sorteo (0 = desactivado)
    mode: 'numbers',             // 'numbers' = rifa con tablero | 'showcase' = vitrina de solo premios
    lotteryImage: '',            // imagen de la loteria (solo para vitrina), guardada en su propia caja
    lotteryBin: '',              // id de la caja JSONBin donde vive la imagen de la loteria
    showResult: false,           // vitrina: mostrar el numero ganador de la loteria
    resultNumber: '',            // vitrina: numero ganador (ej '0422')
    resultShape: 'circle',       // vitrina: 'circle' = bolitas | 'square' = cuadritos
    prizes: defaultPrizes(),
    breb: defaultBreb(),
    numbers: blankNumbers(),
    winner: null,
    history: []
  };
}
function defaultBrand(){
  return {
    logo: '/logo.png',
    logoBin: '',
    heading: 'DREAMS RIFA',
    slogan: 'La suerte tambien se gana',
    intro: 'Elige la rifa en la que quieres participar',
    groups: []   // grupos oficiales de WhatsApp mostrados en la pagina principal: {name,url}
  };
}
function freshDB(){
  return { brand: defaultBrand(), raffles: [ newRaffle('DREAMS RIFA') ] };
}
// ---- Guardado en la nube GRATIS (JSONBin) ----
const RB_BIN = (process.env.JSONBIN_BIN_ID||'').trim();
const RB_KEY = (process.env.JSONBIN_KEY||'').trim();
const USE_REMOTE = !!(RB_BIN && RB_KEY);
const RB_URL = 'https://api.jsonbin.io/v3/b/' + RB_BIN;

/* ===================== IMAGENES EN CAJAS JSONBin PROPIAS =====================
   imgbb bloquea las subidas desde Render ("forbidden"), asi que ya no lo usamos.
   En vez de eso, cada imagen (logo y cada QR) se guarda en SU PROPIA caja de
   JSONBin y en los datos principales dejamos solo el id de esa caja. Asi la caja
   principal se mantiene chiquita (<100KB) y las imagenes persisten igual.
   La imagen se comprime en el navegador antes de subir para que cada caja
   tambien quepa en el tope de 100KB del plan gratis. */
const RB_BASE = 'https://api.jsonbin.io/v3/b';
function isDataImage(s){ return typeof s==='string' && s.startsWith('data:image'); }
// Guarda (o actualiza) una imagen en su propia caja. Devuelve el id de la caja.
async function imgBinPut(binId, dataUri){
  if(!RB_KEY) return null;
  const body = JSON.stringify({ img: dataUri });
  try{
    if(binId){
      const r = await fetch(RB_BASE+'/'+binId, { method:'PUT',
        headers:{ 'Content-Type':'application/json', 'X-Master-Key':RB_KEY }, body });
      if(r.ok){ console.log('[img] imagen actualizada en su caja ('+binId+')'); return binId; }
      const t=await r.text().catch(()=> '');
      console.error('[img] no se pudo actualizar la caja (HTTP '+r.status+'): '+t.slice(0,160));
      // si fallo (p.ej. caja borrada), intentamos crear una nueva abajo
    }
    const r2 = await fetch(RB_BASE, { method:'POST',
      headers:{ 'Content-Type':'application/json', 'X-Master-Key':RB_KEY, 'X-Bin-Private':'false' }, body });
    const j2 = await r2.json().catch(()=>null);
    if(r2.ok && j2 && j2.metadata && j2.metadata.id){ console.log('[img] imagen guardada en caja nueva ('+j2.metadata.id+')'); return j2.metadata.id; }
    console.error('[img] NO se pudo crear la caja de la imagen: '+((j2&&j2.message)||('HTTP '+r2.status)));
    return null;
  }catch(e){ console.error('[img] error guardando imagen en su caja:', e.message); return null; }
}
// Lee una imagen desde su caja. Devuelve el dataURI (base64) o null.
async function imgBinGet(binId){
  if(!RB_KEY || !binId) return null;
  try{
    const r = await fetch(RB_BASE+'/'+binId+'/latest', { headers:{ 'X-Master-Key':RB_KEY } });
    if(!r.ok) return null;
    const data = await r.json();
    const rec = (data && data.record!==undefined) ? data.record : data;
    return (rec && typeof rec.img==='string') ? rec.img : null;
  }catch(e){ console.error('[img] no se pudo leer la caja '+binId+':', e.message); return null; }
}
// Al arrancar: rellena en memoria las imagenes (logo/QR) desde sus cajas,
// usando el id guardado en los datos. Se hace una sola vez.
async function inflateImages(){
  if(!RB_KEY) return;
  try{
    if(db.brand && db.brand.logoBin && !isDataImage(db.brand.logo)){
      const img = await imgBinGet(db.brand.logoBin); if(img) db.brand.logo = img;
    }
    for(const r of (db.raffles||[])){
      if(r.breb && r.breb.qrBin && !isDataImage(r.breb.qrImage)){
        const img = await imgBinGet(r.breb.qrBin); if(img) r.breb.qrImage = img;
      }
      if(r.lotteryBin && !isDataImage(r.lotteryImage)){
        const img = await imgBinGet(r.lotteryBin); if(img) r.lotteryImage = img;
      }
    }
    console.log('[img] imagenes recuperadas desde sus cajas');
  }catch(e){ console.error('[img] error recuperando imagenes:', e.message); }
}
// Migracion unica: si hay imagenes viejas guardadas como base64 (sin caja),
// las movemos a su propia caja y dejamos solo el id.
async function migrateImages(){
  if(!RB_KEY) return;
  let changed=false;
  if(db.brand && isDataImage(db.brand.logo) && !db.brand.logoBin){
    const id = await imgBinPut('', db.brand.logo); if(id){ db.brand.logoBin=id; changed=true; }
  }
  for(const r of (db.raffles||[])){
    if(r.breb && isDataImage(r.breb.qrImage) && !r.breb.qrBin){
      const id = await imgBinPut('', r.breb.qrImage); if(id){ r.breb.qrBin=id; changed=true; }
    }
    if(isDataImage(r.lotteryImage) && !r.lotteryBin){
      const id = await imgBinPut('', r.lotteryImage); if(id){ r.lotteryBin=id; changed=true; }
    }
  }
  if(changed){ console.log('[img] imagenes viejas movidas a sus cajas; guardando...'); save(); }
}

async function remoteLoad(){
  if(!USE_REMOTE) return { ok:false, data:null, error:'desactivado' };
  try{
    const r = await fetch(RB_URL+'/latest', { headers:{ 'X-Master-Key':RB_KEY } });
    if(!r.ok) return { ok:false, data:null, error:'HTTP '+r.status };
    const data = await r.json();
    const rec = (data && data.record!==undefined) ? data.record : data;
    const valid = (rec && (rec.raffles || rec.cfg)) ? rec : null;
    return { ok:true, data:valid, error:null };
  }catch(e){ console.error('[nube] no se pudo leer:', e.message); return { ok:false, data:null, error:e.message }; }
}
// Version liviana para la nube: quita las imagenes pesadas (van en sus cajas)
// y los comprobantes. Deja solo los ids de caja (logoBin/qrBin), que pesan nada.
function slimForRemote(){
  const c = JSON.parse(JSON.stringify(db));
  if(c.brand && isDataImage(c.brand.logo)) c.brand.logo='';   // el logo vive en su caja
  (c.raffles||[]).forEach(r=>{
    if(r.breb && isDataImage(r.breb.qrImage)) r.breb.qrImage='';  // el QR vive en su caja
    if(isDataImage(r.lotteryImage)) r.lotteryImage='';            // la imagen de loteria vive en su caja
    if(r.numbers) for(const k in r.numbers){ if(r.numbers[k]) delete r.numbers[k].receipt; }
    if(Array.isArray(r.history)) r.history.forEach(h=>{ if(h&&h.participants) h.participants.forEach(p=>{ if(p) delete p.receipt; }); });
  });
  return c;
}
let remoteBusy=false, remoteDirty=false;
async function remotePut(){
  if(!USE_REMOTE) return;
  if(remoteBusy){ remoteDirty=true; return; }      // ya hay un guardado en curso: se reintenta luego con el estado mas reciente
  remoteBusy=true; remoteDirty=false;
  try{
    const r = await fetch(RB_URL, { method:'PUT',
      headers:{ 'Content-Type':'application/json', 'X-Master-Key':RB_KEY },
      body: JSON.stringify(slimForRemote()) });
    if(!r.ok){
      const t = await r.text().catch(()=>'');
      console.error('[nube] NO se guardo (HTTP '+r.status+'): '+t.slice(0,200));
      remoteDirty=true;   // reintentar
    } else {
      console.log('[nube] cambios guardados en la nube OK');
    }
  }catch(e){ console.error('[nube] no se pudo guardar:', e.message); remoteDirty=true; }
  finally{
    remoteBusy=false;
    if(remoteDirty){ clearTimeout(remoteTimer); remoteTimer=setTimeout(remotePut,1000); }
  }
}

// Normaliza y MIGRA datos viejos (rifa unica) al nuevo formato (varias rifas).
function normalizeRaffle(r){
  if(!r || typeof r!=='object') return newRaffle('Rifa');
  if(!r.id) r.id = uid();
  if(!r.name) r.name = 'Rifa';
  if(r.slogan==null) r.slogan = '';
  if(!/^#[0-9a-fA-F]{6}$/.test(r.color||'')) r.color = '#FF00FF';
  if(!['active','soon','hidden'].includes(r.status)) r.status = 'active';
  if(!r.currency) r.currency = 'COP';
  if(r.price==null) r.price = 0;
  if(!r.drawDate) r.drawDate = today();
  if(!r.drawTime) r.drawTime = '20:00';
  if(r.drawNote==null) r.drawNote = '';
  if(r.whatsapp==null) r.whatsapp = '';
  if(r.autoReleaseMin==null || isNaN(Number(r.autoReleaseMin))) r.autoReleaseMin = 0; else r.autoReleaseMin = Number(r.autoReleaseMin);
  if(r.mode!=='showcase') r.mode = 'numbers';
  if(r.lotteryImage==null) r.lotteryImage = '';
  if(r.lotteryBin==null) r.lotteryBin = '';
  if(r.showResult==null) r.showResult = false;
  if(r.resultNumber==null) r.resultNumber = '';
  if(r.resultShape!=='square') r.resultShape = 'circle';
  if(!Array.isArray(r.prizes)) r.prizes = defaultPrizes();
  if(!r.breb) r.breb = defaultBreb();
  if(r.breb.qrBin==null) r.breb.qrBin = '';
  if(!r.numbers) r.numbers = blankNumbers();
  if(r.winner===undefined) r.winner = null;
  if(!Array.isArray(r.history)) r.history = [];
  return r;
}
function normalizeDB(){
  if(!db || typeof db!=='object') db = freshDB();
  // Migracion: formato viejo con un solo 'cfg' + 'numbers' en la raiz
  if(db.cfg && !db.raffles){
    const old = db;
    const r = normalizeRaffle({
      id: uid(), name: old.cfg.raffleName || 'DREAMS RIFA', slogan: old.cfg.slogan || '',
      status:'active', currency: old.cfg.currency || 'COP', price: old.cfg.price || 0,
      drawDate: old.date || today(), drawTime: old.cfg.drawTime || '20:00', drawNote:'', whatsapp:'',
      prizes: old.cfg.prizes || defaultPrizes(), breb: old.cfg.breb || defaultBreb(),
      numbers: old.numbers || blankNumbers(), winner: old.winner || null, history: old.history || []
    });
    db = { brand: defaultBrand(), raffles:[r] };
  }
  if(!db.brand) db.brand = defaultBrand();
  if(db.brand.logo==null) db.brand.logo = '/logo.png';
  if(db.brand.logoBin==null) db.brand.logoBin = '';
  if(db.brand.heading==null) db.brand.heading = 'DREAMS RIFA';
  if(db.brand.slogan==null) db.brand.slogan = '';
  if(db.brand.intro==null) db.brand.intro = 'Elige la rifa en la que quieres participar';
  if(!Array.isArray(db.brand.groups)) db.brand.groups = [];
  if(!Array.isArray(db.raffles)) db.raffles = [];
  db.raffles = db.raffles.map(normalizeRaffle);
  if(db.raffles.length===0) db.raffles.push(newRaffle('DREAMS RIFA'));
}

let db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE,'utf8')) : freshDB();
normalizeDB();

let saveTimer=null, remoteTimer=null;
function save(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{ try{ fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); }catch(e){} },120);
  if(USE_REMOTE){ clearTimeout(remoteTimer); remoteTimer=setTimeout(remotePut,500); }
}
// Guarda TODO (disco + nube) antes de que el servicio se cierre o se redespliegue.
async function flushAll(){
  try{ fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); }catch(e){}
  try{ if(USE_REMOTE){ remoteBusy=false; await remotePut(); } }catch(e){}
}
let shuttingDown=false;
function onShutdown(sig){
  if(shuttingDown) return; shuttingDown=true;
  console.log('[nube] senal '+sig+' recibida: guardando antes de cerrar...');
  flushAll().finally(()=>process.exit(0));
  setTimeout(()=>process.exit(0), 4000);   // salvavidas por si la red se cuelga
}
process.on('SIGTERM', ()=>onShutdown('SIGTERM'));
process.on('SIGINT',  ()=>onShutdown('SIGINT'));

/* ===================== LIBERACION AUTOMATICA DE NUMEROS =====================
   Si no puedes estar atenta a la hora del sorteo, la pagina libera sola los
   numeros que estan RESERVADOS pero SIN pago (sin comprobante y sin pago
   pendiente de aprobacion), X minutos antes del sorteo de cada rifa.
   NO toca los que estan pagados ni los que estan esperando aprobacion. */
const TZ_OFFSET = (process.env.TZ_OFFSET||'-05:00').trim();   // hora de Colombia por defecto
function drawTimestamp(r){
  if(!r || !r.drawDate) return null;
  const hhmm = (typeof r.drawTime==='string' && /^\d{2}:\d{2}$/.test(r.drawTime)) ? r.drawTime : '20:00';
  const t = Date.parse(r.drawDate+'T'+hhmm+':00'+TZ_OFFSET);
  return isNaN(t) ? null : t;
}
// Un numero se libera solo si: esta reservado, NO tiene pago pendiente (Mercado
// Pago), NO fue reclamado y NO tiene comprobante cargado.
function esReservadoSinPago(n){
  return n && n.status==='reserved' && !n.mpPending && !n.claimed && !n.receipt;
}
function autoReleaseTick(){
  const now = Date.now();
  let changed = false, total = 0;
  for(const r of (db.raffles||[])){
    const mins = Number(r.autoReleaseMin)||0;
    if(mins<=0) continue;                 // desactivado para esta rifa
    const draw = drawTimestamp(r);
    if(draw==null) continue;
    if(now < draw - mins*60000) continue; // todavia no entra en la ventana de liberacion
    for(const k in r.numbers){
      if(esReservadoSinPago(r.numbers[k])){ r.numbers[k] = { status:'available' }; changed=true; total++; }
    }
  }
  if(changed){ console.log('[auto] se liberaron '+total+' numero(s) reservado(s) sin pago antes del sorteo'); save(); }
}
// Devuelve desde que hora/fecha se liberan los numeros sin pago (o null si esta
// desactivado). Es aritmetica de reloj sobre la hora local de la rifa (Colombia).
function releaseInfo(r){
  const mins = Number(r && r.autoReleaseMin)||0;
  if(mins<=0 || !r.drawDate) return null;
  const hhmm = (typeof r.drawTime==='string' && /^\d{2}:\d{2}$/.test(r.drawTime)) ? r.drawTime : '20:00';
  const base = new Date(r.drawDate+'T'+hhmm+':00');          // hora de la rifa
  if(isNaN(base.getTime())) return null;
  const rel = new Date(base.getTime() - mins*60000);
  const p = n=>String(n).padStart(2,'0');
  return {
    minutes: mins,
    time: p(rel.getHours())+':'+p(rel.getMinutes()),
    date: rel.getFullYear()+'-'+p(rel.getMonth()+1)+'-'+p(rel.getDate()),
    sameDay: rel.toDateString()===base.toDateString()
  };
}
function getRaffle(id){ return db.raffles.find(r=>r.id===id) || null; }
/* ---------- Mercado Pago (opcional, token global) ---------- */
async function mpCreatePreference(r, numKey, buyer){
  if(!MP_TOKEN) throw new Error('Falta MP_ACCESS_TOKEN en el .env');
  const ref = r.id + '#' + numKey;
  const body = {
    items:[{ title: r.name + ' - numero ' + numKey, quantity:1,
      currency_id: r.currency || 'COP', unit_price: Number(r.price)||0 }],
    external_reference: ref,
    notification_url: PUBLIC_URL + '/api/webhook/mp',
    back_urls:{
      success: PUBLIC_URL + '/?r=' + r.id + '&pago=ok&n=' + numKey,
      pending: PUBLIC_URL + '/?r=' + r.id + '&pago=pendiente&n=' + numKey,
      failure: PUBLIC_URL + '/?r=' + r.id + '&pago=error&n=' + numKey
    },
    auto_return:'approved'
  };
  const resp = await fetch('https://api.mercadopago.com/checkout/preferences',{
    method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+MP_TOKEN},
    body: JSON.stringify(body) });
  const data = await resp.json();
  if(!resp.ok) throw new Error('MP preferencia: '+(data.message||resp.status));
  return data.init_point;
}
async function mpGetPayment(paymentId){
  const resp = await fetch('https://api.mercadopago.com/v1/payments/'+paymentId,{ headers:{'Authorization':'Bearer '+MP_TOKEN} });
  return resp.ok ? resp.json() : null;
}

/* ============================================================
   SERVIDOR HTTP
   ============================================================ */
const app = express();
app.use(express.json({limit:'6mb'}));
app.use(express.urlencoded({extended:true, limit:'6mb'}));

function counts(r){
  let libre=0,res=0,pag=0;
  for(const k in r.numbers){ const s=r.numbers[k].status; if(s==='paid')pag++; else if(s==='reserved')res++; else libre++; }
  return {libre,res,pag};
}
// Estado publico de UNA rifa (sin datos personales)
function publicRaffle(r){
  const nums={};
  for(const k in r.numbers) nums[k] = { status: r.numbers[k].status };
  const b=r.breb||{};
  return {
    id:r.id, name:r.name, slogan:r.slogan, color:r.color, status:r.status, currency:r.currency, price:r.price,
    drawDate:r.drawDate, drawTime:r.drawTime, drawNote:r.drawNote, whatsapp:r.whatsapp,
    mode:(r.mode==='showcase'?'showcase':'numbers'), lotteryImage:r.lotteryImage||'',
    showResult:!!r.showResult, resultNumber:r.resultNumber||'', resultShape:(r.resultShape==='square'?'square':'circle'),
    autoReleaseMin:Number(r.autoReleaseMin)||0, release:releaseInfo(r),
    prizes:(Array.isArray(r.prizes)?r.prizes:[]).filter(p=>p&&p.enabled).map(p=>({label:p.label,amount:p.amount})),
    breb: (b.enabled ? { enabled:true, llave:b.llave, beneficiary:b.beneficiary, business:b.business,
           qrImage:b.qrImage, requireReceipt:!!b.requireReceipt } : {enabled:false}),
    numbers:nums, winner:r.winner, mp:!!MP_TOKEN
  };
}

/* ---------- API PUBLICA ---------- */
// Pagina principal: marca + lista de rifas visibles (activa / proximamente)
app.get('/api/home', (req,res)=>{
  const list = db.raffles.filter(r=>r.status!=='hidden').map(r=>({
    id:r.id, name:r.name, slogan:r.slogan, color:r.color, status:r.status, currency:r.currency, price:r.price,
    drawDate:r.drawDate, drawTime:r.drawTime, drawNote:r.drawNote, whatsapp:r.whatsapp,
    mode:(r.mode==='showcase'?'showcase':'numbers'), lotteryImage:r.lotteryImage||'',
    autoReleaseMin:Number(r.autoReleaseMin)||0, release:releaseInfo(r),
    prize: (Array.isArray(r.prizes)?r.prizes:[]).filter(p=>p&&p.enabled)[0]||null,
    prizes:(Array.isArray(r.prizes)?r.prizes:[]).filter(p=>p&&p.enabled).map(p=>({label:p.label,amount:p.amount})),
    counts: counts(r)
  }));
  res.json({ brand:db.brand, raffles:list });
});
// Estado de una rifa concreta
app.get('/api/state/:rid', (req,res)=>{
  const r = getRaffle(req.params.rid);
  if(!r) return res.status(404).json({error:'Rifa no encontrada'});
  res.json(publicRaffle(r));
});

app.post('/api/reserve', async (req,res)=>{
  const r = getRaffle(req.body.raffle);
  if(!r) return res.status(404).json({error:'Rifa no encontrada'});
  if(r.mode==='showcase') return res.status(409).json({error:'Esta publicacion es solo informativa (vitrina de premios)'});
  if(r.status!=='active') return res.status(409).json({error:'Esta rifa no esta disponible en este momento'});
  const key = pad(parseInt(req.body.number,10));
  const buyer = (req.body.buyer||'').toString().trim().slice(0,60);
  const phone = (req.body.phone||'').toString().trim().slice(0,30);
  let method = req.body.method || 'manual';
  if(!['online','breb','manual'].includes(method)) method='manual';
  if(method==='online' && !MP_TOKEN) method='manual';
  if(method==='breb' && !(r.breb && r.breb.enabled)) method='manual';
  if(!/^\d{2}$/.test(key) || !r.numbers[key]) return res.status(400).json({error:'Numero invalido'});
  if(!buyer) return res.status(400).json({error:'Escribe tu nombre'});
  if(r.numbers[key].status!=='available') return res.status(409).json({error:'Ese numero ya no esta disponible'});

  r.numbers[key] = { status:'reserved', buyer, phone, method, reservedAt:Date.now() };
  save();

  if(method==='online'){
    try{
      const link = await mpCreatePreference(r, key, buyer);
      r.numbers[key].mpPending = true; save();
      return res.json({ ok:true, number:key, method, payUrl:link });
    }catch(e){
      r.numbers[key].method='manual'; save();
      return res.json({ ok:true, number:key, method:'manual', payUrl:null, warn:'No se pudo generar el pago en linea: '+e.message });
    }
  }
  if(method==='breb'){
    const b=r.breb;
    return res.json({ ok:true, number:key, method, payUrl:null,
      breb:{ llave:b.llave, beneficiary:b.beneficiary, business:b.business, qrImage:b.qrImage,
             amount:r.price, currency:r.currency, requireReceipt:!!b.requireReceipt } });
  }
  res.json({ ok:true, number:key, method:'manual', payUrl:null });
});

app.post('/api/claim', (req,res)=>{
  const r = getRaffle(req.body.raffle);
  if(!r) return res.status(404).json({error:'Rifa no encontrada'});
  const key = pad(parseInt(req.body.number,10));
  const n = r.numbers[key];
  if(!n || n.status==='available') return res.status(400).json({error:'Ese numero no tiene reserva activa'});
  if(n.status==='paid') return res.json({ok:true, already:true});
  n.claimed = true; n.claimedAt = Date.now();
  const rc = (req.body.receipt||'').toString();
  if(rc && rc.startsWith('data:image') && rc.length < 6*1024*1024) n.receipt = rc;
  save();
  res.json({ok:true});
});

app.post('/api/webhook/mp', async (req,res)=>{
  res.sendStatus(200);
  try{
    const type = req.query.type || req.body.type;
    const payId = (req.query['data.id']) || (req.body.data && req.body.data.id);
    if(type!=='payment' || !payId) return;
    const pay = await mpGetPayment(payId);
    if(!pay) return;
    const ref = pay.external_reference || '';
    const [rid,key] = ref.split('#');
    const r = getRaffle(rid);
    if(pay.status==='approved' && r && key && r.numbers[key]){
      r.numbers[key].status='paid'; r.numbers[key].paidAt=Date.now();
      r.numbers[key].mpPaymentId=payId; delete r.numbers[key].mpPending;
      save(); console.log('[PAGO APROBADO]', rid, key, payId);
    }
  }catch(e){ console.error('webhook error', e.message); }
});

app.get('/api/status/:rid/:num', (req,res)=>{
  const r = getRaffle(req.params.rid);
  const key=pad(parseInt(req.params.num,10));
  const n = r && r.numbers[key];
  res.json({ number:key, status:n?n.status:'available' });
});
/* ---------- API ADMIN (protegida por clave) ---------- */
function auth(req,res,next){
  const pass = req.headers['x-admin-pass'] || req.query.pass;
  if(pass !== ADMIN_PASSWORD) return res.status(401).json({error:'Clave incorrecta'});
  next();
}
app.post('/api/admin/login',(req,res)=>{
  if((req.body.pass||'')===ADMIN_PASSWORD) return res.json({ok:true});
  res.status(401).json({error:'Clave incorrecta'});
});
// Estado completo (marca + todas las rifas con datos de compradores)
app.get('/api/admin/state', auth, (req,res)=>{
  res.json({ brand:db.brand, raffles:db.raffles, mp:!!MP_TOKEN });
});

// Guardar la marca / pagina principal (logo, titulo, intro, grupos WhatsApp)
app.post('/api/admin/brand', auth, async (req,res)=>{
  const b=req.body||{};
  if(b.heading!=null) db.brand.heading = String(b.heading).slice(0,60);
  if(b.slogan!=null) db.brand.slogan = String(b.slogan).slice(0,120);
  if(b.intro!=null) db.brand.intro = String(b.intro).slice(0,160);
  if(Array.isArray(b.groups)){
    db.brand.groups = b.groups.slice(0,12).map(g=>({
      name:String((g&&g.name)||'').slice(0,40),
      url:String((g&&g.url)||'').slice(0,300)
    })).filter(g=>g.name||g.url);
  }
  if(typeof b.logo === 'string'){
    if(b.logo===''){ db.brand.logo=''; db.brand.logoBin=''; }
    else if(b.logo==='/logo.png'){ db.brand.logo='/logo.png'; db.brand.logoBin=''; }
    else if(/^https?:\/\//.test(b.logo)){ db.brand.logo=b.logo; db.brand.logoBin=''; }   // ya es un enlace
    else if(b.logo.startsWith('data:image') && b.logo.length < 6*1024*1024){
      db.brand.logo = b.logo;                                   // en memoria servimos el base64
      const id = await imgBinPut(db.brand.logoBin||'', b.logo);  // y lo guardamos en su propia caja
      if(id) db.brand.logoBin = id;
    }
  }
  save(); res.json({ok:true, brand:db.brand});
});

// Crear una rifa nueva
app.post('/api/admin/raffle/create', auth, (req,res)=>{
  const r = newRaffle((req.body && req.body.name) || 'Nueva rifa');
  if(req.body && req.body.mode==='showcase') r.mode='showcase';
  db.raffles.push(r); save();
  res.json({ok:true, raffle:r});
});
// Borrar una rifa
app.post('/api/admin/raffle/delete', auth, (req,res)=>{
  const id = req.body.raffle;
  const i = db.raffles.findIndex(r=>r.id===id);
  if(i<0) return res.status(404).json({error:'Rifa no encontrada'});
  db.raffles.splice(i,1); save();
  res.json({ok:true});
});
// Reordenar (subir/bajar)
app.post('/api/admin/raffle/move', auth, (req,res)=>{
  const i = db.raffles.findIndex(r=>r.id===req.body.raffle);
  const dir = req.body.dir==='up'?-1:1;
  const j = i+dir;
  if(i<0 || j<0 || j>=db.raffles.length) return res.json({ok:true});
  const t=db.raffles[i]; db.raffles[i]=db.raffles[j]; db.raffles[j]=t; save();
  res.json({ok:true});
});
// Editar la configuracion de una rifa
app.post('/api/admin/raffle/update', auth, async (req,res)=>{
  const r = getRaffle(req.body.raffle);
  if(!r) return res.status(404).json({error:'Rifa no encontrada'});
  const b=req.body;
  if(b.name!=null) r.name = String(b.name).slice(0,60) || r.name;
  if(b.slogan!=null) r.slogan = String(b.slogan).slice(0,120);
  if(b.color!=null && /^#[0-9a-fA-F]{6}$/.test(b.color)) r.color = b.color;
  if(b.status && ['active','soon','hidden'].includes(b.status)) r.status = b.status;
  if(b.price!=null) r.price = Number(b.price)||0;
  if(b.currency) r.currency = String(b.currency).slice(0,6);
  if(b.drawDate!=null) r.drawDate = String(b.drawDate).slice(0,10);
  if(b.drawTime!=null) r.drawTime = String(b.drawTime).slice(0,5);
  if(b.drawNote!=null) r.drawNote = String(b.drawNote).slice(0,80);
  if(b.whatsapp!=null) r.whatsapp = String(b.whatsapp).slice(0,300);
  if(b.autoReleaseMin!=null){ let m=Number(b.autoReleaseMin); if(isNaN(m)||m<0) m=0; if(m>1440) m=1440; r.autoReleaseMin=Math.round(m); }
  if(b.mode==='numbers' || b.mode==='showcase') r.mode = b.mode;
  if(b.showResult!=null) r.showResult = !!b.showResult;
  if(b.resultNumber!=null) r.resultNumber = String(b.resultNumber).slice(0,20);
  if(b.resultShape!=null) r.resultShape = (b.resultShape==='square'?'square':'circle');
  if(typeof b.lotteryImage === 'string'){
    if(b.lotteryImage===''){ r.lotteryImage=''; r.lotteryBin=''; }
    else if(/^https?:\/\//.test(b.lotteryImage)){ r.lotteryImage=b.lotteryImage; r.lotteryBin=''; }   // ya es un enlace
    else if(b.lotteryImage.startsWith('data:image') && b.lotteryImage.length < 6*1024*1024){
      r.lotteryImage = b.lotteryImage;                               // en memoria servimos el base64
      const id = await imgBinPut(r.lotteryBin||'', b.lotteryImage);  // y lo guardamos en su propia caja
      if(id) r.lotteryBin = id;
    }
  }
  if(Array.isArray(b.prizes)){
    r.prizes = b.prizes.slice(0,10).map(p=>({
      label:String((p&&p.label)||'').slice(0,60), amount:Number((p&&p.amount)||0)||0, enabled:!!(p&&p.enabled) }));
  }
  if(b.breb){
    const cur = r.breb || defaultBreb();
    r.breb = {
      enabled: !!b.breb.enabled,
      llave: (b.breb.llave!=null?b.breb.llave:cur.llave||'').toString().slice(0,40),
      beneficiary: (b.breb.beneficiary!=null?b.breb.beneficiary:cur.beneficiary||'').toString().slice(0,80),
      business: (b.breb.business!=null?b.breb.business:cur.business||'').toString().slice(0,80),
      requireReceipt: !!b.breb.requireReceipt,
      qrImage: cur.qrImage||'',
      qrBin: cur.qrBin||''
    };
    if(typeof b.breb.qrImage === 'string'){
      if(b.breb.qrImage===''){ r.breb.qrImage=''; r.breb.qrBin=''; }
      else if(/^https?:\/\//.test(b.breb.qrImage)){ r.breb.qrImage=b.breb.qrImage; r.breb.qrBin=''; }   // ya es un enlace
      else if(b.breb.qrImage.startsWith('data:image') && b.breb.qrImage.length < 6*1024*1024){
        r.breb.qrImage = b.breb.qrImage;                        // en memoria servimos el base64
        const id = await imgBinPut(r.breb.qrBin||'', b.breb.qrImage);  // y lo guardamos en su propia caja
        if(id) r.breb.qrBin = id;
      }
    }
  }
  save(); res.json({ok:true, raffle:r});
});

// Operaciones sobre numeros de una rifa
function withNum(req,res,fn){
  const r = getRaffle(req.body.raffle);
  if(!r) return res.status(404).json({error:'Rifa no encontrada'});
  const k = pad(parseInt(req.body.number,10));
  return fn(r,k);
}
app.post('/api/admin/mark-paid', auth, (req,res)=>withNum(req,res,(r,k)=>{
  if(!r.numbers[k] || r.numbers[k].status==='available') return res.status(400).json({error:'Numero sin reserva'});
  r.numbers[k].status='paid'; r.numbers[k].paidAt=Date.now(); delete r.numbers[k].claimed; save(); res.json({ok:true});
}));
app.post('/api/admin/mark-unpaid', auth, (req,res)=>withNum(req,res,(r,k)=>{
  if(r.numbers[k]){ r.numbers[k].status='reserved'; delete r.numbers[k].paidAt; save(); } res.json({ok:true});
}));
app.post('/api/admin/release', auth, (req,res)=>withNum(req,res,(r,k)=>{
  if(r.numbers[k]){ r.numbers[k]={status:'available'}; save(); } res.json({ok:true});
}));
app.post('/api/admin/reserve', auth, (req,res)=>withNum(req,res,(r,k)=>{
  if(!r.numbers[k] || r.numbers[k].status!=='available') return res.status(409).json({error:'No disponible'});
  r.numbers[k]={status:'reserved', buyer:(req.body.buyer||'').slice(0,60), phone:(req.body.phone||'').slice(0,30),
    method:'manual', note:(req.body.note||'').slice(0,200), reservedAt:Date.now()};
  save(); res.json({ok:true});
}));
app.post('/api/admin/draw', auth, (req,res)=>{
  const r = getRaffle(req.body.raffle);
  if(!r) return res.status(404).json({error:'Rifa no encontrada'});
  let win;
  if(req.body.number!=null && req.body.number!==''){ win = pad(parseInt(req.body.number,10)%100); }
  else {
    let pool = Object.keys(r.numbers);
    if(req.body.onlyPaid){ pool = pool.filter(k=>r.numbers[k].status==='paid'); }
    if(pool.length===0) return res.status(400).json({error:'Sin numeros para sortear'});
    win = pool[Math.floor(Math.random()*pool.length)];
  }
  r.winner=win; save();
  res.json({ok:true, winner:win, buyer:r.numbers[win]?.buyer||null, status:r.numbers[win]?.status||'available'});
});
app.post('/api/admin/clear-winner', auth, (req,res)=>{
  const r = getRaffle(req.body.raffle); if(r){ r.winner=null; save(); } res.json({ok:true});
});
// Reiniciar la rifa (nueva ronda): archiva la ronda actual y deja el tablero en blanco
app.post('/api/admin/reset', auth, (req,res)=>{
  const r = getRaffle(req.body.raffle);
  if(!r) return res.status(404).json({error:'Rifa no encontrada'});
  const parts = Object.entries(r.numbers).filter(([,n])=>n.status!=='available')
    .map(([num,n])=>({num,...n}));
  if(parts.length>0 || r.winner){
    const revenue = parts.filter(p=>p.status==='paid').length * (r.price||0);
    r.history.unshift({ date:r.drawDate, winner:r.winner,
      winnerBuyer: r.winner && r.numbers[r.winner] ? (r.numbers[r.winner].buyer||null) : null,
      participants:parts, revenue });
    r.history = r.history.slice(0,180);
  }
  r.numbers=blankNumbers(); r.winner=null;
  if(req.body.drawDate) r.drawDate=String(req.body.drawDate).slice(0,10);
  save(); res.json({ok:true});
});

/* ---------- Vistas estaticas ---------- */
function resolvePage(name){
  const root = path.join(__dirname, name);
  const pub  = path.join(__dirname, 'public', name);
  if (fs.existsSync(root)) return root;
  if (fs.existsSync(pub))  return pub;
  return root;
}
try { if (fs.existsSync(path.join(__dirname,'public'))) app.use(express.static(path.join(__dirname,'public'))); } catch(e){}
app.get('/', (req,res)=> res.sendFile(resolvePage('index.html')));
app.get('/admin', (req,res)=> res.sendFile(resolvePage('admin.html')));

(async ()=>{
  let safeToSave = true;
  if(USE_REMOTE){
    const remote = await remoteLoad();
    if(remote.ok && remote.data){ db = remote.data; normalizeDB(); console.log('[nube] datos cargados desde la nube (JSONBin)'); }
    else if(remote.ok && !remote.data){ console.log('[nube] sin datos previos en la nube; se inicia con estado nuevo'); }
    else { safeToSave = false; console.error('[nube] NO se pudo leer la nube ('+remote.error+'). No se guardara en este arranque para NO borrar tus datos. Reinicia el servicio cuando la nube responda.'); }
  }
  if(safeToSave){ await inflateImages(); await migrateImages(); save(); }
  app.listen(PORT, '0.0.0.0', ()=>{
    console.log('DREAMS RIFA (multi-rifa) corriendo en puerto '+PORT);
    console.log(' - Cliente: '+PUBLIC_URL+'/');
    console.log(' - Admin:   '+PUBLIC_URL+'/admin');
    console.log(' - Rifas activas: '+db.raffles.length);
    console.log(' - Mercado Pago: '+(MP_TOKEN?'ACTIVO':'NO configurado (solo pago manual/Bre-B)'));
    console.log(' - Guardado en la nube (JSONBin): '+(USE_REMOTE?'ACTIVO':'desactivado'));
    console.log(' - Imagenes: cada una en su propia caja de JSONBin '+(RB_KEY?'(ACTIVO)':'(desactivado: falta JSONBIN_KEY)'));
  });
  autoReleaseTick();                       // revisa al arrancar
  setInterval(autoReleaseTick, 60*1000);   // y luego cada minuto
})();

