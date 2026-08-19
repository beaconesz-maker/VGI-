/**
 * server/routes/clinical.js — parámetros analíticos/clínicos por paciente
 * y fecha (VGI+): los que necesita la pestaña "Plan" (Hb, VCM, ferritina,
 * IST, B12, fólico, eGFR, HbA1c, 25-OH-D, checkboxes clínicos y
 * STOPP/START — ver forma completa en docs/API_CONTRACT.md).
 */
'use strict';

const express = require('express');
const store = require('../store');
const { masRecienteHasta } = require('../lib/vigente');

const router = express.Router({ mergeParams: true });

async function cargarPaciente(req, res, next) {
  const patient = await store.patients.get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'paciente_no_encontrado', mensaje: 'Paciente no encontrado.' });
  req.patient = patient;
  next();
}

router.use(cargarPaciente);

// GET /?fecha= → si se pasa fecha, el registro exacto de esa fecha (o null);
// si no, el más reciente de todos.
router.get('/', async (req, res) => {
  const { fecha } = req.query;
  const all = await store.clinical.list();
  const propios = all.filter((r) => r.patientId === req.params.id);
  if (fecha) {
    const exacto = propios.find((r) => r.fecha === fecha) || null;
    return res.json(exacto);
  }
  const masReciente = masRecienteHasta(propios, null);
  res.json(masReciente);
});

router.post('/', async (req, res) => {
  const { fecha, valores } = req.body || {};
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'datos_invalidos', mensaje: 'fecha (YYYY-MM-DD) es obligatoria.' });
  }
  const registro = await store.clinical.create({
    patientId: req.params.id,
    fecha,
    valores: valores || {},
    userId: req.user.id,
    createdAt: new Date().toISOString(),
  });
  res.status(201).json(registro);
});

module.exports = router;
