'use strict';
/**
 * tests/items-fallidos.test.js — pruebas de server/lib/items-fallidos.js.
 *
 * Petición de Bea: el informe debe detallar en qué ítems concretos falla
 * el paciente, no solo dar la puntuación total.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { itemsFallidos } = require('../server/lib/items-fallidos');
const { ESCALAS } = require('../shared/scales.js');

test('Barthel (mayor_mejor): detecta los ítems no independientes', () => {
  const valores = {
    comer: 10, traslado: 5, aseo: 5, retrete: 10, banarse: 0,
    desplazarse: 15, escaleras: 10, vestirse: 10, heces: 10, orina: 10,
  };
  const fallos = itemsFallidos(ESCALAS.barthel, valores);
  const ids = fallos.map((f) => f.pregunta);
  assert.equal(fallos.length, 2);
  assert.ok(ids.includes('Trasladarse silla-cama'));
  assert.ok(ids.includes('Bañarse / ducharse'));
  const traslado = fallos.find((f) => f.pregunta === 'Trasladarse silla-cama');
  assert.equal(traslado.etiqueta, 'Ayuda importante');
});

test('Barthel: independencia total no produce ítems fallados', () => {
  const valores = {
    comer: 10, traslado: 15, aseo: 5, retrete: 10, banarse: 5,
    desplazarse: 15, escaleras: 10, vestirse: 10, heces: 10, orina: 10,
  };
  assert.deepEqual(itemsFallidos(ESCALAS.barthel, valores), []);
});

test('Pfeiffer (menor_mejor, tipo propio): detecta preguntas falladas y excluye escolaridad', () => {
  const valores = { p0: 1, p1: 0, p2: 1, p3: 0, p4: 0, p5: 0, p6: 0, p7: 0, p8: 0, p9: 0, escolaridad: 1 };
  const fallos = itemsFallidos(ESCALAS.pfeiffer, valores);
  assert.equal(fallos.length, 2);
  assert.ok(fallos.every((f) => f.etiqueta === 'Error'));
  assert.ok(!fallos.some((f) => f.pregunta === 'Escolaridad'));
});

test('Katz (menor_mejor, cortes con "ok" primero): dependiente en un ítem se marca', () => {
  const valores = { bano: 0, vestido: 0, retrete: 0, movilidad: 1, continencia: 0, alimentacion: 0 };
  const fallos = itemsFallidos(ESCALAS.katz, valores);
  assert.equal(fallos.length, 1);
  assert.equal(fallos[0].pregunta, 'Movilidad / transferencia');
  assert.equal(fallos[0].etiqueta, 'Dependiente');
});

test('escalas sin desglose por ítem (p.ej. Charlson) devuelven []', () => {
  assert.deepEqual(itemsFallidos(ESCALAS.charlson, { infarto: 1 }), []);
});

test('valores/escala nulos o incompletos no rompen la función', () => {
  assert.deepEqual(itemsFallidos(null, {}), []);
  assert.deepEqual(itemsFallidos(ESCALAS.barthel, null), []);
  assert.deepEqual(itemsFallidos(ESCALAS.barthel, {}), []);
});
