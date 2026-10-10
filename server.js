// ============================================================
//  Rifa Diaria 00-99  |  servidor + cobro en linea (Mercado Pago)
//  - Vista CLIENTE:  /           (solo elegir numero y pagar)
//  - Vista ADMIN:    /admin      (gestion completa, con clave)
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

// Zona horaria del negocio (Colombia por defecto). Es CLAVE: define cuándo
// cambia el "día" de la rifa y a qué hora real es el sorteo. Sin esto, en un
// servidor en el extranjero (UTC) el tablero se reiniciaría y las reservas se
// liberarían a horas equivocadas. Puedes cambiarla con la variable TZ.
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

function freshDB(){
  return {
    cfg:{
      raffleName: process.env.RAFFLE_NAME || 'DREAMS RIFA',
      slogan: process.env.SLOGAN || 'La suerte tambien se gana',
      currency: process.env.CURRENCY || 'COP',
      price: Number(process.env.PRICE || 5000),
      drawTime: process.env.DRAW_TIME || '20:00',
      releaseMinutes: Number(process.env.RELEASE_MINUTES || 0),
      // Premios (editables desde /admin). El primero es el premio mayor.
      prizes: [
        { label:'Ultimas dos cifras', amount:1400000, enabled:true },
        { label:'Primeras dos cifras', amount:100000, enabled:true },
        { label:'Cifras del medio', amount:100000, enabled:true },
        { label:'Cifras de union (primera y ultima)', amount:100000, enabled:true }
      ],
      // Pago por Bre-B / Nequi (QR + llave). Se configura desde /admin.
      breb:{
        enabled:false,
        llave:'',          // llave Bre-B (numero/alfanumerica) asociada a tu Nequi
        beneficiary:'',    // titular de la cuenta (ej: KEVIN CAMARGO)
        business:'',       // nombre del negocio (opcional)
        qrImage:'',        // imagen del QR de Nequi/Bre-B (data URL), la subes una vez
        requireReceipt:false // exigir que el cliente adjunte el comprobante
      }
    },
    date: today(),
    numbers: blankNumbers(),
    winner: null,
    history: []
  };
}
// ---- Guardado en la nube GRATIS (JSONBin) para que los datos NO se borren ----
// Si pones JSONBIN_BIN_ID y JSONBIN_KEY en las variables de entorno de Render,
// la informacion (configuracion, reservas, pagos, historial) se guarda en la
// nube gratis y sobrevive a los reinicios/dormidas del plan gratuito.
// Si no las pones, el servidor sigue funcionando usando solo el archivo local.
const RB_BIN = (process.env.JSONBIN_BIN_ID||'').trim();
const RB_KEY = (process.env.JSONBIN_KEY||'').trim();
const USE_REMOTE = !!(RB_BIN && RB_KEY);
const RB_URL = 'https://api.jsonbin.io/v3/b/' + RB_BIN;

async function remoteLoad(){
  if(!USE_REMOTE) return null;
  try{
    const r = await fetch(RB_URL+'/latest', { headers:{ 'X-Master-Key':RB_KEY } });
    if(!r.ok) return null;
    const data = await r.json();
    const rec = (data && data.record!==undefined) ? data.record : data;
    return (rec && rec.cfg) ? rec : null;
  }catch(e){ console.error('[nube] no se pudo leer:', e.message); return null; }
}
// Version liviana para la nube: quita los comprobantes (imagenes pesadas) que
// no necesitan sobrevivir a un reinicio, para no llenar el almacenamiento.
function slimForRemote(){
  const c = JSON.parse(JSON.stringify(db));
  if(c.numbers) for(const k in c.numbers){ if(c.numbers[k]) delete c.numbers[k].receipt; }
  if(Array.isArray(c.history)) c.history.forEach(h=>{ if(h&&h.participants) h.participants.forEach(p=>{ if(p) delete p.receipt; }); });
  return c;
}
async function remotePut(){
  if(!USE_REMOTE) return;
  try{
    await fetch(RB_URL, { method:'PUT',
      headers:{ 'Content-Type':'application/json', 'X-Master-Key':RB_KEY },
      body: JSON.stringify(slimForRemote()) });
  }catch(e){ console.error('[nube] no se pudo guardar:', e.message); }
}
function normalizeDB(){
  if(!db || !db.cfg) db = freshDB();
  if(!db.cfg.breb) db.cfg.breb = { enabled:false, llave:'', beneficiary:'', business:'', qrImage:'', requireReceipt:false };
  if(db.cfg.slogan==null) db.cfg.slogan = 'La suerte tambien se gana';
  if(!Array.isArray(db.cfg.prizes)) db.cfg.prizes = [
    { label:'Ultimas dos cifras', amount:1400000, enabled:true },
    { label:'Primeras dos cifras', amount:100000, enabled:true },
    { label:'Cifras del medio', amount:100000, enabled:true },
    { label:'Cifras de union (primera y ultima)', amount:100000, enabled:true }
  ];
  if(!db.numbers) db.numbers = blankNumbers();
  if(!db.date) db.date = today();
  if(!Array.isArray(db.history)) db.history = [];
}

