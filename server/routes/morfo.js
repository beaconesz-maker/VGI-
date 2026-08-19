/**
 * server/routes/morfo.js — peso/talla por paciente y fecha (VGI+).
 *
 * Peso/talla NO son una escala (docs/SCALES_CONTRACT.md): van en su propio
 * endpoint, aunque se muestren en la pestaña "morfofuncional" del frontend.
 */
'use strict';

const express = require('express');
const store = require('../store');

const router = express.Router({ mergeParams: true });

async function cargarPaciente(req, res, next) {
  const patient = await store.patients.get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'paciente_no_encontrado', mensaje: 'Paciente no encontrado.' });
  req.patient = patient;
  next();
}

router.use(cargarPaciente);

router.get('/', async (req, res) => {
  const { from, to } = req.query;
  const all = await store.morfo.list();
  let filtrados = all.filter((r) => r.patientId === req.params.id);
  if (from) filtrados = filtrados.filter((r) => r.fecha >= from);
  if (to) filtrados = filtrados.filter((r) => r.fecha <= to);
  filtrados.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  res.json(filtrados);
});

router.post('/', async (req, res) => {
  const { fecha, peso, talla } = req.body || {};
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'datos_invalidos', mensaje: 'fecha (YYYY-MM-DD) es obligatoria.' });
  }
  if (peso == null && talla == null) {
    return res.status(400).json({ error: 'datos_invalidos', mensaje: 'Indique al menos peso o talla.' });
  }
  const registro = await store.morfo.create({
    patientId: req.params.id,
    fecha,
    peso: peso != null ? Number(peso) : null,
    talla: talla != null ? Number(talla) : null,
    userId: req.user.id,
    createdAt: new Date().toISOString(),
  });
  res.status(201).json(registro);
});

module.exports = router;
