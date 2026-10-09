# Guía de despliegue — Rifa Diaria

Esta guía te deja la app funcionando en Internet con **tu propia URL** (https), gratis o muy barato. Usamos **Render** porque es lo más sencillo para una app Node, pero al final hay alternativas.

---

## 0. Qué vas a lograr

- Una dirección web tuya, por ejemplo: `https://mi-rifa.onrender.com` (o un dominio propio tipo `https://rifadiaria.com`).
- Dos páginas:
  - **Clientes:** `https://TU-URL/` — eligen número y pagan.
  - **Admin (tú):** `https://TU-URL/admin` — entras con tu clave y gestionas todo.

---

## 1. Antes de empezar — ten a mano

1. **Tu clave de administrador** (la inventas tú; es la contraseña para entrar a `/admin`).
2. **El QR de tu Nequi** (lo subes después desde el panel, no hace falta ahora).
3. (Opcional) El **token de Mercado Pago** si quieres cobro automático con tarjeta/PSE.
4. Una cuenta de **GitHub** (gratis) y una de **Render** (gratis). Puedes crear la de Render entrando con tu GitHub.

---

## 2. Subir el código a GitHub

**Opción A — con la web de GitHub (sin instalar nada):**

1. Entra a <https://github.com> y crea una cuenta.
2. Botón **New repository** → nombre `rifa-app` → **Private** → **Create**.
3. En la página del repo vacío, pulsa **uploading an existing file**.
4. Descomprime el `rifa-app.zip` que te entregué y **arrastra todos los archivos** (server.js, package.json, la carpeta `public`, etc.). **No subas** la carpeta `node_modules` ni el archivo `db.json` si aparecen.
5. **Commit changes**.

**Opción B — con Git (si sabes usarlo):**
```bash
git init
git add .
git commit -m "Rifa diaria"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/rifa-app.git
git push -u origin main
```

---

## 3. Crear el servicio en Render

1. Entra a <https://render.com> → **Get Started** → inicia sesión con GitHub.
2. Botón **New +** → **Web Service**.
3. Elige el repositorio `rifa-app` que acabas de subir → **Connect**.
4. Rellena:
   - **Name:** `mi-rifa` (esto define tu URL: `mi-rifa.onrender.com`).
   - **Region:** la más cercana (ej. *Oregon* o *Ohio*).
   - **Branch:** `main`.
   - **Runtime:** `Node`.
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** `Free` (suficiente para empezar).

> ⚠️ El plan **Free** de Render "duerme" la app tras unos minutos sin uso y tarda ~30 s en despertar en la primera visita. Para una rifa diaria con tráfico, considera el plan más barato de pago para que esté siempre despierta.

---

## 4. Variables de entorno (MUY importante)

En Render, dentro de tu servicio → pestaña **Environment** → **Add Environment Variable**. Agrega estas:

| Clave | Valor | ¿Obligatoria? |
|---|---|---|
| `ADMIN_PASSWORD` | *tu clave secreta de admin* | ✅ Sí |
| `PUBLIC_URL` | `https://mi-rifa.onrender.com` (tu URL real) | ✅ Sí |
| `NODE_VERSION` | `18` | ✅ Sí (el cobro MP necesita Node 18+) |
| `MP_ACCESS_TOKEN` | *token de Mercado Pago* | Opcional (solo si quieres cobro automático) |
| `PORT` | *(no la pongas)* | ❌ Render la asigna sola |

Guarda. Render volverá a desplegar automáticamente.

> `PUBLIC_URL` debe coincidir EXACTO con tu dirección final (con `https://` y **sin** barra `/` al final). Mercado Pago la usa para redirigir al cliente después de pagar.

---

## 5. Primer arranque y prueba

1. Cuando Render muestre **Live**, abre tu URL: `https://mi-rifa.onrender.com/`.
2. Entra al panel: `https://mi-rifa.onrender.com/admin` → escribe tu `ADMIN_PASSWORD`.
3. Ve a **⚙️ Config**:
   - Ajusta nombre de la rifa, precio, moneda (COP), hora del sorteo.
   - En **💳 Pago Bre-B / Nequi**: activa la casilla, escribe tu **llave** y **titular**, y **sube la imagen del QR** que genera tu app Nequi. Guarda.
4. Abre la vista de cliente en otra pestaña y haz una reserva de prueba con Bre-B para ver que aparece el QR y el botón **"Ya transferí"**.

---

## 6. (Opcional) Usar tu propio dominio

Si compraste un dominio (ej. en Namecheap, GoDaddy, etc.):

1. En Render → tu servicio → **Settings** → **Custom Domains** → **Add Custom Domain**.
2. Escribe tu dominio (`rifadiaria.com` o `www.rifadiaria.com`).
3. Render te dará un registro **CNAME** (o A). Cópialo en el panel DNS de donde compraste el dominio.
4. Espera a que verifique (minutos u horas). Render pone el **HTTPS gratis** automáticamente.
5. **Actualiza** la variable `PUBLIC_URL` a tu nuevo dominio y guarda.

---

## 7. Nota sobre los datos (importante)

La app guarda todo en un archivo `db.json` en el servidor. En el plan Free de Render **el disco se borra en cada reinicio/despliegue**, así que podrías perder reservas del día.

Para producción real tienes dos caminos:
- **Fácil:** añade un **Disk** persistente en Render (Settings → Disks) montado en la carpeta de la app, para que `db.json` sobreviva.
- **Cada mañana** usas el botón **"Cerrar día y empezar nuevo"** y exportas el **CSV** de participantes como respaldo.

---

## 8. Alternativas a Render

- **Railway** (<https://railway.app>): muy parecido, también con URL propia.
- **Fly.io**: más control, requiere instalar su CLI.
- **Un VPS** (DigitalOcean, Hetzner): más barato a largo plazo pero tienes que administrar el servidor tú.

En todos el principio es igual: `npm install` + `node server.js` + las mismas variables de entorno + Node 18 o superior.

---

## 9. Resumen rápido

1. Sube el código a GitHub.
2. Render → New Web Service → conecta el repo.
3. Build: `npm install` · Start: `node server.js`.
4. Variables: `ADMIN_PASSWORD`, `PUBLIC_URL`, `NODE_VERSION=18` (y `MP_ACCESS_TOKEN` si usas Mercado Pago).
5. Abre `/admin`, configura precio y **sube tu QR de Nequi**.
6. ¡Listo! Comparte tu URL con los clientes.

---

### Aviso legal
Las rifas y sorteos con premio en dinero suelen estar **reguladas** en Colombia (Coljuegos y normativa local). Antes de operar con dinero real, verifica los permisos que necesitas en tu municipio/departamento para no tener problemas legales.
