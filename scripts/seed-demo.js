#!/usr/bin/env node
/**
 * scripts/seed-demo.js — datos sintéticos de demostración (VGI+).
 *
 * Crea varios pacientes ficticios con varias visitas en el tiempo (para
 * poder ver la gráfica de seguimiento con más de un punto) y valida el
 * plan de la visita más reciente de cada uno. Pensado para explorar la
 * aplicación o enseñarla, NUNCA para producción — no usar con datos de
 * pacientes reales.
 *
 * Uso: con el servidor arrancado (`npm start`) y un usuario ya creado
 * (`npm run seed:admin`), ejecutar en otra terminal:
 *   node scripts/seed-demo.js <usuario> <contraseña> [url_base]
 */
'use strict';

const BASE = process.argv[4] || 'http://localhost:3000';
const USERNAME = process.argv[2];
const PASSWORD = process.argv[3];

if (!USERNAME || !PASSWORD) {
  console.error('Uso: node scripts/seed-demo.js <usuario> <contraseña> [url_base]');
  process.exit(1);
}

let cookie = '';

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) { /* no es JSON */ }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${json && json.mensaje ? json.mensaje : text}`);
  return json;
}

/* ── Pacientes sintéticos con varias visitas cada uno ──────────────── */
const PACIENTES = [
  {
    nhc: 'DEMO-001', nombre: 'Domínguez Ruiz, María', fechaNacimiento: '1938-04-12', sexo: 'M', localizacion: 'U3',
    visitas: [
      { fecha: '2026-06-22', morfo: { peso: 54.0, talla: 155 }, escalas: { sppb: { equilibrio: 1, marcha4m: 1, levantarse: 1 }, tug: { valor: 22 }, frail: { fatigue: 1, resistance: 1, aerobic: 1, illnesses: 0, lossweight: 1 }, barthel: bar(70), mmse: mmse(26) }, clinical: { vitd: 16 } },
      { fecha: '2026-07-20', morfo: { peso: 55.2, talla: 155 }, escalas: { sppb: { equilibrio: 2, marcha4m: 2, levantarse: 2 }, tug: { valor: 16 }, frail: { fatigue: 1, resistance: 0, aerobic: 1, illnesses: 0, lossweight: 0 }, barthel: bar(80), mmse: mmse(27) }, clinical: { vitd: 24 } },
      { fecha: '2026-08-20', morfo: { peso: 56.0, talla: 155 }, escalas: { sppb: { equilibrio: 3, marcha4m: 3, levantarse: 3 }, tug: { valor: 11 }, frail: { fatigue: 0, resistance: 0, aerobic: 0, illnesses: 0, lossweight: 0 }, barthel: bar(90), mmse: mmse(28) }, clinical: { vitd: 31 }, validarPlan: true },
    ],
  },
  {
    nhc: 'DEMO-002', nombre: 'Reyes Molina, Antonio', fechaNacimiento: '1941-11-03', sexo: 'H', localizacion: 'U4',
    visitas: [
      { fecha: '2026-07-08', escalas: { mmse: mmse(22), '4at': { consciencia: 0, amt4: 0, atencion: 0, cambio_agudo: 0 }, barthel: bar(85) } },
      { fecha: '2026-07-29', escalas: { '4at': { consciencia: 4, amt4: 2, atencion: 2, cambio_agudo: 4 }, barthel: bar(55) }, validarPlan: true },
      { fecha: '2026-08-19', escalas: { '4at': { consciencia: 0, amt4: 1, atencion: 0, cambio_agudo: 0 }, mmse: mmse(21), barthel: bar(75) }, validarPlan: true },
    ],
  },
  {
    nhc: 'DEMO-003', nombre: 'Jiménez Ortega, Carmen', fechaNacimiento: '1945-02-27', sexo: 'M', localizacion: 'U8',
    visitas: [
      { fecha: '2026-06-15', morfo: { peso: 48.0, talla: 150 }, escalas: { sarcf: sarcf(5), gait: { valor: 0.6 } } },
      { fecha: '2026-07-13', morfo: { peso: 50.1, talla: 150 }, escalas: { sarcf: sarcf(3), gait: { valor: 0.75 } } },
      { fecha: '2026-08-18', morfo: { peso: 52.3, talla: 150 }, escalas: { sarcf: sarcf(1), gait: { valor: 0.95 } }, validarPlan: true },
    ],
  },
  {
    nhc: 'DEMO-004', nombre: 'Torres Gil, Francisco', fechaNacimiento: '1943-09-30', sexo: 'H', localizacion: 'U3',
    visitas: [
      { fecha: '2026-06-30', escalas: { tug: { valor: 15 }, katz: katz(3) } },
      { fecha: '2026-07-28', escalas: { tug: { valor: 14 }, katz: katz(2) } },
      { fecha: '2026-08-17', escalas: { tug: { valor: 12.5 }, katz: katz(1) }, validarPlan: true },
    ],
  },
];

// Helpers para construir "valores" de escalas de suma sin escribir cada ítem a mano.
function bar(total) {
  // Reparte la puntuación de Barthel entre sus ítems de forma simple y determinista.
  const items = { comer: 10, traslado: 15, aseo: 5, retrete: 10, banarse: 5, desplazarse: 15, escaleras: 10, vestirse: 10, heces: 10, orina: 10 };
  const keys = Object.keys(items);
  let restante = total, out = {};
  keys.forEach((k) => { const v = Math.min(items[k], Math.max(0, restante)); out[k] = v; restante -= v; });
  return out;
}
function mmse(total) {
  // 5+5+3+5+3+9 = 30. Reparte de mayor a menor dominio.
  const max = { ot: 5, oe: 5, fij: 3, ac: 5, rd: 3, len: 9 };
  let restante = total, out = {};
  Object.keys(max).forEach((k) => { const v = Math.min(max[k], Math.max(0, restante)); out[k] = v; restante -= v; });
  return out;
}
function sarcf(total) {
  const keys = ['fuerza', 'caminar', 'levantarse', 'escaleras', 'caidas'];
  let restante = total, out = {};
  keys.forEach((k) => { const v = Math.min(2, Math.max(0, restante)); out[k] = v; restante -= v; });
  return out;
}
function katz(dependientes) {
  const keys = ['bano', 'vestido', 'retrete', 'movilidad', 'continencia', 'alimentacion'];
  let restante = dependientes, out = {};
  keys.forEach((k) => { const v = restante > 0 ? 1 : 0; out[k] = v; restante -= v; });
  return out;
}

async function main() {
  await req('POST', '/api/auth/login', { username: USERNAME, password: PASSWORD });
  console.log('Sesión iniciada como', USERNAME);

  for (const p of PACIENTES) {
    let patient;
    try {
      patient = await req('POST', '/api/patients', { nhc: p.nhc, nombre: p.nombre, fechaNacimiento: p.fechaNacimiento, sexo: p.sexo, localizacion: p.localizacion });
      console.log('Paciente creado:', p.nombre, '(' + p.nhc + ')');
    } catch (e) {
      if (String(e.message).includes('409')) {
        const existentes = await req('GET', `/api/patients?q=${encodeURIComponent(p.nhc)}`);
        patient = existentes[0];
        console.log('Paciente ya existía, reutilizando:', p.nombre);
      } else throw e;
    }

    for (const v of p.visitas) {
      if (v.morfo) await req('POST', `/api/patients/${patient.id}/morfo`, { fecha: v.fecha, ...v.morfo });
      if (v.clinical) await req('POST', `/api/patients/${patient.id}/clinical`, { fecha: v.fecha, valores: v.clinical });
      for (const [escalaId, valores] of Object.entries(v.escalas || {})) {
        await req('POST', `/api/patients/${patient.id}/records`, { escalaId, fecha: v.fecha, valores });
      }
      if (v.validarPlan) {
        await req('POST', `/api/patients/${patient.id}/plan/validate`, { fecha: v.fecha });
      }
      console.log('  Visita', v.fecha, 'registrada' + (v.validarPlan ? ' (plan validado)' : ''));
    }
  }

  console.log('\nListo. ' + PACIENTES.length + ' pacientes sintéticos con seguimiento cargados.');
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
