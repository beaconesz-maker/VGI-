/**
 * server/store/jsonStore.js — capa de acceso a datos JSON (VGI+).
 *
 * Un único proceso Express sirve a todos los PCs de la red local a la vez,
 * así que la concurrencia que hay que resolver es "varias peticiones HTTP
 * del mismo proceso Node leyendo/escribiendo el mismo archivo casi a la
 * vez", no "varios procesos compitiendo por el archivo" (eso lo evita el
 * propio diseño: un solo proceso Node como puente, regla no negociable del
 * documento maestro). La solución es una cola en memoria por archivo: cada
 * operación sobre un archivo se encadena a la promesa de la anterior, así
 * que nunca se solapan una lectura y una escritura ni dos escrituras del
 * mismo archivo.
 *
 * La escritura es atómica: se escribe primero a un archivo temporal
 * (mismo directorio, para que el rename sea atómico dentro del mismo
 * sistema de archivos) y se hace `fs.rename` sobre el archivo final. Así,
 * si el proceso muere a mitad de escritura, el archivo original queda
 * intacto (nunca un JSON a medio escribir).
 *
 * Esta capa es deliberadamente la única que toca `fs` para los datos de la
 * app — el día que se migre a SQLite, solo cambia la implementación interna
 * de `readCollection`/`writeCollection` (y de los métodos de
 * `collectionStore.js`), nunca las rutas de `server/routes/`.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Cola de escritura/lectura por archivo: Map<rutaAbsoluta, Promise>
const queues = new Map();

/**
 * Encadena `task` (una función que devuelve una promesa) a la cola del
 * archivo `filePath`, garantizando que se ejecuta después de que termine
 * (con éxito o error) la operación anterior sobre ese mismo archivo.
 */
function enqueue(filePath, task) {
  const prev = queues.get(filePath) || Promise.resolve();
  // encadenamos siempre sobre `prev`, ignorando si la anterior falló, para
  // que un error en una operación no bloquee las siguientes para siempre
  const next = prev.then(task, task);
  // guardamos una versión que no rechaza, para que la cola en sí nunca
  // quede "rota" (el rechazo real se propaga igualmente a quien llamó)
  queues.set(filePath, next.catch(() => {}));
  return next;
}

function readJsonFileSync(filePath, defaultValue) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return defaultValue;
    throw err;
  }
}

function writeJsonFileAtomicSync(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath); // atómico dentro del mismo filesystem
}

/**
 * Lee el archivo `filePath` (JSON) en cola, devolviendo `defaultValue` si
 * no existe todavía.
 */
function readJson(filePath, defaultValue) {
  return enqueue(filePath, () =>
    Promise.resolve(readJsonFileSync(filePath, defaultValue))
  );
}

/**
 * Escribe `data` en `filePath` en cola, de forma atómica.
 */
function writeJson(filePath, data) {
  return enqueue(filePath, () =>
    Promise.resolve(writeJsonFileAtomicSync(filePath, data))
  );
}

/**
 * Lee-modifica-escribe un archivo en una única entrada de la cola, para
 * que la operación sea atómica respecto a otras lecturas/escrituras
 * concurrentes del mismo archivo (evita que dos peticiones lean el mismo
 * estado "viejo" y una sobrescriba a la otra).
 */
function update(filePath, defaultValue, mutator) {
  return enqueue(filePath, () => {
    const current = readJsonFileSync(filePath, defaultValue);
    const result = mutator(current);
    // el mutator puede devolver {data, value} para separar lo que se
    // persiste de lo que se devuelve a quien llamó
    const toPersist = result && Object.prototype.hasOwnProperty.call(result, 'data')
      ? result.data
      : result;
    const toReturn = result && Object.prototype.hasOwnProperty.call(result, 'value')
      ? result.value
      : result;
    writeJsonFileAtomicSync(filePath, toPersist);
    return toReturn;
  });
}

module.exports = { readJson, writeJson, update };
