/**
 * public/js/tab-documentos.js — pestaña Documentos: exportación a Word del
 * informe VGI y del plan de recomendaciones, con selector de fecha (puede
 * haber más de un registro por paciente, p. ej. un ingreso previo).
 */
const TabDocumentos = (() => {
  function build() {
    const root = $('pg-documentos');
    root.innerHTML = '';
    if (!App.requierePaciente(root)) return;

    const c = el('div', 'card');
    c.innerHTML = `<div class="card-h">Generar documentos</div><div class="card-b">
      <p class="help">Elige la fecha del registro que quieres exportar (puede haber más de una valoración guardada para este paciente).</p>
      <div class="fg" style="max-width:260px"><label>Fecha del registro</label><select id="doc-fecha"></select></div>
      <div class="btn-row">
        <button class="btn btn-p btn-big" id="doc-informe">Descargar informe VGI (.docx)</button>
        <button class="btn btn-g btn-big" id="doc-plan">Descargar plan de recomendaciones (.docx)</button>
      </div>
      <div id="doc-status" class="status"></div>
      <div class="note">El plan de recomendaciones solo puede descargarse si la hoja de ruta de esa fecha ya ha sido validada en la pestaña Plan.</div>
    </div>`;
    root.appendChild(c);

    cargarFechas();
    c.querySelector('#doc-informe').addEventListener('click', () => descargar('informe'));
    c.querySelector('#doc-plan').addEventListener('click', () => descargar('plan'));
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

  async function descargar(tipo) {
    const fecha = $('doc-fecha').value;
    limpiarEstado('doc-status');
    const url = tipo === 'informe' ? Api.urlInforme(APP.patient.id, fecha) : Api.urlPlanDoc(APP.patient.id, fecha);
    const nombreArchivo = (tipo === 'informe' ? 'informe_vgi_' : 'plan_recomendaciones_') + (APP.patient.nhc || APP.patient.id) + '_' + fecha + '.docx';
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

  return { build };
})();
