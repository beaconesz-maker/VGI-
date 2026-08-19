# VGI+ (Hospital San Juan Grande) — contexto para Claude

Lee esto entero antes de tocar código. El encargo completo, literal, está en
`docs/DOCUMENTO_MAESTRO.md` — esto de aquí es el resumen operativo y el
mapa del repositorio.

## Qué es esto

Una app de **Valoración Geriátrica Integral (VGI)** de uso interno para el
Hospital San Juan Grande (Jerez de la Frontera): registro de escalas
geriátricas a pie de cama y en consulta, interpretación automática,
generación de plan de recomendaciones basado en guías clínicas, seguimiento
longitudinal por paciente y exportación de informes.

Es la **versión específica de un hospital** (con su marca, su login local,
su servidor Node.js en red local). Existe otro proyecto de Bea,
`VGI_.html` (un solo archivo, sin servidor, sin marca institucional,
pensado para cualquier clínico en cualquier centro) que **no es este
repositorio** — su contenido clínico (escalas, cortes, plan de
recomendaciones) es la base de partida aquí, pero la arquitectura es
distinta. Copia de referencia en
`docs/VGI_prototipo_generico_referencia.html`.

## No negociable (repetir antes de cada decisión de arquitectura)

- Todo en local: nada de nube, ni para datos ni para login.
- Red local, varios PCs a la vez, escritura concurrente sobre los mismos
  datos.
- Almacenamiento en JSON, con una capa de acceso a datos que permita
  cambiar a SQLite sin tocar el resto de la app (nunca acceso directo a
  archivos JSON desde rutas/UI — todo pasa por `server/store/`).
- Servidor Node.js como único puente entre la app y los datos.
- Copia de seguridad automática diaria, local.
- Ninguna recomendación automática tiene efecto sin que un humano la
  valide explícitamente (mismo patrón que ya usaba el prototipo: casilla
  "he revisado y valido" con fecha/hora, obligatoria antes de exportar el
  plan).

## Mapa del repositorio (quién toca qué)

```
docs/               Documento maestro, contratos, referencias clínicas.
shared/             Motor clínico puro (JS sin DOM, sin Express): catálogo
                     de escalas, interpretación, generación del plan.
                     Se usa tanto desde server/ (Node, require) como desde
                     public/ (navegador, <script>). Contrato en
                     docs/SCALES_CONTRACT.md.
server/             Backend Express: auth, rutas API, capa de datos
                     (server/store/), backups, exportaciones. Contrato en
                     docs/API_CONTRACT.md.
public/             Frontend estático servido por Express: HTML/CSS/JS
                     vanilla (sin framework, sin build step). Consume la
                     API descrita en docs/API_CONTRACT.md y usa shared/
                     para pintar y validar escalas.
data/               Datos en tiempo de ejecución (JSON). No se versiona en
                     git salvo estructura de ejemplo (.gitkeep / seeds).
tests/              Pruebas: motor clínico (shared/), API (server/), y
                     smoke test end-to-end del frontend.
scripts/            Utilidades de operación: alta de usuarios, backup
                     manual, migración futura a SQLite.
```

Antes de editar, comprueba si el cambio es del motor clínico (`shared/`),
del servidor (`server/`) o de la interfaz (`public/`) y toca solo esa
capa. Si necesitas cambiar el contrato entre capas, actualiza el `.md`
correspondiente en `docs/` en el mismo commit.

## Convenciones

- Interfaz, textos, comentarios de código: en español.
- Sin frameworks de frontend (no React/Vue), sin bundler, sin dependencias
  de UI. Backend: Express + dependencias mínimas (bcrypt para contraseñas,
  poco más). Justifica cualquier dependencia nueva en el commit.
- Paleta: fondo blanco, texto azul oscuro, pestañas azules (logo de San
  Juan Grande). Sin scroll infinito ni menús anidados — prioridad a la
  velocidad de introducción de datos a pie de cama.
- Cada escala nueva en `shared/scales.js` debe traer su referencia
  bibliográfica verificable (idealmente PMID/DOI). Si no se puede
  verificar, no se incluye. Fuente de partida:
  `docs/ESCALAS_REFERENCIA.txt` y `docs/GUIAS_REFERENCIA.txt`.
- Commits pequeños y descriptivos, uno por funcionalidad terminada y
  probada (regla explícita de Bea). No regenerar módulos enteros sin que
  se pida.

## Cómo trabajar aquí

- Planifica antes de ejecutar; si una decisión tiene más de una opción
  razonable, pregunta antes de elegir (regla explícita de Bea).
- No hay build tools: cualquiera debe poder arrancar la app con
  `npm install && npm start` y ya. Documenta cualquier paso adicional en
  `README.md`, en lenguaje no técnico (Bea es geriatra, no programadora).
- Antes de dar por terminada una funcionalidad: ejecuta las pruebas de
  `tests/` relevantes y, si toca `shared/`, verifica los cortes de
  interpretación contra `docs/ESCALAS_REFERENCIA.txt`.
