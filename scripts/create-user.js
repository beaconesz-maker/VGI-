#!/usr/bin/env node
/**
 * scripts/create-user.js — alta de un usuario clínico local (VGI+).
 *
 * Sin auto-registro (regla no negociable del documento maestro): un
 * administrador local ejecuta `node scripts/create-user.js` (o
 * `npm run seed:admin`) en el propio servidor del hospital, responde a las
 * preguntas por consola y el usuario queda añadido a `data/users.json`
 * con la contraseña ya hasheada (bcrypt, nunca en texto plano).
 */
'use strict';

const readline = require('readline');
const bcrypt = require('bcryptjs');
const store = require('../server/store');

function ask(rl, pregunta) {
  return new Promise((resolve) => rl.question(pregunta, resolve));
}

/**
 * Pregunta ocultando lo que se teclea (para la contraseña): truco estándar
 * de Node -- se sustituye "_writeToOutput" para no volcar los caracteres
 * reales mientras "rl.stdoutMuted" esté activo (readline no ofrece un modo
 * "password" nativo). Si la entrada no es una terminal interactiva (por
 * ejemplo al pasar el script por un pipe en pruebas), se deja sin ocultar.
 */
function askHidden(rl, pregunta) {
  return new Promise((resolve) => {
    const interactivo = process.stdin.isTTY;
    const originalWrite = rl._writeToOutput;
    if (interactivo) {
      rl._writeToOutput = function (stringToWrite) {
        rl.output.write(rl.stdoutMuted ? '' : stringToWrite);
      };
    }
    rl.stdoutMuted = false;
    process.stdout.write(pregunta);
    rl.stdoutMuted = true;
    rl.question('', (respuesta) => {
      rl._writeToOutput = originalWrite;
      rl.stdoutMuted = false;
      if (interactivo) rl.output.write('\n');
      resolve(respuesta);
    });
  });
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('=== VGI+ -- alta de usuario local ===');
  console.log('(Hospital San Juan Grande -- cuentas propias de la app, no del Active Directory)\n');

  try {
    let username = '';
    while (!username) {
      username = (await ask(rl, 'Usuario (codigo de acceso): ')).trim();
      if (!username) console.log('El usuario no puede estar vacio.');
    }

    const existentes = await store.users.list();
    if (existentes.some((u) => u.username === username)) {
      console.log(`Ya existe un usuario con el nombre "${username}". Abortando.`);
      rl.close();
      process.exit(1);
    }

    let nombre = '';
    while (!nombre) {
      nombre = (await ask(rl, 'Nombre completo: ')).trim();
      if (!nombre) console.log('El nombre no puede estar vacio.');
    }

    let rol = '';
    while (rol !== 'clinico' && rol !== 'admin') {
      rol = (await ask(rl, 'Rol (clinico / admin) [clinico]: ')).trim().toLowerCase() || 'clinico';
      if (rol !== 'clinico' && rol !== 'admin') console.log('Responda "clinico" o "admin".');
    }

    let password = '';
    while (password.length < 6) {
      password = await askHidden(rl, 'Contrasena (minimo 6 caracteres): ');
      if (password.length < 6) console.log('La contrasena debe tener al menos 6 caracteres.');
    }
    const password2 = await askHidden(rl, 'Repita la contrasena: ');
    if (password !== password2) {
      console.log('Las contrasenas no coinciden. Abortando.');
      rl.close();
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await store.users.create({
      username,
      passwordHash,
      nombre,
      rol,
      activo: true,
      createdAt: new Date().toISOString(),
    });

    console.log(`\nUsuario creado: ${user.username} (${user.rol}) -- id ${user.id}`);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('Error al crear el usuario:', err.message);
  process.exit(1);
});
