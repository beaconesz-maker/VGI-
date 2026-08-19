/**
 * server/store/index.js — stores de cada colección (VGI+).
 *
 * Punto único de acceso a los datos: las rutas importan de aquí, nunca de
 * `collectionStore.js` ni de `jsonStore.js` directamente ni de `fs`.
 */
'use strict';

const { createCollectionStore } = require('./collectionStore');

module.exports = {
  users: createCollectionStore('users'),
  patients: createCollectionStore('patients'),
  records: createCollectionStore('records'),
  morfo: createCollectionStore('morfo'),
  clinical: createCollectionStore('clinical'),
  planValidations: createCollectionStore('plan_validations'),
};
