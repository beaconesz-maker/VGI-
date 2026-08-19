#!/usr/bin/env node
/**
 * scripts/backup.js — copia de seguridad manual (VGI+).
 *
 * `npm run backup` copia data/*.json a backups/AAAA-MM-DD/ (si no existe
 * ya la de hoy) y purga carpetas de más de 30 días. Es la misma lógica que
 * ejecuta el servidor automáticamente cada hora (server/index.js) —
 * pensado para lanzarlo a mano justo antes de una operación delicada.
 */
'use strict';

const path = require('path');
const { asegurarBackupHoy } = require('../server/lib/backup');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const BACKUPS_DIR = path.resolve(__dirname, '..', 'backups');

const creado = asegurarBackupHoy(DATA_DIR, BACKUPS_DIR);
if (!creado) {
  console.log('[backup] ya existía una copia de seguridad de hoy; no se ha creado ninguna nueva.');
}
