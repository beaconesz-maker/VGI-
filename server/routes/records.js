/**
 * server/routes/records.js — registro de escalas por paciente (VGI+).
 *
 * `resultado` lo calcula SIEMPRE el servidor llamando a
 * shared/scales.js:interpretar() — nunca se confía en una puntuación que
 * llegue ya calculada desde el navegador (docs/API_CONTRACT.md).
 */
'use strict';

const express = require('express');
const scales = require('../../shared/scales.js');
const store = require('../store');
const { edadAnios } = require('../lib/edad');

const router = express.Router({ mergeParams: true });

async function cargarPaciente(req, res, next) {
  const patient = await store.patients.get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'paciente_no_encontrado', mensaje: 'Paciente no encontrado.' });
  req.patient = patient;
  next();
}

router.use(cargarPaciente);

router.get('/', async (req, res) => {
  const { escalaId, from, to } = req.query;
  const all = await store.records.list();
  let filtrados = all.filter((r) => r.patientId === req.params.id);
  if (escalaId) filtrados = filtrados.filter((r) => r.escalaId === escalaId);
  if (from) filtrados = filtrados.filter((r) => r.fecha >= from);
  if (to) filtrados = filtrados.filter((r) => r.fecha <= to);
  filtrados.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  res.json(filtrados);
});

router.post('/', async (req, res) => {
  const { escalaId, fecha, valores } = req.body || {};
  if (!escalaId || !fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'datos_invalidos', mensaje: 'escalaId y fecha (YYYY-MM-DD) son obligatorios.' });
  }
  if (!scales.ESCALAS[escalaId]) {
    return res.status(400).json({ error: 'escala_desconocida', mensaje: 'Escala desconocida: ' + escalaId });
  }
  const contexto = {
    sexo: req.patient.sexo || undefined,
    edadAnios: edadAnios(req.patient.fechaNacimiento, fecha) ?? undefined,
  };
  let resultado;
  try {
    resultado = scales.interpretar(escalaId, valores || {}, contexto);
  } catch (err) {
    return res.status(400).json({ error: 'escala_desconocida', mensaje: err.message });
  }
  const record = await store.records.create({
    patientId: req.params.id,
    escalaId,
    fecha,
    valores: valores || {},
    resultado,
    userId: req.user.id,
    userCodigo: req.user.username,
    createdAt: new Date().toISOString(),
  });
  res.status(201).json(record);
});

router.delete('/:recordId', async (req, res) => {
  const record = await store.records.get(req.params.recordId);
  if (!record || record.patientId !== req.params.id) {
    return res.status(404).json({ error: 'registro_no_encontrado', mensaje: 'Registro no encontrado.' });
  }
  const esAutor = record.userId === req.user.id;
  const esAdmin = req.user.rol === 'admin';
  if (!esAutor && !esAdmin) {
    return res.status(403).json({ error: 'permiso_denegado', mensaje: 'Solo el autor del registro o un administrador pueden borrarlo.' });
  }
  await store.records.remove(req.params.recordId);
  res.status(204).end();
});

module.exports = router;
