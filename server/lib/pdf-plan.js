/**
 * server/lib/pdf-plan.js — plan de recomendaciones .pdf (VGI+).
 * Mismo contenido que server/lib/docx-plan.js, generado con pdfkit.
 */
'use strict';

const { cabeceraPaciente, piePagina, docToBuffer, crearPdf } = require('./pdf-informe');

const AZUL = '#0B4C73';
const GRIS = '#555555';
const ORDEN_EJES = ['ejercicio', 'nutricion', 'caidas', 'delirium', 'demencia', 'anemia', 'vitd', 'glucemia', 'stopstart'];

async function construirPlanPdf({ patient, fecha, edad, plan, validacion }) {
  const doc = crearPdf({ margin: 50, bufferPages: true });
  const bufferPromise = docToBuffer(doc);

  cabeceraPaciente(doc, patient, fecha, edad);

  doc.fontSize(9).fillColor(GRIS).font('Helvetica-Oblique').text(
    'Plan validado el ' + new Date(validacion.validatedAt).toLocaleString('es-ES') + ' por ' + (validacion.userCodigo || validacion.userId)
  );
  doc.font('Helvetica').fillColor('#000').moveDown(0.6);

  doc.fontSize(14).fillColor(AZUL).text('Plan de recomendaciones y medidas');
  doc.fillColor('#000');

  const rec = plan.recomendaciones || {};
  const ejes = ORDEN_EJES.filter((k) => rec[k]);
  if (!ejes.length) {
    doc.fontSize(11).font('Helvetica-Oblique').text('Sin recomendaciones generadas para los datos disponibles en esta fecha.');
    doc.font('Helvetica');
  }
  ejes.forEach((k) => {
    const bloque = rec[k];
    if (doc.y > doc.page.height - 160) doc.addPage();
    doc.moveDown(0.6);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(AZUL).text(bloque.t);
    doc.font('Helvetica').fillColor('#000').fontSize(10);
    (bloque.l || []).forEach((medida) => {
      doc.text('•  ' + medida, { indent: 10 });
    });
    if (bloque.f) {
      doc.fontSize(9).fillColor(GRIS).font('Helvetica-Oblique').text('Referencia: ' + bloque.f);
      doc.font('Helvetica').fillColor('#000');
    }
  });

  piePagina(doc);
  doc.end();
  return bufferPromise;
}

module.exports = { construirPlanPdf };
