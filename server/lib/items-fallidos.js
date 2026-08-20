/**
 * server/lib/items-fallidos.js — detecta, ítem por ítem, en qué falla el
 * paciente dentro de una escala ya registrada (VGI+).
 *
 * Petición explícita de Bea: el informe no debe limitarse a la puntuación
 * total y su interpretación, sino detallar los ítems concretos en los que
 * el paciente no obtuvo la mejor puntuación posible (p. ej. en Barthel,
 * qué actividades básicas requieren ayuda; en Pfeiffer, qué preguntas
 * falló).
 *
 * Solo tiene sentido para escalas con `items[].opciones[]` (todas las de
 * tipo "suma" — Barthel, Lawton, Katz, FRAIL, Fried, SARC-F, SPPB, 4AT — y
 * las de tipo propio que reutilizan la misma forma de ítem: MMSE, Pfeiffer,
 * MoCA, Test del Reloj). El resto (Charlson, CIRS-G, GLIM, MNA, CFS,
 * IF-VIG, marcha, grip, TUG) no tiene un desglose ítem a ítem equivalente
 * y se deja fuera — devuelve [] para ellas.
 *
 * "Falla" = el paciente no obtuvo la opción más favorable de ese ítem. La
 * dirección (¿el valor más alto es el mejor, o el más bajo?) depende de
 * cómo puntúa cada escala: para las de tipo "suma" se deduce de sus
 * `cortes` (si el primer tramo es "ok", el valor bajo es el mejor, y
 * viceversa); para las escalas de interpretación propia que no llevan
 * `cortes` (MMSE, Pfeiffer, MoCA, Test del Reloj) está fijada a mano, son
 * solo cuatro y se conocen bien.
 */
'use strict';

const DIRECCION_TIPO_PROPIO = {
  mmse: 'mayor_mejor',
  pfeiffer: 'menor_mejor',
  moca: 'mayor_mejor',
  reloj: 'mayor_mejor',
};

// Ítems que existen dentro de `items[]` pero no son una puntuación de
// desempeño del paciente (son un ajuste, p. ej. el nivel de escolaridad
// de Pfeiffer) — no tiene sentido listarlos como "ítem fallado".
const ITEMS_EXCLUIDOS = new Set(['escolaridad']);

function direccionDe(esc) {
  if (Array.isArray(esc.cortes) && esc.cortes.length) {
    return esc.cortes[0][2] === 'ok' ? 'menor_mejor' : 'mayor_mejor';
  }
  return DIRECCION_TIPO_PROPIO[esc.tipo] || null;
}

/**
 * @param {object} esc definición de la escala (shared/scales.js ESCALAS[id])
 * @param {object} valores lo guardado en record.valores ({[itemId]: valorNumerico})
 * @returns {Array<{pregunta:string, etiqueta:string}>} ítems en los que el
 *   paciente no obtuvo la mejor puntuación, en el mismo orden que la escala.
 */
function itemsFallidos(esc, valores) {
  if (!esc || !Array.isArray(esc.items) || !valores) return [];
  const direccion = direccionDe(esc);
  if (!direccion) return [];

  const resultado = [];
  esc.items.forEach((it) => {
    if (!it.opciones || ITEMS_EXCLUIDOS.has(it.id)) return;
    const val = valores[it.id];
    if (val == null) return;
    const valoresPosibles = it.opciones.map((o) => o.valor);
    const mejorValor = direccion === 'mayor_mejor' ? Math.max(...valoresPosibles) : Math.min(...valoresPosibles);
    if (val === mejorValor) return;
    const opcion = it.opciones.find((o) => o.valor === val);
    resultado.push({ pregunta: it.pregunta, etiqueta: opcion ? opcion.etiqueta : String(val) });
  });
  return resultado;
}

module.exports = { itemsFallidos };
