# VGI+ — Valoración Geriátrica Integral

Aplicación de uso interno para registrar, interpretar y hacer seguimiento
de las escalas de la Valoración Geriátrica Integral (VGI), pensada para
usarse a pie de cama y en consulta externa. **Todo funciona dentro de la
red del centro: ningún dato de paciente sale del ordenador servidor ni de
la red local.**

> Herramienta de apoyo clínico. No sustituye el juicio clínico del
> profesional responsable, que toma y firma toda decisión asistencial.

## Qué hace

- Registra los datos del paciente (NHC, fecha de nacimiento, sexo,
  localización, peso y talla).
- Ofrece las escalas geriátricas agrupadas por dominio (morfofuncional,
  nutricional, comorbilidad, fragilidad, cognitivo), con el mismo aspecto
  que tienen en papel — incluidas las que llevan dibujos, como el
  MMSE/MEC y el MoCA.
- Calcula la puntuación y la interpretación de cada escala automáticamente.
- Genera un plan de recomendaciones (ejercicio, nutrición, caídas,
  cognición, anemia, vitamina D, glucemia, revisión de medicación) basado
  en guías clínicas, que **siempre debe revisar y validar un profesional**
  antes de poder descargarse — ninguna recomendación tiene efecto por sí
  sola.
- Guarda un histórico por paciente y dibuja una gráfica de evolución de
  cada variable.
- Genera informes en Word (.docx) y PDF descargables, eligiendo la fecha
  del registro que se quiere exportar. Además de la puntuación y la
  interpretación de cada escala, el informe detalla en qué ítems concretos
  falla el paciente (por ejemplo, qué actividades básicas del Barthel
  necesitan ayuda, o qué preguntas del Pfeiffer se fallaron).
- Al volver a pasar una escala ya registrada antes a un paciente (por
  ejemplo, en una visita de seguimiento), el formulario se precarga con
  los valores del último registro en vez de partir en blanco.
- Hace copia de seguridad automática, todos los días, en la carpeta
  `backups/` del propio ordenador.

## Cómo arrancar la aplicación (la primera vez)

Hace falta un ordenador que actúe de "servidor" (puede ser cualquier PC
del centro que se pueda dejar encendido y conectado a la red durante el
horario de uso) con [Node.js](https://nodejs.org) instalado (versión 18 o
más reciente). El resto de PCs de la red no necesitan instalar nada:
acceden con un navegador normal (Chrome, Edge, Firefox...).

1. Copia la carpeta del proyecto al ordenador que hará de servidor.
2. Abre una terminal dentro de esa carpeta y ejecuta:
   ```
   npm install
   ```
   (esto instala, una sola vez, las piezas que necesita el programa; hace
   falta conexión a internet solo este primer paso, nunca después).
3. Da de alta el primer usuario administrador:
   ```
   npm run seed:admin
   ```
   Te pedirá un nombre de usuario, tu nombre completo, si eres
   "admin" o "clinico", y una contraseña (mínimo 6 caracteres). Repite
   este paso una vez por cada profesional que vaya a usar la app —
   **son cuentas propias de la aplicación, no las del hospital**: cada
   persona elige su propio usuario y contraseña la primera vez que se le
   da de alta.
4. Arranca el servidor:
   ```
   npm start
   ```
   Verás el mensaje `Servidor escuchando en http://localhost:3000`. Deja
   esa ventana abierta mientras se esté usando la aplicación.

## Cómo se usa en el día a día

- **En el propio ordenador servidor**: abre un navegador y entra en
  `http://localhost:3000`.
- **Desde cualquier otro PC de la red del centro**: abre un navegador y
  entra en `http://` seguido de la dirección IP del ordenador servidor y
  `:3000` (por ejemplo `http://10.20.30.40:3000`). Pide esa dirección IP
  al departamento de informática si no la conoces — no cambia salvo que
  ellos la reasignen.
- Inicia sesión con tu usuario y contraseña.
- Pestaña **Paciente**: busca al paciente por NHC o date de alta uno
  nuevo. Registra peso y talla si corresponde.
- Pestaña **Escalas**: elige el dominio y la escala, rellénala igual que
  en papel y guarda.
- Pestaña **Plan**: añade los datos analíticos si los tienes, genera el
  plan, revísalo y marca la casilla de validación antes de poder
  descargarlo.
- Pestaña **Seguimiento**: elige una variable para ver su tabla y su
  gráfica de evolución en el tiempo.
- Pestaña **Documentos**: descarga el informe VGI o el plan de
  recomendaciones en Word o en PDF, eligiendo la fecha del registro que
  interese. Si tu usuario es administrador, además verás ahí una sección
  para descargar en CSV o Excel los datos de todos los pacientes,
  agregados y sin NHC ni nombre (solo el identificador interno).

Para cerrar sesión (por ejemplo, en un equipo compartido entre varios
profesionales), usa el botón "Salir" de la esquina superior derecha.

## Copias de seguridad

Se hace una copia automática, una vez al día, en la carpeta `backups/`
del ordenador servidor (se conservan los últimos 30 días). También puedes
forzar una copia manual en cualquier momento con:
```
npm run backup
```

## Apagar y volver a arrancar

Para apagar el servidor, cierra la ventana de la terminal donde se
ejecutó `npm start` (o pulsa Ctrl+C dentro de ella). Los datos quedan
guardados en la carpeta `data/` del proyecto — no se pierde nada. Para
volver a arrancarlo, repite el paso 4 (`npm start`); no hace falta
repetir `npm install` ni dar de alta usuarios otra vez.

## Estado actual / pendiente

- El inicio de sesión usa cuentas propias de la aplicación (no está
  conectado al Active Directory del hospital); si el departamento de
  informática lo facilita más adelante, se puede añadir esa integración
  sin rehacer el resto de la app.
- El 4AT (cribado de delirium) dispara, cuando la puntuación es ≥4, un
  eje de "Manejo del delirium" en el plan de recomendaciones, según NICE
  CG103.
- No hay todavía un cuadro de mando multi-paciente/planta (más allá del
  seguimiento por paciente, que sí está hecho) — pendiente de confirmar
  si hace falta.

## Para el departamento de informática

Si vais a instalar VGI+ en un ordenador del hospital para que lo use todo
el equipo por red local, `docs/REQUISITOS_SISTEMA.md` tiene todo lo que
necesitáis: requisitos de hardware/software, cómo dejarlo arrancado como
servicio, copias de seguridad, puertos de red y recomendaciones de
seguridad.

## Para quien mantenga el código

Ver `CLAUDE.md` y la carpeta `docs/` (documento maestro y contratos entre
las distintas partes de la aplicación). Pruebas automáticas con
`npm test`.