let db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE,'utf8')) : freshDB();
normalizeDB();
let saveTimer=null, remoteTimer=null;
function save(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{ try{ fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); }catch(e){} },120);
  if(USE_REMOTE){ clearTimeout(remoteTimer); remoteTimer=setTimeout(remotePut,1500); }
}

/* ---------- Logica de dia / liberacion automatica ---------- */
function hmToMin(hm){ if(!hm) return null; const [h,m]=hm.split(':').map(Number); return h*60+m; }
function nowMin(){ const d=new Date(); return d.getHours()*60+d.getMinutes(); }

function checkNewDay(){
  if(db.date !== today()){
    archiveDay();
    db.date = today(); db.numbers = blankNumbers(); db.winner = null; save();
  }
}
function archiveDay(){
  const parts = Object.entries(db.numbers).filter(([,n])=>n.status!=='available')
    .map(([num,n])=>({num,...n}));
  if(parts.length===0 && !db.winner) return;
  const revenue = parts.filter(p=>p.status==='paid').length * (db.cfg.price||0);
  db.history.unshift({
    date:db.date, winner:db.winner,
    winnerBuyer: db.winner && db.numbers[db.winner] ? (db.numbers[db.winner].buyer||null) : null,
    participants:parts, revenue
  });
  db.history = db.history.slice(0,180);
}
// Libera reservas SIN pago, releaseMinutes antes del sorteo.
// NO libera las que el cliente ya marco "Ya transferi" (claimed): esas esperan
// la confirmacion manual del administrador.
function autoRelease(){
  const rel = db.cfg.releaseMinutes||0;
  if(rel<=0) return 0;                 // 0 = NUNCA liberar automáticamente (las reservas se mantienen)
  const dm = hmToMin(db.cfg.drawTime);
  if(dm==null) return 0;
  if(nowMin() < dm - rel) return 0;
  // Solo liberar dentro de la ventana [sorteo-rel, sorteo]; no después del sorteo.
  if(nowMin() > dm) return 0;
  let freed=0;
  for(const k in db.numbers){
    const n=db.numbers[k];
    if(n.status==='reserved' && !n.claimed){ db.numbers[k]={status:'available'}; freed++; }
  }
  if(freed>0) save();
  return freed;
}
// Tareas periodicas en el servidor (independiente de que haya alguien conectado)
setInterval(()=>{ checkNewDay(); autoRelease(); }, 30000);

/* ---------- Mercado Pago ---------- */
// Crea una preferencia de pago y devuelve el link (init_point)
async function mpCreatePreference(numKey, buyer){
  if(!MP_TOKEN) throw new Error('Falta MP_ACCESS_TOKEN en el .env');
  const ref = db.date + '#' + numKey;
  const body = {
    items:[{
      title: db.cfg.raffleName + ' - numero ' + numKey + ' (' + db.date + ')',
      quantity:1, currency_id: db.cfg.currency || 'COP',
      unit_price: Number(db.cfg.price)||0
    }],
    external_reference: ref,
    notification_url: PUBLIC_URL + '/api/webhook/mp',
    back_urls:{
      success: PUBLIC_URL + '/?pago=ok&n=' + numKey,
      pending: PUBLIC_URL + '/?pago=pendiente&n=' + numKey,
      failure: PUBLIC_URL + '/?pago=error&n=' + numKey
    },
    auto_return:'approved'
  };
  const r = await fetch('https://api.mercadopago.com/checkout/preferences',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+MP_TOKEN},
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if(!r.ok) throw new Error('MP preferencia: '+(data.message||r.status));
  return data.init_point;
}
// Consulta el estado real de un pago en Mercado Pago
async function mpGetPayment(paymentId){
  const r = await fetch('https://api.mercadopago.com/v1/payments/'+paymentId,{
    headers:{'Authorization':'Bearer '+MP_TOKEN}
  });
  return r.ok ? r.json() : null;
}

