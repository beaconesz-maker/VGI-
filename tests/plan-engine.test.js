'use strict';
/**
 * tests/plan-engine.test.js — pruebas del generador de plan
 * (pasaporte Vivifrail, gate de validación es responsabilidad de
 * server/routes/plan.js, no de este módulo puro).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const PlanEngine = require('../shared/plan-engine.js');
const Scales = require('../shared/scales.js');

function sppbResultado(raw) {
  // raw 0-12 repartido de forma simple entre los tres ítems (0-4 cada uno)
  const base = Math.floor(raw / 3), resto = raw % 3;
  const vals = { equilibrio: base + (resto > 0 ? 1 : 0), marcha4m: base + (resto > 1 ? 1 : 0), levantarse: base };
  return Scales.interpretar('sppb', vals, {});
}

test('Vivifrail: SPPB 0-3 -> pasaporte A (discapacidad)', () => {
  const plan = PlanEngine.generarPlan({ records: { sppb: sppbResultado(3) }, morfo: {}, clinical: {}, paciente: {} });
  assert.match(plan.recomendaciones.ejercicio.l[0], /Pasaporte VIVIFRAIL A/);
});

test('Vivifrail: SPPB 4-6 -> pasaporte B (fragilidad)', () => {
  const plan = PlanEngine.generarPlan({ records: { sppb: sppbResultado(6) }, morfo: {}, clinical: {}, paciente: {} });
  assert.match(plan.recomendaciones.ejercicio.l[0], /Pasaporte VIVIFRAIL B/);
});

test('Vivifrail: SPPB 7-9 -> pasaporte C (prefragilidad)', () => {
  const plan = PlanEngine.generarPlan({ records: { sppb: sppbResultado(9) }, morfo: {}, clinical: {}, paciente: {} });
  assert.match(plan.recomendaciones.ejercicio.l[0], /Pasaporte VIVIFRAIL C/);
});

test('Vivifrail: SPPB 10-12 -> pasaporte D (robusto), sin variante "+"', () => {
  const plan = PlanEngine.generarPlan({ records: { sppb: sppbResultado(12) }, morfo: {}, clinical: {}, paciente: {} });
  assert.match(plan.recomendaciones.ejercicio.l[0], /Pasaporte VIVIFRAIL D/);
  assert.doesNotMatch(plan.recomendaciones.ejercicio.l[0], /\+/);
});

test('Vivifrail: variante "+" cuando SPPB intermedio y marcha <=0.8 m/s', () => {
  const plan = PlanEngine.generarPlan({
    records: { sppb: sppbResultado(6), gait: Scales.interpretar('gait', { valor: 0.6 }, {}) },
    morfo: {}, clinical: {}, paciente: {},
  });
  assert.match(plan.recomendaciones.ejercicio.l[0], /VIVIFRAIL B\+/);
});

test('Sin ninguna escala registrada, no se genera eje de ejercicio', () => {
  const plan = PlanEngine.generarPlan({ records: {}, morfo: {}, clinical: {}, paciente: {} });
  assert.equal(plan.recomendaciones.ejercicio, undefined);
});

test('4AT >=4 dispara el eje de delirium (NICE CG103)', () => {
  const at4 = Scales.interpretar('4at', { consciencia: 4, amt4: 0, atencion: 0, cambio_agudo: 0 }, {});
  const plan = PlanEngine.generarPlan({ records: { '4at': at4 }, morfo: {}, clinical: {}, paciente: {} });
  assert.ok(plan.recomendaciones.delirium, 'debe existir el eje delirium');
  assert.match(plan.recomendaciones.delirium.f, /CG103/);
  assert.match(plan.recomendaciones.delirium.f, /29020579/);
});

test('4AT 1-3 (posible deterioro cognitivo, no delirium) no dispara el eje de delirium', () => {
  const at4 = Scales.interpretar('4at', { consciencia: 0, amt4: 1, atencion: 1, cambio_agudo: 0 }, {});
  const plan = PlanEngine.generarPlan({ records: { '4at': at4 }, morfo: {}, clinical: {}, paciente: {} });
  assert.equal(plan.recomendaciones.delirium, undefined);
});

test('demencia + delirium activo a la vez: el eje demencia avisa de priorizar el delirium primero', () => {
  const at4 = Scales.interpretar('4at', { consciencia: 4, amt4: 0, atencion: 0, cambio_agudo: 0 }, {});
  const mmse = Scales.interpretar('mmse', { ot: 0, oe: 0, fij: 0, ac: 0, rd: 0, len: 0 }, {}); // 0/30
  const plan = PlanEngine.generarPlan({ records: { '4at': at4, mmse }, morfo: {}, clinical: {}, paciente: {} });
  assert.ok(plan.recomendaciones.delirium);
  assert.ok(plan.recomendaciones.demencia);
  assert.match(plan.recomendaciones.demencia.l[0], /priorizar el estudio y tratamiento del delirium/);
});
