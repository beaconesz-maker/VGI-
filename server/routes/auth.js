/**
 * server/routes/auth.js — login/logout/me (VGI+).
 *
 * Cuentas locales: no hay auto-registro (regla del documento maestro — un
 * administrador local da de alta a los clínicos con
 * `scripts/create-user.js`). POST /api/auth/login es la única ruta /api
 * que no exige sesión previa.
 */
'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const store = require('../store');
const { sanitizeUser } = require('../lib/sanitize');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'credenciales_invalidas', mensaje: 'Usuario y contraseña son obligatorios.' });
  }
  const users = await store.users.list();
  const user = users.find((u) => u.username === username);
  if (!user || user.activo === false) {
    return res.status(401).json({ error: 'credenciales_invalidas', mensaje: 'Usuario o contraseña incorrectos.' });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'credenciales_invalidas', mensaje: 'Usuario o contraseña incorrectos.' });
  }
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'error_sesion', mensaje: 'No se pudo iniciar sesión.' });
    req.session.userId = user.id;
    res.json({ user: sanitizeUser(user) });
  });
});

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.status(204).end();
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

module.exports = router;
