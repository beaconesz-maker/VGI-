/**
 * public/js/tab-paciente.js — pestaña Paciente: buscar/crear paciente por
 * NHC, datos básicos, y apartado Morfofuncional (peso/talla).
 */
const TabPaciente = (() => {
  let resultados = [];
  let editando = null; // paciente que se está editando (o null si es alta nueva)

  function build() {
    const root = $('pg-paciente');
    root.innerHTML = '';

    root.appendChild(buscarCard());
    root.appendChild(datosCard());
    root.appendChild(morfoCard());
  }

  /* ── Buscar paciente ────────────────────────────────────────────── */
  function buscarCard() {
    const c = el('div', 'card');
    c.innerHTML = `<div class="card-h">Buscar paciente</div><div class="card-b">
      <div class="fg"><label>NHC o nombre</label>
        <div style="display:flex;gap:.5rem">
          <input type="text" id="buscar-q" placeholder="Número de historia o apellidos">
          <button class="btn btn-p" id="buscar-btn" style="flex-shrink:0">Buscar</button>
        </div>
      </div>
      <div id="buscar-resultados" class="pat-list"></div>
      <div id="buscar-status" class="status"></div>
    </div>`;
    c.querySelector('#buscar-btn').addEventListener('click', buscar);
    c.querySelector('#buscar-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });
    return c;
  }

  async function buscar() {
    const q = $('buscar-q').value.trim();
    limpiarEstado('buscar-status');
    try {
      resultados = await Api.buscarPacientes(q);
      pintarResultados();
    } catch (e) {
      mostrarEstado('buscar-status', e.mensaje, 'err');
    }
  }

  function pintarResultados() {
    const box = $('buscar-resultados');
    if (!resultados.length) { box.innerHTML = '<div class="empty">Sin resultados. Puedes dar de alta un paciente nuevo abajo.</div>'; return; }
    box.innerHTML = '';
    resultados.forEach((p) => {
      const row = el('div', 'pat-row');
      row.innerHTML = `<div class="nm">${escapeHtml(p.nombre)}</div><div class="meta">NHC ${escapeHtml(p.nhc)} · ${escapeHtml(p.localizacion || '')}</div>`;
      row.addEventListener('click', () => seleccionar(p));
      box.appendChild(row);
    });
  }

  function seleccionar(p) {
    editando = p;
    App.setPacienteActivo(p);
    build();
    mostrarEstado('buscar-status', 'Paciente seleccionado: ' + p.nombre, 'ok');
  }

  /* ── Datos del paciente (alta o edición) ──────────────────────────── */
  function datosCard() {
    const p = editando || APP.patient || {};
    const c = el('div', 'card');
    c.innerHTML = `<div class="card-h">Datos del paciente<span class="b">${editando ? 'editando' : 'alta nueva'}</span></div>
    <div class="card-b">
      <div class="grid2">
        <div class="fg"><label>NHC</label><input type="text" id="pac-nhc" value="${escapeHtml(p.nhc || '')}"></div>
        <div class="fg"><label>Nombre completo</label><input type="text" id="pac-nombre" value="${escapeHtml(p.nombre || '')}" placeholder="Apellidos, Nombre"></div>
        <div class="fg"><label>Fecha de nacimiento</label><input type="date" id="pac-fnac" value="${p.fechaNacimiento || ''}"></div>
        <div class="fg"><label>Sexo</label><div class="seg" id="pac-sexo">
          <button type="button" data-v="H" class="${p.sexo === 'H' ? 'on' : ''}">Hombre</button>
          <button type="button" data-v="M" class="${p.sexo === 'M' ? 'on' : ''}">Mujer</button>
        </div></div>
        <div class="fg"><label>Localización</label><select id="pac-loc">
          <option value="U3" ${p.localizacion === 'U3' ? 'selected' : ''}>U3</option>
          <option value="U4" ${p.localizacion === 'U4' ? 'selected' : ''}>U4</option>
          <option value="U8" ${p.localizacion === 'U8' ? 'selected' : ''}>U8</option>
        </select></div>
        <div class="fg"><label>Fecha de registro</label><input type="date" id="pac-fecha" value="${APP.fechaTrabajo}"></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-p" id="pac-guardar">${editando ? 'Guardar cambios' : 'Dar de alta'}</button>
        <button type="button" class="btn btn-g" id="pac-nuevo">＋ Paciente nuevo</button>
      </div>
      ${editando ? '<div class="help">Estás editando a ' + escapeHtml(p.nombre || p.nhc || '') + '. Pulsa "＋ Paciente nuevo" antes de escribir los datos de otro paciente, o "Guardar cambios" sobrescribirá los suyos.</div>' : ''}
      <div id="pac-status" class="status"></div>
    </div>`;

    c.querySelector('#pac-sexo').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      c.querySelectorAll('#pac-sexo button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    });
    c.querySelector('#pac-fecha').addEventListener('change', (e) => { APP.fechaTrabajo = e.target.value; });
    c.querySelector('#pac-guardar').addEventListener('click', guardarPaciente);
    c.querySelector('#pac-nuevo').addEventListener('click', () => {
      editando = null;
      resultados = [];
      App.setPacienteActivo(null);
      build();
    });
    return c;
  }

  async function guardarPaciente() {
    const sexoBtn = document.querySelector('#pac-sexo button.on');
    const datos = {
      nhc: $('pac-nhc').value.trim(),
      nombre: $('pac-nombre').value.trim(),
      fechaNacimiento: $('pac-fnac').value,
      sexo: sexoBtn ? sexoBtn.dataset.v : undefined,
      localizacion: $('pac-loc').value
    };
    if (!datos.nhc || !datos.nombre || !datos.fechaNacimiento) {
      mostrarEstado('pac-status', 'NHC, nombre y fecha de nacimiento son obligatorios.', 'err');
      return;
    }
    try {
      let p;
      if (editando && editando.id) {
        p = await Api.actualizarPaciente(editando.id, datos);
        mostrarEstado('pac-status', 'Datos del paciente actualizados.', 'ok');
      } else {
        p = await Api.crearPaciente(datos);
        mostrarEstado('pac-status', 'Paciente dado de alta correctamente.', 'ok');
      }
      editando = p;
      App.setPacienteActivo(p);
      build();
    } catch (e) {
      mostrarEstado('pac-status', e.mensaje, 'err');
    }
  }

  /* ── Morfofuncional (peso / talla) ────────────────────────────────── */
  function morfoCard() {
    const c = el('div', 'card');
    if (!APP.patient) {
      c.innerHTML = '<div class="card-h">Morfofuncional</div><div class="card-b"><div class="empty">Selecciona o da de alta un paciente para registrar peso y talla.</div></div>';
      return c;
    }
    c.innerHTML = `<div class="card-h">Morfofuncional</div><div class="card-b">
      <div class="grid3">
        <div class="fg"><label>Fecha</label><input type="date" id="mo-fecha" value="${APP.fechaTrabajo}"></div>
        <div class="fg"><label>Peso (kg)</label><input type="number" id="mo-peso" step="0.1" min="0"></div>
        <div class="fg"><label>Talla (cm)</label><input type="number" id="mo-talla" step="0.1" min="0"></div>
      </div>
      <div class="help" id="mo-imc"></div>
      <div class="btn-row"><button class="btn btn-p" id="mo-guardar">Guardar peso y talla</button></div>
      <div id="mo-status" class="status"></div>
    </div>`;
    const calcImc = () => {
      const peso = parseFloat($('mo-peso').value), talla = parseFloat($('mo-talla').value);
      const box = $('mo-imc');
      if (peso > 0 && talla > 0) {
        const imc = peso / Math.pow(talla / 100, 2);
        box.textContent = 'IMC: ' + imc.toFixed(1) + ' kg/m²';
      } else box.textContent = '';
    };
    c.querySelector('#mo-peso').addEventListener('input', calcImc);
    c.querySelector('#mo-talla').addEventListener('input', calcImc);
    c.querySelector('#mo-guardar').addEventListener('click', guardarMorfo);
    return c;
  }

  async function guardarMorfo() {
    const fecha = $('mo-fecha').value || APP.fechaTrabajo;
    const peso = $('mo-peso').value === '' ? null : parseFloat($('mo-peso').value);
    const talla = $('mo-talla').value === '' ? null : parseFloat($('mo-talla').value);
    try {
      await Api.guardarMorfo(APP.patient.id, { fecha, peso, talla });
      mostrarEstado('mo-status', 'Peso y talla guardados para el ' + fmtFechaES(fecha) + '.', 'ok');
    } catch (e) {
      mostrarEstado('mo-status', e.mensaje, 'err');
    }
  }

  return { build };
})();
