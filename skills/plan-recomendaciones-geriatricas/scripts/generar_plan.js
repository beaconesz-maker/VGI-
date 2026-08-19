/**
 * generar_plan.js — Genera el documento "Plan de recomendaciones y medidas geriátricas" (.docx)
 * a partir de los resultados de una Valoración Geriátrica Integral, para el Hospital San Juan
 * Grande (Jerez de la Frontera). Word editable.
 *
 * Uso:  node generar_plan.js datos.json salida.docx
 *
 * El JSON admite todos los campos opcionales. Estructura esperada:
 * {
 *   "paciente": { "nombre":"", "fnac":"", "fecha_eval":"", "medico":"", "nhc":"" },
 *   "resumen_clinico": "texto opcional de contexto",
 *   "clasificacion": {
 *     "fisico":      [ {"nombre":"SPPB","valor":"5/12","interp":"limitación moderada","conclusion":"..."} ],
 *     "nutricional": [ {"nombre":"MNA","valor":"19/30","interp":"riesgo","conclusion":"..."} ],
 *     "cognitivo":   [ {"nombre":"Pfeiffer","valor":"4 errores","interp":"deterioro leve","conclusion":"..."} ]
 *   },
 *   "recomendaciones": {
 *     "ejercicio":  { "titulo":"Ejercicio físico multicomponente (VIVIFRAIL)", "lineas":["...","..."], "fuente":"Ministerio de Sanidad 2022; vivifrail.com" },
 *     "nutricion":  { "titulo":"Nutrición (ESPEN)", "lineas":["..."], "fuente":"ESPEN 2019/2022; PROT-AGE 2013" },
 *     "caidas":     { "titulo":"Prevención de caídas (NICE NG249)", "lineas":["..."], "fuente":"NICE NG249, 2025" },
 *     "demencia":   { "titulo":"Estudio y tratamiento de demencia (NICE NG97 / SEGG)", "lineas":["..."], "fuente":"NICE NG97, 2018; SEGG" }
 *   },
 *   "referencias": ["Volkert D, et al. Clin Nutr. 2019;38(1):10-47. PMID 30005900.", "..."]
 * }
 *
 * Cualquier bloque que falte se omite; la cabecera y el formato se respetan siempre.
 */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  LevelFormat, BorderStyle, Header, Footer, PageNumber
} = require('docx');

const [,, jsonPath, outPath = 'Plan_recomendaciones.docx'] = process.argv;
if (!jsonPath) { console.error('Falta el JSON. Uso: node generar_plan.js datos.json salida.docx'); process.exit(1); }
const d = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const FONT = 'Calibri';
const COLOR = '0E5A4E';      // verde institucional sobrio
const GREY  = '555555';
const P = (children, opts={}) => new Paragraph({ children, spacing:{ after: 60 }, ...opts });
const run = (text, opts={}) => new TextRun({ text, font: FONT, size: 22, ...opts });
const bold = (text, opts={}) => run(text, { bold:true, ...opts });

function sectionTitle(txt){
  return new Paragraph({ spacing:{ before: 220, after: 80 },
    border:{ bottom:{ style:BorderStyle.SINGLE, size:6, color:COLOR, space:2 } },
    children:[ new TextRun({ text: txt, font:FONT, size:24, bold:true, color:COLOR }) ] });
}
function labelLine(label, value){
  const ch = [bold(label)];
  if (value!=null && value!=='') ch.push(run(' ' + value));
  return P(ch, { spacing:{ before: 60, after: 60 } });
}
function bullet(children, level=0){
  return new Paragraph({ children, numbering:{ reference:'plan-bullets', level }, spacing:{ after: 40 } });
}
const bulletText = (txt, level=0) => bullet([run(txt)], level);

// Viñeta de un test clasificado: "Nombre valor: interp. Conclusión."
function bulletTest(t, level=0){
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
  children:[ new TextRun({ text:'PLAN DE RECOMENDACIONES Y MEDIDAS GERIÁTRICAS', font:FONT, size:26, bold:true, color:COLOR }) ] }));
body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing:{ after: 160 },
  children:[ new TextRun({ text:'Basado en la Valoración Geriátrica Integral', font:FONT, size:22, italics:true, color:GREY }) ] }));

// --- Identificación ---
const pac = d.paciente || {};
body.push(labelLine('Paciente:', pac.nombre || ''));
if (pac.nhc) body.push(labelLine('N.º historia:', pac.nhc));
body.push(labelLine('Fecha de nacimiento:', pac.fnac || ''));
body.push(labelLine('Fecha de evaluación:', pac.fecha_eval || new Date().toLocaleDateString('es-ES')));
if (pac.medico) body.push(labelLine('Médico responsable:', pac.medico));

