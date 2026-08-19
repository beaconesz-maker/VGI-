/**
 * shared/scales.js — Motor clínico puro de escalas geriátricas (VGI+).
 *
 * JavaScript puro: sin `document`, sin `window`, sin `require('express')`,
 * sin acceso a archivos. Cargable con `require()` en Node y con
 * `<script src="/shared/scales.js"></script>` en el navegador.
 *
 * Puerto fiel de la lógica clínica de
 * docs/VGI_prototipo_generico_referencia.html (objeto DATA + funciones
 * rXxx()/upd()), reorganizado según el contrato de docs/SCALES_CONTRACT.md,
 * más la escala MoCA (nueva, no estaba en el prototipo).
 *
 * Contrato de entrada/salida
 * ---------------------------
 * interpretar(escalaId, valores, contexto) → {raw, label, cls, texto, completo}
 *   - valores: objeto plano cuyas claves dependen de la escala (ver el
 *     comentario "valores esperados" en cada bloque más abajo). Las
 *     escalas de tipo "suma" esperan {[itemId]: valorNumerico, ...}. Las
 *     escalas de entrada numérica (marcha, grip, TUG, IF-VIG, reloj, CFS)
 *     esperan {valor: numero}.
 *   - contexto: {sexo: "H"|"M", edadAnios: number, escolaridadAnios: number}
 *     — sexo lo usan Hand Grip; edadAnios lo usa Charlson; escolaridadAnios
 *     lo usa MoCA (ajuste +1 si ≤12 años). Todos opcionales; si faltan, la
 *     escala que los necesita lo indica en el resultado en vez de fallar.
 *   - cls: "ok" | "warn" | "alert" | "neutro". El motor solo clasifica; el
 *     color lo decide el frontend.
 *   - completo: true si se han introducido todos los ítems necesarios para
 *     un resultado definitivo (false si faltan datos pero aun así se puede
 *     dar una lectura parcial, p. ej. escalas de suma con algunos ítems).
 *
 * Todas las escalas llevan referencia bibliográfica verificada. Cuando no
 * se ha podido verificar un DOI/PMID concreto se omite el campo (nunca se
 * inventa) — queda anotado en el comentario junto a la escala.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VGIScales = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ────────────────────────────────────────────────────────────────
   * Utilidades
   * ──────────────────────────────────────────────────────────────── */

  // cortes: array de [limiteSuperiorExclusivo, etiqueta, cls], ordenado
  // ascendente; el último elemento es el "cajón de sastre" para todo lo
  // que no ha entrado en los anteriores (se usa su etiqueta/cls tal cual,
  // sin comprobar límite). Idéntico a corte() del prototipo.
  function corte(cortes, s) {
    for (var i = 0; i < cortes.length; i++) {
      if (s < cortes[i][0]) return [cortes[i][1], cortes[i][2]];
    }
    var last = cortes[cortes.length - 1];
    return [last[1], last[2]];
  }

  function neutro(msg) {
    return { raw: null, label: msg, cls: 'neutro', texto: msg, completo: false };
  }

  function num(v) {
    return v === '' || v === undefined || v === null || isNaN(v) ? null : +v;
  }

  // Genera opciones {etiqueta,valor} para un ítem tipo "stepper" 0..max
  // (usado por MMSE y MoCA, cuyos dominios se puntúan como un número de
  // 0 a un máximo, igual que en el prototipo).
  function opcionesRango(max) {
    var out = [];
    for (var i = 0; i <= max; i++) out.push({ etiqueta: String(i), valor: i });
    return out;
  }

  /* ────────────────────────────────────────────────────────────────
   * Dominios (grupo mostrado en el desplegable de la pestaña Escalas)
   * ──────────────────────────────────────────────────────────────── */
  var DOMINIOS = [
    { id: 'morfofuncional', nombre: 'Morfofuncional' },
    { id: 'nutricional', nombre: 'Nutricional' },
    { id: 'comorbilidad', nombre: 'Comorbilidad' },
    { id: 'fragilidad', nombre: 'Fragilidad' },
    { id: 'cognitivo', nombre: 'Cognitivo' }
  ];

  /* ────────────────────────────────────────────────────────────────
   * Tablas auxiliares (comorbilidades Charlson, sistemas CIRS-G,
   * preguntas Pfeiffer) — se usan tanto para construir los ítems como
   * para el cálculo.
   * ──────────────────────────────────────────────────────────────── */

  var CHARLSON_ITEMS = [
    { id: 'im', etiqueta: 'Infarto de miocardio', peso: 1 },
    { id: 'icc', etiqueta: 'Insuficiencia cardíaca', peso: 1 },
    { id: 'evp', etiqueta: 'Enf. vascular periférica', peso: 1 },
    { id: 'acv', etiqueta: 'Enf. cerebrovascular', peso: 1 },
    { id: 'dem', etiqueta: 'Demencia', peso: 1 },
    { id: 'epoc', etiqueta: 'EPOC / enf. pulmonar crónica', peso: 1 },
    { id: 'tc', etiqueta: 'Enf. del tejido conectivo', peso: 1 },
    { id: 'ulc', etiqueta: 'Úlcera péptica', peso: 1 },
    { id: 'hep', etiqueta: 'Hepatopatía leve', peso: 1 },
    { id: 'dm', etiqueta: 'Diabetes sin lesión orgánica', peso: 1 },
    { id: 'hemi', etiqueta: 'Hemiplejía', peso: 2 },
    { id: 'erc', etiqueta: 'ERC moderada-grave', peso: 2 },
    { id: 'dmo', etiqueta: 'Diabetes con lesión orgánica', peso: 2 },
    { id: 'tumor', etiqueta: 'Tumor sólido (sin metástasis)', peso: 2 },
    { id: 'leuc', etiqueta: 'Leucemia', peso: 2 },
    { id: 'linf', etiqueta: 'Linfoma', peso: 2 },
    { id: 'hepg', etiqueta: 'Hepatopatía moderada-grave', peso: 3 },
    { id: 'meta', etiqueta: 'Tumor sólido metastásico', peso: 6 },
    { id: 'sida', etiqueta: 'SIDA', peso: 6 }
  ];
  var CHARLSON_CORTES = [[2, 'bajo riesgo', 'ok'], [4, 'moderado', 'warn'], [6, 'alto', 'alert'], [Infinity, 'muy alto', 'alert']];

  var CIRSG_SISTEMAS = [
    { id: 'cardiaco', etiqueta: 'Cardíaco' },
    { id: 'vascular', etiqueta: 'Vascular / HTA' },
    { id: 'hematopoyetico', etiqueta: 'Hematopoyético' },
    { id: 'respiratorio', etiqueta: 'Respiratorio' },
    { id: 'oftalmoorl', etiqueta: 'Oftalmo-ORL' },
    { id: 'gisup', etiqueta: 'GI superior' },
    { id: 'giinf', etiqueta: 'GI inferior' },
    { id: 'hepatopancreatico', etiqueta: 'Hepatopancreático' },
    { id: 'renal', etiqueta: 'Renal' },
    { id: 'genitourinario', etiqueta: 'Genitourinario' },
    { id: 'musculoesqueletico', etiqueta: 'Musculoesquelético / piel' },
    { id: 'neurologico', etiqueta: 'Neurológico' },
    { id: 'endocrino', etiqueta: 'Endocrino-metabólico / mama' },
    { id: 'psiquiatrico', etiqueta: 'Psiquiátrico-conductual' }
  ];
  var CIRSG_OPCIONES = [
    { etiqueta: '0 — Ninguno', valor: 0 },
    { etiqueta: '1 — Leve', valor: 1 },
    { etiqueta: '2 — Moderado', valor: 2 },
    { etiqueta: '3 — Grave', valor: 3 },
    { etiqueta: '4 — Muy grave / incapacitante', valor: 4 }
  ];

  var PFEIFFER_PREGUNTAS = [
    '¿Fecha de hoy?', '¿Día de la semana?', '¿Lugar?', '¿Teléfono o dirección?',
    '¿Cuántos años tiene?', '¿Dónde nació?', '¿Nombre del presidente?',
    '¿Presidente anterior?', '¿Apellido materno?', 'Restar de 3 en 3 desde 20'
  ];

  var MMSE_DOMINIOS = [
    { id: 'ot', etiqueta: 'Orientación temporal', max: 5 },
    { id: 'oe', etiqueta: 'Orientación espacial', max: 5 },
    { id: 'fij', etiqueta: 'Fijación', max: 3 },
    { id: 'ac', etiqueta: 'Atención y cálculo', max: 5 },
    { id: 'rd', etiqueta: 'Recuerdo diferido', max: 3 },
    { id: 'len', etiqueta: 'Lenguaje y praxis', max: 9 }
  ];

  var MOCA_DOMINIOS = [
    { id: 'visuoejec', etiqueta: 'Visuoespacial / ejecutivo', max: 5 },
    { id: 'identificacion', etiqueta: 'Identificación (denominación)', max: 3 },
    { id: 'atencion', etiqueta: 'Atención', max: 6 },
    { id: 'lenguaje', etiqueta: 'Lenguaje', max: 3 },
    { id: 'abstraccion', etiqueta: 'Abstracción', max: 2 },
    { id: 'recuerdo', etiqueta: 'Recuerdo diferido', max: 5 },
    { id: 'orientacion', etiqueta: 'Orientación', max: 6 }
  ];

  /* ────────────────────────────────────────────────────────────────
   * Catálogo de escalas
   * ──────────────────────────────────────────────────────────────── */
  var ESCALAS = {};

  function reg(esc) { ESCALAS[esc.id] = esc; }

  /* ---- Morfofuncional ------------------------------------------------ */

  reg({
    id: 'barthel', nombre: 'Barthel', sub: 'ABVD', dominio: 'morfofuncional',
    tipo: 'suma', unidad: '/100',
    cortes: [[20, 'dependencia total', 'alert'], [36, 'dependencia grave', 'alert'], [56, 'dependencia moderada', 'warn'], [96, 'dependencia leve', 'warn'], [Infinity, 'independencia', 'ok']],
    items: [
      { id: 'comer', pregunta: 'Comer', opciones: [{ etiqueta: 'Incapaz', valor: 0 }, { etiqueta: 'Ayuda', valor: 5 }, { etiqueta: 'Independiente', valor: 10 }] },
      { id: 'traslado', pregunta: 'Trasladarse silla-cama', opciones: [{ etiqueta: 'Incapaz', valor: 0 }, { etiqueta: 'Ayuda importante', valor: 5 }, { etiqueta: 'Algo de ayuda', valor: 10 }, { etiqueta: 'Independiente', valor: 15 }] },
      { id: 'aseo', pregunta: 'Aseo personal', opciones: [{ etiqueta: 'Ayuda', valor: 0 }, { etiqueta: 'Independiente', valor: 5 }] },
      { id: 'retrete', pregunta: 'Uso del retrete', opciones: [{ etiqueta: 'Dependiente', valor: 0 }, { etiqueta: 'Ayuda', valor: 5 }, { etiqueta: 'Independiente', valor: 10 }] },
      { id: 'banarse', pregunta: 'Bañarse / ducharse', opciones: [{ etiqueta: 'Dependiente', valor: 0 }, { etiqueta: 'Independiente', valor: 5 }] },
      { id: 'desplazarse', pregunta: 'Desplazarse', opciones: [{ etiqueta: 'Inmóvil', valor: 0 }, { etiqueta: 'Silla 50 m', valor: 5 }, { etiqueta: 'Anda con ayuda', valor: 10 }, { etiqueta: 'Independiente ≥50 m', valor: 15 }] },
      { id: 'escaleras', pregunta: 'Subir escaleras', opciones: [{ etiqueta: 'Incapaz', valor: 0 }, { etiqueta: 'Con ayuda', valor: 5 }, { etiqueta: 'Independiente', valor: 10 }] },
      { id: 'vestirse', pregunta: 'Vestirse', opciones: [{ etiqueta: 'Dependiente', valor: 0 }, { etiqueta: 'Ayuda ~mitad', valor: 5 }, { etiqueta: 'Independiente', valor: 10 }] },
      { id: 'heces', pregunta: 'Control de heces', opciones: [{ etiqueta: 'Incontinente', valor: 0 }, { etiqueta: 'Ocasional', valor: 5 }, { etiqueta: 'Continente', valor: 10 }] },
      { id: 'orina', pregunta: 'Control de orina', opciones: [{ etiqueta: 'Incontinente', valor: 0 }, { etiqueta: 'Ocasional', valor: 5 }, { etiqueta: 'Continente', valor: 10 }] }
    ],
    referencia: { texto: 'Mahoney FI, Barthel DW. Functional evaluation: the Barthel Index. Md State Med J. 1965;14:61-65.' }
    // DOI/PMID no localizados con fiabilidad para esta publicación de 1965; se omiten.
  });

  reg({
    id: 'lawton', nombre: 'Lawton-Brody', sub: 'AIVD', dominio: 'morfofuncional',
    tipo: 'suma', unidad: '/8', nota: 'En varones puede valorarse /5.',
    cortes: [[2, 'dependencia total', 'alert'], [4, 'dependencia grave', 'alert'], [6, 'dependencia moderada', 'warn'], [8, 'dependencia ligera', 'warn'], [Infinity, 'independiente', 'ok']],
    items: [
      { id: 'telefono', pregunta: 'Uso del teléfono', opciones: [{ etiqueta: 'Iniciativa propia', valor: 1 }, { etiqueta: 'Marca conocidos', valor: 1 }, { etiqueta: 'Solo contesta', valor: 1 }, { etiqueta: 'No capaz', valor: 0 }] },
      { id: 'compras', pregunta: 'Hacer compras', opciones: [{ etiqueta: 'Independiente', valor: 1 }, { etiqueta: 'Solo pequeñas', valor: 0 }, { etiqueta: 'Acompañado', valor: 0 }, { etiqueta: 'Incapaz', valor: 0 }] },
      { id: 'comida', pregunta: 'Preparación de la comida', opciones: [{ etiqueta: 'Organiza y sirve', valor: 1 }, { etiqueta: 'Si le dan ingredientes', valor: 0 }, { etiqueta: 'Calienta', valor: 0 }, { etiqueta: 'Le preparan', valor: 0 }] },
      { id: 'casa', pregunta: 'Cuidado de la casa', opciones: [{ etiqueta: 'Solo / ayuda ocasional', valor: 1 }, { etiqueta: 'Tareas ligeras', valor: 1 }, { etiqueta: 'Sin limpieza adecuada', valor: 1 }, { etiqueta: 'Ayuda en todas', valor: 1 }, { etiqueta: 'No participa', valor: 0 }] },
      { id: 'ropa', pregunta: 'Lavado de ropa', opciones: [{ etiqueta: 'Toda su ropa', valor: 1 }, { etiqueta: 'Pequeñas prendas', valor: 1 }, { etiqueta: 'Lo hace otro', valor: 0 }] },
      { id: 'transporte', pregunta: 'Uso de transporte', opciones: [{ etiqueta: 'Solo / conduce', valor: 1 }, { etiqueta: 'Solo taxi', valor: 1 }, { etiqueta: 'Público acompañado', valor: 1 }, { etiqueta: 'Taxi con ayuda', valor: 0 }, { etiqueta: 'No viaja', valor: 0 }] },
      { id: 'medicacion', pregunta: 'Responsabilidad sobre la medicación', opciones: [{ etiqueta: 'A su hora y dosis', valor: 1 }, { etiqueta: 'Si se la preparan', valor: 0 }, { etiqueta: 'No capaz', valor: 0 }] },
      { id: 'economia', pregunta: 'Asuntos económicos', opciones: [{ etiqueta: 'Solo', valor: 1 }, { etiqueta: 'Diario sí, grandes no', valor: 1 }, { etiqueta: 'Incapaz', valor: 0 }] }
    ],
    referencia: { texto: 'Lawton MP, Brody EM. Assessment of older people: ADL/IADL. Gerontologist. 1969;9:179-186.' }
  });

  reg({
    id: 'katz', nombre: 'Katz', sub: 'ABVD (dependencias)', dominio: 'morfofuncional',
    tipo: 'suma', unidad: '/6', nota: 'Número de ABVD dependientes (0 = independiente en las 6).',
    cortes: [[1, 'independiente', 'ok'], [3, 'dependencia leve', 'warn'], [5, 'dependencia moderada', 'warn'], [Infinity, 'dependencia grave', 'alert']],
    items: [
      { id: 'bano', pregunta: 'Baño', opciones: [{ etiqueta: 'Independiente', valor: 0 }, { etiqueta: 'Dependiente', valor: 1 }] },
      { id: 'vestido', pregunta: 'Vestido', opciones: [{ etiqueta: 'Independiente', valor: 0 }, { etiqueta: 'Dependiente', valor: 1 }] },
      { id: 'retrete', pregunta: 'Uso del retrete', opciones: [{ etiqueta: 'Independiente', valor: 0 }, { etiqueta: 'Dependiente', valor: 1 }] },
      { id: 'movilidad', pregunta: 'Movilidad / transferencia', opciones: [{ etiqueta: 'Independiente', valor: 0 }, { etiqueta: 'Dependiente', valor: 1 }] },
      { id: 'continencia', pregunta: 'Continencia', opciones: [{ etiqueta: 'Continente', valor: 0 }, { etiqueta: 'Incontinente', valor: 1 }] },
      { id: 'alimentacion', pregunta: 'Alimentación', opciones: [{ etiqueta: 'Independiente', valor: 0 }, { etiqueta: 'Dependiente', valor: 1 }] }
    ],
    referencia: { texto: 'Katz S, et al. Studies of illness in the aged. The Index of ADL. JAMA. 1963;185:914-919.', doi: '10.1001/jama.1963.03060120024016' }
  });

  reg({
    id: 'gait', nombre: 'Velocidad de la marcha', sub: 'm/s', dominio: 'morfofuncional',
    tipo: 'gait', unidad: 'm/s',
    entrada: { tipo: 'numero', etiqueta: 'Velocidad de la marcha habitual', unidad: 'm/s', ayuda: 'Sobre 4-6 m, marcha habitual', min: 0, max: 3, paso: 0.01 },
    nota: '>1,0 m/s normal · 0,81-1,0 m/s intermedia · ≤0,8 m/s lentitud (criterio EWGSOP2 de sarcopenia grave / fragilidad).',
    referencia: { texto: 'Cruz-Jentoft AJ, et al. Sarcopenia: revised European consensus on definition and diagnosis (EWGSOP2). Age Ageing. 2019;48:16-31.', doi: '10.1093/ageing/afy169', pmid: '30312372' }
  });

  reg({
    id: 'grip', nombre: 'Fuerza de prensión (Hand Grip)', sub: 'kg', dominio: 'morfofuncional',
    tipo: 'grip', unidad: 'kg',
    entrada: { tipo: 'numero', etiqueta: 'Fuerza máxima de prensión', unidad: 'kg', ayuda: 'Mejor de 3 intentos, mano dominante', min: 0, max: 80, paso: 0.1 },
    nota: 'Fuerza baja (EWGSOP2): <27 kg en hombres · <16 kg en mujeres. El corte se aplica según el sexo del paciente.',
    referencia: { texto: 'Cruz-Jentoft AJ, et al. Sarcopenia: revised European consensus on definition and diagnosis (EWGSOP2). Age Ageing. 2019;48:16-31.', doi: '10.1093/ageing/afy169', pmid: '30312372' }
  });

  reg({
    id: 'tug', nombre: 'TUG (Timed Up and Go)', sub: 's', dominio: 'morfofuncional',
    tipo: 'tug', unidad: 's',
    entrada: { tipo: 'numero', etiqueta: 'Tiempo total', unidad: 's', ayuda: 'Levantarse, caminar 3 m, girar y volver a sentarse', min: 0, max: 120, paso: 0.1 },
    nota: '<10 s normal · 10-13,4 s movilidad reducida · 13,5-20 s riesgo aumentado · >20 s alto riesgo de caídas.',
    referencia: { texto: 'Podsiadlo D, Richardson S. The timed "Up & Go": a test of basic functional mobility for frail elderly persons. J Am Geriatr Soc. 1991;39:142-148.', doi: '10.1111/j.1532-5415.1991.tb01616.x', pmid: '1991946' }
  });

  reg({
    id: 'sppb', nombre: 'SPPB', sub: 'rendimiento físico', dominio: 'morfofuncional',
    tipo: 'suma', unidad: '/12',
    nota: 'SPPB ≤8: fragilidad / mayor riesgo de discapacidad. Define el pasaporte VIVIFRAIL.',
    cortes: [[4, 'limitación grave', 'alert'], [7, 'limitación moderada', 'warn'], [10, 'limitación leve', 'warn'], [Infinity, 'sin limitación', 'ok']],
    items: [
      { id: 'equilibrio', pregunta: 'Equilibrio', ayuda: 'Pies juntos + semitándem + tándem', opciones: opcionesRango(4) },
      { id: 'marcha4m', pregunta: 'Velocidad de la marcha en 4 m', ayuda: '>8,70 s = 1 · 6,21-8,70 s = 2 · 4,82-6,20 s = 3 · <4,82 s = 4 · incapaz = 0', opciones: opcionesRango(4) },
      { id: 'levantarse', pregunta: 'Levantarse de la silla × 5', ayuda: '>60 s = 0 · 16,7-59,9 s = 1 · 13,7-16,69 s = 2 · 11,2-13,69 s = 3 · <11,19 s = 4', opciones: opcionesRango(4) }
    ],
    referencia: { texto: 'Guralnik JM, et al. A short physical performance battery assessing lower extremity function. J Gerontol. 1994;49:M85-94.', doi: '10.1093/geronj/49.2.m85', pmid: '8126356' }
  });

  /* ---- Nutricional ----------------------------------------------------- */

  reg({
    id: 'mna', nombre: 'MNA', sub: 'Mini Nutritional Assessment', dominio: 'nutricional',
    tipo: 'mna',
    nota: 'Cribado aislado A-F (/14): ≥12 normal · 8-11 riesgo · ≤7 malnutrición. Si se completa también la evaluación G-R, total /30: ≥24 normal · 17-23,5 riesgo · <17 malnutrición.',
    items: [
      { id: 'A', pregunta: 'A. Apetito en los últimos 3 meses', opciones: [{ etiqueta: 'Mucho menos', valor: 0 }, { etiqueta: 'Menos', valor: 1 }, { etiqueta: 'Igual', valor: 2 }] },
      { id: 'B', pregunta: 'B. Pérdida de peso en los últimos 3 meses', opciones: [{ etiqueta: '>3 kg', valor: 0 }, { etiqueta: 'No sabe', valor: 1 }, { etiqueta: '1-3 kg', valor: 2 }, { etiqueta: 'Sin pérdida', valor: 3 }] },
      { id: 'C', pregunta: 'C. Movilidad', opciones: [{ etiqueta: 'Cama-sillón', valor: 0 }, { etiqueta: 'Interior', valor: 1 }, { etiqueta: 'Sale a la calle', valor: 2 }] },
      { id: 'D', pregunta: 'D. Estrés psicológico o enfermedad aguda', opciones: [{ etiqueta: 'Sí', valor: 0 }, { etiqueta: 'No', valor: 2 }] },
      { id: 'E', pregunta: 'E. Problema neuropsicológico', opciones: [{ etiqueta: 'Demencia / depresión grave', valor: 0 }, { etiqueta: 'Demencia leve', valor: 1 }, { etiqueta: 'Sin problemas', valor: 2 }] },
      { id: 'F', pregunta: 'F. Índice de masa corporal', opciones: [{ etiqueta: '<19', valor: 0 }, { etiqueta: '19-<21', valor: 1 }, { etiqueta: '21-<23', valor: 2 }, { etiqueta: '≥23', valor: 3 }] },
      { id: 'G', pregunta: 'G. ¿Vive de forma independiente?', opciones: [{ etiqueta: 'No', valor: 0 }, { etiqueta: 'Sí', valor: 1 }] },
      { id: 'H', pregunta: 'H. ¿Toma más de 3 fármacos al día?', opciones: [{ etiqueta: 'Sí', valor: 0 }, { etiqueta: 'No', valor: 1 }] },
      { id: 'I', pregunta: 'I. ¿Úlceras o lesiones cutáneas?', opciones: [{ etiqueta: 'Sí', valor: 0 }, { etiqueta: 'No', valor: 1 }] },
      { id: 'J', pregunta: 'J. Número de comidas completas al día', opciones: [{ etiqueta: '1', valor: 0 }, { etiqueta: '2', valor: 1 }, { etiqueta: '3', valor: 2 }] },
      { id: 'K', pregunta: 'K. Consumo de proteínas', opciones: [{ etiqueta: '0-1 indicadores', valor: 0 }, { etiqueta: '2 indicadores', valor: 0.5 }, { etiqueta: '3 indicadores', valor: 1 }] },
      { id: 'L', pregunta: 'L. ¿Toma ≥2 raciones de fruta o verdura al día?', opciones: [{ etiqueta: 'No', valor: 0 }, { etiqueta: 'Sí', valor: 1 }] },
      { id: 'M', pregunta: 'M. Consumo de líquidos al día', opciones: [{ etiqueta: '<3 vasos', valor: 0 }, { etiqueta: '3-5 vasos', valor: 0.5 }, { etiqueta: '>5 vasos', valor: 1 }] },
      { id: 'N', pregunta: 'N. Forma de alimentarse', opciones: [{ etiqueta: 'Necesita ayuda', valor: 0 }, { etiqueta: 'Con dificultad', valor: 1 }, { etiqueta: 'Solo, sin dificultad', valor: 2 }] },
      { id: 'O', pregunta: 'O. Autopercepción del estado nutricional', opciones: [{ etiqueta: 'Malnutrición grave', valor: 0 }, { etiqueta: 'No sabe / malnutrición moderada', valor: 1 }, { etiqueta: 'Sin problemas', valor: 2 }] },
      { id: 'P', pregunta: 'P. Comparación del estado de salud con personas de su edad', opciones: [{ etiqueta: 'Peor', valor: 0 }, { etiqueta: 'No sabe', valor: 0.5 }, { etiqueta: 'Igual', valor: 1 }, { etiqueta: 'Mejor', valor: 2 }] },
      { id: 'Q', pregunta: 'Q. Circunferencia braquial (CB, cm)', opciones: [{ etiqueta: '<21', valor: 0 }, { etiqueta: '21-22', valor: 0.5 }, { etiqueta: '>22', valor: 1 }] },
      { id: 'R', pregunta: 'R. Circunferencia de la pantorrilla (CP, cm)', opciones: [{ etiqueta: '<31', valor: 0 }, { etiqueta: '≥31', valor: 1 }] }
    ],
    referencia: { texto: 'Vellas B, Guigoz Y, Garry PJ, et al. The Mini Nutritional Assessment (MNA) and its use in grading the nutritional state of elderly patients. Nutrition. 1999;15:116-122.', doi: '10.1016/s0899-9007(98)00171-3', pmid: '9990575' }
  });

  reg({
    id: 'glim', nombre: 'GLIM', sub: 'criterios de desnutrición', dominio: 'nutricional',
    tipo: 'glim',
    nota: 'Diagnóstico de desnutrición: al menos 1 criterio fenotípico + al menos 1 criterio etiológico.',
    items: [
      { id: 'fpeso', pregunta: 'Pérdida de peso', ayuda: '>5% en 6 meses o >10% en más de 6 meses', opciones: [{ etiqueta: 'No', valor: 0 }, { etiqueta: 'Sí', valor: 1 }] },
      { id: 'fimc', pregunta: 'IMC bajo', ayuda: '<20 si <70 años; <22 si ≥70 años', opciones: [{ etiqueta: 'No', valor: 0 }, { etiqueta: 'Sí', valor: 1 }] },
      { id: 'fmasa', pregunta: 'Reducción de masa muscular', ayuda: 'Por técnica de composición corporal validada', opciones: [{ etiqueta: 'No', valor: 0 }, { etiqueta: 'Sí', valor: 1 }] },
      { id: 'eing', pregunta: 'Reducción de ingesta o asimilación', ayuda: '≤50% de los requerimientos >1 semana, o enfermedad gastrointestinal crónica', opciones: [{ etiqueta: 'No', valor: 0 }, { etiqueta: 'Sí', valor: 1 }] },
      { id: 'einf', pregunta: 'Carga inflamatoria', ayuda: 'Lesión/enfermedad aguda o enfermedad crónica relacionada', opciones: [{ etiqueta: 'No', valor: 0 }, { etiqueta: 'Sí', valor: 1 }] }
    ],
    referencia: { texto: 'Cederholm T, et al. GLIM criteria for the diagnosis of malnutrition — a consensus report. Clin Nutr. 2019;38:1-9.', doi: '10.1016/j.clnu.2018.08.002', pmid: '30181091' }
  });

  reg({
    id: 'sarcf', nombre: 'SARC-F', sub: 'cribado de sarcopenia', dominio: 'nutricional',
    tipo: 'suma', unidad: '/10',
    nota: '≥4: confirmar con dinamometría / velocidad de la marcha (EWGSOP2).',
    cortes: [[4, 'cribado negativo', 'ok'], [Infinity, 'sarcopenia probable', 'alert']],
    items: [
      { id: 'fuerza', pregunta: 'Fuerza', ayuda: 'Capacidad para cargar 4,5 kg', opciones: [{ etiqueta: 'Ninguna dificultad', valor: 0 }, { etiqueta: 'Alguna dificultad', valor: 1 }, { etiqueta: 'Mucha dificultad / incapaz', valor: 2 }] },
      { id: 'caminar', pregunta: 'Ayuda para caminar', ayuda: 'Cruzar un cuarto', opciones: [{ etiqueta: 'Ninguna dificultad', valor: 0 }, { etiqueta: 'Alguna dificultad', valor: 1 }, { etiqueta: 'Mucha dificultad / incapaz', valor: 2 }] },
      { id: 'levantarse', pregunta: 'Levantarse de una silla', opciones: [{ etiqueta: 'Ninguna dificultad', valor: 0 }, { etiqueta: 'Alguna dificultad', valor: 1 }, { etiqueta: 'Incapaz sin ayuda', valor: 2 }] },
      { id: 'escaleras', pregunta: 'Subir escaleras', ayuda: '10 escalones', opciones: [{ etiqueta: 'Ninguna dificultad', valor: 0 }, { etiqueta: 'Alguna dificultad', valor: 1 }, { etiqueta: 'Mucha dificultad / incapaz', valor: 2 }] },
      { id: 'caidas', pregunta: 'Caídas en el último año', opciones: [{ etiqueta: 'Ninguna', valor: 0 }, { etiqueta: '1-3', valor: 1 }, { etiqueta: '≥4', valor: 2 }] }
    ],
    referencia: { texto: 'Malmstrom TK, Morley JE. SARC-F: a simple questionnaire to rapidly diagnose sarcopenia. J Am Med Dir Assoc. 2013;14:531-532.', doi: '10.1016/j.jamda.2013.05.018', pmid: '23810110' }
  });

  /* ---- Comorbilidad ----------------------------------------------------- */

  reg({
    id: 'charlson', nombre: 'Charlson', sub: 'comorbilidad', dominio: 'comorbilidad',
    tipo: 'charlson',
    nota: 'Se añade ajuste por edad: +1 punto por década desde los 50 años (máximo +5), a partir de edadAnios del contexto.',
    items: CHARLSON_ITEMS.map(function (c) {
      return { id: c.id, pregunta: c.etiqueta, ayuda: c.peso + ' punto' + (c.peso > 1 ? 's' : ''), opciones: [{ etiqueta: 'No', valor: 0 }, { etiqueta: 'Sí', valor: c.peso }] };
    }),
    referencia: { texto: 'Charlson ME, et al. A new method of classifying prognostic comorbidity in longitudinal studies. J Chronic Dis. 1987;40:373-383.', doi: '10.1016/0021-9681(87)90171-8' }
  });

  reg({
    id: 'cirsg', nombre: 'CIRS-G', sub: 'carga de enfermedad', dominio: 'comorbilidad',
    tipo: 'cirsg',
    nota: 'Resultado: puntuación total, nº de categorías afectadas, índice de severidad (total/categorías) y nº de sistemas en grado ≥3. Alarma si algún sistema en grado 4 o ≥2 sistemas en grado ≥3.',
    items: CIRSG_SISTEMAS.map(function (s) {
      return { id: s.id, pregunta: s.etiqueta, opciones: CIRSG_OPCIONES };
    }),
    referencia: { texto: 'Miller MD, et al. Rating chronic medical illness burden in geropsychiatric practice and research: application of the CIRS-G. Psychiatry Res. 1992;41:237-248.', doi: '10.1016/0165-1781(92)90005-n' }
  });

  /* ---- Fragilidad -------------------------------------------------------- */

  reg({
    id: 'frail', nombre: 'FRAIL', sub: 'cribado', dominio: 'fragilidad',
    tipo: 'suma', unidad: '/5',
    cortes: [[1, 'robusto', 'ok'], [3, 'prefrágil', 'warn'], [Infinity, 'frágil', 'alert']],
    items: [
      { id: 'fatigue', pregunta: 'Fatigue', ayuda: '¿Cansado la mayor parte del tiempo?', opciones: [{ etiqueta: 'No', valor: 0 }, { etiqueta: 'Sí', valor: 1 }] },
      { id: 'resistance', pregunta: 'Resistance', ayuda: '¿Incapaz de subir un piso de escaleras?', opciones: [{ etiqueta: 'No', valor: 0 }, { etiqueta: 'Sí', valor: 1 }] },
      { id: 'aerobic', pregunta: 'Aerobic', ayuda: '¿Incapaz de caminar una manzana?', opciones: [{ etiqueta: 'No', valor: 0 }, { etiqueta: 'Sí', valor: 1 }] },
      { id: 'illnesses', pregunta: 'Illnesses', ayuda: '¿Más de 5 enfermedades?', opciones: [{ etiqueta: 'No', valor: 0 }, { etiqueta: 'Sí', valor: 1 }] },
      { id: 'lossweight', pregunta: 'Loss of weight', ayuda: '¿Pérdida >5% del peso en 6 meses?', opciones: [{ etiqueta: 'No', valor: 0 }, { etiqueta: 'Sí', valor: 1 }] }
    ],
    referencia: { texto: 'Morley JE, Malmstrom TK, Miller DK. A simple frailty questionnaire (FRAIL) predicts outcomes in middle aged African Americans. J Nutr Health Aging. 2012;16:601-608.', doi: '10.1007/s12603-012-0084-2', pmid: '22836700' }
  });

  reg({
    id: 'fried', nombre: 'Fenotipo de Fried', sub: 'fragilidad física', dominio: 'fragilidad',
    tipo: 'suma', unidad: '/5',
    nota: 'Debilidad: usar Hand Grip. Lentitud: usar velocidad de la marcha.',
    cortes: [[1, 'robusto', 'ok'], [3, 'prefrágil', 'warn'], [Infinity, 'frágil', 'alert']],
    items: [
      { id: 'peso', pregunta: 'Pérdida de peso', ayuda: 'Involuntaria >4,5 kg o >5% en 1 año', opciones: [{ etiqueta: 'No', valor: 0 }, { etiqueta: 'Sí', valor: 1 }] },
      { id: 'agotamiento', pregunta: 'Agotamiento', ayuda: 'Autoinforme (escala CES-D)', opciones: [{ etiqueta: 'No', valor: 0 }, { etiqueta: 'Sí', valor: 1 }] },
      { id: 'debilidad', pregunta: 'Debilidad', ayuda: 'Prensión baja (<27 kg hombres / <16 kg mujeres)', opciones: [{ etiqueta: 'No', valor: 0 }, { etiqueta: 'Sí', valor: 1 }] },
      { id: 'lentitud', pregunta: 'Lentitud de la marcha', ayuda: 'Velocidad reducida (≤0,8 m/s)', opciones: [{ etiqueta: 'No', valor: 0 }, { etiqueta: 'Sí', valor: 1 }] },
      { id: 'actividad', pregunta: 'Baja actividad física', opciones: [{ etiqueta: 'No', valor: 0 }, { etiqueta: 'Sí', valor: 1 }] }
    ],
    referencia: { texto: 'Fried LP, et al. Frailty in older adults: evidence for a phenotype. J Gerontol A Biol Sci Med Sci. 2001;56:M146-156.', doi: '10.1093/gerona/56.3.m146' }
  });

  reg({
    id: 'cfs', nombre: 'Clinical Frailty Scale', sub: 'CFS 1-9', dominio: 'fragilidad',
    tipo: 'cfs',
    items: [{
      id: 'valor', pregunta: 'Nivel CFS', opciones: [
        { etiqueta: '1 · Muy en forma', valor: 1 }, { etiqueta: '2 · En forma', valor: 2 },
        { etiqueta: '3 · Controlado', valor: 3 }, { etiqueta: '4 · Vulnerable', valor: 4 },
        { etiqueta: '5 · Fragilidad leve', valor: 5 }, { etiqueta: '6 · Fragilidad moderada', valor: 6 },
        { etiqueta: '7 · Fragilidad grave', valor: 7 }, { etiqueta: '8 · Fragilidad muy grave', valor: 8 },
        { etiqueta: '9 · Enfermo terminal', valor: 9 }
      ]
    }],
    nota: '1-3 robusto · 4 vulnerable · 5-6 fragilidad leve-moderada · 7-9 fragilidad grave.',
    referencia: { texto: 'Rockwood K, et al. A global clinical measure of fitness and frailty in elderly people. CMAJ. 2005;173:489-495.', doi: '10.1503/cmaj.050051' }
  });

  reg({
    id: 'frailvig', nombre: 'Índice Frágil-VIG (IF-VIG)', sub: 'índice 0-1', dominio: 'fragilidad',
    tipo: 'frailvig',
    entrada: { tipo: 'numero', etiqueta: 'Índice IF-VIG', unidad: '', ayuda: 'Resultado del cuestionario validado de 25 déficits (no lo calcula esta app)', min: 0, max: 1, paso: 0.01 },
    nota: '<0,20 sin fragilidad · 0,20-0,35 leve · 0,36-0,50 moderada · >0,50 avanzada. El IF-VIG debe cumplimentarse con el cuestionario validado de 25 déficits; esta app registra e interpreta el índice resultante, no sustituye al instrumento.',
    referencia: { texto: 'Torné Amblàs A, Amblàs-Novellas J, et al. Reliability, validity and feasibility of the Frail-VIG index. Int J Environ Res Public Health. 2021;18:5187.', doi: '10.3390/ijerph18105187' }
  });

  /* ---- Cognitivo ---------------------------------------------------------- */

  reg({
    id: 'mmse', nombre: 'Mini-Mental (MMSE / MEC)', sub: 'cognición', dominio: 'cognitivo',
    tipo: 'mmse', unidad: '/30',
    nota: '≥27 normal · 25-26 dudoso · 13-24 deterioro · ≤12 demencia (sobre 30).',
    items: MMSE_DOMINIOS.slice(0, 5).map(function (d) {
      return { id: d.id, pregunta: d.etiqueta, ayuda: 'máx ' + d.max, opciones: opcionesRango(d.max) };
    }).concat([
      { id: 'mmse_pentagono', tipo: 'imagen', pregunta: 'Praxis constructiva', instrucciones: 'Pida al paciente que copie el dibujo en una hoja aparte. La puntuación de este ítem (1 punto) se incluye dentro del apartado "Lenguaje y praxis" de abajo.', src: '/assets/scales/mmse-pentagonos.svg' },
      { id: 'len', pregunta: 'Lenguaje y praxis', ayuda: 'máx 9 (incluye la copia del dibujo, 1 punto)', opciones: opcionesRango(9) }
    ]),
    referencia: { texto: 'Folstein MF, Folstein SE, McHugh PR. "Mini-mental state": a practical method for grading the cognitive state of patients for the clinician. J Psychiatr Res. 1975;12:189-198.', doi: '10.1016/0022-3956(75)90026-6', pmid: '1202204' },
    // Versión española (MEC) — referencia adicional de revalidación:
    referenciaAdicional: { texto: 'Lobo A, et al. Revalidación del Mini-Examen Cognoscitivo (MEC) en población general geriátrica. Med Clin (Barc). 1999;112:767-774.' }
  });

  reg({
    id: 'moca', nombre: 'MoCA (Montreal Cognitive Assessment)', sub: 'cognición', dominio: 'cognitivo',
    tipo: 'moca', unidad: '/30',
    nota: '≥26 normal · <26 sugiere deterioro cognitivo leve. Se suma +1 punto si escolaridad ≤12 años (sin superar 30). ' +
      'Nota de diseño: la versión original define un único corte de cribado (≥26); esta herramienta no añade bandas de gravedad adicionales (leve/moderado/grave) porque no están especificadas de forma estandarizada en la publicación original y no se ha podido verificar una fuente fiable para ellas — queda pendiente de revisión por un geriatra si se desea añadirlas.',
    items: [
      { id: 'moca_trail', tipo: 'imagen', pregunta: 'Trail making alterno (número-letra)', instrucciones: 'Pida al paciente que una con una línea, sin levantar el lápiz, la secuencia alterna creciente número→letra (1-A-2-B-3-C-4-D-5) sobre una hoja aparte.', src: '/assets/scales/moca-trail.svg' },
      { id: 'moca_cubo', tipo: 'imagen', pregunta: 'Copia del cubo', instrucciones: 'Pida al paciente que copie el cubo tal cual en una hoja aparte.', src: '/assets/scales/moca-cubo.svg' },
      { id: 'moca_reloj', tipo: 'imagen', pregunta: 'Dibujo del reloj', instrucciones: 'Pida al paciente que dibuje una esfera de reloj, coloque los números y marque las 11:10, en una hoja aparte.', src: '/assets/scales/moca-reloj.svg' },
      { id: 'visuoejec', pregunta: 'Visuoespacial / ejecutivo', ayuda: 'máx 5 (trail alterno 1 + cubo 1 + reloj: contorno/números/agujas 3)', opciones: opcionesRango(5) },
      { id: 'identificacion', pregunta: 'Identificación (denominación de 3 animales)', ayuda: 'máx 3', opciones: opcionesRango(3) },
      { id: 'atencion', pregunta: 'Atención', ayuda: 'máx 6 (dígitos directos 1 + inversos 1 + vigilancia 1 + resta seriada de 7 en 7, 3)', opciones: opcionesRango(6) },
      { id: 'lenguaje', pregunta: 'Lenguaje', ayuda: 'máx 3 (repetición de frases 2 + fluidez fonémica 1)', opciones: opcionesRango(3) },
      { id: 'abstraccion', pregunta: 'Abstracción', ayuda: 'máx 2 (semejanzas, 2 pares)', opciones: opcionesRango(2) },
      { id: 'recuerdo', pregunta: 'Recuerdo diferido', ayuda: 'máx 5 (5 palabras, sin pista)', opciones: opcionesRango(5) },
      { id: 'orientacion', pregunta: 'Orientación', ayuda: 'máx 6 (fecha, mes, año, día, lugar, ciudad)', opciones: opcionesRango(6) }
    ],
    referencia: { texto: 'Nasreddine ZS, Phillips NA, Bédirian V, et al. The Montreal Cognitive Assessment, MoCA: a brief screening tool for mild cognitive impairment. J Am Geriatr Soc. 2005;53:695-699.', doi: '10.1111/j.1532-5415.2005.53221.x', pmid: '15817019' }
  });

  reg({
    id: 'pfeiffer', nombre: 'Pfeiffer (SPMSQ)', sub: 'cognición', dominio: 'cognitivo',
    tipo: 'pfeiffer',
    nota: 'Se cuentan ERRORES. 0-2 normal · 3-4 leve · 5-7 moderado · 8-10 severo (±1 según escolaridad).',
    items: PFEIFFER_PREGUNTAS.map(function (q, idx) {
      return { id: 'p' + idx, pregunta: (idx + 1) + '. ' + q, opciones: [{ etiqueta: 'Correcto', valor: 0 }, { etiqueta: 'Error', valor: 1 }] };
    }).concat([{
      id: 'escolaridad', pregunta: 'Escolaridad', ayuda: 'Ajusta el número de errores permitido', opciones: [
        { etiqueta: 'Media', valor: 0 }, { etiqueta: 'Baja (+1 error permitido)', valor: 1 }, { etiqueta: 'Alta (−1 error)', valor: -1 }
      ]
    }]),
    referencia: { texto: 'Pfeiffer E. A short portable mental status questionnaire for the assessment of organic brain deficit in elderly patients. J Am Geriatr Soc. 1975;23:433-441.', doi: '10.1111/j.1532-5415.1975.tb00927.x', pmid: '1159263' }
  });

  reg({
    id: 'reloj', nombre: 'Test del Reloj (CDT)', sub: 'función ejecutiva · Shulman', dominio: 'cognitivo',
    tipo: 'reloj',
    items: [{
      id: 'valor', pregunta: 'Puntuación de Shulman (0-5)', opciones: [
        { etiqueta: '5 — Normal', valor: 5 }, { etiqueta: '4 — Errores leves de espaciado', valor: 4 },
        { etiqueta: '3 — Errores moderados / números incorrectos', valor: 3 }, { etiqueta: '2 — Solo 2 cuadrantes correctos', valor: 2 },
        { etiqueta: '1 — Sin semejanza con reloj', valor: 1 }, { etiqueta: '0 — Sin intento o irreconocible', valor: 0 }
      ]
    }],
    nota: '≥4 normal · ≤3 alteración significativa de función ejecutiva y visuoespacial. Complementario al MMSE/Pfeiffer.',
    referencia: { texto: 'Shulman KI, et al. IPA survey of brief cognitive screening instruments. Int Psychogeriatr. 2006;18(2):281-294.', doi: '10.1017/S1041610205002693' },
    // Referencia adicional verificada (revisión de propiedades psicométricas del CDT):
    referenciaAdicional: { texto: 'Shulman KI. Clock-drawing: is it the ideal cognitive screening test? Int J Geriatr Psychiatry. 2000;15:548-561.', doi: '10.1002/1099-1166(200006)15:6<548::AID-GPS242>3.0.CO;2-U', pmid: '10861923' }
  });

  /* ────────────────────────────────────────────────────────────────
   * Funciones de interpretación
   * ──────────────────────────────────────────────────────────────── */

  // valores esperados: {[itemId]: valorNumerico, ...} — una clave por
  // cada ítem con "opciones" de la escala (se ignoran ítems tipo imagen).
  function interpretarSuma(esc, valores) {
    var s = 0, n = 0;
    var itemsPuntuables = esc.items.filter(function (it) { return it.opciones; });
    itemsPuntuables.forEach(function (it) {
      var v = valores[it.id];
      if (v !== undefined && v !== null) { s += v; n++; }
    });
    if (n === 0) return neutro('Sin valorar');
    var completo = n === itemsPuntuables.length;
    var r = corte(esc.cortes, s), label = r[0], cls = r[1];
    var texto = s + (esc.unidad || '') + ' — ' + label + (completo ? '' : ' (incompleto)');
    return { raw: s, label: label, cls: cls, texto: texto, completo: completo };
  }

  // valores esperados: {valor: numero (s)}
  function interpretarTug(valores) {
    var t = num(valores.valor);
    if (t == null) return neutro('Sin valorar');
    var label, cls;
    if (t < 10) { label = 'normal'; cls = 'ok'; }
    else if (t < 13.5) { label = 'movilidad reducida'; cls = 'warn'; }
    else if (t <= 20) { label = 'riesgo aumentado'; cls = 'alert'; }
    else { label = 'alto riesgo de caídas'; cls = 'alert'; }
    return { raw: t, label: label, cls: cls, texto: t + ' s — ' + label, completo: true };
  }

  // valores esperados: {valor: numero (m/s)}
  function interpretarGait(valores) {
    var v = num(valores.valor);
    if (v == null) return neutro('Sin valorar');
    var label, cls;
    if (v > 1) { label = 'normal'; cls = 'ok'; }
    else if (v > 0.8) { label = 'intermedia'; cls = 'warn'; }
    else { label = 'lentitud (≤0,8 m/s)'; cls = 'alert'; }
    return { raw: v, label: label, cls: cls, texto: v + ' m/s — ' + label, completo: true };
  }

  // valores esperados: {valor: numero (kg)}; contexto: {sexo:"H"|"M"}
  function interpretarGrip(valores, contexto) {
    var g = num(valores.valor);
    if (g == null) return neutro('Sin valorar');
    var sx = contexto && contexto.sexo;
    if (!sx) return { raw: g, label: '(introduzca el sexo del paciente)', cls: 'neutro', texto: g + ' kg — (introduzca el sexo del paciente)', completo: false };
    var cut = sx === 'M' ? 16 : 27;
    var baja = g < cut;
    var label = (baja ? 'fuerza baja' : 'normal') + ' (corte ' + cut + ' kg)';
    var cls = baja ? 'alert' : 'ok';
    return { raw: g, label: label, cls: cls, texto: g + ' kg — ' + label, completo: true };
  }

  // valores esperados: {valor: 0-5}
  function interpretarReloj(valores) {
    var n = num(valores.valor);
    if (n == null) return neutro('Sin valorar');
    var label = n >= 4 ? 'normal' : n === 3 ? 'alteración leve' : n === 2 ? 'alteración moderada' : n === 1 ? 'alteración grave' : 'irreconocible';
    var cls = n >= 4 ? 'ok' : n >= 3 ? 'warn' : 'alert';
    return { raw: n, label: label, cls: cls, texto: 'Test del Reloj ' + n + '/5 — ' + label, completo: true };
  }

  // valores esperados: {valor: 1-9}
  function interpretarCfs(valores) {
    var n = num(valores.valor);
    if (n == null) return neutro('Sin valorar');
    var label = n <= 3 ? 'robusto' : n === 4 ? 'vulnerable' : n <= 6 ? 'fragilidad leve-moderada' : 'fragilidad grave';
    var cls = n <= 3 ? 'ok' : n === 4 ? 'warn' : n <= 6 ? 'warn' : 'alert';
    return { raw: n, label: label, cls: cls, texto: 'CFS ' + n + ' — ' + label, completo: true };
  }

  // valores esperados: {valor: 0.00-1.00}
  function interpretarFrailvig(valores) {
    var x = num(valores.valor);
    if (x == null) return neutro('Sin valorar');
    var label = x < 0.2 ? 'sin fragilidad' : x <= 0.35 ? 'fragilidad leve' : x <= 0.5 ? 'fragilidad moderada' : 'fragilidad avanzada';
    var cls = x < 0.2 ? 'ok' : x <= 0.5 ? 'warn' : 'alert';
    return { raw: x, label: label, cls: cls, texto: 'IF-VIG ' + x.toFixed(2) + ' — ' + label, completo: true };
  }

  // valores esperados: {[comorbilidadId]: true|false, ...}; contexto: {edadAnios}
  function interpretarCharlson(valores, contexto) {
    var s = 0;
    CHARLSON_ITEMS.forEach(function (c) { if (valores[c.id]) s += c.peso; });
    var edad = contexto && contexto.edadAnios;
    var ap = 0;
    if (edad != null && edad >= 50) ap = Math.min(5, Math.floor((edad - 40) / 10));
    var tot = s + ap;
    var r = corte(CHARLSON_CORTES, tot), label = r[0], cls = r[1];
    var texto = 'Charlson ' + tot + ' ptos (comorbilidad ' + s + ' + edad ' + ap + ') — riesgo ' + label;
    return { raw: tot, label: label, cls: cls, texto: texto, completo: true };
  }

  // valores esperados: {[sistemaId]: 0-4, ...}
  function interpretarCirsg(valores) {
    var vals = CIRSG_SISTEMAS.map(function (s) { return valores[s.id] || 0; });
    var tot = vals.reduce(function (a, b) { return a + b; }, 0);
    var activos = vals.filter(function (v) { return v > 0; });
    var endo = activos.length;
    var is = endo ? +(tot / endo).toFixed(2) : 0;
    var n3 = vals.filter(function (v) { return v >= 3; }).length;
    var n4 = vals.filter(function (v) { return v === 4; }).length;
    var cls = (n4 > 0 || n3 >= 2) ? 'alert' : (n3 === 1 ? 'warn' : 'ok');
    var label = 'total ' + tot + ' · ' + endo + ' categorías · IS ' + is + ' · grado≥3: ' + n3;
    return { raw: tot, label: label, cls: cls, texto: label, completo: true };
  }

  // valores esperados: {ot,oe,fij,ac,rd,len: 0-max}
  var MMSE_CORTES = [[13, 'demencia', 'alert'], [25, 'deterioro', 'warn'], [27, 'dudoso', 'warn'], [Infinity, 'normal', 'ok']];
  function interpretarMmse(valores) {
    var claves = ['ot', 'oe', 'fij', 'ac', 'rd', 'len'];
    var s = claves.reduce(function (a, k) { return a + (valores[k] || 0); }, 0);
    var r = corte(MMSE_CORTES, s), label = r[0], cls = r[1];
    return { raw: s, label: label, cls: cls, texto: s + '/30 — ' + label, completo: true };
  }

  // valores esperados: {p0..p9: 0|1, escolaridad: -1|0|1}
  function interpretarPfeiffer(valores) {
    var e = 0;
    for (var i = 0; i < PFEIFFER_PREGUNTAS.length; i++) e += (valores['p' + i] || 0);
    var ajuste = valores.escolaridad || 0;
    var eff = e - ajuste;
    var label, cls;
    if (eff <= 2) { label = 'normal'; cls = 'ok'; }
    else if (eff <= 4) { label = 'leve'; cls = 'warn'; }
    else if (eff <= 7) { label = 'moderado'; cls = 'alert'; }
    else { label = 'severo'; cls = 'alert'; }
    return { raw: e, label: label, cls: cls, texto: e + ' errores — ' + label, completo: true };
  }

  // valores esperados: {fpeso,fimc,fmasa,eing,einf: true|false}
  function interpretarGlim(valores) {
    var fen = !!(valores.fpeso || valores.fimc || valores.fmasa);
    var eti = !!(valores.eing || valores.einf);
    if (!fen && !eti) return neutro('Sin datos suficientes');
    var ok = fen && eti;
    return {
      raw: ok ? 1 : 0, label: ok ? 'cumple desnutrición' : 'no cumple', cls: ok ? 'alert' : 'ok',
      texto: ok ? 'CUMPLE criterios de desnutrición (fenotípico + etiológico)' : 'No cumple criterios de desnutrición', completo: true
    };
  }

  // valores esperados: {A..F, G..R: numero|null} — cribado A-F obligatorio
  // para dar resultado; evaluación G-R opcional (si se rellena, se suma).
  function interpretarMna(valores) {
    var crib = ['A', 'B', 'C', 'D', 'E', 'F'];
    var evalu = ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'];
    function sum(ks) { return ks.reduce(function (a, k) { return a + (valores[k] == null ? 0 : valores[k]); }, 0); }
    var anyCrib = crib.some(function (k) { return valores[k] != null; });
    if (!anyCrib) return neutro('Sin datos suficientes');
    var cS = sum(crib);
    var cCat = cS >= 12 ? 'normal' : cS >= 8 ? 'riesgo' : 'malnutrición';
    var eAny = evalu.some(function (k) { return valores[k] != null; });
    if (eAny) {
      var tot = cS + sum(evalu);
      var tCat = tot >= 24 ? 'normal' : tot >= 17 ? 'riesgo' : 'malnutrición';
      var cls = tCat === 'normal' ? 'ok' : tCat === 'riesgo' ? 'warn' : 'alert';
      return { raw: tot, label: tCat, cls: cls, texto: 'Cribado ' + cS + '/14 · Total ' + tot + '/30 (' + tCat + ')', completo: true };
    }
    var clsC = cCat === 'normal' ? 'ok' : cCat === 'riesgo' ? 'warn' : 'alert';
    return { raw: cS, label: cCat, cls: clsC, texto: 'Cribado ' + cS + '/14 (' + cCat + ')', completo: false };
  }

  // valores esperados: {visuoejec,identificacion,atencion,lenguaje,
  // abstraccion,recuerdo,orientacion: 0-max}; contexto: {escolaridadAnios}
  // (alternativa: valores.escolaridadBaja: true|false si no hay contexto).
  function interpretarMoca(valores, contexto) {
    var claves = ['visuoejec', 'identificacion', 'atencion', 'lenguaje', 'abstraccion', 'recuerdo', 'orientacion'];
    var s = claves.reduce(function (a, k) { return a + (valores[k] || 0); }, 0);
    var bajaEscolaridad = (contexto && contexto.escolaridadAnios != null) ? contexto.escolaridadAnios <= 12 : !!valores.escolaridadBaja;
    var ajusteAplicado = false;
    if (bajaEscolaridad) { s = Math.min(30, s + 1); ajusteAplicado = true; }
    var label = s >= 26 ? 'normal' : 'sugiere deterioro cognitivo leve';
    var cls = s >= 26 ? 'ok' : 'warn';
    var texto = s + '/30 — ' + label + (ajusteAplicado ? ' (incluye +1 por escolaridad ≤12 años)' : '');
    return { raw: s, label: label, cls: cls, texto: texto, completo: true };
  }

  /* ────────────────────────────────────────────────────────────────
   * Dispatcher principal
   * ──────────────────────────────────────────────────────────────── */
  function interpretar(escalaId, valores, contexto) {
    var esc = ESCALAS[escalaId];
    if (!esc) throw new Error('Escala desconocida: ' + escalaId);
    valores = valores || {};
    contexto = contexto || {};
    switch (esc.tipo) {
      case 'suma': return interpretarSuma(esc, valores);
      case 'tug': return interpretarTug(valores);
      case 'gait': return interpretarGait(valores);
      case 'grip': return interpretarGrip(valores, contexto);
      case 'reloj': return interpretarReloj(valores);
      case 'cfs': return interpretarCfs(valores);
      case 'frailvig': return interpretarFrailvig(valores);
      case 'charlson': return interpretarCharlson(valores, contexto);
      case 'cirsg': return interpretarCirsg(valores);
      case 'mmse': return interpretarMmse(valores);
      case 'pfeiffer': return interpretarPfeiffer(valores);
      case 'glim': return interpretarGlim(valores);
      case 'mna': return interpretarMna(valores);
      case 'moca': return interpretarMoca(valores, contexto);
      default: throw new Error('Escala sin lógica de interpretación: ' + escalaId);
    }
  }

  /* ────────────────────────────────────────────────────────────────
   * Catálogo agrupado por dominio (para el desplegable de la UI)
   * ──────────────────────────────────────────────────────────────── */
  function catalogo() {
    return DOMINIOS.map(function (d) {
      return {
        id: d.id,
        nombre: d.nombre,
        escalas: Object.keys(ESCALAS).map(function (k) { return ESCALAS[k]; }).filter(function (e) { return e.dominio === d.id; })
      };
    });
  }

  return { DOMINIOS: DOMINIOS, ESCALAS: ESCALAS, interpretar: interpretar, catalogo: catalogo };
});
