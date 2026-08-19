/**
 * server/routes/export.js — exportación a Word (VGI+, v1).
 *
 * PDF/Excel/CSV quedan para v1.1 (docs/API_CONTRACT.md), no se implementan
 * aquí todavía.
 */
'use strict';

const express = require('express');
const { Packer } = require('docx');
const scales = require('../../shared/scales.js');
const planEngine = require('../../shared/plan-engine.js');
const store = require('../store');
const { edadAnios, hoyISO } = require('../lib/edad');
const { registrosVigentesPorEscala } = require('../lib/vigente');
const { construirEntradaPlan } = require('./plan');
const { construirInformeDocx } = require('../lib/docx-informe');
const { construirPlanDocx } = require('../lib/docx-plan');

const router = express.Router({ mergeParams: true });

async function cargarPaciente(req, res, next) {
  const patient = await store.patients.get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'paciente_no_encontrado', mensaje: 'Paciente no encontrado.' });
  req.patient = patient;
  next();
}

router.use(cargarPaciente);

function nombreArchivo(patient, sufijo) {
  const base = (patient.nhc || patient.id).toString().replace(/[^a-zA-Z0-9_-]/g, '');
  return `${base}_${sufijo}.docx`;
}

router.get('/informe.docx', async (req, res) => {
  const fecha = req.query.fecha || hoyISO();
  const patient = req.patient;
  const edad = edadAnios(patient.fechaNacimiento, fecha);

  const allRecords = await store.records.list();
  const recordsPaciente = allRecords.filter((r) => r.patientId === patient.id);
  const vigentesPorEscala = registrosVigentesPorEscala(recordsPaciente, fecha);

  const doc = construirInformeDocx({ patient, fecha, edad, vigentesPorEscala, scalesCatalog: scales });
  const buffer = await Packer.toBuffer(doc);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(patient, 'informe')}"`);
  res.send(buffer);
});

router.get('/plan.docx', async (req, res) => {
  const fecha = req.query.fecha || hoyISO();
  const patient = req.patient;

  const validaciones = await store.planValidations.list();
  const validacion = validaciones.find((v) => v.patientId === patient.id && v.fecha === fecha);
  if (!validacion) {
    return res.status(403).json({ error: 'plan_no_validado', mensaje: 'El plan de esta fecha aún no ha sido validado por un clínico.' });
  }

  const edad = edadAnios(patient.fechaNacimiento, fecha);
  const entrada = await construirEntradaPlan(patient, fecha);
  const plan = planEngine.generarPlan({
    records: entrada.records,
    morfo: entrada.morfo,
    clinical: entrada.clinical,
    paciente: entrada.paciente,
  });

  const doc = construirPlanDocx({ patient, fecha, edad, plan, validacion });
  const buffer = await Packer.toBuffer(doc);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(patient, 'plan')}"`);
  res.send(buffer);
});

module.exports = router;
