/**
 * server/store/collectionStore.js — store genérico por colección (VGI+).
 *
 * Cada colección (`users`, `patients`, `records`, `morfo`, `clinical`,
 * `planValidations`) vive en su propio archivo JSON bajo `data/`, como si
 * fuera una tabla: un array de objetos con `id` (crypto.randomUUID()).
 * Expone `list()`, `get(id)`, `create(obj)`, `update(id, patch)`,
 * `remove(id)` — la forma que pide docs/API_CONTRACT.md para que el día de
 * mañana cambiar a SQLite sea solo reimplementar este archivo, sin tocar
 * `server/routes/`.
 *
 * Todas las operaciones pasan por `jsonStore.update()`, que encola
 * lectura+escritura como una única operación atómica por archivo — así dos
 * peticiones que crean/actualizan registros a la vez nunca se pisan.
 */
'use strict';

const path = require('path');
const crypto = require('crypto');
const jsonStore = require('./jsonStore');

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');

function filePathFor(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function createCollectionStore(name) {
  const filePath = filePathFor(name);

  return {
    /** Devuelve todos los registros de la colección. */
    list() {
      return jsonStore.readJson(filePath, []);
    },

    /** Devuelve un registro por id, o null si no existe. */
    async get(id) {
      const all = await jsonStore.readJson(filePath, []);
      return all.find((item) => item.id === id) || null;
    },

    /** Crea un registro nuevo (asigna id si no lo trae) y lo persiste. */
    create(obj) {
      return jsonStore.update(filePath, [], (all) => {
        const record = Object.assign({ id: crypto.randomUUID() }, obj);
        all.push(record);
        return { data: all, value: record };
      });
    },

    /**
     * Aplica `patch` sobre el registro `id` y lo persiste. Devuelve el
     * registro actualizado, o null si no existía.
     */
    update(id, patch) {
      return jsonStore.update(filePath, [], (all) => {
        const idx = all.findIndex((item) => item.id === id);
        if (idx === -1) return { data: all, value: null };
        all[idx] = Object.assign({}, all[idx], patch, { id: all[idx].id });
        return { data: all, value: all[idx] };
      });
    },

    /** Elimina el registro `id`. Devuelve true si existía. */
    remove(id) {
      return jsonStore.update(filePath, [], (all) => {
        const idx = all.findIndex((item) => item.id === id);
        if (idx === -1) return { data: all, value: false };
        all.splice(idx, 1);
        return { data: all, value: true };
      });
    },
  };
}

module.exports = { createCollectionStore, DATA_DIR };
