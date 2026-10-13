# 🚀 Despliegue en 1 clic — Rifa Diaria

Esta es la forma MÁS FÁCIL de poner tu rifa en Internet con tu propia URL.
Incluye un botón “Deploy to Render”: casi todo se configura solo.

Solo tienes que hacer **dos cosas una vez**: subir el código a GitHub y pulsar el botón.

---

## Paso 1 · Sube el código a GitHub (5 min)

El botón necesita que el código esté en un repositorio **público** de GitHub.

1. Entra a <https://github.com> y crea una cuenta (gratis).
2. Pulsa **New repository**.
   - **Repository name:** `rifa-app`
   - Marca **Public** (importante: debe ser público para que el botón funcione).
   - Pulsa **Create repository**.
3. En la página del repo vacío pulsa el enlace **uploading an existing file**.
4. Descomprime el `rifa-app.zip` que te entregué y **arrastra TODOS los archivos**
   (todos los archivos quedan sueltos: server.js, admin.html, index.html, package.json, package-lock.json, render.yaml, etc. — NO hay carpetas).
   - **No subas** `node_modules` ni `db.json` si llegaran a aparecer.
5. Pulsa **Commit changes**.

> Resultado: tu código queda en `https://github.com/TU_USUARIO/rifa-app`
> (reemplaza `TU_USUARIO` por tu usuario real de GitHub).

---

## Paso 2 · Pulsa el botón de despliegue (3 min)

Abre esta dirección en tu navegador, **cambiando `TU_USUARIO`** por tu usuario de GitHub:

```
https://render.com/deploy?repo=https://github.com/TU_USUARIO/rifa-app
```

Ejemplo: si tu usuario es `juanperez`, la dirección sería
`https://render.com/deploy?repo=https://github.com/juanperez/rifa-app`

Al abrirla:

1. Inicia sesión en Render con tu cuenta de GitHub (gratis).
2. Render leerá el archivo `render.yaml` y mostrará todo preconfigurado.
3. Solo te pedirá **escribir tu clave de administrador** (campo `ADMIN_PASSWORD`).
   Pon una contraseña buena: es la que usarás para entrar a `/admin`.
   - El campo `MP_ACCESS_TOKEN` déjalo **vacío** por ahora (es opcional, para
     cobro automático con Mercado Pago; puedes añadirlo después).
4. Pulsa **Apply** / **Create** y espera 1–2 minutos a que diga **Live**.

¡Y ya! Render te dará tu URL, algo como:

```
https://rifa-diaria-xxxx.onrender.com
```

> La app detecta esa dirección sola, no tienes que configurar nada más.

---

## Paso 3 · Entra y configura tu rifa (2 min)

1. Abre `https://TU-URL.onrender.com/admin`
2. Escribe la clave que pusiste en el paso anterior.
3. Ve a **⚙️ Config → 💳 Pago Bre-B / Nequi**:
   - Activa la casilla.
   - Escribe tu **llave** Bre-B y el **titular**.
   - **Sube la imagen del QR** que genera tu app Nequi (una sola vez).
   - Guarda.
4. Comparte con tus clientes la dirección principal: `https://TU-URL.onrender.com/`

---

## Como insertar el botón en tu propia página (opcional)

Si quieres el botón visual “Deploy to Render” en el README de tu GitHub,
pega esto (cambiando `TU_USUARIO`):

```markdown
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/TU_USUARIO/rifa-app)
```

---

## Cosas importantes a recordar

- **Plan gratis:** la app “duerme” tras unos minutos sin visitas y tarda ~30 s en
  despertar la primera vez. Para una rifa con tráfico, el plan de pago más barato
  la mantiene siempre despierta.
- **Respaldo de datos:** en el plan gratis los datos pueden borrarse al reiniciar.
  Usa cada día el botón **“Cerrar día y empezar nuevo”** y exporta el **CSV** de
  participantes como copia de seguridad.
- **Dominio propio:** si luego compras un dominio, puedes conectarlo en Render
  (Settings → Custom Domains); el HTTPS es automático y gratis.

---

## Si algo falla

- Verifica que el repositorio de GitHub sea **Public** y contenga `render.yaml`.
- Si el despliegue falla, en Render abre la pestaña **Logs** para ver el error.
- Asegúrate de haber subido `package.json` y `package-lock.json`.

---

### Aviso legal
Las rifas con premio en dinero suelen estar **reguladas** en Colombia
(Coljuegos y normativa local). Verifica los permisos que necesitas antes de
operar con dinero real.