if (d.resumen_clinico){
  body.push(sectionTitle('Contexto clínico'));
  body.push(P([run(d.resumen_clinico)]));
}

// --- Clasificación de resultados ---
const cl = d.clasificacion || {};
const hayCl = ['fisico','nutricional','cognitivo'].some(k => (cl[k]||[]).length);
if (hayCl){
  body.push(sectionTitle('Clasificación de resultados (con evidencia)'));
  const dom = [['fisico','Dominio funcional y de marcha'],['nutricional','Dominio nutricional'],['cognitivo','Dominio cognitivo']];
  dom.forEach(([key,tit])=>{
    if ((cl[key]||[]).length){
      body.push(bullet([bold(tit + ':')], 0));
      cl[key].forEach(t => body.push(bulletTest(t, 1)));
    }
  });
}

// --- Recomendaciones y medidas ---
const rec = d.recomendaciones || {};
const orden = ['ejercicio','nutricion','caidas','demencia'];
const hayRec = orden.some(k => rec[k] && (rec[k].lineas||[]).length);
if (hayRec){
  body.push(sectionTitle('Recomendaciones y medidas'));
  orden.forEach(k=>{
    const r = rec[k];
    if (r && (r.lineas||[]).length){
      body.push(new Paragraph({ spacing:{ before: 120, after: 40 },
        children:[ new TextRun({ text: r.titulo || k, font:FONT, size:22, bold:true }) ] }));
      r.lineas.forEach(l => body.push(bulletText(l, 0)));
      if (r.fuente) body.push(new Paragraph({ spacing:{ after: 60 },
        children:[ new TextRun({ text:'Fuente: ' + r.fuente, font:FONT, size:18, italics:true, color:GREY }) ] }));
    }
  });
}

// --- Referencias ---
if ((d.referencias||[]).length){
  body.push(sectionTitle('Referencias'));
  d.referencias.forEach((r,i) => body.push(new Paragraph({ spacing:{ after: 30 },
    children:[ run(`${i+1}. ${r}`, { size:18 }) ] })));
}

// --- Nota legal/clínica ---
body.push(new Paragraph({ spacing:{ before: 200 },
  border:{ top:{ style:BorderStyle.SINGLE, size:4, color:'CCCCCC', space:4 } },
  children:[ new TextRun({ text:'Documento de apoyo a la decisión clínica generado a partir de la VGI. Las recomendaciones se anclan en guías de práctica clínica vigentes; la indicación y prescripción finales corresponden al facultativo responsable.', font:FONT, size:16, italics:true, color:GREY }) ] }));

// --- Cabecera (membrete del hospital) ---
const header = new Header({ children: [
  new Paragraph({ spacing:{ after: 0 }, children:[ new TextRun({ text:'Hospital San Juan Grande', font:FONT, size:22, bold:true, color:COLOR }) ] }),
  new Paragraph({ spacing:{ after: 0 }, children:[ new TextRun({ text:'Servicio de Geriatría · Jerez de la Frontera', font:FONT, size:18, italics:true, color:GREY }) ] }),
  new Paragraph({ spacing:{ after: 60 },
    border:{ bottom:{ style:BorderStyle.SINGLE, size:6, color:COLOR, space:2 } },
    children:[ new TextRun({ text:'', font:FONT, size:10 }) ] }),
]});

const footer = new Footer({ children:[
  new Paragraph({ alignment: AlignmentType.CENTER,
    children:[ new TextRun({ text:'Página ', font:FONT, size:16, color:GREY }),
               new TextRun({ children:[PageNumber.CURRENT], font:FONT, size:16, color:GREY }) ] }),
]});

const doc = new Document({
  styles:{ default:{ document:{ run:{ font:FONT, size:22 } } } },
  numbering:{ config:[ { reference:'plan-bullets', levels:[
    { level:0, format:LevelFormat.BULLET, text:'•', alignment:AlignmentType.LEFT, style:{ paragraph:{ indent:{ left:420, hanging:260 } } } },
    { level:1, format:LevelFormat.BULLET, text:'–', alignment:AlignmentType.LEFT, style:{ paragraph:{ indent:{ left:840, hanging:260 } } } },
  ] } ] },
  sections:[{
    properties:{ page:{
      size:{ width:11906, height:16838 },                       // A4
      margin:{ top:1417, right:1701, bottom:1417, left:1701, header:708, footer:708 },
    } },
    headers:{ default: header },
    footers:{ default: footer },
    children: body,
  }],
});

Packer.toBuffer(doc).then(buf => { fs.writeFileSync(outPath, buf); console.log('OK: ' + outPath); });
