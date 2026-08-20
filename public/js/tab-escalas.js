/**
 * public/js/tab-escalas.js — pestaña Escalas.
 *
 * El catálogo (dominios, escalas, ítems) viene de shared/scales.js cargado
 * en el navegador (VGIScales.catalogo()) — el frontend no hardcodea
 * escalas, tal como pide docs/API_CONTRACT.md. shared/scales.js no trae
 * funciones de render (solo datos + interpretar()); el renderizador de
 * cada ítem/tipo de escala se construye aquí, con el mismo aspecto que la
 * escala en papel (botones tipo .opt, imágenes con instrucciones para
 * MMSE/MoCA), inspirado en los patrones de
 * docs/VGI_prototipo_generico_referencia.html (no es el mismo código).
 *
 * La puntuación que se ve mientras se rellena (VGIScales.interpretar) es
 * solo una vista previa inmediata: el valor autoritativo que queda
 * guardado lo recalcula siempre el servidor al hacer POST /records.
 */
const TabEscalas = (() => {
  let domActual = null;
  let escActual = null;
  let valores = {};       // {[itemId]: valorNumerico, ...} o {valor: numero} para escalas de entrada numérica
  let escolaridadBajaMoca = false;

  function build() {
    const root = $('pg-escalas');
    root.innerHTML = '';
    if (!App.requierePaciente(root)) return;

    const cat = VGIScales.catalogo();
    const c = el('div', 'card');
    c.innerHTML = `<div class="card-h">Seleccionar escala</div><div class="card-b">
      <div class="grid3">
        <div class="fg"><label>Dominio</label><select id="esc-dom"></select></div>
        <div class="fg"><label>Escala</label><select id="esc-esc"></select></div>
        <div class="fg"><label>Fecha de la valoración</label><input type="date" id="esc-fecha" value="${APP.fechaTrabajo}"></div>
      </div>
    </div>`;
    root.appendChild(c);

    const formBox = el('div', '', '');
    formBox.id = 'esc-form-box';
    root.appendChild(formBox);

    const domSel = c.querySelector('#esc-dom');
    cat.forEach((d) => {
      if (!d.escalas.length) return;
      const opt = el('option'); opt.value = d.id; opt.textContent = d.nombre;
      domSel.appendChild(opt);
    });
    domSel.value = domActual || cat.find((d) => d.escalas.length).id;
    domActual = domSel.value;

    const escSel = c.querySelector('#esc-esc');
    function pintarEscalasDelDominio() {
      escSel.innerHTML = '';
      const dom = cat.find((d) => d.id === domSel.value);
      dom.escalas.forEach((e) => {
        const opt = el('option'); opt.value = e.id; opt.textContent = e.nombre + (e.sub ? ' · ' + e.sub : '');
        escSel.appendChild(opt);
      });
      escActual = escSel.value;
      renderFormulario();
    }
    domSel.addEventListener('change', () => { domActual = domSel.value; pintarEscalasDelDominio(); });
    escSel.addEventListener('change', () => { escActual = escSel.value; renderFormulario(); });
    c.querySelector('#esc-fecha').addEventListener('change', renderFormulario);
    pintarEscalasDelDominio();
  }

  // A igualdad de fecha, gana el creado más tarde — mismo criterio que
  // server/lib/vigente.js:masRecienteHasta(), reimplementado aquí porque
  // ese archivo es solo de servidor (usa require de Node).
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

  async function renderFormulario() {
    const box = $('esc-form-box');
    if (!box || !escActual) return;
    const esc = VGIScales.ESCALAS[escActual];
    const fecha = $('esc-fecha') ? $('esc-fecha').value : APP.fechaTrabajo;
    valores = {};
    escolaridadBajaMoca = false;
    box.innerHTML = '<div class="empty">Cargando…</div>';

    // Recupera el último registro de esta escala hasta la fecha elegida
    // (misma regla que "vigente a fecha" del plan) para partir de esos
    // valores en vez de un formulario en blanco: al hacer seguimiento de
    // un paciente ya valorado antes, se ve lo que se contestó la vez
    // anterior y solo hay que corregir lo que haya cambiado.
    let previo = null;
    try {
      const regs = await Api.listarRecords(APP.patient.id, { escalaId: escActual });
      previo = masRecienteHasta(regs || [], fecha);
    } catch (e) {
      previo = null; // si falla la carga, se sigue con el formulario en blanco
    }
    // Si mientras se cargaba el usuario cambió de escala, de paciente, o
    // navegó a otra pestaña, no pintar sobre un formulario que ya no
    // corresponde a lo que se ve en pantalla.
    if ($('esc-form-box') !== box || escActual !== escSelActual()) return;
    if (previo) {
      valores = Object.assign({}, previo.valores);
      escolaridadBajaMoca = !!valores.escolaridadBaja;
    }

    box.innerHTML = '';
    const card = el('div', 'card');
    card.innerHTML = `<div class="card-h">${escapeHtml(esc.nombre)}<span class="b">${escapeHtml(esc.sub || '')}</span></div><div class="card-b" id="esc-cuerpo"></div>`;
    box.appendChild(card);
    const cuerpo = card.querySelector('#esc-cuerpo');

    if (previo) {
      cuerpo.appendChild(el('div', 'leg', 'Cargados los valores del registro de ' + fmtFechaES(previo.fecha) + (previo.fecha === fecha ? ' (mismo día — al guardar se sustituye este registro).' : ' — revísalos y corrige lo que haya cambiado.')));
    }

    if (esc.entrada) {
      cuerpo.appendChild(renderEntradaNumerica(esc));
    } else if (esc.items) {
      esc.items.forEach((it) => cuerpo.appendChild(renderItem(it)));
      if (esc.id === 'moca') cuerpo.appendChild(renderEscolaridadMoca());
    }

    if (esc.nota) cuerpo.appendChild(el('div', 'leg', escapeHtml(esc.nota)));
    if (esc.referencia) cuerpo.appendChild(el('div', 'leg', 'Fuente: ' + escapeHtml(esc.referencia.texto)));

    const res = el('div', clsRes('neutro'), 'Sin valorar');
    res.id = 'esc-resultado';
    cuerpo.appendChild(res);

    const btnRow = el('div', 'btn-row');
    const btnGuardar = el('button', 'btn btn-p', 'Guardar registro');
    btnGuardar.addEventListener('click', guardarRegistro);
    btnRow.appendChild(btnGuardar);
    cuerpo.appendChild(btnRow);
    cuerpo.appendChild(el('div', 'status', ''));
    cuerpo.lastChild.id = 'esc-status';

    actualizarPreview();
  }

  function escSelActual() {
    const sel = $('esc-esc');
    return sel ? sel.value : escActual;
  }

  function renderEntradaNumerica(esc) {
    const ent = esc.entrada;
    const row = el('div', 'itm');
    row.appendChild(el('div', 'itm-q', `${escapeHtml(ent.etiqueta)}${ent.unidad ? ' (' + escapeHtml(ent.unidad) + ')' : ''}` + (ent.ayuda ? ` <small>· ${escapeHtml(ent.ayuda)}</small>` : '')));
    const inp = el('input'); inp.type = 'number';
    if (ent.min != null) inp.min = ent.min;
    if (ent.max != null) inp.max = ent.max;
    if (ent.paso != null) inp.step = ent.paso;
    if (valores.valor != null) inp.value = valores.valor;
    inp.addEventListener('input', () => { valores.valor = inp.value === '' ? null : parseFloat(inp.value); actualizarPreview(); });
    row.appendChild(inp);
    return row;
  }

  // Ítem estándar {id, pregunta, ayuda, opciones:[{etiqueta,valor}]} —
  // cubre TODOS los tipos de escala salvo las de entrada numérica (tug,
  // gait, grip, frailvig), porque en shared/scales.js todas ellas ya
  // llegan con la misma forma items[].opciones[] (incluidas reloj y cfs,
  // que tienen un único ítem "valor").
  function renderItem(it) {
    if (it.tipo === 'imagen') return renderItemImagen(it);
    const row = el('div', 'itm');
    row.appendChild(el('div', 'itm-q', escapeHtml(it.pregunta) + (it.ayuda ? ` <small>· ${escapeHtml(it.ayuda)}</small>` : '')));
    const opts = el('div', 'opts');
    it.opciones.forEach((op) => {
      // Si la etiqueta ya ES el número (p. ej. los "stepper" 0..max de
      // MMSE/MoCA/SPPB generados con opcionesRango()), no dupliques el
      // valor al lado; solo se muestra aparte cuando aporta información
      // distinta de la etiqueta (p. ej. "Independiente" + 10).
      const badge = String(op.etiqueta).trim() === String(op.valor) ? '' : `<span class="v">${op.valor}</span>`;
      const btn = el('div', 'opt', `${escapeHtml(op.etiqueta)}${badge}`);
      if (valores[it.id] === op.valor) btn.classList.add('sel');
      btn.addEventListener('click', () => {
        valores[it.id] = op.valor;
        opts.querySelectorAll('.opt').forEach((x) => x.classList.remove('sel'));
        btn.classList.add('sel');
        actualizarPreview();
      });
      opts.appendChild(btn);
    });
    row.appendChild(opts);
    return row;
  }

  function renderItemImagen(it) {
    const box = el('div', 'imgitem');
    box.appendChild(el('div', 'itm-q', escapeHtml(it.pregunta)));
    const img = el('img'); img.src = it.src; img.alt = it.pregunta;
    box.appendChild(img);
    if (it.instrucciones) box.appendChild(el('div', 'instr', escapeHtml(it.instrucciones)));
    return box;
  }

  // El MoCA suma +1 si escolaridad ≤12 años (docs/API_CONTRACT.md): no es
  // un ítem puntuable más, así que se pide aparte, igual que Pfeiffer ya
  // trae su propio ítem de escolaridad autocontenido dentro de items[].
  function renderEscolaridadMoca() {
    const row = el('div', 'itm');
    row.appendChild(el('div', 'itm-q', 'Escolaridad ≤ 12 años <small>· ajusta +1 punto (máx. 30)</small>'));
    const opts = el('div', 'opts');
    [['No', false], ['Sí', true]].forEach(([lab, v]) => {
      const btn = el('div', 'opt', lab);
      if (v === escolaridadBajaMoca) btn.classList.add('sel');
      btn.addEventListener('click', () => {
        escolaridadBajaMoca = v;
        opts.querySelectorAll('.opt').forEach((x) => x.classList.remove('sel'));
        btn.classList.add('sel');
        actualizarPreview();
      });
      opts.appendChild(btn);
    });
    row.appendChild(opts);
    return row;
  }

  function contexto() {
    const fecha = $('esc-fecha') ? $('esc-fecha').value : APP.fechaTrabajo;
    return {
      sexo: APP.patient ? APP.patient.sexo : undefined,
      edadAnios: APP.patient ? calcEdad(APP.patient.fechaNacimiento, fecha) : undefined
    };
  }

  function actualizarPreview() {
    const res = $('esc-resultado');
    if (!res || !escActual) return;
    const v = Object.assign({}, valores);
    if (escActual === 'moca') v.escolaridadBaja = escolaridadBajaMoca;
    let r;
    try {
      r = VGIScales.interpretar(escActual, v, contexto());
    } catch (e) {
      r = { texto: 'No se puede calcular todavía: ' + e.message, cls: 'neutro' };
    }
    res.className = clsRes(r.cls);
    res.textContent = (r.texto || r.label || 'Sin valorar') + ' (vista previa)';
  }

  async function guardarRegistro() {
    const fecha = $('esc-fecha').value || APP.fechaTrabajo;
    const v = Object.assign({}, valores);
    if (escActual === 'moca') v.escolaridadBaja = escolaridadBajaMoca;
    try {
      const record = await Api.guardarRecord(APP.patient.id, { escalaId: escActual, fecha, valores: v });
      mostrarEstado('esc-status', 'Registro guardado — ' + (record.resultado ? record.resultado.texto : 'ok') + '.', 'ok');
    } catch (e) {
      mostrarEstado('esc-status', e.mensaje, 'err');
    }
  }

  return { build };
})();
