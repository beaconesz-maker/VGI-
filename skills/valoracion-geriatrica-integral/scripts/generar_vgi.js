/**
 * generar_vgi.js — Genera el informe de Valoración Geriátrica Integral (.docx)
 * siguiendo la plantilla de la Dra. Contreras.
 *
 * Uso:  node generar_vgi.js datos.json salida.docx
 *
 * El JSON de entrada admite todos los campos opcionales. Estructura esperada:
 * {
 *   "paciente": { "nombre":"", "fnac":"", "fecha_eval":"18 de Junio de 2026" },
 *   "antecedentes": ["No RAMc", ...],
 *   "historia_actual": "texto...",
 *   "fisico":   [ {"nombre":"Barthel","valor":"65/100","interp":"dependencia leve","conclusion":"..."}, ... ],
 *   "caidas": "texto...",
 *   "nutricional": [ {"nombre":"MNA","valor":"20/30","interp":"riesgo","conclusion":"..."}, ... ],
 *   "disfagia": "texto...",
 *   "deposicion": "texto...",
 *   "cognitivo": [ {"nombre":"Pfeiffer","valor":"4 errores","interp":"deterioro leve","conclusion":"..."}, ... ],
 *   "social": "texto...",
 *   "tratamiento": ["...", "..."],
 *   "exploracion": {"general":"","cardiopulmonar":"","abdomen":"","extremidades":"","neurologico":"","marcha":""},
 *   "analitica": "texto...",
 *   "juicio_clinico": ["...", "..."],
 *   "medidas": ["...", "..."]
 * }
 */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel,
  LevelFormat, BorderStyle, Header, PageNumber
} = require('docx');

const [,, jsonPath, outPath = 'VGI.docx'] = process.argv;
if (!jsonPath) { console.error('Falta el JSON de entrada. Uso: node generar_vgi.js datos.json salida.docx'); process.exit(1); }
const d = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const FONT = 'Calibri';
const COLOR_AZUL = '1C5D8C';
const P = (children, opts={}) => new Paragraph({ children, spacing:{ after: 60 }, ...opts });
const run = (text, opts={}) => new TextRun({ text, font: FONT, size: 22, ...opts });
const bold = (text, opts={}) => run(text, { bold:true, ...opts });

// Etiqueta en negrita seguida de valor normal (misma línea)
function labelLine(label, value){
  const ch = [bold(label)];
  if (value!=null && value!=='') ch.push(run(' ' + value));
  return P(ch, { spacing:{ before: 120, after: 60 } });
}

// Viñeta de primer nivel
function bullet(children, level=0){
  return new Paragraph({ children, numbering:{ reference:'vgi-bullets', level }, spacing:{ after: 40 } });
}
const bulletText = (txt, level=0) => bullet([run(txt)], level);

// Viñeta de un test: "Nombre valor: interp. Conclusión."
function bulletTest(t, level=1){
  const ch = [];
  const cab = [t.nombre, t.valor].filter(Boolean).join(' ');
  ch.push(bold(cab + (t.interp ? ': ' : (t.conclusion?': ':''))));
  if (t.interp) ch.push(run(t.interp + (t.conclusion ? '. ' : '.')));
  if (t.conclusion) ch.push(run(t.conclusion));
  return bullet(ch, level);
}

const body = [];

// --- Títulos ---
body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing:{ after: 40 },
  children:[ new TextRun({ text:'CONSULTA DE GERIATRÍA', font:FONT, size:26, bold:true, color:COLOR_AZUL }) ] }));
body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing:{ after: 200 },
  children:[ new TextRun({ text:'Valoración Geriátrica Integral', font:FONT, size:24, bold:true }) ] }));

// --- Identificación ---
const pac = d.paciente || {};
body.push(labelLine('Nombre:', pac.nombre || ''));
body.push(labelLine('Fecha de nacimiento:', pac.fnac || ''));
body.push(labelLine('Fecha de evaluación:', pac.fecha_eval || new Date().toLocaleDateString('es-ES')));

// --- Antecedentes ---
body.push(labelLine('Antecedentes Personales:'));
(d.antecedentes && d.antecedentes.length ? d.antecedentes : ['No RAMc']).forEach(a => body.push(bulletText(a)));

