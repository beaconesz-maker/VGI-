/**
 * server/routes/aggregate.js — exportación agregada anonimizada (VGI+, v1.1).
 *
 * No cuelga de un paciente concreto: GET /api/export/aggregate.csv y
 * .../aggregate.xlsx. "Anonimizado" = sin NHC ni nombre del paciente (solo
 * su id interno, que no permite identificarlo fuera de esta base de
 * datos). Solo accesible a rol admin — aunque no lleve NHC/nombre, es un
 * volcado de todos los registros clínicos del centro.
 */
'use strict';

const express = require('express');
const ExcelJS = require('exceljs');
const store = require('../store');
const scales = require('../../shared/scales.js');
const { requireAdmin } = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAdmin);

const COLUMNAS = ['pacienteId', 'localizacion', 'fecha', 'escalaId', 'escalaNombre', 'dominio', 'puntuacion', 'interpretacion'];

async function filasAgregadas() {
  const [records, patients] = await Promise.all([store.records.list(), store.patients.list()]);
  const localizacionPorPaciente = {};
  patients.forEach((p) => { localizacionPorPaciente[p.id] = p.localizacion || ''; });

  return records
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
    .map((r) => {
      const esc = scales.ESCALAS[r.escalaId];
      const resultado = r.resultado || {};
      return {
        pacienteId: r.patientId,
        localizacion: localizacionPorPaciente[r.patientId] || '',
        fecha: r.fecha,
        escalaId: r.escalaId,
        escalaNombre: esc ? esc.nombre : r.escalaId,
        dominio: esc ? esc.dominio : '',
        puntuacion: resultado.raw != null ? resultado.raw : '',
        interpretacion: resultado.label || '',
      };
    });
}

function csvEscape(valor) {
  const s = valor == null ? '' : String(valor);
  if (/[",\n;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

router.get('/aggregate.csv', async (req, res) => {
  const filas = await filasAgregadas();
  const lineas = [COLUMNAS.join(',')];
  filas.forEach((fila) => {
    lineas.push(COLUMNAS.map((c) => csvEscape(fila[c])).join(','));
  });
  const csv = '﻿' + lineas.join('\r\n'); // BOM: para que Excel abra los acentos bien en Windows
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="vgiplus_agregado_anonimizado.csv"');
  res.send(csv);
});

router.get('/aggregate.xlsx', async (req, res) => {
  const filas = await filasAgregadas();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'VGI+';
  const ws = wb.addWorksheet('Datos agregados');
  ws.columns = COLUMNAS.map((c) => ({ header: c, key: c, width: c === 'interpretacion' ? 32 : c === 'escalaNombre' ? 26 : 16 }));
  ws.getRow(1).font = { bold: true };
  filas.forEach((fila) => ws.addRow(fila));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="vgiplus_agregado_anonimizado.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

module.exports = router;
