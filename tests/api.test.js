'use strict';
/**
 * tests/api.test.js — prueba de integración end-to-end contra el
 * servidor real (server/index.js), levantado como proceso hijo sobre un
 * directorio de datos temporal y un puerto distinto al de producción,
 * para no pisar data/ ni el servidor que pueda estar en marcha.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const bcrypt = require('bcryptjs');

const ROOT = path.join(__dirname, '..');
const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;

let serverProc;
let dataDir;
let cookie = '';

function req(method, urlPath, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return fetch(BASE + urlPath, { method, headers, body: body ? JSON.stringify(body) : undefined }).then(async (res) => {
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) { /* respuesta binaria (docx) */ }
    return { status: res.status, json, buffer: json === null ? Buffer.from(text, 'binary') : null, headers: res.headers };
  });
}

test.before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vgi-test-data-'));
  fs.mkdirSync(path.join(dataDir, 'backups'), { recursive: true });
  const passwordHash = await bcrypt.hash('ClaveDePrueba123', 10);
  fs.writeFileSync(path.join(dataDir, 'users.json'), JSON.stringify([{
    id: 'u-test', username: 'test-admin', passwordHash, nombre: 'Admin de pruebas', rol: 'admin', activo: true, createdAt: new Date().toISOString(),
  }]));

  serverProc = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT: String(PORT), VGI_DATA_DIR: dataDir }),
    stdio: 'pipe',
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('el servidor de pruebas no arrancó a tiempo')), 8000);
    serverProc.stdout.on('data', (chunk) => { if (chunk.toString().includes('escuchando')) { clearTimeout(timeout); resolve(); } });
    serverProc.on('exit', (code) => reject(new Error('el servidor de pruebas terminó pronto, código ' + code)));
  });
});

test.after(() => {
  if (serverProc) serverProc.kill();
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

test('flujo completo: login -> paciente -> escalas -> plan -> validar -> exportar', async () => {
  const login = await req('POST', '/api/auth/login', { username: 'test-admin', password: 'ClaveDePrueba123' });
  assert.equal(login.status, 200, 'login debe funcionar con el usuario sembrado');

  const me = await req('GET', '/api/auth/me');
  assert.equal(me.json.user.username, 'test-admin');

  const scales = await req('GET', '/api/scales');
  assert.equal(scales.status, 200);
  assert.ok(Array.isArray(scales.json) && scales.json.length === 5, 'el catálogo debe tener 5 dominios');

  const patient = await req('POST', '/api/patients', { nhc: 'TEST-0001', nombre: 'Paciente de Test', fechaNacimiento: '1945-01-01', sexo: 'H', localizacion: 'U4' });
  assert.equal(patient.status, 201);
  const pid = patient.json.id;

  const dup = await req('POST', '/api/patients', { nhc: 'TEST-0001', nombre: 'Otro', fechaNacimiento: '1950-01-01', sexo: 'M', localizacion: 'U3' });
  assert.equal(dup.status, 409, 'un NHC duplicado debe rechazarse');

  const sppb = await req('POST', `/api/patients/${pid}/records`, {
    escalaId: 'sppb', fecha: '2026-08-19', valores: { equilibrio: 1, marcha4m: 2, levantarse: 1 },
  });
  assert.equal(sppb.status, 201);
  assert.equal(sppb.json.resultado.raw, 4, 'el servidor debe calcular la puntuación, no confiar en el cliente');
  assert.equal(sppb.json.userCodigo, 'test-admin', 'el registro debe llevar el código del usuario que lo creó');

  const planAntes = await req('GET', `/api/patients/${pid}/plan?fecha=2026-08-19`);
  assert.equal(planAntes.status, 200);
  assert.match(planAntes.json.recomendaciones.ejercicio.l[0], /Pasaporte VIVIFRAIL B/, 'SPPB 4 -> pasaporte B');

  const exportSinValidar = await req('GET', `/api/patients/${pid}/export/plan.docx?fecha=2026-08-19`);
  assert.equal(exportSinValidar.status, 403, 'no debe poder exportarse el plan sin validación humana');
  assert.equal(exportSinValidar.json.error, 'plan_no_validado');

  const validar = await req('POST', `/api/patients/${pid}/plan/validate`, { fecha: '2026-08-19' });
  assert.equal(validar.status, 201);

  const exportTrasValidar = await req('GET', `/api/patients/${pid}/export/plan.docx?fecha=2026-08-19`);
  assert.equal(exportTrasValidar.status, 200);
  assert.ok(exportTrasValidar.buffer && exportTrasValidar.buffer.length > 1000, 'el .docx generado debe tener contenido');

  const informe = await req('GET', `/api/patients/${pid}/export/informe.docx?fecha=2026-08-19`);
  assert.equal(informe.status, 200);

  const informePdf = await req('GET', `/api/patients/${pid}/export/informe.pdf?fecha=2026-08-19`);
  assert.equal(informePdf.status, 200);
  assert.ok(informePdf.buffer && informePdf.buffer.slice(0, 4).toString() === '%PDF', 'informe.pdf debe ser un PDF válido');

  const planPdf = await req('GET', `/api/patients/${pid}/export/plan.pdf?fecha=2026-08-19`);
  assert.equal(planPdf.status, 200);
  assert.ok(planPdf.buffer && planPdf.buffer.slice(0, 4).toString() === '%PDF', 'plan.pdf debe ser un PDF válido');

  // Datos agregados anonimizados (el usuario sembrado en before() es admin)
  const csv = await req('GET', '/api/export/aggregate.csv');
  assert.equal(csv.status, 200);
  const csvTexto = csv.buffer.toString('utf-8');
  assert.match(csvTexto, /pacienteId,localizacion,fecha,escalaId/, 'cabecera del CSV agregado');
  assert.doesNotMatch(csvTexto, /TEST-0001/, 'el CSV agregado no debe llevar el NHC del paciente');
  assert.match(csvTexto, new RegExp(pid), 'el CSV agregado sí lleva el id interno del paciente');

  const xlsx = await req('GET', '/api/export/aggregate.xlsx');
  assert.equal(xlsx.status, 200);
  assert.ok(xlsx.buffer && xlsx.buffer.length > 1000, 'el .xlsx agregado debe tener contenido');

  await req('POST', '/api/auth/logout');
  const meDespuesLogout = await req('GET', '/api/auth/me');
  assert.equal(meDespuesLogout.status, 401, 'tras logout no debe quedar sesión activa');
});

test('la exportación agregada requiere rol admin', async () => {
  const passwordHash = await bcrypt.hash('OtraClaveDePrueba123', 10);
  await fs.promises.readFile(path.join(dataDir, 'users.json'), 'utf-8').then(async (raw) => {
    const users = JSON.parse(raw);
    users.push({ id: 'u-clinico', username: 'clinico-test', passwordHash, nombre: 'Clínico de pruebas', rol: 'clinico', activo: true, createdAt: new Date().toISOString() });
    await fs.promises.writeFile(path.join(dataDir, 'users.json'), JSON.stringify(users));
  });

  const login = await req('POST', '/api/auth/login', { username: 'clinico-test', password: 'OtraClaveDePrueba123' });
  assert.equal(login.status, 200);

  const csv = await req('GET', '/api/export/aggregate.csv');
  assert.equal(csv.status, 403, 'un rol "clinico" no debe poder exportar los datos agregados');
  assert.equal(csv.json.error, 'permiso_denegado');
});

test('rutas /api/* sin sesión devuelven 401', async () => {
  cookie = '';
  const res = await req('GET', '/api/patients');
  assert.equal(res.status, 401);
  assert.equal(res.json.error, 'no_autenticado');
});