/* ============================================================
   SERVIDOR HTTP
   ============================================================ */
const app = express();
app.use(express.json({limit:'6mb'}));
app.use(express.urlencoded({extended:true, limit:'6mb'}));

// Vista publica del estado (sin datos personales de los compradores)
function publicState(){
  checkNewDay(); autoRelease();
  const nums={};
  for(const k in db.numbers) nums[k] = { status: db.numbers[k].status };
  const dm=hmToMin(db.cfg.drawTime);
  const b=db.cfg.breb||{};
  return {
    cfg:{ raffleName:db.cfg.raffleName, slogan:db.cfg.slogan, currency:db.cfg.currency, price:db.cfg.price,
          drawTime:db.cfg.drawTime, releaseMinutes:db.cfg.releaseMinutes,
          prizes:(Array.isArray(db.cfg.prizes)?db.cfg.prizes:[]).filter(p=>p&&p.enabled)
                   .map(p=>({label:p.label,amount:p.amount})),
          releaseAt: dm==null?null:((dm-(db.cfg.releaseMinutes||0)+1440)%1440),
          breb: (b.enabled ? { enabled:true, llave:b.llave, beneficiary:b.beneficiary,
                 business:b.business, qrImage:b.qrImage, requireReceipt:!!b.requireReceipt } : {enabled:false}) },
    date:db.date, numbers:nums, winner:db.winner, mp: !!MP_TOKEN
  };
}

/* ---------- API PUBLICA (cliente) ---------- */
app.get('/api/state', (req,res)=> res.json(publicState()));

// El cliente reserva un numero.
//  - method 'online' -> Mercado Pago (devuelve payUrl)
//  - method 'breb'   -> Bre-B/Nequi (devuelve datos del QR + llave)
//  - method 'manual' -> pago directo coordinado con el admin
app.post('/api/reserve', async (req,res)=>{
  checkNewDay(); autoRelease();
  const key = pad(parseInt(req.body.number,10));
  const buyer = (req.body.buyer||'').toString().trim().slice(0,60);
  const phone = (req.body.phone||'').toString().trim().slice(0,30);
  let method = req.body.method || (req.body.online?'online':'manual');
  if(!['online','breb','manual'].includes(method)) method='manual';
  if(method==='online' && !MP_TOKEN) method='manual';
  if(method==='breb' && !(db.cfg.breb && db.cfg.breb.enabled)) method='manual';
  if(!/^\d{2}$/.test(key) || !db.numbers[key]) return res.status(400).json({error:'Numero invalido'});
  if(!buyer) return res.status(400).json({error:'Escribe tu nombre'});
  if(db.numbers[key].status!=='available') return res.status(409).json({error:'Ese numero ya no esta disponible'});

  db.numbers[key] = { status:'reserved', buyer, phone, method, reservedAt:Date.now() };
  save();

  if(method==='online'){
    try{
      const link = await mpCreatePreference(key, buyer);
      db.numbers[key].mpPending = true; save();
      return res.json({ ok:true, number:key, method, payUrl:link });
    }catch(e){
      db.numbers[key].method='manual'; save();
      return res.json({ ok:true, number:key, method:'manual', payUrl:null, warn:'No se pudo generar el pago en linea: '+e.message });
    }
  }
  if(method==='breb'){
    const b=db.cfg.breb;
    return res.json({ ok:true, number:key, method, payUrl:null,
      breb:{ llave:b.llave, beneficiary:b.beneficiary, business:b.business,
             qrImage:b.qrImage, amount:db.cfg.price, currency:db.cfg.currency,
             requireReceipt:!!b.requireReceipt } });
  }
  res.json({ ok:true, number:key, method:'manual', payUrl:null });
});

