/**
 * shared/scales.test-manual.js
 *
 * Autocomprobación rápida y ejecutable con `node shared/scales.test-manual.js`.
 * No es un sustituto de las pruebas formales de tests/ (que usará el
 * agente de QA) — solo verifica que interpretar() y generarPlan() no se
 * han roto y que los cortes clínicos clave coinciden con
 * docs/ESCALAS_REFERENCIA.txt / docs/SCALES_CONTRACT.md.
 */
'use strict';
var assert = require('assert');
var Scales = require('./scales.js');
var PlanEngine = require('./plan-engine.js');

var pass = 0, fail = 0, failures = [];

function check(desc, fn) {
  try {
    fn();
    pass++;
  } catch (e) {
    fail++;
    failures.push(desc + ' :: ' + e.message);
  }
}

function eq(actual, expected, msg) {
  assert.strictEqual(actual, expected, msg || ('esperado ' + expected + ', obtenido ' + actual));
}

/* ────────────────────────────────────────────────────────────────
 * Catálogo básico
 * ──────────────────────────────────────────────────────────────── */
check('catálogo expone las 21 escalas', function () {
  var ids = Object.keys(Scales.ESCALAS);
  eq(ids.length, 21, 'se esperaban 21 escalas, hay ' + ids.length);
});

check('catalogo() agrupa por los 5 dominios del contrato', function () {
  var cat = Scales.catalogo();
  eq(cat.length, 5);
  var ids = cat.map(function (d) { return d.id; });
  ['morfofuncional', 'nutricional', 'comorbilidad', 'fragilidad', 'cognitivo'].forEach(function (d) {
    assert.ok(ids.indexOf(d) !== -1, 'falta dominio ' + d);
  });
});

check('cada escala tiene referencia bibliográfica', function () {
  Object.keys(Scales.ESCALAS).forEach(function (id) {
    var esc = Scales.ESCALAS[id];
    assert.ok(esc.referencia && esc.referencia.texto, 'falta referencia en ' + id);
  });
});

/* ────────────────────────────────────────────────────────────────
 * Barthel
 * ──────────────────────────────────────────────────────────────── */
check('Barthel — independencia (100)', function () {
  var r = Scales.interpretar('barthel', {
    comer: 10, traslado: 15, aseo: 5, retrete: 10, banarse: 5,
    desplazarse: 15, escaleras: 10, vestirse: 10, heces: 10, orina: 10
  });
  eq(r.raw, 100); eq(r.label, 'independencia'); eq(r.cls, 'ok'); eq(r.completo, true);
});

check('Barthel — dependencia total (0)', function () {
  var vals = {}; ['comer', 'traslado', 'aseo', 'retrete', 'banarse', 'desplazarse', 'escaleras', 'vestirse', 'heces', 'orina'].forEach(function (k) { vals[k] = 0; });
  var r = Scales.interpretar('barthel', vals);
  eq(r.raw, 0); eq(r.label, 'dependencia total'); eq(r.cls, 'alert');
});

check('Barthel — incompleto si faltan ítems', function () {
  var r = Scales.interpretar('barthel', { comer: 10, traslado: 15 });
  eq(r.completo, false);
  assert.ok(/incompleto/.test(r.texto));
});

/* ────────────────────────────────────────────────────────────────
 * Lawton-Brody y Katz
 * ──────────────────────────────────────────────────────────────── */
check('Lawton — independiente (8/8)', function () {
  var r = Scales.interpretar('lawton', { telefono: 1, compras: 1, comida: 1, casa: 1, ropa: 1, transporte: 1, medicacion: 1, economia: 1 });
  eq(r.raw, 8); eq(r.label, 'independiente'); eq(r.cls, 'ok');
});

check('Katz — dependencia grave (6/6)', function () {
  var vals = {}; ['bano', 'vestido', 'retrete', 'movilidad', 'continencia', 'alimentacion'].forEach(function (k) { vals[k] = 1; });
  var r = Scales.interpretar('katz', vals);
  eq(r.raw, 6); eq(r.label, 'dependencia grave'); eq(r.cls, 'alert');
});

/* ────────────────────────────────────────────────────────────────
 * Charlson (con ajuste por edad)
 * ──────────────────────────────────────────────────────────────── */
