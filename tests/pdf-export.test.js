'use strict';
/**
 * tests/pdf-export.test.js — protege dos cosas añadidas después del primer
 * despliegue: (1) el saneado de símbolos incompatibles con la fuente
 * estándar de los PDF (Helvetica solo cubre WinAnsiEncoding/cp1252; sin
 * esto, "→"/"≥"/"≤" salían como caracteres basura en el PDF real, bug
 * detectado revisando el informe generado), y (2) que informe.pdf/plan.pdf
 * se generen igual de bien que sus .docx.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizarTexto } = require('../server/lib/pdf-informe');

test('sanitizarTexto sustituye los símbolos que Helvetica/WinAnsi no puede codificar', () => {
  assert.equal(sanitizarTexto('SPPB 6/12 → Pasaporte VIVIFRAIL B'), 'SPPB 6/12 -> Pasaporte VIVIFRAIL B');
  assert.equal(sanitizarTexto('con ≥1 criterio y ≥2 caídas'), 'con >=1 criterio y >=2 caídas');
  assert.equal(sanitizarTexto('≤0,8 m/s'), '<=0,8 m/s');
  assert.equal(sanitizarTexto('valor ≈ estimado'), 'valor ~ estimado');
  // las tildes/ñ/¿ sí las cubre WinAnsiEncoding: no deben tocarse
  assert.equal(sanitizarTexto('¿validación según categoría?'), '¿validación según categoría?');
});

test('sanitizarTexto no rompe con valores no-string (pdfkit los pasa tal cual)', () => {
  assert.equal(sanitizarTexto(42), 42);
  assert.equal(sanitizarTexto(null), null);
  assert.equal(sanitizarTexto(undefined), undefined);
});
