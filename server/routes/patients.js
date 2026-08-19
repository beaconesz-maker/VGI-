/**
 * server/routes/patients.js — CRUD de pacientes (VGI+).
 *
 * Nota sobre el contrato (ver docs/API_CONTRACT.md): el modelo de datos de
 * `patients` incluye `sexo` (lo necesitan Hand Grip y el motor de plan),
 * pero la lista de campos del `POST` en la sección de rutas no lo
 * mencionaba explícitamente. Se acepta aquí como campo opcional del body
 * (igual que `localizacion`) — ver nota en API_CONTRACT.md.
 */
'use strict';

const express = require('express');
const store = require('../store');

const router = express.Router();

function validarPaciente(body, { parcial = false } = {}) {
  const errores = [];
  if (!parcial || body.nhc !== undefined) {
    if (!body.nhc || typeof body.nhc !== 'string') errores.push('nhc');
  }
  if (!parcial || body.nombre !== undefined) {
    if (!body.nombre || typeof body.nombre !== 'string') errores.push('nombre');
  }
  if (!parcial || body.fechaNacimiento !== undefined) {
    if (!body.fechaNacimiento || !/^\d{4}-\d{2}-\d{2}$/.test(body.fechaNacimiento)) errores.push('fechaNacimiento');
  }
  if (body.sexo !== undefined && body.sexo !== null && !['H', 'M'].includes(body.sexo)) {
    errores.push('sexo');
  }
  if (body.localizacion !== undefined && body.localizacion !== null && !['U3', 'U4', 'U8'].includes(body.localizacion)) {
    errores.push('localizacion');
  }
  return errores;
}

router.get('/', async (req, res) => {
  const q = (req.query.q || '').toString().trim().toLowerCase();
  const all = await store.patients.list();
  if (!q) return res.json(all);
  const filtrados = all.filter((p) =>
    (p.nhc || '').toLowerCase().includes(q) || (p.nombre || '').toLowerCase().includes(q)
  );
  res.json(filtrados);
});

router.post('/', async (req, res) => {
  const body = req.body || {};
  const errores = validarPaciente(body);
  if (errores.length) {
    return res.status(400).json({ error: 'datos_invalidos', mensaje: 'Faltan campos obligatorios o son inválidos: ' + errores.join(', ') });
  }
  const existentes = await store.patients.list();
  if (existentes.some((p) => p.nhc === body.nhc)) {
    return res.status(409).json({ error: 'nhc_duplicado', mensaje: 'Ya existe un paciente con ese NHC.' });
  }
  const patient = await store.patients.create({
    nhc: body.nhc,
    nombre: body.nombre,
    fechaNacimiento: body.fechaNacimiento,
    sexo: body.sexo || null,
    localizacion: body.localizacion || null,
    createdAt: new Date().toISOString(),
    createdBy: req.user.id,
  });
  res.status(201).json(patient);
});

router.get('/:id', async (req, res) => {
  const patient = await store.patients.get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'paciente_no_encontrado', mensaje: 'Paciente no encontrado.' });
  res.json(patient);
});

router.put('/:id', async (req, res) => {
  const body = req.body || {};
  const errores = validarPaciente(body, { parcial: true });
  if (errores.length) {
    return res.status(400).json({ error: 'datos_invalidos', mensaje: 'Campos inválidos: ' + errores.join(', ') });
  }
  if (body.nhc !== undefined) {
    const existentes = await store.patients.list();
    if (existentes.some((p) => p.nhc === body.nhc && p.id !== req.params.id)) {
      return res.status(409).json({ error: 'nhc_duplicado', mensaje: 'Ya existe un paciente con ese NHC.' });
    }
  }
  const patch = {};
  ['nhc', 'nombre', 'fechaNacimiento', 'sexo', 'localizacion'].forEach((k) => {
    if (body[k] !== undefined) patch[k] = body[k];
  });
  const patient = await store.patients.update(req.params.id, patch);
  if (!patient) return res.status(404).json({ error: 'paciente_no_encontrado', mensaje: 'Paciente no encontrado.' });
  res.json(patient);
});

module.exports = router;
