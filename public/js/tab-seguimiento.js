/**
 * public/js/tab-seguimiento.js — pestaña Seguimiento: tabla de resultados
 * (fecha + código de usuario + valor) por variable, y gráfica de puntos al
 * elegir la variable / clicar una fila. El SVG se dibuja a mano, sin
 * librerías, con el mismo patrón que chartSVG() de
 * docs/VGI_prototipo_generico_referencia.html (línea ~893).
 */
const TabSeguimiento = (() => {
  let variable = null; // escalaId elegido, p. ej. "barthel"
  let registros = [];

  function build() {
    const root = $('pg-seguimiento');
    root.innerHTML = '';
    if (!App.requierePaciente(root)) return;

    const c = el('div', 'card');
    let chipsHtml = '';
    VGIPlanEngine.TRACK.forEach(([id, lab]) => {
      chipsHtml += `<span class="chip${id === variable ? ' on' : ''}" data-v="${id}">${escapeHtml(lab)}</span>`;
    });
    c.innerHTML = `<div class="card-h">Seguimiento longitudinal<span class="b">elige una variable</span></div><div class="card-b">
      <div class="chips" id="seg-chips">${chipsHtml}</div>
      <div id="seg-cuerpo"></div>
    </div>`;
    root.appendChild(c);

    c.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => { variable = chip.dataset.v; cargarVariable(); });
    });

    if (variable) cargarVariable(); else $('seg-cuerpo').innerHTML = '<div class="empty">Elige arriba la variable que quieres seguir en el tiempo.</div>';
  }

  async function cargarVariable() {
    document.querySelectorAll('#seg-chips .chip').forEach((ch) => ch.classList.toggle('on', ch.dataset.v === variable));
    const cuerpo = $('seg-cuerpo');
    cuerpo.innerHTML = '<div class="empty">Cargando…</div>';
    try {
      registros = await Api.listarRecords(APP.patient.id, { escalaId: variable });
      registros = (registros || []).slice().sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0);
      pintarCuerpo(cuerpo);
    } catch (e) {
      cuerpo.innerHTML = '';
      mostrarEstado('seg-cuerpo', e.mensaje, 'err');
    }
  }

  function pintarCuerpo(cuerpo) {
    if (!registros.length) {
      cuerpo.innerHTML = '<div class="empty">Todavía no hay registros de esta escala para este paciente.</div>';
      return;
    }
    const lab = (VGIPlanEngine.TRACK.find((t) => t[0] === variable) || [variable, variable])[1];
    cuerpo.innerHTML = `<div class="chart-wrap" id="seg-chart"></div><hr class="dv"><div style="overflow-x:auto">${tablaHtml(lab)}</div>`;
    $('seg-chart').innerHTML = chartSVG(registros, lab);
    cuerpo.querySelectorAll('tr.snap-row').forEach((row) => {
      row.addEventListener('click', () => resaltarPunto(row.dataset.idx));
    });
  }

  function tablaHtml(lab) {
    let h = `<table class="snap"><tr><th>Fecha</th><th>Usuario</th><th>${escapeHtml(lab)}</th><th>Interpretación</th></tr>`;
    registros.forEach((r, i) => {
      const raw = r.resultado ? r.resultado.raw : null;
      h += `<tr class="snap-row" data-idx="${i}"><td>${fmtFechaES(r.fecha)}</td><td>${escapeHtml(r.userCodigo || '—')}</td><td>${raw == null ? '·' : raw}</td><td>${escapeHtml(r.resultado ? r.resultado.label : '')}</td></tr>`;
    });
    return h + '</table>';
  }

  function resaltarPunto(idx) {
    document.querySelectorAll('#seg-chart circle').forEach((c) => c.setAttribute('r', 5));
    const c = document.querySelector(`#seg-chart circle[data-idx="${idx}"]`);
    if (c) c.setAttribute('r', 8);
  }

  // Gráfica de puntos en SVG dibujada a mano (sin librerías), a partir de
  // los registros ya ordenados por fecha. Mismo patrón que chartSVG() del
  // prototipo de referencia.
  function chartSVG(regs, lab) {
    const pts = regs.map((r, i) => ({ i, fecha: r.fecha, v: r.resultado ? r.resultado.raw : null }))
      .filter((o) => o.v != null && !isNaN(+o.v));
    if (!pts.length) return '<div class="empty">Sin valores numéricos para representar en esta variable.</div>';
    const W = Math.max(380, regs.length * 90), H = 240, pad = 44;
    const vals = pts.map((o) => +o.v);
    let mn = Math.min(...vals), mx = Math.max(...vals);
    if (mn === mx) { mn -= 1; mx += 1; }
    const X = (i) => pad + (regs.length <= 1 ? (W - 2 * pad) / 2 : (i / (regs.length - 1)) * (W - 2 * pad));
    const Y = (v) => H - pad - ((v - mn) / (mx - mn)) * (H - 2 * pad);
    let g = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="sans-serif" style="min-width:${W}px">`;
    g += `<line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="#ccc"/><line x1="${pad}" y1="${pad}" x2="${pad}" y2="${H - pad}" stroke="#ccc"/>`;
    [0, 0.5, 1].forEach((t) => {
      const v = mn + t * (mx - mn), y = Y(v);
      g += `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="#eee"/><text x="4" y="${y + 4}" font-size="10" fill="#999">${+v.toFixed(1)}</text>`;
    });
    let d = '';
    pts.forEach((o, j) => { const x = X(o.i), y = Y(+o.v); d += (j ? 'L' : 'M') + x + ' ' + y + ' '; });
    g += `<path d="${d}" fill="none" stroke="#1C6FB0" stroke-width="2.5" stroke-linejoin="round"/>`;
    pts.forEach((o) => {
      const x = X(o.i), y = Y(+o.v);
      g += `<circle data-idx="${o.i}" cx="${x}" cy="${y}" r="5" fill="#1C6FB0"/><text x="${x}" y="${y - 9}" font-size="10" fill="#0B3D63" text-anchor="middle">${o.v}</text>`;
    });
    regs.forEach((r, i) => { g += `<text x="${X(i)}" y="${H - 8}" font-size="9" fill="#999" text-anchor="middle">${fmtFechaES(r.fecha)}</text>`; });
    g += '</svg>';
    return g;
  }

  return { build };
})();