check('Charlson — comorbilidad + ajuste por edad → riesgo alto', function () {
  var r = Scales.interpretar('charlson', { im: true, epoc: true }, { edadAnios: 65 });
  // comorbilidad: im(1)+epoc(1)=2; edad 65 → ap = floor((65-40)/10) = 2; total 4
  eq(r.raw, 4); eq(r.label, 'alto'); eq(r.cls, 'alert');
});

check('Charlson — sin comorbilidades ni edad → bajo riesgo', function () {
  var r = Scales.interpretar('charlson', {});
  eq(r.raw, 0); eq(r.label, 'bajo riesgo'); eq(r.cls, 'ok');
});

/* ────────────────────────────────────────────────────────────────
 * CIRS-G
 * ──────────────────────────────────────────────────────────────── */
check('CIRS-G — un sistema en grado 4 → alerta', function () {
  var r = Scales.interpretar('cirsg', { cardiaco: 4 });
  eq(r.raw, 4); eq(r.cls, 'alert');
});

check('CIRS-G — todo en 0 → ok', function () {
  var r = Scales.interpretar('cirsg', {});
  eq(r.raw, 0); eq(r.cls, 'ok');
});

/* ────────────────────────────────────────────────────────────────
 * FRAIL / Fried / SPPB / SARC-F
 * ──────────────────────────────────────────────────────────────── */
check('FRAIL — frágil (5/5)', function () {
  var r = Scales.interpretar('frail', { fatigue: 1, resistance: 1, aerobic: 1, illnesses: 1, lossweight: 1 });
  eq(r.raw, 5); eq(r.label, 'frágil'); eq(r.cls, 'alert');
});

check('SPPB — limitación moderada (6/12)', function () {
  var r = Scales.interpretar('sppb', { equilibrio: 2, marcha4m: 2, levantarse: 2 });
  eq(r.raw, 6); eq(r.label, 'limitación moderada'); eq(r.cls, 'warn');
});

check('SARC-F — sarcopenia probable (10/10)', function () {
  var r = Scales.interpretar('sarcf', { fuerza: 2, caminar: 2, levantarse: 2, escaleras: 2, caidas: 2 });
  eq(r.raw, 10); eq(r.label, 'sarcopenia probable'); eq(r.cls, 'alert');
});

/* ────────────────────────────────────────────────────────────────
 * CFS / IF-VIG / marcha / grip / TUG / reloj
 * ──────────────────────────────────────────────────────────────── */
check('CFS 7 → fragilidad grave', function () {
  var r = Scales.interpretar('cfs', { valor: 7 });
  eq(r.label, 'fragilidad grave'); eq(r.cls, 'alert');
});

check('IF-VIG 0,30 → fragilidad leve', function () {
  var r = Scales.interpretar('frailvig', { valor: 0.3 });
  eq(r.label, 'fragilidad leve'); eq(r.cls, 'warn');
});

check('Marcha 0,5 m/s → lentitud', function () {
  var r = Scales.interpretar('gait', { valor: 0.5 });
  eq(r.label, 'lentitud (≤0,8 m/s)'); eq(r.cls, 'alert');
});

check('Grip 20 kg hombre → fuerza baja', function () {
  var r = Scales.interpretar('grip', { valor: 20 }, { sexo: 'H' });
  eq(r.cls, 'alert');
});

check('Grip 20 kg mujer → normal', function () {
  var r = Scales.interpretar('grip', { valor: 20 }, { sexo: 'M' });
  eq(r.cls, 'ok');
});

check('Grip sin sexo → neutro, no falla', function () {
  var r = Scales.interpretar('grip', { valor: 20 }, {});
  eq(r.cls, 'neutro'); eq(r.completo, false);
});

check('TUG 15 s → riesgo aumentado (alert)', function () {
  var r = Scales.interpretar('tug', { valor: 15 });
  eq(r.label, 'riesgo aumentado'); eq(r.cls, 'alert');
});

check('Test del Reloj 2/5 → alteración moderada, alert', function () {
  var r = Scales.interpretar('reloj', { valor: 2 });
  eq(r.label, 'alteración moderada'); eq(r.cls, 'alert');
});