// El cliente declara "Ya transferi" (opcionalmente adjunta comprobante).
// El numero queda reservado + marcado como "por confirmar" y NO se libera solo.
app.post('/api/claim', (req,res)=>{
  const key = pad(parseInt(req.body.number,10));
  const n = db.numbers[key];
  if(!n || n.status==='available') return res.status(400).json({error:'Ese numero no tiene reserva activa'});
  if(n.status==='paid') return res.json({ok:true, already:true});
  n.claimed = true; n.claimedAt = Date.now();
  const rc = (req.body.receipt||'').toString();
  if(rc && rc.startsWith('data:image') && rc.length < 6*1024*1024) n.receipt = rc;
  save();
  res.json({ok:true});
});

// Webhook de Mercado Pago: confirma el pago automaticamente
app.post('/api/webhook/mp', async (req,res)=>{
  res.sendStatus(200); // responder rapido
  try{
    const type = req.query.type || req.body.type;
    const payId = (req.query['data.id']) || (req.body.data && req.body.data.id);
    if(type!=='payment' || !payId) return;
    const pay = await mpGetPayment(payId);
    if(!pay) return;
    const ref = pay.external_reference || '';
    const key = ref.split('#')[1];
    if(pay.status==='approved' && key && db.numbers[key]){
      db.numbers[key].status='paid';
      db.numbers[key].paidAt=Date.now();
      db.numbers[key].mpPaymentId=payId;
      delete db.numbers[key].mpPending;
      save();
      console.log('[PAGO APROBADO] numero', key, 'pago', payId);
    }
  }catch(e){ console.error('webhook error', e.message); }
});

