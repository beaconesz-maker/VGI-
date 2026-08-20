'use strict';
/**
 * tests/scales.test.js — pruebas formales (node:test) del motor clínico.
 *
 * Complementa (no sustituye) shared/scales.test-manual.js, que el agente
 * que construyó shared/ ya dejó con 43 autocomprobaciones ejecutables con
 * `node shared/scales.test-manual.js`. Aquí se cubren los cortes clínicos
 * clave contra docs/ESCALAS_REFERENCIA.txt con el runner oficial de Node,
 * para que `npm test` los recoja.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const Scales = require('../shared/scales.js');

test('catálogo expone las 21 escalas en 5 dominios', () => {
  assert.equal(Object.keys(Scales.ESCALAS).length, 21);
  const cat = Scales.catalogo();
  assert.equal(cat.length, 5);
  assert.deepEqual(cat.map((d) => d.id).sort(), ['cognitivo', 'comorbilidad', 'fragilidad', 'morfofuncional', 'nutricional'].sort());
});

test('Barthel: 100/100 independencia, 0/100 dependencia total', () => {
  const items = ['comer', 'traslado', 'aseo', 'retrete', 'banarse', 'desplazarse', 'escaleras', 'vestirse', 'heces', 'orina'];
  const max = { comer: 10, traslado: 15, aseo: 5, retrete: 10, banarse: 5, desplazarse: 15, escaleras: 10, vestirse: 10, heces: 10, orina: 10 };
  const full = {}; items.forEach((k) => (full[k] = max[k]));
  const zero = {}; items.forEach((k) => (zero[k] = 0));
  assert.equal(Scales.interpretar('barthel', full, {}).label, 'independencia');
  assert.equal(Scales.interpretar('barthel', zero, {}).label, 'dependencia total');
});

test('SPPB: cortes de limitación según docs/ESCALAS_REFERENCIA.txt (0-3 grave, 10-12 sin limitación)', () => {
  const v = (n) => Scales.interpretar('sppb', { equilibrio: 0, marcha4m: 0, levantarse: n }, {});
  assert.equal(Scales.interpretar('sppb', { equilibrio: 0, marcha4m: 0, levantarse: 0 }, {}).label, 'limitación grave');
  assert.equal(Scales.interpretar('sppb', { equilibrio: 4, marcha4m: 4, levantarse: 4 }, {}).raw, 12);
  assert.equal(Scales.interpretar('sppb', { equilibrio: 4, marcha4m: 4, levantarse: 4 }, {}).label, 'sin limitación');
});

test('MMSE: >=27 normal, <=12 demencia', () => {
  const dom = { ot: 5, oe: 5, fij: 3, ac: 5, rd: 3, len: 9 };
  assert.equal(Scales.interpretar('mmse', dom, {}).raw, 30);
  assert.equal(Scales.interpretar('mmse', dom, {}).label, 'normal');
  assert.equal(Scales.interpretar('mmse', { ot: 0, oe: 0, fij: 0, ac: 0, rd: 0, len: 0 }, {}).label, 'demencia');
});

test('MoCA: corte único 26, ajuste +1 por escolaridad baja sin superar 30', () => {
  const claves = ['visuoejec', 'identificacion', 'atencion', 'lenguaje', 'abstraccion', 'recuerdo', 'orientacion'];
  const vals25 = { visuoejec: 5, identificacion: 3, atencion: 6, lenguaje: 3, abstraccion: 2, recuerdo: 4, orientacion: 2 }; // suma 25
  assert.equal(Scales.interpretar('moca', vals25, {}).label, 'sugiere deterioro cognitivo leve');
  assert.equal(Scales.interpretar('moca', vals25, { escolaridadAnios: 8 }).raw, 26);
  assert.equal(Scales.interpretar('moca', vals25, { escolaridadAnios: 8 }).label, 'normal');
  const vals30 = { visuoejec: 5, identificacion: 3, atencion: 6, lenguaje: 3, abstraccion: 2, recuerdo: 5, orientacion: 6 }; // suma 30
  assert.equal(Scales.interpretar('moca', vals30, { escolaridadAnios: 8 }).raw, 30, 'no debe superar 30 con el ajuste');
});

test('Hand Grip: corte distinto por sexo, y neutro si no hay sexo', () => {
  assert.equal(Scales.interpretar('grip', { valor: 20 }, {}).completo, false, 'sin sexo, resultado incompleto');
  assert.equal(Scales.interpretar('grip', { valor: 20 }, { sexo: 'M' }).label.includes('normal'), true, '20kg en mujer (corte 16) es normal');
  assert.equal(Scales.interpretar('grip', { valor: 20 }, { sexo: 'H' }).label.includes('fuerza baja'), true, '20kg en hombre (corte 27) es fuerza baja');
});

test('Charlson: ajuste por edad se suma a la comorbilidad', () => {
  const sinComorbilidad = Scales.interpretar('charlson', {}, { edadAnios: 80 });
  assert.equal(sinComorbilidad.raw, 4, '80 años sin comorbilidad = +4 (una década por encima de 40, tope 5)');
});

test('4AT: cortes 0 / 1-3 / >=4 (Bellelli et al. Age Ageing 2014, PMID 24590568)', () => {
  const normal = { consciencia: 0, amt4: 0, atencion: 0, cambio_agudo: 0 };
  assert.equal(Scales.interpretar('4at', normal, {}).raw, 0);
  assert.equal(Scales.interpretar('4at', normal, {}).label, 'delirium o deterioro cognitivo severo poco probable');

  const deterioro = { consciencia: 0, amt4: 1, atencion: 1, cambio_agudo: 0 };
  assert.equal(Scales.interpretar('4at', deterioro, {}).raw, 2);
  assert.equal(Scales.interpretar('4at', deterioro, {}).label, 'posible deterioro cognitivo');

  const cambioAgudoSolo = { consciencia: 0, amt4: 0, atencion: 0, cambio_agudo: 4 };
  assert.equal(Scales.interpretar('4at', cambioAgudoSolo, {}).label, 'posible delirium ± deterioro cognitivo', 'el ítem 4 por sí solo (cambio agudo/fluctuante = 4) ya da posible delirium');

  const conscienciaAnormal = { consciencia: 4, amt4: 0, atencion: 0, cambio_agudo: 0 };
  assert.equal(Scales.interpretar('4at', conscienciaAnormal, {}).label, 'posible delirium ± deterioro cognitivo', 'estado de consciencia claramente anormal por sí solo ya da posible delirium');
});