/* ────────────────────────────────────────────────────────────────
 * MNA / GLIM
 * ──────────────────────────────────────────────────────────────── */
check('MNA — cribado normal (14/14), sin evaluación → incompleto', function () {
  var r = Scales.interpretar('mna', { A: 2, B: 3, C: 2, D: 2, E: 2, F: 3 });
  eq(r.raw, 14); eq(r.label, 'normal'); eq(r.completo, false);
});

check('MNA — total /30 con evaluación → malnutrición', function () {
  var vals = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0, K: 0, L: 0, M: 0, N: 0, O: 0, P: 0, Q: 0, R: 0 };
  var r = Scales.interpretar('mna', vals);
  eq(r.raw, 0); eq(r.label, 'malnutrición'); eq(r.cls, 'alert'); eq(r.completo, true);
});

check('GLIM — cumple criterios (fenotípico + etiológico)', function () {
  var r = Scales.interpretar('glim', { fpeso: true, eing: true });
  eq(r.raw, 1); eq(r.cls, 'alert');
});

check('GLIM — sin datos → neutro', function () {
  var r = Scales.interpretar('glim', {});
  eq(r.cls, 'neutro'); eq(r.completo, false);
});

/* ────────────────────────────────────────────────────────────────
 * MMSE / Pfeiffer
 * ──────────────────────────────────────────────────────────────── */
check('MMSE — normal (30/30)', function () {
  var r = Scales.interpretar('mmse', { ot: 5, oe: 5, fij: 3, ac: 5, rd: 3, len: 9 });
  eq(r.raw, 30); eq(r.label, 'normal'); eq(r.cls, 'ok');
});

check('MMSE — demencia (≤12)', function () {
  var r = Scales.interpretar('mmse', { ot: 1, oe: 1, fij: 1, ac: 1, rd: 1, len: 5 });
  eq(r.raw, 10); eq(r.label, 'demencia'); eq(r.cls, 'alert');
});

check('Pfeiffer — 3 errores, escolaridad baja (+1) → normal', function () {
  var vals = { p0: 1, p1: 1, p2: 1, escolaridad: 1 };
  var r = Scales.interpretar('pfeiffer', vals);
  eq(r.raw, 3); eq(r.label, 'normal'); eq(r.cls, 'ok');
});

check('Pfeiffer — 3 errores, escolaridad media → leve', function () {
  var vals = { p0: 1, p1: 1, p2: 1, escolaridad: 0 };
  var r = Scales.interpretar('pfeiffer', vals);
  eq(r.raw, 3); eq(r.label, 'leve'); eq(r.cls, 'warn');
});

/* ────────────────────────────────────────────────────────────────
 * MoCA (escala nueva)
 * ──────────────────────────────────────────────────────────────── */
check('MoCA — 30/30 sin ajuste → normal', function () {
  var r = Scales.interpretar('moca', {
    visuoejec: 5, identificacion: 3, atencion: 6, lenguaje: 3, abstraccion: 2, recuerdo: 5, orientacion: 6
  });
  eq(r.raw, 30); eq(r.label, 'normal'); eq(r.cls, 'ok');
});

check('MoCA — 22/30 → sugiere deterioro cognitivo leve', function () {
  var r = Scales.interpretar('moca', {
    visuoejec: 3, identificacion: 3, atencion: 4, lenguaje: 2, abstraccion: 1, recuerdo: 3, orientacion: 6
  });
  eq(r.raw, 22); eq(r.label, 'sugiere deterioro cognitivo leve'); eq(r.cls, 'warn');
});

check('MoCA — 25 + escolaridad ≤12 años (+1) cruza a normal (26)', function () {
  var r = Scales.interpretar('moca', {
    visuoejec: 4, identificacion: 3, atencion: 5, lenguaje: 3, abstraccion: 2, recuerdo: 4, orientacion: 4
  }, { escolaridadAnios: 8 });
  eq(r.raw, 26); eq(r.label, 'normal'); eq(r.cls, 'ok');
  assert.ok(/\+1 por escolaridad/.test(r.texto));
});