// --- Historia actual ---
body.push(labelLine('Historia actual:'));
if (d.historia_actual) body.push(P([run(d.historia_actual)]));

// --- Situación funcional basal ---
body.push(labelLine('Situación funcional basal:'));

// Físico
body.push(bullet([bold('Físico:')], 0));
(d.fisico || []).forEach(t => body.push(bulletTest(t)));

// Caídas
const caidasCh = [bold('Caídas: ')];
if (d.caidas) caidasCh.push(run(d.caidas));
body.push(bullet(caidasCh, 0));

// Nutricional y eliminación
body.push(bullet([bold('Nutricional y eliminación:')], 0));
(d.nutricional || []).forEach(t => body.push(bulletTest(t)));
if (d.disfagia!=null) body.push(bullet([bold('Disfagia: '), run(d.disfagia||'')], 1));
if (d.deposicion!=null) body.push(bullet([bold('Deposición: '), run(d.deposicion||'')], 1));

// Cognitivo
body.push(bullet([bold('Cognitivo:')], 0));
(d.cognitivo || []).forEach(t => body.push(bulletTest(t)));

// Social
body.push(bullet([bold('Social: '), run(d.social||'')], 0));

// --- Tratamiento ---
body.push(labelLine('Tratamiento actual:'));
(d.tratamiento || []).forEach(t => body.push(bulletText(t)));

// --- Exploración física ---
body.push(labelLine('Exploración física:'));
const exp = d.exploracion || {};
const expMap = [['General','general'],['Cardiopulmonar','cardiopulmonar'],['Abdomen','abdomen'],
  ['Extremidades','extremidades'],['Neurológico','neurologico'],['Marcha','marcha']];
expMap.forEach(([lab,key]) => body.push(bullet([bold(lab + ': '), run(exp[key]||'')], 0)));

// --- Analítica ---
body.push(labelLine('Analítica:'));
if (d.analitica) body.push(P([run(d.analitica)]));

// --- Juicio clínico ---
body.push(labelLine('Juicio Clínico:'));
(d.juicio_clinico || []).forEach(t => body.push(bulletText(t)));

// --- Medidas ---
body.push(labelLine('Medidas:'));
(d.medidas || []).forEach(t => body.push(bulletText(t)));

// --- Cabecera (membrete) ---
const header = new Header({ children: [
  new Paragraph({ spacing:{ after: 0 }, children:[ new TextRun({ text:'Dra Beatriz Contreras Escámez', font:FONT, size:22, bold:true }) ] }),
  new Paragraph({ spacing:{ after: 0 }, children:[ new TextRun({ text:'Médico Especialista en Geriatría y Cuidados Paliativos', font:FONT, size:18, italics:true }) ] }),
  new Paragraph({ spacing:{ after: 0 }, children:[ new TextRun({ text:'C/ PAÚL 1 BJ J · CP 11402, Jerez de la Frontera', font:FONT, size:18, italics:true }) ] }),
  new Paragraph({ spacing:{ after: 60 },
    border:{ bottom:{ style:BorderStyle.SINGLE, size:6, color:COLOR_AZUL, space:2 } },
    children:[ new TextRun({ text:'N.º Col. 112870059', font:FONT, size:18 }) ] }),
]});

const doc = new Document({
  styles:{ default:{ document:{ run:{ font:FONT, size:22 } } } },
  numbering:{ config:[ { reference:'vgi-bullets', levels:[
    { level:0, format:LevelFormat.BULLET, text:'•', alignment:AlignmentType.LEFT, style:{ paragraph:{ indent:{ left:420, hanging:260 } } } },
    { level:1, format:LevelFormat.BULLET, text:'–', alignment:AlignmentType.LEFT, style:{ paragraph:{ indent:{ left:840, hanging:260 } } } },
  ] } ] },
  sections:[{
    properties:{ page:{
      size:{ width:11906, height:16838 },                       // A4
      margin:{ top:1417, right:1701, bottom:1417, left:1701, header:708, footer:708 },
    } },
    headers:{ default: header },
    children: body,
  }],
});

Packer.toBuffer(doc).then(buf => { fs.writeFileSync(outPath, buf); console.log('OK: ' + outPath); });
