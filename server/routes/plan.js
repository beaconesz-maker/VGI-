/**
 * server/routes/plan.js — plan de recomendaciones y su validación (VGI+).
 *
 * GET /:id/plan?fecha= construye records/morfo/clinical "vigentes" a esa
 * fecha (el más reciente por escala con fecha <= la pedida) y llama a
 * shared/plan-engine.js:generarPlan(). No se recalcula nada de las
 * escalas: usa el `resultado` que ya quedó guardado en cada `record`
 * (docs/API_CONTRACT.md).
 *
 * POST /:id/plan/validate {fecha} dinos el sello de validación humana:
 * ninguna recomendación tiene efecto (ni se puede exportar) sin él.
 */
'use strict';

const express = require('express');
const planEngine = require('../../shared/plan-engine.js');
const store = require('../store');
const { edadAnios, hoyISO } = require('../lib/edad');
const { registrosVigentesPorEscala, masRecienteHasta } = require('../lib/vigente');

const router = express.Router({ mergeParams: true });

async function cargarPaciente(req, res, next) {
  const patient = await store.patients.get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'paciente_no_encontrado', mensaje: 'Paciente no encontrado.' });
  req.patient = patient;
  next();
}

router.use(cargarPaciente);

/**
 * Arma {records, morfo, clinical, paciente} vigentes a `fecha` para el
 * paciente `patient` — compartido entre GET /plan y las exportaciones .docx.
 */
async function construirEntradaPlan(patient, fecha) {
  const [allRecords, allMorfo, allClinical] = await Promise.all([
    store.records.list(),
    store.morfo.list(),
    store.clinical.list(),
  ]);
  const recordsPaciente = allRecords.filter((r) => r.patientId === patient.id);
  const morfoPaciente = allMorfo.filter((r) => r.patientId === patient.id);
  const clinicalPaciente = allClinical.filter((r) => r.patientId === patient.id);

  const vigentesPorEscala = registrosVigentesPorEscala(recordsPaciente, fecha);
  const records = {};
  Object.keys(vigentesPorEscala).forEach((escalaId) => {
    records[escalaId] = vigentesPorEscala[escalaId].resultado;
  });

  const morfoVigente = masRecienteHasta(morfoPaciente, fecha);
  const morfo = { peso: morfoVigente ? morfoVigente.peso : null, talla: morfoVigente ? morfoVigente.talla : null };

  const clinicalVigente = masRecienteHasta(clinicalPaciente, fecha);
  const clinical = clinicalVigente ? clinicalVigente.valores || {} : {};

  const paciente = {
    sexo: patient.sexo || undefined,
    edadAnios: edadAnios(patient.fechaNacimiento, fecha) ?? undefined,
    caidasUltimoAnio: clinical.caidasUltimoAnio != null ? clinical.caidasUltimoAnio : 0,
  };

  return { records, morfo, clinical, paciente, vigentesPorEscala, morfoVigente, clinicalVigente };
}

router.get('/', async (req, res) => {
  const fecha = req.query.fecha || hoyISO();
  const entrada = await construirEntradaPlan(req.patient, fecha);
  const plan = planEngine.generarPlan({
    records: entrada.records,
    morfo: entrada.morfo,
    clinical: entrada.clinical,
    paciente: entrada.paciente,
  });
  // Se incluye el sello de validación humana (o null si no existe) para que
  // el frontend pueda mostrar "Copiar recomendaciones" con el mismo aviso
  // de "sin validar" que ya usa la exportación a Word/PDF, sin tener que
  // llamar a otro endpoint aparte (ver public/js/tab-documentos.js).
  const validaciones = await store.planValidations.list();
  plan.validacion = validaciones.find((v) => v.patientId === req.patient.id && v.fecha === fecha) || null;
  res.json(plan);
});

router.post('/validate', async (req, res) => {
  const { fecha } = req.body || {};
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'datos_invalidos', mensaje: 'fecha (YYYY-MM-DD) es obligatoria.' });
  }
  const todas = await store.planValidations.list();
  const existente = todas.find((v) => v.patientId === req.patient.id && v.fecha === fecha);
  const validatedAt = new Date().toISOString();
  let validacion;
  if (existente) {
    validacion = await store.planValidations.update(existente.id, { userId: req.user.id, userCodigo: req.user.username, validatedAt });
  } else {
    validacion = await store.planValidations.create({
      patientId: req.patient.id,
      fecha,
      userId: req.user.id,
      userCodigo: req.user.username,
      validatedAt,
    });
  }
  res.status(201).json(validacion);
});

module.exports = router;
module.exports.construirEntradaPlan = construirEntradaPlan;
