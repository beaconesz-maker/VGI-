/**
 * server/lib/vigente.js — helpers para "el registro vigente a fecha X".
 *
 * Usado por GET /api/patients/:id/plan y por GET /api/patients/:id/clinical
 * (sin `fecha`): "vigente" = el más reciente cuya `fecha` sea <= la fecha
 * pedida (nunca uno posterior — regla de negocio 1: la fecha la elige el
 * clínico, y el plan/valoración de una fecha pasada no debe verse afectado
 * por datos introducidos después de esa fecha).
 */
'use strict';

/**
 * @param {Array<{fecha:string}>} items
 * @param {string} fecha 'YYYY-MM-DD'
 * @returns el item con fecha <= `fecha` más reciente, o null
 */
function masRecienteHasta(items, fecha) {
  const candidatos = items.filter((it) => !fecha || it.fecha <= fecha);
  if (!candidatos.length) return null;
  return candidatos.reduce((mejor, actual) => {
    if (!mejor) return actual;
    if (actual.fecha > mejor.fecha) return actual;
    // a igualdad de fecha, gana el creado más tarde (createdAt)
    if (actual.fecha === mejor.fecha && (actual.createdAt || '') > (mejor.createdAt || '')) return actual;
    return mejor;
  }, null);
}

/**
 * Agrupa `records` (de todas las escalas de un paciente) por escalaId,
 * quedándose con el vigente a `fecha` de cada una.
 * @returns {Object<string, object>} {[escalaId]: record}
 */
function registrosVigentesPorEscala(records, fecha) {
  const porEscala = {};
  records.forEach((r) => {
    if (!porEscala[r.escalaId]) porEscala[r.escalaId] = [];
    porEscala[r.escalaId].push(r);
  });
  const vigentes = {};
  Object.keys(porEscala).forEach((escalaId) => {
    const v = masRecienteHasta(porEscala[escalaId], fecha);
    if (v) vigentes[escalaId] = v;
  });
  return vigentes;
}

module.exports = { masRecienteHasta, registrosVigentesPorEscala };
