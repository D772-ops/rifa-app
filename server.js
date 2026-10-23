// DREAMS RIFA - servidor Express
// Sirve el editor de tableros. Todo el flujo de pagos/reservas es por WhatsApp.
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Archivos de la pagina (carpeta public)
app.use(express.static(path.join(__dirname, 'public')));

// Pagina principal = editor DREAMS RIFA
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ruta de salud para Render
app.get('/health', (req, res) => res.send('ok'));

app.listen(PORT, () => {
  console.log('DREAMS RIFA corriendo en el puerto ' + PORT);
});
