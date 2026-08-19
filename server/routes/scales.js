/**
 * server/routes/scales.js — catálogo de escalas (VGI+).
 *
 * El frontend NO hardcodea escalas: las pinta a partir de esta ruta, que
 * expone tal cual el catálogo agrupado por dominio de shared/scales.js.
 */
'use strict';

const express = require('express');
const scales = require('../../shared/scales.js');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(scales.catalogo());
});

module.exports = router;
