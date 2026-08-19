/**
 * public/js/auth.js — pantalla de acceso (usuario/contraseña) y sesión.
 */
const Auth = (() => {
  function render() {
    const form = $('login-form');
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const username = $('login-user').value.trim();
      const password = $('login-pass').value;
      const errBox = $('login-err');
      errBox.classList.remove('on');
      if (!username || !password) return;
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const data = await Api.login(username, password);
        APP.user = data.user;
        entrarEnApp();
      } catch (e) {
        errBox.textContent = e.mensaje || 'Usuario o contraseña incorrectos.';
        errBox.classList.add('on');
      } finally {
        btn.disabled = false;
      }
    });
  }

  async function comprobarSesion() {
    try {
      const data = await Api.me();
      APP.user = data.user;
      return true;
    } catch (e) {
      return false;
    }
  }

  function entrarEnApp() {
    $('gate').style.display = 'none';
    $('appwrap').style.display = 'block';
    $('hdr-user').textContent = APP.user ? (APP.user.nombre || APP.user.username) : '';
    App.iniciar();
  }

  async function salir() {
    try { await Api.logout(); } catch (e) { /* ignorar */ }
    APP.user = null;
    APP.patient = null;
    location.reload();
  }

  return { render, comprobarSesion, entrarEnApp, salir };
})();
