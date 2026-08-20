/**
 * server/routes/export.js — exportación a Word y PDF (VGI+).
 *
 * Excel/CSV agregado anonimizado vive aparte, en server/routes/aggregate.js
 * (no cuelga de un paciente concreto).
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
const { construirInformePdf } = require('../lib/pdf-informe');
const { construirPlanPdf } = require('../lib/pdf-plan');

const router = express.Router({ mergeParams: true });

async function cargarPaciente(req, res, next) {
  const patient = await store.patients.get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'paciente_no_encontrado', mensaje: 'Paciente no encontrado.' });
  req.patient = patient;
  next();
}

router.use(cargarPaciente);

function nombreArchivo(patient, sufijo, ext) {
  const base = (patient.nhc || patient.id).toString().replace(/[^a-zA-Z0-9_-]/g, '');
  return `${base}_${sufijo}.${ext}`;
}

/** Datos comunes al informe: escalas vigentes a `fecha` y edad del paciente. */
async function datosInforme(patient, fecha) {
  const edad = edadAnios(patient.fechaNacimiento, fecha);
  const allRecords = await store.records.list();
  const recordsPaciente = allRecords.filter((r) => r.patientId === patient.id);
  const vigentesPorEscala = registrosVigentesPorEscala(recordsPaciente, fecha);
  return { edad, vigentesPorEscala };
}

/**
 * Datos comunes al plan de recomendaciones: valida que exista el sello de
 * validación humana para esa fecha (403 si no) y calcula el plan.
 * Devuelve null si no está validado (el llamador ya habrá respondido 403).
 */
async function datosPlan(req, res, patient, fecha) {
  const validaciones = await store.planValidations.list();
  const validacion = validaciones.find((v) => v.patientId === patient.id && v.fecha === fecha);
  if (!validacion) {
    res.status(403).json({ error: 'plan_no_validado', mensaje: 'El plan de esta fecha aún no ha sido validado por un clínico.' });
    return null;
  }
  const edad = edadAnios(patient.fechaNacimiento, fecha);
  const entrada = await construirEntradaPlan(patient, fecha);
  const plan = planEngine.generarPlan({
    records: entrada.records,
    morfo: entrada.morfo,
    clinical: entrada.clinical,
    paciente: entrada.paciente,
  });
  return { edad, plan, validacion };
}

router.get('/informe.docx', async (req, res) => {
  const fecha = req.query.fecha || hoyISO();
  const patient = req.patient;
  const { edad, vigentesPorEscala } = await datosInforme(patient, fecha);

  const doc = construirInformeDocx({ patient, fecha, edad, vigentesPorEscala, scalesCatalog: scales });
  const buffer = await Packer.toBuffer(doc);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(patient, 'informe', 'docx')}"`);
  res.send(buffer);
});

router.get('/informe.pdf', async (req, res) => {
  const fecha = req.query.fecha || hoyISO();
  const patient = req.patient;
  const { edad, vigentesPorEscala } = await datosInforme(patient, fecha);

  const buffer = await construirInformePdf({ patient, fecha, edad, vigentesPorEscala, scalesCatalog: scales });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(patient, 'informe', 'pdf')}"`);
  res.send(buffer);
});

router.get('/plan.docx', async (req, res) => {
  const fecha = req.query.fecha || hoyISO();
  const patient = req.patient;
  const datos = await datosPlan(req, res, patient, fecha);
  if (!datos) return; // datosPlan ya respondió 403

  const doc = construirPlanDocx({ patient, fecha, edad: datos.edad, plan: datos.plan, validacion: datos.validacion });
  const buffer = await Packer.toBuffer(doc);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(patient, 'plan', 'docx')}"`);
  res.send(buffer);
});

router.get('/plan.pdf', async (req, res) => {
  const fecha = req.query.fecha || hoyISO();
  const patient = req.patient;
  const datos = await datosPlan(req, res, patient, fecha);
  if (!datos) return;

  const buffer = await construirPlanPdf({ patient, fecha, edad: datos.edad, plan: datos.plan, validacion: datos.validacion });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(patient, 'plan', 'pdf')}"`);
  res.send(buffer);
});

module.exports = router;
