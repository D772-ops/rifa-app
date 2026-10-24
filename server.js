// =====================================================================
// DREAMS RIFA - servidor Express
// - Sirve el editor (solo para el ADMINISTRADOR, con login)
// - Sirve una vista PUBLICA de solo lectura en /ver
// - Guarda el estado del sorteo para que la gente lo vea
// Todo el cobro y la reserva se coordinan por WhatsApp.
// =====================================================================
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Usuario y contrasena (se configuran en Render como variables de entorno) ----
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'dreams2026';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dreams-rifa-secreto-cambia-esto';

// Render corre detras de un proxy (https). Esto hace que las cookies funcionen bien.
app.set('trust proxy', 1);

app.use(express.json({ limit: '12mb' }));           // para /api/state (puede traer imagenes en base64)
app.use(express.urlencoded({ extended: true }));    // para el formulario de login

app.use(session({
  name: 'dreams.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 } // 8 horas
}));

// ---------- Estado del sorteo (lo que ve la vista publica) ----------
const DATA_FILE = path.join(__dirname, 'rifa_state.json');
let estado = null;
try { if (fs.existsSync(DATA_FILE)) estado = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { estado = null; }
function guardarEstado() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(estado)); } catch (e) { /* en Render el disco es temporal, no pasa nada */ }
}

// ---------- Middleware: exige estar logueado ----------
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/login');
}
function requireApiAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ ok: false, error: 'No autorizado' });
}

// ---------- Archivos publicos (fondos y stickers) ----------
app.use('/fondos', express.static(path.join(__dirname, 'public', 'fondos')));
app.use('/stickers', express.static(path.join(__dirname, 'public', 'stickers')));

// ---------- Login ----------
app.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.post('/login', (req, res) => {
  const u = (req.body.usuario || '').trim();
  const p = (req.body.clave || '');
  if (u === ADMIN_USER && p === ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.redirect('/');
  }
  res.redirect('/login?error=1');
});
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ---------- Editor (solo admin) ----------
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- Vista publica de solo lectura ----------
app.get('/ver', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'view.html'));
});

// ---------- API de estado ----------
// Leer (publico): lo usa la vista /ver
app.get('/api/state', (req, res) => {
  res.json({ ok: true, estado: estado });
});
// Guardar (solo admin): lo usa el editor al pulsar "Guardar y publicar"
app.post('/api/state', requireApiAuth, (req, res) => {
  estado = req.body && req.body.estado ? req.body.estado : null;
  guardarEstado();
  res.json({ ok: true });
});

// ---------- Salud (para Render) ----------
app.get('/health', (req, res) => res.send('ok'));

app.listen(PORT, () => {
  console.log('DREAMS RIFA corriendo en el puerto ' + PORT);
});
