/**
 * server/index.js — punto de entrada del backend VGI+.
 *
 * Un único proceso Node/Express, puente entre la app y los datos (regla no
 * negociable del documento maestro). Sirve la API bajo /api, el frontend
 * estático de public/ en / y el motor clínico de shared/ en /shared (para
 * que el navegador pueda hacer <script src="/shared/scales.js">).
 */
'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');

const jsonStore = require('./store/jsonStore');
const { asegurarBackupHoy } = require('./lib/backup');
const { requireAuth } = require('./middleware/requireAuth');

const authRoutes = require('./routes/auth');
const patientsRoutes = require('./routes/patients');
const scalesRoutes = require('./routes/scales');
const recordsRoutes = require('./routes/records');
const morfoRoutes = require('./routes/morfo');
const clinicalRoutes = require('./routes/clinical');
const planRoutes = require('./routes/plan');
const exportRoutes = require('./routes/export');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PORT = process.env.PORT || 3000;
const UNA_HORA_MS = 60 * 60 * 1000;

const app = express();

app.use(express.json());

// Sesión en memoria del propio proceso (suficiente para ~100 usuarios en
// red local, sin necesidad de Redis ni de nada externo). Cookie httpOnly y
// sameSite:'lax' porque el sitio se sirve como primera parte desde el
// mismo origen que lo consume. IMPORTANTE: si el hospital llega a
// desplegar esto detrás de HTTPS real, hay que añadir `secure: true` a la
// cookie (si no, los navegadores modernos pueden rechazar sameSite=lax
// sin secure en algunos escenarios, y en cualquier caso es buena
// práctica no negociable en producción con HTTPS).
app.use(
  session({
    name: 'vgiplus.sid',
    secret: process.env.SESSION_SECRET || 'vgi-plus-hospital-san-juan-grande-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // secure: true, // ← activar si se sirve por HTTPS real
      maxAge: 12 * 60 * 60 * 1000, // 12 h
    },
  })
);

// --- API -------------------------------------------------------------
// /api/auth/login es la única ruta /api que no exige sesión (login,
// logout y me se gestionan dentro de auth.js con su propio requireAuth
// donde corresponde). El resto de /api/* exige sesión válida.
app.use('/api/auth', authRoutes);
app.use('/api', requireAuth);
app.use('/api/patients/:id/records', recordsRoutes);
app.use('/api/patients/:id/morfo', morfoRoutes);
app.use('/api/patients/:id/clinical', clinicalRoutes);
app.use('/api/patients/:id/plan', planRoutes);
app.use('/api/patients/:id/export', exportRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/scales', scalesRoutes);

// 404 uniforme para cualquier /api/* no reconocida
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'ruta_no_encontrada', mensaje: 'Ruta de API no encontrada.' });
});

// --- Estático ----------------------------------------------------------
app.use('/shared', express.static(path.join(ROOT_DIR, 'shared')));
app.use(express.static(path.join(ROOT_DIR, 'public')));

// --- Arranque ------------------------------------------------------------

function asegurarUsersJsonInicial() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    jsonStore.writeJson(USERS_FILE, []);
    console.log('[VGI+] data/users.json creado vacío (sin usuario por defecto, por seguridad).');
    console.log('[VGI+] Ejecute "npm run seed:admin" para dar de alta el primer usuario administrador.');
  }
}

function iniciarBackupsAutomaticos() {
  asegurarBackupHoy(DATA_DIR, BACKUPS_DIR);
  setInterval(() => {
    try {
      asegurarBackupHoy(DATA_DIR, BACKUPS_DIR);
    } catch (err) {
      console.error('[backup] error al comprobar/crear la copia de seguridad:', err.message);
    }
  }, UNA_HORA_MS);
}

function iniciar() {
  asegurarUsersJsonInicial();
  iniciarBackupsAutomaticos();
  app.listen(PORT, () => {
    console.log(`[VGI+] Servidor escuchando en http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  iniciar();
}

module.exports = app;
