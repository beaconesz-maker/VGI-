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
