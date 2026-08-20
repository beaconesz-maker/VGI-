/**
 * server/lib/docx-plan.js — plan de recomendaciones .docx (VGI+).
 */
'use strict';

const { Document, Paragraph, TextRun, HeadingLevel } = require('docx');
const { cabeceraPaciente, piePagina } = require('./docx-informe');

const ORDEN_EJES = ['ejercicio', 'nutricion', 'caidas', 'delirium', 'demencia', 'anemia', 'vitd', 'glucemia', 'stopstart'];

function construirPlanDocx({ patient, fecha, edad, plan, validacion }) {
  const children = cabeceraPaciente(patient, fecha, edad);

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text:
            'Plan validado el ' +
            new Date(validacion.validatedAt).toLocaleString('es-ES') +
            ' por ' +
            (validacion.userCodigo || validacion.userId),
          italics: true,
          size: 18,
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300 },
      children: [new TextRun({ text: 'Plan de recomendaciones y medidas', color: '1F3864' })],
    })
  );

  const rec = plan.recomendaciones || {};
  const ejes = ORDEN_EJES.filter((k) => rec[k]);
  if (!ejes.length) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Sin recomendaciones generadas para los datos disponibles en esta fecha.', italics: true })],
      })
    );
  }
  ejes.forEach((k) => {
    const bloque = rec[k];
    children.push(
      new Paragraph({
        spacing: { before: 200 },
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: bloque.t, color: '1F3864' })],
      })
    );
    (bloque.l || []).forEach((medida) => {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: medida })],
        })
      );
    });
    if (bloque.f) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Referencia: ' + bloque.f, italics: true, size: 18, color: '555555' })],
        })
      );
    }
  });

  children.push(piePagina());

  return new Document({
    sections: [{ properties: {}, children }],
  });
}

module.exports = { construirPlanDocx };