// El cliente puede consultar si su numero ya quedo pagado
app.get('/api/status/:num', (req,res)=>{
  const key=pad(parseInt(req.params.num,10));
  const n=db.numbers[key];
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

// Estado completo con datos de compradores
app.get('/api/admin/state', auth, (req,res)=>{
  checkNewDay(); autoRelease();
  res.json({ cfg:db.cfg, date:db.date, numbers:db.numbers, winner:db.winner, history:db.history, mp:!!MP_TOKEN });
});

app.post('/api/admin/mark-paid', auth, (req,res)=>{
  const k=pad(parseInt(req.body.number,10));
  if(!db.numbers[k] || db.numbers[k].status==='available') return res.status(400).json({error:'Numero sin reserva'});
  db.numbers[k].status='paid'; db.numbers[k].paidAt=Date.now(); delete db.numbers[k].claimed; save();
  res.json({ok:true});
});
app.post('/api/admin/mark-unpaid', auth, (req,res)=>{
  const k=pad(parseInt(req.body.number,10));
  if(db.numbers[k]){ db.numbers[k].status='reserved'; delete db.numbers[k].paidAt; save(); }
  res.json({ok:true});
});
app.post('/api/admin/release', auth, (req,res)=>{
  const k=pad(parseInt(req.body.number,10));
  if(db.numbers[k]){ db.numbers[k]={status:'available'}; save(); }
  res.json({ok:true});
});
app.post('/api/admin/reserve', auth, (req,res)=>{
  const k=pad(parseInt(req.body.number,10));
  if(!db.numbers[k] || db.numbers[k].status!=='available') return res.status(409).json({error:'No disponible'});
  db.numbers[k]={status:'reserved', buyer:(req.body.buyer||'').slice(0,60), phone:(req.body.phone||'').slice(0,30),
    method:'manual', note:(req.body.note||'').slice(0,200), reservedAt:Date.now()};
  save(); res.json({ok:true});
});
app.post('/api/admin/config', auth, (req,res)=>{
  const b=req.body;
  db.cfg.raffleName = (b.raffleName||db.cfg.raffleName).slice(0,60);
  if(b.slogan!=null) db.cfg.slogan = String(b.slogan).slice(0,120);
  if(Array.isArray(b.prizes)){
    db.cfg.prizes = b.prizes.slice(0,4).map(p=>({
      label: String((p&&p.label)||'').slice(0,60),
      amount: Number((p&&p.amount)||0)||0,
      enabled: !!(p&&p.enabled)
    }));
  }
  if(b.price!=null) db.cfg.price = Number(b.price)||0;
  if(b.currency) db.cfg.currency = b.currency.slice(0,6);
  if(b.drawTime) db.cfg.drawTime = b.drawTime;
  if(b.releaseMinutes!=null) db.cfg.releaseMinutes = Number(b.releaseMinutes)||0;
  if(b.breb){
    const cur = db.cfg.breb || {};
    db.cfg.breb = {
      enabled: !!b.breb.enabled,
      llave: (b.breb.llave!=null?b.breb.llave:cur.llave||'').toString().slice(0,40),
      beneficiary: (b.breb.beneficiary!=null?b.breb.beneficiary:cur.beneficiary||'').toString().slice(0,80),
      business: (b.breb.business!=null?b.breb.business:cur.business||'').toString().slice(0,80),
      requireReceipt: !!b.breb.requireReceipt,
      qrImage: cur.qrImage||''
    };
    // qrImage: solo se reemplaza si envian una nueva; '' explicito la borra
    if(typeof b.breb.qrImage === 'string'){
      if(b.breb.qrImage===''){ db.cfg.breb.qrImage=''; }
      else if(b.breb.qrImage.startsWith('data:image') && b.breb.qrImage.length < 6*1024*1024){ db.cfg.breb.qrImage=b.breb.qrImage; }
    }
  }
  save(); res.json({ok:true, cfg:db.cfg});
});
app.post('/api/admin/draw', auth, (req,res)=>{
  let win;
  if(req.body.number!=null && req.body.number!==''){
    win = pad(parseInt(req.body.number,10)%100);
  } else {
    let pool = Object.keys(db.numbers);
    if(req.body.onlyPaid){ pool = pool.filter(k=>db.numbers[k].status==='paid'); }
    if(pool.length===0) return res.status(400).json({error:'Sin numeros para sortear'});
    win = pool[Math.floor(Math.random()*pool.length)];
  }
  db.winner=win; save();
  res.json({ok:true, winner:win, buyer: db.numbers[win]?.buyer||null, status: db.numbers[win]?.status||'available'});
});
app.post('/api/admin/clear-winner', auth, (req,res)=>{ db.winner=null; save(); res.json({ok:true}); });
app.post('/api/admin/new-day', auth, (req,res)=>{
  archiveDay(); db.numbers=blankNumbers(); db.winner=null; db.date=today(); save(); res.json({ok:true});
});

/* ---------- Vistas estaticas ---------- */
// Busca un archivo primero en la raiz y luego en /public (soporta ambas estructuras)
function resolvePage(name){
  const root = path.join(__dirname, name);
  const pub  = path.join(__dirname, 'public', name);
  if (fs.existsSync(root)) return root;
  if (fs.existsSync(pub))  return pub;
  return root;
}
// Sirve archivos estaticos desde /public y desde la raiz, si existen
try { if (fs.existsSync(path.join(__dirname,'public'))) app.use(express.static(path.join(__dirname,'public'))); } catch(e){}
app.get('/', (req,res)=> res.sendFile(resolvePage('index.html')));
app.get('/admin', (req,res)=> res.sendFile(resolvePage('admin.html')));

(async ()=>{
  if(USE_REMOTE){
    const remote = await remoteLoad();
    if(remote){ db = remote; normalizeDB(); console.log('[nube] datos cargados desde la nube (JSONBin)'); }
    else { console.log('[nube] sin datos previos en la nube; se inicia con estado nuevo'); }
  }
  save(); // crea el archivo local y, si aplica, sube el estado inicial a la nube
  app.listen(PORT, '0.0.0.0', ()=>{
    console.log('Rifa Diaria corriendo en puerto '+PORT);
    console.log(' - Cliente: '+PUBLIC_URL+'/');
    console.log(' - Admin:   '+PUBLIC_URL+'/admin');
    console.log(' - Mercado Pago: '+(MP_TOKEN?'ACTIVO':'NO configurado (solo pago manual)'));
    console.log(' - Bre-B/Nequi: '+((db.cfg.breb&&db.cfg.breb.enabled)?'ACTIVO':'desactivado (se activa en /admin)'));
    console.log(' - Guardado en la nube (JSONBin): '+(USE_REMOTE?'ACTIVO':'desactivado'));
  });
})();


