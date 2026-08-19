/**
 * server/middleware/requireAuth.js — exige sesión válida (VGI+).
 *
 * Todas las rutas /api/* excepto /api/auth/login la usan (contrato en
 * docs/API_CONTRACT.md). Si no hay sesión, 401 {error:"no_autenticado"}.
 * Si la sesión apunta a un usuario que ya no existe o está desactivado,
 * se trata igual que "no autenticado" (no se destruye la sesión aquí para
 * no acoplar esta capa a la implementación de express-session).
 */
'use strict';

const store = require('../store');

function noAutenticado(res) {
  return res.status(401).json({ error: 'no_autenticado', mensaje: 'Debe iniciar sesión.' });
}

async function requireAuth(req, res, next) {
  const userId = req.session && req.session.userId;
  if (!userId) return noAutenticado(res);
  const user = await store.users.get(userId);
  if (!user || user.activo === false) return noAutenticado(res);
  req.user = user;
  next();
}

/** Exige además rol admin (para acciones restringidas). */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'permiso_denegado', mensaje: 'Requiere rol de administrador.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
