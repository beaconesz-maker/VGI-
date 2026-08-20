/**
 * public/js/app.js — arranque de la aplicación: estado global, cabecera,
 * pestañas y barra de "paciente activo". Cada pestaña tiene su propio
 * módulo (tab-*.js) con una función build() que este archivo invoca.
 */

// Estado global de la sesión de trabajo en el navegador. No es la fuente
// de verdad (esa es el servidor / data/*.json) — solo lo que la interfaz
// necesita recordar mientras el clínico va de pestaña en pestaña.
const APP = {
  user: null,
  patient: null,       // paciente activo, tal cual lo devuelve la API
  fechaTrabajo: hoyISO() // fecha por defecto para nuevos registros (regla de negocio 1)
};

// Logo oficial del Hospital San Juan Grande (San Juan de Dios), facilitado
// por Bea. Archivo en public/assets/marca/logo-san-juan-grande.png (el
// icono recortado del lockup completo, que también se guarda aparte por
// si se necesita en algún documento a tamaño completo).
const LOGO_HTML = `<img src="/assets/marca/logo-san-juan-grande.png" alt="Hospital San Juan Grande · San Juan de Dios">`;

const App = {
  async init() {
    $('gate-logo').innerHTML = LOGO_HTML;
    Auth.render();
    const yaAutenticado = await Auth.comprobarSesion();
    if (yaAutenticado) Auth.entrarEnApp();
  },

  // Se llama una vez, justo después de iniciar sesión.
  iniciar() {
    $('hdr-logo').innerHTML = LOGO_HTML;
    $('btn-logout').addEventListener('click', Auth.salir);
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => this.mostrarPestana(tab.dataset.tab));
    });
    this.pintarBarraPaciente();
    this.mostrarPestana('paciente');
  },

  mostrarPestana(id) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === id));
    document.querySelectorAll('.page').forEach((p) => p.classList.toggle('on', p.id === 'pg-' + id));
    const builders = {
      paciente: TabPaciente.build,
      escalas: TabEscalas.build,
      plan: TabPlan.build,
      seguimiento: TabSeguimiento.build,
      documentos: TabDocumentos.build
    };
    if (builders[id]) builders[id]();
  },

  // Se llama cada vez que cambia el paciente activo (selección, alta o edición).
  setPacienteActivo(patient) {
    APP.patient = patient;
    this.pintarBarraPaciente();
  },

  pintarBarraPaciente() {
    const bar = $('patbar');
    if (!APP.patient) { bar.classList.remove('on'); bar.innerHTML = ''; return; }
    const p = APP.patient;
    const edad = calcEdad(p.fechaNacimiento, hoyISO());
    bar.classList.add('on');
    bar.innerHTML = `<b>${escapeHtml(p.nombre || '(sin nombre)')}</b>` +
      `<span class="sep">·</span>NHC ${escapeHtml(p.nhc || '—')}` +
      `<span class="sep">·</span>${edad != null ? edad + ' años' : 'edad ?'}` +
      `<span class="sep">·</span>${p.sexo === 'M' ? 'Mujer' : p.sexo === 'H' ? 'Hombre' : 'sexo ?'}` +
      `<span class="sep">·</span>${escapeHtml(p.localizacion || '—')}`;
  },

  // Requiere paciente activo antes de dejar usar una pestaña; devuelve un
  // aviso pintado en el contenedor si no hay paciente seleccionado.
  requierePaciente(container) {
    if (APP.patient) return true;
    container.innerHTML = '<div class="empty">Selecciona o da de alta un paciente en la pestaña «Paciente» para continuar.</div>';
    return false;
  }
};

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

document.addEventListener('DOMContentLoaded', () => App.init());
