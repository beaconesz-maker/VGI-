/**
 * server/lib/docx-informe.js — informe .docx de escalas registradas (VGI+).
 */
'use strict';

const { Document, Paragraph, TextRun, HeadingLevel, BorderStyle } = require('docx');

const DISCLAIMER =
  'Herramienta de apoyo a la decisión clínica. No sustituye el juicio ' +
  'clínico del médico responsable, que toma y firma toda decisión asistencial.';

function piePagina() {
  return new Paragraph({
    spacing: { before: 400 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: '1F3864' } },
    children: [
      new TextRun({ text: DISCLAIMER, italics: true, size: 18, color: '444444' }),
    ],
  });
}

function cabeceraPaciente(patient, fecha, edad) {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'VGI+ — Informe de valoración', color: '1F3864' })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: 'Hospital San Juan Grande (Jerez de la Frontera)', italics: true, size: 20 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Paciente: ', bold: true }),
        new TextRun({ text: patient.nombre || '—' }),
        new TextRun({ text: '    NHC: ', bold: true }),
        new TextRun({ text: patient.nhc || '—' }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Fecha de nacimiento: ', bold: true }),
        new TextRun({ text: patient.fechaNacimiento || '—' }),
        new TextRun({ text: (edad != null ? '  (' + edad + ' años a fecha del informe)' : '') }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Sexo: ', bold: true }),
        new TextRun({ text: patient.sexo || '—' }),
        new TextRun({ text: '    Localización: ', bold: true }),
        new TextRun({ text: patient.localizacion || '—' }),
      ],
    }),
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({ text: 'Fecha del informe: ', bold: true }),
        new TextRun({ text: fecha }),
      ],
    }),
  ];
}

/**
 * @param {object} patient
 * @param {string} fecha
 * @param {number|null} edad
 * @param {Object<string, object>} vigentesPorEscala {[escalaId]: record}
 * @param {object} scalesCatalog shared/scales.js require()d ({ESCALAS})
 */
function construirInformeDocx({ patient, fecha, edad, vigentesPorEscala, scalesCatalog }) {
  const children = cabeceraPaciente(patient, fecha, edad);

  const escalaIds = Object.keys(vigentesPorEscala).sort();
  if (!escalaIds.length) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'No hay escalas registradas hasta la fecha indicada.', italics: true })],
      })
    );
  } else {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: 'Escalas registradas', color: '1F3864' })],
      })
    );
    escalaIds.forEach((escalaId) => {
      const record = vigentesPorEscala[escalaId];
      const esc = (scalesCatalog.ESCALAS || {})[escalaId];
      const nombre = esc ? esc.nombre + (esc.sub ? ' (' + esc.sub + ')' : '') : escalaId;
      const resultado = record.resultado || {};
      children.push(
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({ text: nombre, bold: true, size: 22 })],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Fecha del registro: ' + record.fecha + '    Registrado por: ' + (record.userCodigo || '—') }),
          ],
        }),
        new Paragraph({
          children: [new TextRun({ text: resultado.texto || resultado.label || '(sin interpretación)' })],
        })
      );
      if (esc && esc.referencia && esc.referencia.texto) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: 'Referencia: ' + esc.referencia.texto, italics: true, size: 18, color: '555555' })],
          })
        );
      }
    });
  }

  children.push(piePagina());

  return new Document({
    sections: [{ properties: {}, children }],
  });
}

module.exports = { construirInformeDocx, DISCLAIMER, piePagina, cabeceraPaciente };
