/**
 * public/js/utils.js — utilidades pequeñas compartidas por el frontend.
 * Nada de esto depende de la API ni de shared/; son helpers de DOM/fecha.
 */
const $ = (id) => document.getElementById(id);

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

// YYYY-MM-DD de hoy, para el <input type="date"> por defecto
// (regla de negocio 1: la fecha de hoy siempre por defecto, editable).
function hoyISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fmtFechaES(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Edad en años a partir de una fecha de nacimiento y una fecha de referencia,
// ambas YYYY-MM-DD. Solo para la vista previa en el navegador — la edad
// autoritativa para el cálculo de Charlson la recalcula el servidor.
function calcEdad(fechaNacimientoISO, fechaRefISO) {
  if (!fechaNacimientoISO) return null;
  const nac = new Date(fechaNacimientoISO + 'T00:00:00');
  const ref = new Date((fechaRefISO || hoyISO()) + 'T00:00:00');
  if (isNaN(nac.getTime()) || isNaN(ref.getTime())) return null;
  let edad = ref.getFullYear() - nac.getFullYear();
  const m = ref.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < nac.getDate())) edad--;
  return edad;
}

// Clase CSS del recuadro de resultado / badge a partir de resultado.cls
// ("ok"|"warn"|"alert"|"neutro"), tal cual lo define shared/scales.js.
function clsRes(cls) {
  return 'res res-' + (cls || 'neutro');
}

function mostrarEstado(id, msg, tipo) {
  const e = $(id);
  if (!e) return;
  e.className = 'status ' + tipo;
  e.textContent = msg;
}

function limpiarEstado(id) {
  const e = $(id);
  if (!e) return;
  e.className = 'status';
  e.textContent = '';
}