check('MoCA — mismo bruto 25 sin ajuste de escolaridad se queda en deterioro leve', function () {
  var r = Scales.interpretar('moca', {
    visuoejec: 4, identificacion: 3, atencion: 5, lenguaje: 3, abstraccion: 2, recuerdo: 4, orientacion: 4
  }, { escolaridadAnios: 16 });
  eq(r.raw, 25); eq(r.label, 'sugiere deterioro cognitivo leve'); eq(r.cls, 'warn');
});

check('MoCA — el ajuste nunca supera 30', function () {
  var r = Scales.interpretar('moca', {
    visuoejec: 5, identificacion: 3, atencion: 6, lenguaje: 3, abstraccion: 2, recuerdo: 5, orientacion: 6
  }, { escolaridadAnios: 6 });
  eq(r.raw, 30);
});

/* ────────────────────────────────────────────────────────────────
 * Errores de uso
 * ──────────────────────────────────────────────────────────────── */
check('interpretar() lanza error con escala desconocida', function () {
  assert.throws(function () { Scales.interpretar('no-existe', {}); }, /Escala desconocida/);
});

/* ────────────────────────────────────────────────────────────────
 * plan-engine
 * ──────────────────────────────────────────────────────────────── */
check('generarPlan — Vivifrail pasaporte B+ por SPPB y TUG', function () {
  var records = {
    sppb: Scales.interpretar('sppb', { equilibrio: 1, marcha4m: 1, levantarse: 2 }), // raw=4 -> B
    tug: Scales.interpretar('tug', { valor: 15 })
  };
  var plan = PlanEngine.generarPlan({ records: records, paciente: {}, clinical: {}, morfo: {} });
  assert.ok(plan.recomendaciones.ejercicio, 'debería generar recomendación de ejercicio');
  assert.ok(/Pasaporte VIVIFRAIL B\+/.test(plan.recomendaciones.ejercicio.l[0]), 'esperaba pasaporte B+, obtenido: ' + plan.recomendaciones.ejercicio.l[0]);
});

check('generarPlan — sin datos no genera ejes', function () {
  var plan = PlanEngine.generarPlan({ records: {}, paciente: {}, clinical: {}, morfo: {} });
  eq(Object.keys(plan.recomendaciones).length, 0);
  eq(plan.clasificacion.length, 0);
});

check('generarPlan — anemia ferropénica genera recomendaciones de hierro', function () {
  var plan = PlanEngine.generarPlan({
    records: {}, paciente: { sexo: 'M' },
    clinical: { hb: 9.5, fer: 15, ist: 10 }, morfo: {}
  });
  assert.ok(plan.recomendaciones.anemia);
  assert.ok(plan.recomendaciones.anemia.l.some(function (x) { return /ferropénico/.test(x); }));
});

check('generarPlan — caídas se activa por FRAIL ≥3', function () {
  var records = { frail: Scales.interpretar('frail', { fatigue: 1, resistance: 1, aerobic: 1, illnesses: 0, lossweight: 0 }) };
  var plan = PlanEngine.generarPlan({ records: records, paciente: {}, clinical: {}, morfo: {} });
  assert.ok(plan.recomendaciones.caidas);
});

check('generarPlan — deterioro cognitivo se activa por MoCA <26', function () {
  var records = {
    moca: Scales.interpretar('moca', { visuoejec: 2, identificacion: 2, atencion: 3, lenguaje: 2, abstraccion: 1, recuerdo: 2, orientacion: 4 })
  };
  var plan = PlanEngine.generarPlan({ records: records, paciente: {}, clinical: {}, morfo: {} });
  assert.ok(plan.recomendaciones.demencia, 'MoCA bajo debería activar el eje de deterioro cognitivo');
});

check('generarPlan — STOPP/START solo lista lo marcado', function () {
  var plan = PlanEngine.generarPlan({
    records: {}, paciente: {}, morfo: {},
    clinical: { ss: { stopp_bzd: true, start_vacuna: true } }
  });
  eq(plan.recomendaciones.stopstart.l.length, 2);
});

/* ────────────────────────────────────────────────────────────────
 * Resultado
 * ──────────────────────────────────────────────────────────────── */
console.log('\n' + pass + ' pruebas OK, ' + fail + ' fallidas.');
if (fail) {
  console.log('\nFallos:');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
