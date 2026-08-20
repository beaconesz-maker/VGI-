/**
 * server/lib/pdf-informe.js — informe .pdf de escalas registradas (VGI+).
 *
 * Mismo contenido que server/lib/docx-informe.js (misma cabecera de
 * paciente, mismas escalas, mismo pie de página con el disclaimer) pero
 * generado con pdfkit en vez de la librería docx. Se mantienen ambos
 * formatos porque el encargo original pide poder exportar a Word Y a PDF.
 */
'use strict';

const PDFDocument = require('pdfkit');
const { itemsFallidos } = require('./items-fallidos');

const AZUL = '#0B4C73';
const GRIS = '#555555';

const DISCLAIMER =
  'Herramienta de apoyo a la decisión clínica. No sustituye el juicio ' +
  'clínico del médico responsable, que toma y firma toda decisión asistencial.';

// Las fuentes estándar de PDF (Helvetica) sólo cubren WinAnsiEncoding
// (cp1252): las tildes/ñ/¿ funcionan, pero símbolos como → ≥ ≤ − ≈ no
// existen ahí y pdfkit los sustituye por caracteres basura en vez de
// avisar. shared/scales.js y shared/plan-engine.js los usan en textos
// clínicos reales (cortes de interpretación, plan de recomendaciones), así
// que se sustituyen por su equivalente ASCII antes de escribir cualquier
// texto al PDF. El .docx no tiene este problema (XML en UTF-8 completo).
const SUSTITUCIONES = [
  [/→/g, '->'],
  [/−/g, '-'], // signo menos (U+2212), distinto del guion normal
  [/≈/g, '~'],
  [/≤/g, '<='],
  [/≥/g, '>='],
  [/─/g, '-'],
];

function sanitizarTexto(s) {
  if (typeof s !== 'string') return s;
  return SUSTITUCIONES.reduce((acc, [patron, reemplazo]) => acc.replace(patron, reemplazo), s);
}

/** Crea un PDFDocument con `.text()` parcheado para sanear automáticamente
 * los símbolos incompatibles con WinAnsiEncoding en cada llamada. */
function crearPdf(opciones) {
  const doc = new PDFDocument(opciones);
  const textoOriginal = doc.text.bind(doc);
  doc.text = (texto, ...resto) => textoOriginal(sanitizarTexto(texto), ...resto);
  return doc;
}

function docToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function cabeceraPaciente(doc, patient, fecha, edad) {
  doc.fontSize(18).fillColor(AZUL).text('VGI+ — Informe de valoración', { continued: false });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor('#000').font('Helvetica-Oblique').text('Hospital San Juan Grande (Jerez de la Frontera)');
  doc.font('Helvetica').moveDown(0.6);

  doc.fontSize(11);
  doc.text(`Paciente: ${patient.nombre || '—'}    NHC: ${patient.nhc || '—'}`);
  doc.text(`Fecha de nacimiento: ${patient.fechaNacimiento || '—'}${edad != null ? '  (' + edad + ' años a fecha del informe)' : ''}`);
  doc.text(`Sexo: ${patient.sexo || '—'}    Localización: ${patient.localizacion || '—'}`);
  doc.text(`Fecha del informe: ${fecha}`);
  doc.moveDown(0.8);
}

function piePagina(doc) {
  doc.moveDown(1.2);
  const y = doc.y;
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor(AZUL).lineWidth(1).stroke();
  doc.moveDown(0.4);
  doc.fontSize(9).fillColor(GRIS).font('Helvetica-Oblique').text(DISCLAIMER);
  doc.font('Helvetica');
}

/**
 * @param {object} patient
 * @param {string} fecha
 * @param {number|null} edad
 * @param {Object<string, object>} vigentesPorEscala {[escalaId]: record}
 * @param {object} scalesCatalog shared/scales.js require()d ({ESCALAS})
 */
async function construirInformePdf({ patient, fecha, edad, vigentesPorEscala, scalesCatalog }) {
  const doc = crearPdf({ margin: 50, bufferPages: true });
  const bufferPromise = docToBuffer(doc);

  cabeceraPaciente(doc, patient, fecha, edad);

  const escalaIds = Object.keys(vigentesPorEscala).sort();
  if (!escalaIds.length) {
    doc.fontSize(11).font('Helvetica-Oblique').text('No hay escalas registradas hasta la fecha indicada.');
    doc.font('Helvetica');
  } else {
    doc.fontSize(14).fillColor(AZUL).text('Escalas registradas');
    doc.fillColor('#000');
    escalaIds.forEach((escalaId) => {
      const record = vigentesPorEscala[escalaId];
      const esc = (scalesCatalog.ESCALAS || {})[escalaId];
      const nombre = esc ? esc.nombre + (esc.sub ? ' (' + esc.sub + ')' : '') : escalaId;
      const resultado = record.resultado || {};

      if (doc.y > doc.page.height - 140) doc.addPage();
      doc.moveDown(0.6);
      doc.fontSize(12).font('Helvetica-Bold').text(nombre);
      doc.font('Helvetica').fontSize(10);
      doc.text(`Fecha del registro: ${record.fecha}    Registrado por: ${record.userCodigo || '—'}`);
      doc.fontSize(11).text(resultado.texto || resultado.label || '(sin interpretación)');
      const fallos = esc ? itemsFallidos(esc, record.valores) : [];
      if (fallos.length) {
        if (doc.y > doc.page.height - 100) doc.addPage();
        doc.fontSize(10).font('Helvetica-Bold').text('Ítems con dificultad:');
        doc.font('Helvetica');
        fallos.forEach((f) => {
          if (doc.y > doc.page.height - 80) doc.addPage();
          doc.text('•  ' + f.pregunta + ': ' + f.etiqueta, { indent: 10 });
        });
      }
      if (esc && esc.referencia && esc.referencia.texto) {
        doc.fontSize(9).fillColor(GRIS).font('Helvetica-Oblique').text('Referencia: ' + esc.referencia.texto);
        doc.font('Helvetica').fillColor('#000');
      }
    });
  }

  piePagina(doc);
  doc.end();
  return bufferPromise;
}

module.exports = { construirInformePdf, docToBuffer, cabeceraPaciente, piePagina, crearPdf, sanitizarTexto, DISCLAIMER };
