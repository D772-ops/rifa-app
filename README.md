# Rifa Diaria 00–99 — con cobro en línea y vista de cliente

App web para gestionar una rifa diaria de dos cifras (del 00 al 99). Tiene **dos vistas separadas**:

- **Cliente** → `https://TU-DOMINIO/`  
  El cliente solo ve los números, elige uno libre, deja su nombre y paga. **No puede configurar nada.**
- **Administrador** → `https://TU-DOMINIO/admin`  
  Protegida con clave. Desde aquí configuras precio/hora, marcas pagos manuales, haces el sorteo, ves participantes e historial.

El **pago en línea se confirma automáticamente** mediante Mercado Pago: cuando el pago queda aprobado, el servidor recibe un aviso (webhook) y marca el número como *pagado* sin que tengas que hacer nada.

Las reservas **sin pago se liberan solas** los minutos que configures antes del sorteo (por defecto 60).

---

## 1) Requisitos
- Node.js 18 o superior.
- Una cuenta de **Mercado Pago** (opcional pero necesaria para el cobro automático).

## 2) Instalación
```bash
npm install
cp .env.example .env     # luego edita .env con tus datos
npm start
```
Abre:
- Cliente: http://localhost:3000/
- Admin:   http://localhost:3000/admin  (usa la clave de `ADMIN_PASSWORD`)

## 3) Configurar el cobro automático (Mercado Pago)
1. Entra a https://www.mercadopago.com → **Tu negocio → Credenciales**.
2. Copia el **Access Token** (de prueba para testear, de producción para cobrar de verdad).
3. Pégalo en `.env` en `MP_ACCESS_TOKEN`.
4. Pon en `PUBLIC_URL` la URL pública real de tu app (la de tu hosting). Mercado Pago
   necesita esa URL para avisar del pago; **no funciona con `localhost`** porque
   internet no puede alcanzar tu PC.

### ¿Cómo tener una URL pública?
Lo más simple es desplegar en un hosting gratuito/económico de Node, por ejemplo
**Render**, **Railway** o **Fly.io**. Al desplegar te dan una URL del tipo
`https://mirifa.onrender.com`; esa va en `PUBLIC_URL`. Sube las variables del `.env`
como “Environment Variables” del servicio.

Si solo quieres **probar** el webhook desde tu PC, puedes usar un túnel como
`ngrok` (`ngrok http 3000`) y poner la URL que te da en `PUBLIC_URL`. Es solo para
pruebas tuyas, no para producción.

> Si **no** configuras Mercado Pago, la app funciona igual pero solo con **pago
> manual**: el cliente reserva y tú confirmas el pago desde `/admin`.

## 4) Seguridad (importante)
- Cambia `ADMIN_PASSWORD` por una clave fuerte. La vista `/admin` queda protegida por
  esa clave; la vista de cliente nunca muestra datos personales de otros ni permite configurar.
- Usa siempre **HTTPS** en producción (los hostings mencionados lo dan automático).
- No subas tu archivo `.env` a repositorios públicos.

## 5) Datos
- Todo se guarda en `db.json` (se crea solo). Haz copias de ese archivo para respaldar,
  o usa **Exportar CSV** desde Participantes.
- El cambio de día es automático: al llegar una fecha nueva, el día anterior se archiva
  en el historial y el tablero se reinicia. También puedes hacerlo manualmente en el menú.

## 6) Nota legal
Según tu país, las rifas/sorteos con premio en dinero pueden requerir permisos o licencia.
Revisa la normativa local antes de operar.

---

## Estructura
```
rifa-app/
  server.js            # servidor + API + webhook de pagos
  package.json
  .env.example         # copia a .env y completa
  public/
    index.html         # vista CLIENTE (sin configuración)
    admin.html         # vista ADMIN (con clave)
  db.json              # se crea al ejecutar (base de datos)
```
