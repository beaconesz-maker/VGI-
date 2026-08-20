/**
 * public/js/api.js — capa de acceso a la API descrita en
 * docs/API_CONTRACT.md. Todo pasa por aquí: ninguna otra parte del
 * frontend construye una URL /api/... a mano.
 *
 * Errores: la API responde {error:"codigo", mensaje:"texto en español"}.
 * apiFetch() los propaga como Error con .codigo y .mensaje para que cada
 * pantalla pueda mostrar el mensaje tal cual en la UI.
 */
const Api = (() => {
  async function apiFetch(path, opts) {
    opts = opts || {};
    const headers = Object.assign({}, opts.headers || {});
    let body = opts.body;
    if (body !== undefined && !(body instanceof Blob)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch('/api' + path, {
        method: opts.method || 'GET',
        credentials: 'same-origin',
        headers,
        body
      });
    } catch (e) {
      const err = new Error('No se ha podido contactar con el servidor. Comprueba la conexión de red local.');
      err.codigo = 'sin_conexion';
      err.mensaje = err.message;
      throw err;
    }
    if (res.status === 204) return null;
    let data = null;
    try { data = await res.json(); } catch (e) { /* respuesta sin cuerpo JSON */ }
    if (!res.ok) {
      const mensaje = (data && data.mensaje) || 'Error del servidor (' + res.status + ').';
      // Sesión caducada a media consulta (no en el propio login/me): recarga
      // para volver a mostrar la pantalla de acceso en vez de dejar la app
      // en un estado a medias.
      if (res.status === 401 && path !== '/auth/login' && path !== '/auth/me' && typeof APP !== 'undefined' && APP.user) {
        setTimeout(() => location.reload(), 50);
      }
      const err = new Error(mensaje);
      err.codigo = data && data.error;
      err.mensaje = mensaje;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  return {
    // Auth
    login: (username, password) => apiFetch('/auth/login', { method: 'POST', body: { username, password } }),
    logout: () => apiFetch('/auth/logout', { method: 'POST' }),
    me: () => apiFetch('/auth/me'),

    // Pacientes
    buscarPacientes: (q) => apiFetch('/patients?q=' + encodeURIComponent(q || '')),
    crearPaciente: (datos) => apiFetch('/patients', { method: 'POST', body: datos }),
    obtenerPaciente: (id) => apiFetch('/patients/' + id),
    actualizarPaciente: (id, datos) => apiFetch('/patients/' + id, { method: 'PUT', body: datos }),

    // Morfofuncional
    guardarMorfo: (patientId, datos) => apiFetch(`/patients/${patientId}/morfo`, { method: 'POST', body: datos }),
    listarMorfo: (patientId, params) => apiFetch(`/patients/${patientId}/morfo` + qs(params)),

    // Registros de escalas
    listarRecords: (patientId, params) => apiFetch(`/patients/${patientId}/records` + qs(params)),
    guardarRecord: (patientId, datos) => apiFetch(`/patients/${patientId}/records`, { method: 'POST', body: datos }),
    borrarRecord: (patientId, recordId) => apiFetch(`/patients/${patientId}/records/${recordId}`, { method: 'DELETE' }),

    // Clínico / analítico
    guardarClinical: (patientId, datos) => apiFetch(`/patients/${patientId}/clinical`, { method: 'POST', body: datos }),
    obtenerClinical: (patientId, fecha) => apiFetch(`/patients/${patientId}/clinical` + qs({ fecha })),

    // Plan
    obtenerPlan: (patientId, fecha) => apiFetch(`/patients/${patientId}/plan` + qs({ fecha })),
    validarPlan: (patientId, fecha) => apiFetch(`/patients/${patientId}/plan/validate`, { method: 'POST', body: { fecha } }),

    // Exportación (descarga de fichero, no JSON — ver tab-documentos.js)
    urlInforme: (patientId, fecha, formato) => `/api/patients/${patientId}/export/informe.${formato || 'docx'}` + qs({ fecha }),
    urlPlanDoc: (patientId, fecha, formato) => `/api/patients/${patientId}/export/plan.${formato || 'docx'}` + qs({ fecha }),

    // Exportación agregada anonimizada (solo admin)
    urlAgregadoCsv: () => '/api/export/aggregate.csv',
    urlAgregadoXlsx: () => '/api/export/aggregate.xlsx'
  };

  function qs(params) {
    if (!params) return '';
    const parts = Object.keys(params)
      .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
      .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    return parts.length ? '?' + parts.join('&') : '';
  }
})();
