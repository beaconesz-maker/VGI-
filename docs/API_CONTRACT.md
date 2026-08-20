# Contrato API — servidor ↔ frontend

Backend Express, un único proceso Node sirviendo a todos los PCs de la red
local a la vez (esto es lo que da la "memoria compartida": no hay bloqueo
de archivos entre procesos, hay una cola en memoria por archivo dentro del
mismo proceso — ver `server/store/jsonStore.js`). Todas las rutas bajo
`/api`. Todo el resto (`/`) sirve estático desde `public/`.

Autenticación por sesión (cookie httpOnly, `express-session`, store en
memoria del proceso — no hace falta Redis ni nada externo para 100
usuarios). Todas las rutas `/api/*` excepto `/api/auth/login` requieren
sesión válida; si no la hay, `401 {error:"no_autenticado"}`.

## Modelo de datos (JSON hoy, pensado para SQLite mañana)

Cada colección vive en su propio archivo bajo `data/`, como si fuera una
tabla: un array de objetos con `id` (usar `crypto.randomUUID()`). Acceso
**siempre** a través de `server/store/*.js` — nunca `fs.readFile` directo
desde una ruta. Esa capa es la que absorbe el cambio futuro a SQLite: cada
store expone métodos tipo `list()`, `get(id)`, `create(obj)`,
`update(id, patch)`; el día que se cambie a SQLite, solo cambia la
implementación interna de esos métodos.

- `data/users.json` → `{id, username, passwordHash, nombre, rol, activo, createdAt}`
  `rol`: `"clinico" | "admin"`. `passwordHash` con bcrypt (bcryptjs, sin
  dependencias nativas — importante para instalar en PCs de hospital sin
  entorno de compilación).
- `data/patients.json` → `{id, nhc, nombre, fechaNacimiento (YYYY-MM-DD), sexo ("H"|"M"), localizacion ("U3"|"U4"|"U8"), createdAt, createdBy}`
  `nhc` es único (índice lógico, comprobar duplicados en `create`). `sexo`
  no estaba en el encargo original pero lo necesita `shared/scales.js`
  (Hand Grip) y `shared/plan-engine.js` (anemia, plan) como `contexto.sexo`
  — añadido igual que ya lo tenía el prototipo de referencia.
- `data/records.json` → una fila por administración de una escala:
  `{id, patientId, escalaId, fecha (YYYY-MM-DD, la que elige el usuario — regla de negocio 1), valores (lo que necesite cada escala, ver SCALES_CONTRACT), resultado {raw, label, cls, texto}, userId, userCodigo, createdAt}`.
  `resultado` **lo calcula siempre el servidor** llamando a
  `shared/scales.js` — nunca se confía en una puntuación que llegue ya
  calculada desde el navegador. El `contexto` que se le pasa a
  `interpretar(escalaId, valores, contexto)` es
  `{sexo: patient.sexo, edadAnios: edad calculada desde fechaNacimiento y
  record.fecha}`. La escolaridad del MoCA (`contexto.escolaridadAnios`) no
  hace falta pedirla aparte: si no se manda, `interpretarMoca` usa
  `valores.escolaridadBaja` (booleano) como alternativa — pide ese campo en
  el formulario de MoCA, igual que Pfeiffer ya trae su propio ítem de
  escolaridad autocontenido.
- `data/morfo.json` → peso/talla por paciente y fecha:
  `{id, patientId, fecha, peso, talla, userId, createdAt}`.
- `data/clinical.json` → parámetros analíticos y clínicos por paciente y
  fecha (Hb, VCM, ferritina, IST, B12, fólico, eGFR, HbA1c, 25-OH-D, y los
  checkboxes clínicos del plan — inflamación, cardiopatía, preoperatorio,
  DM, insulina/sulfonilureas, categoría ADA, caídas último año, STOPP/START
  marcados): `{id, patientId, fecha, valores{...}, userId, createdAt}`.
- `data/plan_validations.json` → sello de validación humana de la hoja de
  ruta (requisito no negociable: ninguna recomendación tiene efecto sin
  validar): `{id, patientId, fecha, userId, validatedAt}`. Generar un
  documento del plan sin una validación para esa combinación
  paciente+fecha → `403 {error:"plan_no_validado"}`.

