/**
 * public/js/tab-plan.js — pestaña Plan: datos clínicos/analíticos,
 * revisión STOPP/START, plan generado por el servidor (shared/plan-engine.js
 * vía GET /api/patients/:id/plan) y validación humana obligatoria antes de
 * poder exportar (requisito no negociable de docs/DOCUMENTO_MAESTRO.md).
 */
const TabPlan = (() => {
  const CAMPOS_NUM = [
    ['hb', 'Hb (g/dL)'], ['vcm', 'VCM (fL)'], ['fer', 'Ferritina (ng/mL)'], ['ist', 'IST / TSAT (%)'],
    ['b12', 'Vit. B12 (pg/mL)'], ['fol', 'Ác. fólico (ng/mL)'], ['egfr', 'eGFR (mL/min/1,73)'],
    ['vitd', '25-OH-vitamina D (ng/mL)'], ['hba1c', 'HbA1c (%)'], ['caidasUltimoAnio', 'Caídas en el último año']
  ];

  function build() {
    const root = $('pg-plan');
    root.innerHTML = '';
    if (!App.requierePaciente(root)) return;
    root.appendChild(clinicalCard());
    root.appendChild(planCard());
  }

  function clinicalCard() {
    const c = el('div', 'card');
    let camposHtml = '<div class="grid3">';
    CAMPOS_NUM.forEach(([id, lab]) => {
      camposHtml += `<div class="fg"><label>${lab}</label><input type="number" step="0.1" id="cl-${id}"></div>`;
    });
    camposHtml += '</div>';

    let ssHtml = '<div class="gg">STOPP — considerar retirar o revisar</div>';
    VGIPlanEngine.SS.filter((s) => s[2] === 'stop').forEach(([k, lab]) => {
      ssHtml += `<label class="chk"><input type="checkbox" data-ss="${k}"><span>${escapeHtml(lab.replace('STOPP — ', ''))}</span></label>`;
    });
    ssHtml += '<div class="gg">START — considerar iniciar</div>';
    VGIPlanEngine.SS.filter((s) => s[2] === 'start').forEach(([k, lab]) => {
      ssHtml += `<label class="chk"><input type="checkbox" data-ss="${k}"><span>${escapeHtml(lab.replace('START — ', ''))}</span></label>`;
    });

    c.innerHTML = `<div class="card-h">Datos clínicos y analíticos</div><div class="card-b">
      <div class="fg" style="max-width:220px"><label>Fecha</label><input type="date" id="cl-fecha" value="${APP.fechaTrabajo}"></div>
      ${camposHtml}
      <label class="chk"><input type="checkbox" id="cl-inflam"><span>Proceso inflamatorio / enfermedad crónica activa</span></label>
      <label class="chk"><input type="checkbox" id="cl-card"><span>Enfermedad cardiovascular (umbral transfusional 8 g/dL)</span></label>
      <label class="chk"><input type="checkbox" id="cl-preop"><span>Cirugía electiva con riesgo de sangrado (optimización preoperatoria RICA/PBM)</span></label>
      <label class="chk"><input type="checkbox" id="cl-dm"><span>Diabetes en tratamiento activo</span></label>
      <label class="chk"><input type="checkbox" id="cl-sulin"><span>Tratamiento con insulina o sulfonilureas (riesgo de hipoglucemia)</span></label>
      <div class="fg" style="max-width:320px"><label>Categoría funcional (ADA)</label>
        <select id="cl-cat"><option value="">— automática, según escalas</option>
          <option value="healthy">Sano / buena función</option>
          <option value="complex">Complejo / intermedio</option>
          <option value="poor">Muy complejo / mala salud</option>
        </select>
      </div>
      <hr class="dv">
      <div class="card-h" style="margin:-1rem -1rem 1rem;border-radius:0">Revisión de medicación — STOPP/START v3</div>
      ${ssHtml}
      <div class="note">Subconjunto representativo. Requiere juicio clínico individualizado (O'Mahony et al. Eur Geriatr Med 2023;14:625-632).</div>
      <div class="btn-row"><button class="btn btn-p" id="cl-guardar">Guardar datos clínicos</button></div>
      <div id="cl-status" class="status"></div>
    </div>`;
    c.querySelector('#cl-guardar').addEventListener('click', guardarClinical);
    return c;
  }

  async function guardarClinical() {
    const fecha = $('cl-fecha').value || APP.fechaTrabajo;
    const valores = {};
    CAMPOS_NUM.forEach(([id]) => {
      const v = $('cl-' + id).value;
      valores[id] = v === '' ? null : parseFloat(v);
    });
    valores.inflam = $('cl-inflam').checked;
    valores.card = $('cl-card').checked;
    valores.preop = $('cl-preop').checked;
    valores.dm = $('cl-dm').checked;
    valores.sulin = $('cl-sulin').checked;
    valores.cat = $('cl-cat').value || undefined;
    const ss = {};
    document.querySelectorAll('[data-ss]').forEach((cb) => { ss[cb.dataset.ss] = cb.checked; });
    valores.ss = ss;
    try {
      await Api.guardarClinical(APP.patient.id, { fecha, valores });
      mostrarEstado('cl-status', 'Datos clínicos guardados para el ' + fmtFechaES(fecha) + '.', 'ok');
    } catch (e) {
      mostrarEstado('cl-status', e.mensaje, 'err');
    }
  }

  /* ── Plan generado + validación ─────────────────────────────────── */
  function planCard() {
    const c = el('div', 'card');
    c.innerHTML = `<div class="card-h">Plan de recomendaciones<span class="b">calculado por el servidor</span></div><div class="card-b">
      <div class="fg" style="max-width:220px"><label>Fecha del plan</label><input type="date" id="pl-fecha" value="${APP.fechaTrabajo}"></div>
      <div class="btn-row"><button class="btn btn-p" id="pl-generar">Generar / actualizar plan</button></div>
      <div id="pl-contenido"></div>
      <div id="pl-status" class="status"></div>
    </div>`;
    c.querySelector('#pl-generar').addEventListener('click', generarPlan);
    return c;
  }

  const ICONOS = { ejercicio: '🏃', nutricion: '🥗', caidas: '⚕️', delirium: '🌀', demencia: '🧠', anemia: '🩸', vitd: '☀️', glucemia: '🍬', stopstart: '💊' };
  const ORDEN_EJES = ['ejercicio', 'nutricion', 'caidas', 'delirium', 'demencia', 'anemia', 'vitd', 'glucemia', 'stopstart'];

  async function generarPlan() {
    const fecha = $('pl-fecha').value || APP.fechaTrabajo;
    const cont = $('pl-contenido');
    limpiarEstado('pl-status');
    try {
      const plan = await Api.obtenerPlan(APP.patient.id, fecha);
      pintarPlan(plan, fecha, cont);
    } catch (e) {
      cont.innerHTML = '';
      mostrarEstado('pl-status', e.mensaje, 'err');
    }
  }

  function pintarPlan(plan, fecha, cont) {
    const clasif = plan.clasificacion || [];
    const rec = plan.recomendaciones || {};
    if (!clasif.length && !Object.keys(rec).length) {
      cont.innerHTML = '<div class="empty">Todavía no hay escalas ni datos clínicos suficientes en esta fecha para generar un plan.</div>';
      return;
    }
    let h = '';
    if (clasif.length) {
      h += '<div class="psec"><h3>Clasificación de resultados</h3>';
      clasif.forEach((s) => { h += `<div class="pitem"><b>${escapeHtml(s.escalaId)}</b> — ${escapeHtml(s.texto)}</div>`; });
      h += '</div>';
    }
    ORDEN_EJES.forEach((k) => {
      const rv = rec[k];
      if (!rv) return;
      h += `<div class="psec"><h3>${ICONOS[k] || ''} ${escapeHtml(rv.t)}</h3><ul>`;
      (rv.l || []).forEach((x) => { h += `<li>${escapeHtml(x)}</li>`; });
      h += `</ul><div class="psrc">Fuente: ${escapeHtml(rv.f || '')}</div></div>`;
    });
    h += validacionBox(fecha);
    cont.innerHTML = h;
    const chk = cont.querySelector('#pl-validar-chk');
    if (chk) chk.addEventListener('change', (e) => { if (e.target.checked) validarPlan(fecha); });
  }

  function validacionBox(fecha) {
    return `<div class="valbox">
      <label><input type="checkbox" id="pl-validar-chk">
        He revisado y <b>valido esta hoja de ruta</b> (plan de recomendaciones y medidas) para la fecha ${fmtFechaES(fecha)}.
        Ninguna recomendación automática tiene efecto sin esta validación.
      </label>
      <div class="stamp" id="pl-validar-stamp">Sin validar todavía. La exportación del plan requiere esta validación (pestaña Documentos).</div>
    </div>`;
  }

  async function validarPlan(fecha) {
    try {
      const sello = await Api.validarPlan(APP.patient.id, fecha);
      const stamp = $('pl-validar-stamp');
      if (stamp) stamp.textContent = 'Validado el ' + fmtFechaES(fecha) + (sello && sello.validatedAt ? ' — ' + new Date(sello.validatedAt).toLocaleString('es-ES') : '') + '.';
      mostrarEstado('pl-status', 'Hoja de ruta validada. Ya puedes exportar el plan desde Documentos.', 'ok');
    } catch (e) {
      const chk = $('pl-validar-chk'); if (chk) chk.checked = false;
      mostrarEstado('pl-status', e.mensaje, 'err');
    }
  }

  return { build };
})();
