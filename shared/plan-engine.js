/**
 * shared/plan-engine.js — Generador del plan de recomendaciones (VGI+).
 *
 * JavaScript puro: sin `document`, sin `window`, sin `require('express')`,
 * sin acceso a archivos. Cargable con `require()` en Node y con
 * `<script src="/shared/plan-engine.js"></script>` en el navegador.
 *
 * Puerto fiel de buildPlan() / adaCat() de
 * docs/VGI_prototipo_generico_referencia.html (línea ~722 en adelante).
 * Los cortes de Vivifrail (pasaporte por SPPB, variante "+" por TUG/SARC-F/
 * marcha) están ya validados en el prototipo y se portan tal cual, sin
 * modificar dosis ni ejercicios. No se ha podido acceder a vivifrail.es /
 * vivifrail.com desde este entorno para ampliar detalle: se mantiene el
 * enlace de salida a vivifrail.com para que el clínico consulte la rueda
 * oficial impresa, igual que hacía el prototipo.
 *
 * Firma
 * -----
 * generarPlan({records, morfo, clinical, paciente}) →
 *   { clasificacion: [...], recomendaciones: {ejercicio, nutricion, caidas,
 *     demencia, anemia, vitd, glucemia, stopstart} }
 *
 * Forma esperada de los parámetros de entrada
 * --------------------------------------------
 * records   — objeto {[escalaId]: resultadoDeInterpretar}, es decir, el
 *             resultado de `VGIScales.interpretar(escalaId, ...)` para el
 *             registro más reciente de cada escala del paciente. Una
 *             escala no valorada simplemente no tiene clave en `records`.
 * morfo     — {peso: number|null, talla: number|null} (kg, cm). El
 *             peso/talla no son una escala (SCALES_CONTRACT.md), van
 *             aparte.
 * clinical  — datos complementarios de la pestaña Plan del prototipo:
 *             {hb, vcm, fer, ist, b12, fol, egfr, vitd, hba1c, inflam,
 *              card, preop, dm, sulin, cat, ss:{[stoppStartId]: boolean}}
 *             (todas las claves numéricas opcionales; cat es la
 *             categoría funcional ADA manual: "healthy"|"complex"|"poor",
 *             opcional — si no se da, se calcula igual que en el
 *             prototipo con adaCat()).
 * paciente  — {sexo: "H"|"M", edadAnios: number, caidasUltimoAnio: number}
 *
 * Cada entrada de `recomendaciones` es {t: titulo, l: [medida, ...],
 * f: referenciaBibliografica}, igual que en el prototipo.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VGIPlanEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ────────────────────────────────────────────────────────────────
   * STOPP/START v3 — subconjunto representativo (idéntico al prototipo)
   * ──────────────────────────────────────────────────────────────── */
  var SS = [
    ['stopp_frid', 'STOPP — fármacos que aumentan riesgo de caídas (benzodiacepinas, neurolépticos, vasodilatadores, hipnóticos-Z) en paciente con caídas recurrentes', 'stop'],
    ['stopp_bzd', 'STOPP — benzodiacepinas ≥4 semanas (sedación, caídas, confusión)', 'stop'],
    ['stopp_neuro', 'STOPP — antipsicóticos como hipnótico o en SCPD sin indicación clara', 'stop'],
    ['stopp_antihta', 'STOPP — duplicidad de antihipertensivos / hipotensión ortostática sintomática', 'stop'],
    ['stopp_aines', 'STOPP — AINE de forma prolongada (riesgo HDA, ERC, HTA, IC)', 'stop'],
    ['stopp_ppi', 'STOPP — IBP a dosis plena >8 semanas sin indicación de mantenimiento', 'stop'],
    ['stopp_anticol', 'STOPP — fármacos anticolinérgicos en deterioro cognitivo o demencia', 'stop'],
    ['stopp_sulfo', 'STOPP — sulfonilureas de acción prolongada (glibenclamida) en diabetes', 'stop'],
    ['stopp_opioide', 'STOPP — opioides sin laxante pautado (riesgo de estreñimiento)', 'stop'],
    ['stopp_duplic', 'STOPP — duplicidad terapéutica de una misma clase farmacológica', 'stop'],
    ['start_anticoag', 'START — anticoagulación en FA crónica sin contraindicación', 'start'],
    ['start_estatina', 'START — estatina en enfermedad cardiovascular establecida', 'start'],
    ['start_iecaical', 'START — IECA/ARA-II en insuficiencia cardíaca o tras IAM', 'start'],
    ['start_vitd', 'START — vitamina D en paciente institucionalizado o con caídas/osteoporosis', 'start'],
    ['start_calcio', 'START — calcio + vitamina D / antirresortivo en osteoporosis documentada', 'start'],
    ['start_laxante', 'START — laxante en paciente con opioides crónicos', 'start'],
    ['start_vacuna', 'START — vacunación antigripal anual y antineumocócica', 'start'],
    ['start_isrs', 'START — ISRS en depresión moderada-grave persistente', 'start']
  ];

  var DOM_A_GRUPO = { morfofuncional: 'f', fragilidad: 'f', nutricional: 'n', cognitivo: 'c', comorbilidad: 'x' };

  var TRACK = [
    ['barthel', 'Barthel'], ['lawton', 'Lawton'], ['katz', 'Katz dep'], ['charlson', 'Charlson'],
    ['cirsg', 'CIRS-G'], ['frail', 'FRAIL'], ['fried', 'Fried'], ['cfs', 'CFS'], ['frailvig', 'IF-VIG'],
    ['reloj', 'T.Reloj'], ['gait', 'Marcha m/s'], ['grip', 'Grip kg'], ['tug', 'TUG s'], ['sppb', 'SPPB'],
    ['sarcf', 'SARC-F'], ['mna', 'MNA'], ['mmse', 'MMSE'], ['moca', 'MoCA'], ['pfeiffer', 'Pfeiffer']
  ];

  /* ────────────────────────────────────────────────────────────────
   * Utilidades
   * ──────────────────────────────────────────────────────────────── */
  function RAW(records, id) {
    return records && records[id] && records[id].raw != null ? records[id].raw : null;
  }
  function PRESENTE(records, id) {
    return !!(records && records[id] && records[id].raw != null);
  }

  function adaCat(records, clinical) {
    if (clinical && clinical.cat) return clinical.cat;
    var b = RAW(records, 'barthel'), mm = RAW(records, 'mmse'), pf = RAW(records, 'pfeiffer'),
      cfs = RAW(records, 'cfs'), vig = RAW(records, 'frailvig'), katz = RAW(records, 'katz'),
      frail = RAW(records, 'frail');
    var poor = (mm != null && mm <= 12) || (pf != null && pf >= 8) || (b != null && b <= 35) ||
      (cfs != null && cfs >= 7) || (vig != null && vig > 0.5) || (katz != null && katz >= 5);
    if (poor) return 'poor';
    var complex = (mm != null && mm <= 24) || (pf != null && pf >= 3) || (b != null && b <= 90) ||
      (katz != null && katz >= 2) || (cfs != null && cfs >= 5) || (vig != null && vig > 0.2) ||
      (frail != null && frail >= 3);
    return complex ? 'complex' : 'healthy';
  }

  /* ────────────────────────────────────────────────────────────────
   * generarPlan
   * ──────────────────────────────────────────────────────────────── */
  function generarPlan(input) {
    input = input || {};
    var records = input.records || {};
    var morfo = input.morfo || {};
    var clinical = input.clinical || {};
    var paciente = input.paciente || {};
    var ss = clinical.ss || {};

    var rec = {};
    var clasificacion = [];

    // Clasificación de resultados (todas las escalas con valor presente)
    var ESC_DOMINIO = {
      barthel: 'morfofuncional', lawton: 'morfofuncional', katz: 'morfofuncional', gait: 'morfofuncional',
      grip: 'morfofuncional', tug: 'morfofuncional', sppb: 'morfofuncional',
      mna: 'nutricional', glim: 'nutricional', sarcf: 'nutricional',
      charlson: 'comorbilidad', cirsg: 'comorbilidad',
      frail: 'fragilidad', fried: 'fragilidad', cfs: 'fragilidad', frailvig: 'fragilidad',
      mmse: 'cognitivo', moca: 'cognitivo', pfeiffer: 'cognitivo', reloj: 'cognitivo'
    };
    Object.keys(records).forEach(function (id) {
      var r = records[id];
      if (!r || r.raw == null) return;
      var dominio = ESC_DOMINIO[id] || 'morfofuncional';
      clasificacion.push({ escalaId: id, dominio: dominio, grupo: DOM_A_GRUPO[dominio] || 'f', texto: r.texto || r.label });
    });

    /* EJE 1 — VIVIFRAIL (ejercicio) */
    var sppb = RAW(records, 'sppb');
    if (sppb != null) {
      var P, E;
      if (sppb <= 3) { P = 'A'; E = 'discapacidad'; }
      else if (sppb <= 6) { P = 'B'; E = 'fragilidad'; }
      else if (sppb <= 9) { P = 'C'; E = 'prefragilidad'; }
      else { P = 'D'; E = 'robusto'; }
      var plus = false, pr = [];
      if (P !== 'A' && P !== 'D') {
        var tug = RAW(records, 'tug'), sarcf = RAW(records, 'sarcf'), gait = RAW(records, 'gait');
        if (tug != null && tug >= 13.5) { plus = true; pr.push('TUG ≥13,5 s'); }
        if (sarcf != null && sarcf >= 4) { plus = true; pr.push('SARC-F ≥4'); }
        if (gait != null && gait <= 0.8) { plus = true; pr.push('marcha ≤0,8 m/s'); }
      }
      var PL = P + (plus ? '+' : '');
      rec.ejercicio = {
        t: 'Ejercicio físico multicomponente (VIVIFRAIL)',
        l: [
          'SPPB ' + sppb + '/12 → Pasaporte VIVIFRAIL ' + PL + ' (' + E + ').' + (plus ? ' Variante "+" por: ' + pr.join(', ') + '.' : ''),
          'Componentes: fuerza y potencia de MMII, equilibrio y coordinación, reentrenamiento de la marcha, flexibilidad y resistencia aeróbica.',
          'Dosis: 30-45 min, 3 días/semana, intensidad baja-moderada progresiva, mínimo 8 semanas.',
          'Consultar rueda de ejercicios VIVIFRAIL ' + PL + ' en vivifrail.com. Reevaluar SPPB al finalizar para reasignar pasaporte.'
        ],
        f: 'Ministerio de Sanidad 2022 (consenso VIVIFRAIL); vivifrail.com'
      };
    }

    /* EJE 2 — NUTRICIÓN */
    var glimSi = RAW(records, 'glim') === 1;
    var mnaRec = records.mna;
    var mnaRiesgo = !!(mnaRec && mnaRec.raw != null && mnaRec.label && mnaRec.label !== 'normal');
    if (PRESENTE(records, 'mna') || (records.glim && records.glim.raw != null)) {
      var l2;
      if (glimSi || mnaRiesgo) {
        l2 = [
          'Desnutrición / riesgo nutricional confirmado: plan nutricional intensificado.',
          'Aporte proteico 1,2-1,5 g/kg/día (ajustar en ERC grave sin diálisis).',
          'Suplementos nutricionales orales si la dieta no cubre requerimientos: ≥400 kcal/día y ≥30 g proteína/día durante ≥1 mes con revisión mensual.',
          'Energía ≈30 kcal/kg/día. Intervención multimodal: apoyo en comidas, enriquecimiento de texturas, consejo dietético individualizado. Priorizar siempre la vía oral.',
          'Tratar causas reversibles de baja ingesta: dolor, polifarmacia, salud bucodental, estreñimiento, depresión.',
          'Combinar con ejercicio multicomponente para preservar masa y función muscular.',
          'Hidratación adecuada: ≈1,6 L/día (mujeres) / ≈2,0 L/día (hombres).'
        ];
      } else {
        l2 = ['Estado nutricional adecuado. Mantener ≈30 kcal/kg/día y ≥1,0-1,2 g/kg/día de proteína. Evitar dietas restrictivas no justificadas. Mantener cribado nutricional periódico.'];
      }
      rec.nutricion = { t: 'Nutrición (ESPEN)', l: l2, f: 'Volkert D et al. ESPEN 2019 (PMID 30005900); ESPEN 2022 (PMID 35306388); PROT-AGE 2013 (PMID 23867520)' };
    }

    /* EJE 3 — CAÍDAS */
    var cN = paciente.caidasUltimoAnio;
    var frail = RAW(records, 'frail'), tugR = RAW(records, 'tug'), gaitR = RAW(records, 'gait'), cfsR = RAW(records, 'cfs');
    var rCaidas = (sppb != null && sppb <= 8) || (frail != null && frail >= 3) ||
      (RAW(records, 'sarcf') != null && RAW(records, 'sarcf') >= 4) ||
      (tugR != null && tugR >= 13.5) || (gaitR != null && gaitR <= 0.8) ||
      (cN != null && cN >= 1) || (cfsR != null && cfsR >= 5);
    if (rCaidas) {
      var fc = [];
      if (cN != null && cN > 0) fc.push(cN + ' caída(s) en el último año');
      if (frail != null && frail >= 3) fc.push('fragilidad (FRAIL)');
      if (sppb != null && sppb <= 8) fc.push('SPPB ' + sppb + '/12');
      if (tugR != null && tugR >= 13.5) fc.push('TUG ' + tugR + ' s');
      if (gaitR != null && gaitR <= 0.8) fc.push('marcha ' + gaitR + ' m/s');
      rec.caidas = {
        t: 'Prevención de caídas (NICE NG249)',
        l: [
          'Riesgo elevado de caídas' + (fc.length ? ' por: ' + fc.join(', ') : '') + '. Ofrecer valoración multifactorial si ha caído en el último año con ≥1 criterio (fragilidad, ≥2 caídas, lesión que precisó atención, pérdida de conciencia o incapacidad para levantarse).',
          'Valoración multifactorial: TA en decúbito y bipedestación (hipotensión ortostática), cognición y ánimo, calzado y pie, marcha-equilibrio-fuerza, visión, audición, continencia, mareo/vértigo, riesgo de osteoporosis y enfermedades crónicas.',
          'Revisión estructurada de la medicación: retirar o ajustar psicofármacos y otros fármacos de riesgo (ver módulo STOPP/START).',
          'Programa de ejercicio progresivo centrado en equilibrio, coordinación, fuerza y potencia, alineado con el Pasaporte VIVIFRAIL asignado.',
          'Evaluación de riesgos del entorno domiciliario o residencial con herramienta validada; preferiblemente por terapeuta ocupacional.',
          'Vitamina D para salud ósea y muscular según niveles (ver módulo). Valorar TCC del miedo a caer si persiste tras el programa de ejercicio.'
        ],
        f: 'NICE NG249, 2025; Neilson J et al. BMJ 2026;392:s223. doi:10.1136/bmj.s223'
      };
    }

    /* EJE 4 — DETERIORO COGNITIVO */
    var pfeifferR = RAW(records, 'pfeiffer'), mmseR = RAW(records, 'mmse'), relojR = RAW(records, 'reloj'), mocaR = RAW(records, 'moca');
    var cogPos = (pfeifferR != null && pfeifferR >= 3) || (mmseR != null && mmseR <= 24) ||
      (relojR != null && relojR <= 3) || (mocaR != null && mocaR < 26);
    if (cogPos) {
      var gr = mmseR != null ? (mmseR >= 21 ? 'leve' : mmseR >= 10 ? 'moderado' : 'grave') : null;
      var partes = ['Cribado cognitivo positivo'];
      if (mmseR != null) partes.push(' (MMSE ' + mmseR + '/30)');
      if (mocaR != null) partes.push(' · MoCA ' + mocaR + '/30');
      if (pfeifferR != null) partes.push(' · Pfeiffer ' + pfeifferR + ' errores');
      if (relojR != null && relojR <= 3) partes.push(' · Test del Reloj ' + relojR + '/5');
      rec.demencia = {
        t: 'Estudio del deterioro cognitivo (NICE NG97)',
        l: [
          partes.join('') + '. Indicado estudio diagnóstico completo.',
          'Anamnesis estructurada con informante fiable: cronología, repercusión funcional en ABVD y AIVD, síntomas conductuales y psicológicos (SCPD).',
          'Neuroimagen estructural (TC o RM preferible) para apoyar diagnóstico y excluir causas estructurales.',
          'Analítica de causas reversibles: hemograma, VSG/PCR, glucosa/HbA1c, función renal y hepática, iones (calcio), TSH, vitamina B12 y ácido fólico.',
          'Filiar subtipo de demencia. Derivar a unidad de memoria / geriatría / neurología. Si demencia establecida: valorar IACE' + (gr ? ' (estadio ' + gr + ')' : '') + ' y memantina en fases moderada-grave, junto a medidas no farmacológicas y apoyo al cuidador.'
        ],
        f: 'NICE NG97, 2018; Shulman KI et al. Int Psychogeriatr 2006;18:281-294'
      };
    }

    /* EJE 5 — ANEMIA */
    var hb = clinical.hb;
    if (hb != null) {
      var sx = paciente.sexo, lim = sx === 'M' ? 12 : 13, anem = hb < lim, sev = hb < 8 ? 'grave' : hb < 11 ? 'moderada' : 'leve';
      var fer = clinical.fer, ist = clinical.ist, inflam = clinical.inflam, egfr = clinical.egfr, preop = clinical.preop;
      var ferrop = (fer != null && (fer < 30 || (inflam && fer < 100))) || (ist != null && ist < 20);
      var l5 = [];
      if (preop) {
        l5.push('OPTIMIZACIÓN PREOPERATORIA (Vía RICA / PBM): objetivo Hb >13 g/dL en ambos sexos antes de cirugía electiva con riesgo de sangrado. Hb actual ' + hb + ' g/dL.');
        if (anem || ferrop) {
          if (ferrop) l5.push('Ferropenia presente: hierro oral de 1.ª línea si hay ≥6 semanas hasta la cirugía. Hierro IV si tiempo insuficiente, intolerancia oral, malabsorción o necesidad de corrección rápida. Reevaluar Hb a las 4 semanas.');
          else l5.push('Anemia no ferropénica (Hb 10-13 g/dL): considerar agentes estimulantes de eritropoyesis (rHuEPO) en cirugía con riesgo de sangrado moderado-alto.');
          l5.push('No programar cirugía electiva con riesgo de sangrado hasta completar diagnóstico y tratamiento de la anemia.');
        } else { l5.push('Hb dentro del objetivo preoperatorio (>13 g/dL). Continuar con protocolo PBM/ERAS institucional.'); }
        l5.push('Descartar y corregir déficits de B12 y folato. Criterios transfusionales restrictivos intra/postoperatorios: Hb <7-8 g/dL (AABB 2023).');
        l5.push('Ácido tranexámico en cirugía mayor con sangrado esperado (nivel de evidencia 1A, Moral V 2024).');
      } else if (anem) {
        l5.push('Anemia ' + sev + ' (Hb ' + hb + ' g/dL; umbral OMS ' + lim + ' g/dL).' + (clinical.vcm ? ' VCM ' + clinical.vcm + ' fL.' : ''));
        if (ferrop) l5.push('Patrón ferropénico: hierro oral ~100 mg Fe elemento preferiblemente en días alternos. Hierro IV si intolerancia oral, malabsorción, EII, ERC o corrección urgente. Reevaluar Hb a las 4 semanas.');
        if (clinical.b12 != null && clinical.b12 < 200) l5.push('Déficit de vitamina B12: reponer cianocobalamina y estudiar causa.');
        if (clinical.fol != null && clinical.fol < 3) l5.push('Déficit de folato: reponer ácido fólico.');
        if (egfr != null && egfr < 60) l5.push('Anemia en ERC: corregir primero la ferropenia. Valorar AEE (eritropoyetina) si Hb <10 g/dL persistente; objetivo Hb 10-12 g/dL (no superar 12 g/dL).');
        l5.push('Transfusión restrictiva: umbral Hb <7 g/dL (o <8 g/dL si enfermedad cardiovascular o cirugía ortopédica). Decisión individualizada según síntomas (AABB 2023).');
      } else { l5.push('Sin anemia (Hb ' + hb + ' g/dL ≥ umbral ' + lim + ' g/dL).'); }
      rec.anemia = {
        t: 'Anemia' + (preop ? ' — optimización preoperatoria (RICA/PBM)' : ''), l: l5,
        f: 'OMS; Camaschella C. NEJM 2015 (PMID 25946282); Carson JL et al. AABB 2023 (PMID 37824153); Moral V et al. Rev Esp Anestesiol 2024 (PMID 38670490); Muñoz M et al. Rev Clin Esp 2024 (PMID 38423382)'
      };
    }

    /* EJE 6 — VITAMINA D */
    if (clinical.vitd != null) {
      var vd = clinical.vitd, cat6, l6;
      if (vd < 20) { cat6 = 'deficiencia'; l6 = ['Deficiencia (<20 ng/mL): colecalciferol en carga (p. ej. 50.000 UI/semana 6-8 semanas o equivalente diario) y mantenimiento posterior 1.500-2.000 UI/día.']; }
      else if (vd < 30) { cat6 = 'insuficiencia'; l6 = ['Insuficiencia (20-29 ng/mL): suplementar 1.000-2.000 UI/día y recontrolar a los 3-4 meses.']; }
      else { cat6 = 'suficiencia'; l6 = ['Niveles suficientes (≥30 ng/mL): mantenimiento según riesgo. En ≥75 años o institucionalizados: ≈800-1.000 UI/día para salud ósea y muscular.']; }
      l6.push('Asegurar aporte adecuado de calcio. Recontrolar 25-OH-D a los 3-4 meses. En mayores de 75 años se sugiere suplementación empírica de mantenimiento (Endocrine Society 2024).');
      rec.vitd = { t: 'Vitamina D — ' + cat6 + ' (25-OH-D ' + vd + ' ng/mL)', l: l6, f: 'Holick MF et al. Endocrine Society 2011 (PMID 21646368); Demay MB et al. 2024 (PMID 38828931)' };
    }

    /* EJE 7 — GLUCEMIA */
    if (clinical.dm || clinical.hba1c != null) {
      var cat7 = adaCat(records, clinical), a1c = clinical.hba1c;
      var objs = { healthy: '<7,0-7,5 %', complex: '<8,0 %', poor: 'evitar hipoglucemia e hiperglucemia sintomática (no depender de HbA1c)' };
      var catTs = { healthy: 'sano / buena función cognitiva y funcional', complex: 'complejo / intermedio', poor: 'muy complejo / mala salud' };
      var l7 = ['Categoría funcional ADA 2026: ' + catTs[cat7] + '. Objetivo HbA1c: ' + objs[cat7] + '.' + (a1c != null ? ' HbA1c actual: ' + a1c + ' %.' : '')];
      if (cat7 === 'poor') l7.push('Priorizar evitar hipoglucemia y simplificar/desintensificar el plan terapéutico. Glucemia en ayunas aceptable: 100-180 mg/dL.');
      if (clinical.sulin) l7.push('Insulina/sulfonilureas: alto riesgo de hipoglucemia. Preferir fármacos de bajo riesgo (metformina si eGFR≥30, iDPP4, iSGLT2, arGLP1 según indicación) y simplificar pautas complejas.');
      l7.push('Priorizar fármacos con beneficio CV/renal demostrado cuando esté indicado. Revisar eGFR para dosificación correcta.');
      rec.glucemia = { t: 'Control glucémico individualizado (ADA 2026)', l: l7, f: 'ADA. Diabetes Care 2026;49(Suppl.1):S277-S296. doi:10.2337/dc26-S013' };
    }

    /* EJE 8 — STOPP/START */
    var ssOn = SS.filter(function (s) { return ss[s[0]]; });
    if (ssOn.length) {
      rec.stopstart = { t: 'Optimización de la medicación (STOPP/START v3)', l: ssOn.map(function (s) { return s[1]; }), f: "O'Mahony D et al. Eur Geriatr Med 2023;14:625-632. doi:10.1007/s41999-023-00777-y" };
    }

    return { clasificacion: clasificacion, recomendaciones: rec };
  }

  return { generarPlan: generarPlan, SS: SS, TRACK: TRACK, adaCat: adaCat };
});