`userCodigo` en `records` es el campo pensado para la tabla de seguimiento
que pide Bea ("tabla con fecha y código del usuario que registró el
dato") — usar `username`, no el nombre completo, para no repetir un dato
identificativo innecesariamente.

## Rutas

```
POST   /api/auth/login          {username, password} → {user}
POST   /api/auth/logout         → 204
GET    /api/auth/me             → {user} | 401

GET    /api/patients?q=         búsqueda por NHC o nombre → [patient]
POST   /api/patients            {nhc, nombre, fechaNacimiento, sexo, localizacion} → patient
GET    /api/patients/:id        → patient
PUT    /api/patients/:id        {nhc?, nombre?, fechaNacimiento?, sexo?, localizacion?} → patient

GET    /api/scales              catálogo completo (dominios, escalas, ítems) tal cual lo expone shared/scales.js — el frontend NO hardcodea escalas, las pinta desde aquí
GET    /api/patients/:id/records?escalaId=&from=&to=   → [record]  (para tabla de seguimiento y gráfica)
POST   /api/patients/:id/records  {escalaId, fecha, valores} → record (con resultado ya calculado en servidor)
DELETE /api/patients/:id/records/:recordId → 204  (borrado por error de tecleo; requiere rol admin o ser el autor del registro)

POST   /api/patients/:id/morfo   {fecha, peso, talla} → registro
GET    /api/patients/:id/morfo?from=&to=

POST   /api/patients/:id/clinical {fecha, valores{...}} → registro
GET    /api/patients/:id/clinical?fecha=   (el más reciente si no se pasa fecha)

GET    /api/patients/:id/plan?fecha=       calcula el plan con shared/plan-engine.js usando los records/morfo/clinical vigentes en esa fecha (el más reciente con fecha <= la pedida, por escala) → {clasificacion:[...], recomendaciones:{...}}
POST   /api/patients/:id/plan/validate {fecha} → sello de validación

GET    /api/patients/:id/export/informe.docx?fecha=
       (además de puntuación e interpretación, incluye por escala los
       ítems en los que el paciente no obtuvo la mejor respuesta posible
       — ver server/lib/items-fallidos.js — cuando la escala tiene ese
       desglose)
GET    /api/patients/:id/export/plan.docx?fecha=   → 403 plan_no_validado si falta el sello
GET    /api/patients/:id/export/informe.pdf?fecha=   mismo contenido que el .docx, generado con pdfkit (server/lib/pdf-informe.js)
GET    /api/patients/:id/export/plan.pdf?fecha=      mismo gate 403 plan_no_validado que el .docx (server/lib/pdf-plan.js)

GET    /api/export/aggregate.csv      datos agregados anonimizados (sin NHC ni nombre, solo id interno del paciente) — requiere rol admin, 403 permiso_denegado si no
GET    /api/export/aggregate.xlsx     igual, en Excel (exceljs)
```

## Notas de implementación (server/, ajustes menores sobre este contrato)

- **`sexo` en `POST /api/patients`**: la lista de campos del `POST` no
  mencionaba `sexo` explícitamente (solo el modelo de datos lo hacía, más
  arriba). Como `sexo` es obligatorio para que Hand Grip y el plan
  (anemia, Charlson) funcionen bien, `POST` y `PUT /api/patients` lo
  aceptan como campo del body igual que `localizacion` (opcional en el
  body, pero recomendado rellenarlo desde el alta del paciente). Ver
  `server/routes/patients.js`.
- **`GET /api/patients/:id/clinical?fecha=`**: se implementa como "el
  registro exacto de esa fecha (o `null` si no hay ninguno ese día
  concreto)" cuando se pasa `fecha`, y "el más reciente de todos" cuando
  no se pasa — pensado para rellenar el formulario de edición de un día
  concreto. Es distinto del concepto "vigente a fecha X" (el más reciente
  con `fecha <=`) que sí usan `GET /plan` y las exportaciones `.docx`
  internamente (ver `server/lib/vigente.js`) — ese cálculo no se expone
  como endpoint aparte porque no hacía falta para el frontend.
- **`plan_validations`**: además de `{id, patientId, fecha, userId,
  validatedAt}` se guarda también `userCodigo` (el `username`, igual que
  en `records`), para poder mostrar "validado por Fulanito" sin tener que
  resolver el `userId` contra `users` en cada exportación.
- **Ítems con imagen (MMSE/MoCA)**: `docs/SCALES_CONTRACT.md` pide SVGs
  propios en `public/assets/scales/*.svg`. El backend no necesita generar
  ni interpretar esos SVG (son estáticos, servidos igual que el resto de
  `public/`); esto es tarea del frontend, se deja anotado aquí solo para
  que quien lea este contrato sepa que no falta nada por el lado de
  `server/`.

## Errores

Formato uniforme: `{error: "codigo_snake_case", mensaje: "texto en español para mostrar en la UI"}`. Códigos ya usados arriba: `no_autenticado`, `plan_no_validado`. Añadir los que hagan falta (`nhc_duplicado`, `escala_desconocida`, `credenciales_invalidas`...) siguiendo el mismo patrón.
