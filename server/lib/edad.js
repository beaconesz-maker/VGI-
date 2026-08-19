/**
 * server/lib/edad.js — cálculo de edad en años a una fecha de referencia.
 *
 * Usado para construir `contexto.edadAnios` (shared/scales.js) y
 * `paciente.edadAnios` (shared/plan-engine.js): la edad se calcula "a
 * fecha del registro", no la edad actual del paciente — dos registros del
 * mismo paciente en fechas distintas pueden dar edades distintas.
 */
'use strict';

/**
 * @param {string} fechaNacimiento 'YYYY-MM-DD'
 * @param {string} fechaReferencia 'YYYY-MM-DD' (por defecto, hoy)
 * @returns {number|null} edad en años cumplidos, o null si falta algún dato
 */
function edadAnios(fechaNacimiento, fechaReferencia) {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(fechaNacimiento + 'T00:00:00');
  const referencia = new Date((fechaReferencia || hoyISO()) + 'T00:00:00');
  if (isNaN(nacimiento.getTime()) || isNaN(referencia.getTime())) return null;
  let edad = referencia.getFullYear() - nacimiento.getFullYear();
  const meses = referencia.getMonth() - nacimiento.getMonth();
  if (meses < 0 || (meses === 0 && referencia.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad;
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = { edadAnios, hoyISO };
