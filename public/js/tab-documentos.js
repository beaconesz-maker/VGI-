/**
 * public/js/tab-documentos.js — pestaña Documentos: exportación a Word del
 * informe VGI y del plan de recomendaciones, con selector de fecha (puede
 * haber más de un registro por paciente, p. ej. un ingreso previo), y
 * botones de "copiar" para tenerlos como texto sin tener que descargar
 * ningún archivo.
 */
const TabDocumentos = (() => {
  function build() {
    const root = $('pg-documentos');
    root.innerHTML = '';
    if (!App.requierePaciente(root)) return;

    const c = el('div', 'card');
    c.innerHTML = `<div class="card-h">Generar documentos</div><div class="card-b">
      <p class="help">Elige la fecha del registro que quieres exportar o copiar (puede haber más de una valoración guardada para este paciente).</p>
      <div class="fg" style="max-width:260px"><label>Fecha del registro</label><select id="doc-fecha"></select></div>
      <div class="gg">Informe VGI</div>
      <div class="btn-row">
        <button class="btn btn-p btn-big" id="doc-informe-docx">Descargar informe VGI (.docx)</button>
        <button class="btn btn-g btn-big" id="doc-informe-pdf">Descargar informe VGI (.pdf)</button>
        <button class="btn btn-g btn-big" id="doc-informe-copiar">📋 Copiar valoración</button>
      </div>
      <div class="gg">Plan de recomendaciones</div>
      <div class="btn-row">
        <button class="btn btn-p btn-big" id="doc-plan-docx">Descargar plan de recomendaciones (.docx)</button>
        <button class="btn btn-g btn-big" id="doc-plan-pdf">Descargar plan de recomendaciones (.pdf)</button>
        <button class="btn btn-g btn-big" id="doc-plan-copiar">📋 Copiar recomendaciones</button>
      </div>
      <div id="doc-status" class="status"></div>
      <div class="note">El plan de recomendaciones solo puede descargarse o copiarse si la hoja de ruta de esa fecha ya ha sido validada en la pestaña Plan.</div>
      <div class="fg" id="doc-copiar-box" style="display:none">
        <label>Texto copiado (también puedes seleccionarlo y copiarlo a mano)</label>
        <textarea id="doc-copiar-texto" readonly rows="14" style="width:100%;font-family:monospace;font-size:.85rem"></textarea>
      </div>
    </div>`;
    root.appendChild(c);

    if (APP.user && APP.user.rol === 'admin') root.appendChild(cardAgregado());

    cargarFechas();
    c.querySelector('#doc-informe-docx').addEventListener('click', () => descargar('informe', 'docx'));
    c.querySelector('#doc-informe-pdf').addEventListener('click', () => descargar('informe', 'pdf'));
    c.querySelector('#doc-plan-docx').addEventListener('click', () => descargar('plan', 'docx'));
    c.querySelector('#doc-plan-pdf').addEventListener('click', () => descargar('plan', 'pdf'));
    c.querySelector('#doc-informe-copiar').addEventListener('click', copiarInforme);
    c.querySelector('#doc-plan-copiar').addEventListener('click', copiarPlan);
  }

  function cardAgregado() {
    const c = el('div', 'card');
    c.innerHTML = `<div class="card-h">Datos agregados anonimizados<span class="b">solo administrador</span></div><div class="card-b">
      <p class="help">Volcado de todos los registros de escalas de todos los pacientes, sin NHC ni nombre (solo el identificador interno del paciente). Pensado para análisis o auditoría, no para el seguimiento clínico individual.</p>
      <div class="btn-row">
        <a class="btn btn-g btn-big" href="${Api.urlAgregadoCsv()}">Descargar CSV</a>
        <a class="btn btn-g btn-big" href="${Api.urlAgregadoXlsx()}">Descargar Excel (.xlsx)</a>
      </div>
    </div>`;
    return c;
  }

  async function cargarFechas() {
    const sel = $('doc-fecha');
    sel.innerHTML = '';
    let fechas = [];
    try {
      const registros = await Api.listarRecords(APP.patient.id, {});
      fechas = Array.from(new Set((registros || []).map((r) => r.fecha)));
    } catch (e) { /* si falla, seguimos con la fecha de trabajo */ }
    if (!fechas.includes(APP.fechaTrabajo)) fechas.push(APP.fechaTrabajo);
    fechas.sort().reverse();
    fechas.forEach((f) => {
      const opt = el('option'); opt.value = f; opt.textContent = fmtFechaES(f);
      sel.appendChild(opt);
    });
  }

  async function descargar(tipo, formato) {
    const fecha = $('doc-fecha').value;
    limpiarEstado('doc-status');
    const url = tipo === 'informe' ? Api.urlInforme(APP.patient.id, fecha, formato) : Api.urlPlanDoc(APP.patient.id, fecha, formato);
    const nombreArchivo = (tipo === 'informe' ? 'informe_vgi_' : 'plan_recomendaciones_') + (APP.patient.nhc || APP.patient.id) + '_' + fecha + '.' + formato;
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) {
        let mensaje = 'No se ha podido generar el documento (' + res.status + ').';
        try { const data = await res.json(); if (data && data.mensaje) mensaje = data.mensaje; } catch (e) { /* sin cuerpo JSON */ }
        mostrarEstado('doc-status', mensaje, 'err');
        return;
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl; a.download = nombreArchivo;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(objUrl);
      mostrarEstado('doc-status', 'Documento descargado: ' + nombreArchivo, 'ok');
    } catch (e) {
      mostrarEstado('doc-status', 'No se ha podido contactar con el servidor.', 'err');
    }
  }

  /* ── Copiar al portapapeles ────────────────────────────────────────
   * Reconstruye, en texto plano, el mismo contenido que informe.docx/.pdf
   * y plan.docx/.pdf (ver server/lib/docx-informe.js y docx-plan.js), sin
   * pasar por un archivo descargado. server/lib/items-fallidos.js es solo
   * de servidor (usa require de Node), así que aquí se reimplementa la
   * misma lógica — igual que ya hace public/js/tab-escalas.js con
   * "vigente a fecha" (server/lib/vigente.js). */

  const DIRECCION_TIPO_PROPIO = { mmse: 'mayor_mejor', pfeiffer: 'menor_mejor', moca: 'mayor_mejor', reloj: 'mayor_mejor' };
  const ITEMS_EXCLUIDOS = new Set(['escolaridad']);

  function direccionDe(esc) {
    if (Array.isArray(esc.cortes) && esc.cortes.length) return esc.cortes[0][2] === 'ok' ? 'menor_mejor' : 'mayor_mejor';
    return DIRECCION_TIPO_PROPIO[esc.tipo] || null;
  }

  function itemsFallidos(esc, valores) {
    if (!esc || !Array.isArray(esc.items) || !valores) return [];
    const direccion = direccionDe(esc);
    if (!direccion) return [];
    const resultado = [];
    esc.items.forEach((it) => {
      if (!it.opciones || ITEMS_EXCLUIDOS.has(it.id)) return;
      const val = valores[it.id];
      if (val == null) return;
      const valoresPosibles = it.opciones.map((o) => o.valor);
      const mejorValor = direccion === 'mayor_mejor' ? Math.max(...valoresPosibles) : Math.min(...valoresPosibles);
      if (val === mejorValor) return;
      const opcion = it.opciones.find((o) => o.valor === val);
      resultado.push({ pregunta: it.pregunta, etiqueta: opcion ? opcion.etiqueta : String(val) });
    });
    return resultado;
  }

  // A igualdad de fecha, gana el creado más tarde — mismo criterio que
  // server/lib/vigente.js:masRecienteHasta().
  function masRecienteHasta(regs, fecha) {
    const candidatos = regs.filter((r) => !fecha || r.fecha <= fecha);
    if (!candidatos.length) return null;
    return candidatos.reduce((mejor, actual) => {
      if (!mejor) return actual;
      if (actual.fecha > mejor.fecha) return actual;
      if (actual.fecha === mejor.fecha && (actual.createdAt || '') > (mejor.createdAt || '')) return actual;
      return mejor;
    }, null);
  }

  async function construirTextoInforme(fecha) {
    const p = APP.patient;
    const edad = calcEdad(p.fechaNacimiento, fecha);
    const registros = await Api.listarRecords(p.id, {});
    const porEscala = {};
    (registros || []).forEach((r) => { (porEscala[r.escalaId] = porEscala[r.escalaId] || []).push(r); });

    const lineas = [];
    lineas.push('VGI+ — Informe de valoración');
    lineas.push('Hospital San Juan Grande (Jerez de la Frontera)');
    lineas.push('');
    lineas.push('Paciente: ' + (p.nombre || '—') + '    NHC: ' + (p.nhc || '—'));
    lineas.push('Fecha de nacimiento: ' + (p.fechaNacimiento || '—') + (edad != null ? '  (' + edad + ' años a fecha del informe)' : ''));
    lineas.push('Sexo: ' + (p.sexo === 'M' ? 'Mujer' : p.sexo === 'H' ? 'Hombre' : '—') + '    Localización: ' + (p.localizacion || '—'));
    lineas.push('Fecha del informe: ' + fecha);
    lineas.push('');
    lineas.push('Escalas registradas');
    lineas.push('--------------------');

    const escalaIds = Object.keys(porEscala).sort();
    if (!escalaIds.length) {
      lineas.push('(No hay escalas registradas hasta la fecha indicada.)');
    }
    escalaIds.forEach((escalaId) => {
      const record = masRecienteHasta(porEscala[escalaId], fecha);
      if (!record) return;
      const esc = VGIScales.ESCALAS[escalaId];
      const nombre = esc ? esc.nombre + (esc.sub ? ' (' + esc.sub + ')' : '') : escalaId;
      const resultado = record.resultado || {};
      lineas.push('');
      lineas.push(nombre);
      lineas.push('Fecha del registro: ' + record.fecha + '    Registrado por: ' + (record.userCodigo || '—'));
      lineas.push(resultado.texto || resultado.label || '(sin interpretación)');
      const fallos = esc ? itemsFallidos(esc, record.valores) : [];
      if (fallos.length) {
        lineas.push('Ítems con dificultad:');
        fallos.forEach((f) => lineas.push('  - ' + f.pregunta + ': ' + f.etiqueta));
      }
      if (esc && esc.referencia && esc.referencia.texto) {
        lineas.push('Referencia: ' + esc.referencia.texto);
      }
    });
    lineas.push('');
    lineas.push('Herramienta de apoyo a la decisión clínica. No sustituye el juicio clínico del médico responsable, que toma y firma toda decisión asistencial.');
    return lineas.join('\n');
  }

  const ICONOS_EJE = { ejercicio: '🏃', nutricion: '🥗', caidas: '⚕️', delirium: '🌀', demencia: '🧠', anemia: '🩸', vitd: '☀️', glucemia: '🍬', stopstart: '💊' };
  const ORDEN_EJES = ['ejercicio', 'nutricion', 'caidas', 'delirium', 'demencia', 'anemia', 'vitd', 'glucemia', 'stopstart'];

  async function construirTextoPlan(fecha) {
    const p = APP.patient;
    const edad = calcEdad(p.fechaNacimiento, fecha);
    const plan = await Api.obtenerPlan(p.id, fecha);
    if (!plan.validacion) {
      const err = new Error('sin validar');
      err.mensaje = 'El plan de esta fecha aún no ha sido validado por un clínico.';
      throw err;
    }

    const lineas = [];
    lineas.push('VGI+ — Informe de valoración');
    lineas.push('Hospital San Juan Grande (Jerez de la Frontera)');
    lineas.push('');
    lineas.push('Paciente: ' + (p.nombre || '—') + '    NHC: ' + (p.nhc || '—'));
    lineas.push('Fecha de nacimiento: ' + (p.fechaNacimiento || '—') + (edad != null ? '  (' + edad + ' años a fecha del informe)' : ''));
    lineas.push('Sexo: ' + (p.sexo === 'M' ? 'Mujer' : p.sexo === 'H' ? 'Hombre' : '—') + '    Localización: ' + (p.localizacion || '—'));
    lineas.push('Fecha del informe: ' + fecha);
    lineas.push('');
    const v = plan.validacion;
    lineas.push('Plan validado el ' + new Date(v.validatedAt).toLocaleString('es-ES') + ' por ' + (v.userCodigo || v.userId));
    lineas.push('');
    lineas.push('Plan de recomendaciones y medidas');
    lineas.push('----------------------------------');

    const rec = plan.recomendaciones || {};
    const ejes = ORDEN_EJES.filter((k) => rec[k]);
    if (!ejes.length) {
      lineas.push('(Sin recomendaciones generadas para los datos disponibles en esta fecha.)');
    }
    ejes.forEach((k) => {
      const bloque = rec[k];
      lineas.push('');
      lineas.push((ICONOS_EJE[k] || '') + ' ' + bloque.t);
      (bloque.l || []).forEach((medida) => lineas.push('  - ' + medida));
      if (bloque.f) lineas.push('Referencia: ' + bloque.f);
    });
    lineas.push('');
    lineas.push('Herramienta de apoyo a la decisión clínica. No sustituye el juicio clínico del médico responsable, que toma y firma toda decisión asistencial.');
    return lineas.join('\n');
  }

  async function copiarAlPortapapeles(texto) {
    if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(texto);
        return true;
      } catch (e) { /* cae al método clásico de abajo */ }
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  async function copiarTexto(construir, etiquetaOk) {
    const fecha = $('doc-fecha').value;
    limpiarEstado('doc-status');
    mostrarEstado('doc-status', 'Generando…', 'info');
    let texto;
    try {
      texto = await construir(fecha);
    } catch (e) {
      mostrarEstado('doc-status', e.mensaje || 'No se ha podido generar el texto.', 'err');
      return;
    }
    const box = $('doc-copiar-box');
    const textarea = $('doc-copiar-texto');
    box.style.display = '';
    textarea.value = texto;
    const copiado = await copiarAlPortapapeles(texto);
    if (copiado) {
      mostrarEstado('doc-status', 'Copiado al portapapeles: ' + etiquetaOk + ' — ya puedes pegarlo donde lo necesites.', 'ok');
    } else {
      textarea.focus();
      textarea.select();
      mostrarEstado('doc-status', 'No se ha podido copiar automáticamente: el texto está seleccionado abajo, cópialo con Ctrl+C (o Cmd+C).', 'err');
    }
  }

  function copiarInforme() { return copiarTexto(construirTextoInforme, 'Valoración'); }
  function copiarPlan() { return copiarTexto(construirTextoPlan, 'Plan de recomendaciones'); }

  return { build };
})();
