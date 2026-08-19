/**
 * server/lib/backup.js — copia de seguridad diaria local (VGI+).
 *
 * Compartido entre `scripts/backup.js` (manual) y `server/index.js`
 * (automático: al arrancar y cada hora comprueba si ya existe el backup
 * de hoy). Copia `data/*.json` a `backups/AAAA-MM-DD/` y conserva como
 * máximo los últimos 30 días de carpetas.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const MAX_DIAS = 30;

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Crea el backup de hoy si todavía no existe, y purga carpetas antiguas.
 * Devuelve true si se creó un backup nuevo, false si ya existía.
 */
function asegurarBackupHoy(dataDir, backupsDir) {
  const fecha = hoyISO();
  const destino = path.join(backupsDir, fecha);
  let creado = false;
  if (!fs.existsSync(destino)) {
    fs.mkdirSync(destino, { recursive: true });
    let archivos = [];
    if (fs.existsSync(dataDir)) {
      archivos = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));
    }
    archivos.forEach((f) => {
      fs.copyFileSync(path.join(dataDir, f), path.join(destino, f));
    });
    creado = true;
    console.log(`[backup] copia de seguridad creada en ${destino} (${archivos.length} archivo(s))`);
  }
  purgarAntiguos(backupsDir, MAX_DIAS);
  return creado;
}

/** Borra carpetas de backup (AAAA-MM-DD) más allá de las `maxDias` más recientes. */
function purgarAntiguos(backupsDir, maxDias) {
  if (!fs.existsSync(backupsDir)) return;
  const carpetas = fs
    .readdirSync(backupsDir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .sort(); // orden lexicográfico ISO = orden cronológico
  const exceso = carpetas.length - maxDias;
  if (exceso <= 0) return;
  carpetas.slice(0, exceso).forEach((name) => {
    fs.rmSync(path.join(backupsDir, name), { recursive: true, force: true });
    console.log(`[backup] carpeta antigua eliminada: ${name}`);
  });
}

module.exports = { asegurarBackupHoy, purgarAntiguos, MAX_DIAS };
