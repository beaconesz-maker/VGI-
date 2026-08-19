---
name: plan-recomendaciones-geriatricas
description: >-
  A partir de los resultados de una Valoración Geriátrica Integral (el bloque "=== RESULTADOS VGI ==="
  generado por la app de VGI, o puntuaciones dictadas), clasifica cada escala con su evidencia y
  genera un PLAN DE RECOMENDACIONES Y MEDIDAS en Word editable para los médicos del Hospital San Juan
  Grande (Jerez de la Frontera). Activa esta skill SIEMPRE que el usuario pegue un bloque de resultados
  VGI y pida recomendaciones, medidas o un plan; o diga: "genera el plan de recomendaciones", "plan de
  medidas a partir de la VGI", "qué pasaporte Vivifrail le corresponde", "recomendaciones de ejercicio
  / nutrición / caídas / demencia según estas escalas", "informe de recomendaciones para el hospital",
  "Vivifrail según SPPB", "pauta ESPEN", "medidas NICE de caídas", o cuando aporte SPPB / MNA / GLIM /
  Pfeiffer / MMSE y pida la conducta a seguir. Es la skill hermana de la VGI: la VGI puntúa, esta
  recomienda. Úsala también si pide "el documento de recomendaciones" o "el plan para San Juan Grande".
---

# Plan de recomendaciones y medidas geriátricas

Skill hermana de la Valoración Geriátrica Integral. Recibe los resultados de una VGI (el bloque
`=== RESULTADOS VGI ===` que produce la app de VGI, o puntuaciones sueltas), **clasifica cada escala
con su evidencia** y genera un **plan de recomendaciones y medidas** en Word editable, pensado para
los médicos del **Hospital San Juan Grande (Jerez de la Frontera)**. El motor de recomendaciones
cubre cuatro ejes: ejercicio multicomponente (VIVIFRAIL), nutrición (ESPEN), caídas (NICE NG249) y
estudio/tratamiento de demencia (NICE NG97 + SEGG).

## Entrada esperada

El bloque que pega la usuaria tiene este formato (lo emite la app de VGI):

```
=== RESULTADOS VGI ===
PACIENTE: <nombre> | F. NAC: <fecha>
[FUNCIONAL]
Barthel: 65/100 | dependencia leve
SPPB: 5/12 | limitación moderada
FRAIL: 3/5 | frágil
[NUTRICIONAL]
MNA: cribado 9/14 (riesgo) · total 19/30 (riesgo)
GLIM: CUMPLE desnutrición | fenotípico[...] etiológico[...]
[COGNITIVO]
Pfeiffer: 4 errores | deterioro leve (esc. media)
MMSE/MEC: 22/30 | deterioro
[MARCHA Y SARCOPENIA]
TUG: 22 s | alto riesgo de caídas
SARC-F: 5/10 | positivo
=== FIN ===
```

Si la usuaria dicta o pega puntuaciones sueltas en lugar del bloque, interprétalas igual. No
bloquees el flujo por el formato.

## Flujo

### Paso 1 — Parsear y clasificar con evidencia
Lee el bloque y, para cada escala con resultado, redacta una **conclusión breve** (1-2 frases)
combinando la puntuación con su punto de corte y su significado, usando
`references/escalas_evidencia.md` (base curada, PMID verificados). Reglas:
- **No inventes referencias.** Usa solo las de la tabla verificada.
- Búsqueda en vivo (PubMed/web) SOLO si la usuaria la pide explícitamente; entonces incorpora la
  cita con su identificador.
- Si una afirmación no está soportada, decláralo como laguna; nunca la fabriques.

### Paso 2 — Motor de recomendaciones
Lee `references/guias_recomendaciones.md` y genera las recomendaciones de los ejes que apliquen
según los resultados. **Cada eje cita su fuente.** Resumen de disparadores (el detalle, cifras y
redacción está en el archivo de evidencia):

- **Ejercicio multicomponente — VIVIFRAIL (driver: SPPB).** Asigna pasaporte por SPPB:
  0-3 → **A** (discapacidad) · 4-6 → **B** (fragilidad) · 7-9 → **C** (prefragilidad) ·
  10-12 → **D** (robusto). Usa la **variante "+"** (B+/C+) si hay riesgo de caídas (TUG ≥ 20 s,
  SARC-F con caídas, ≥ 2 caídas). Añade la pauta general (fuerza-potencia, equilibrio, marcha,
  flexibilidad y aeróbico; 30-45 min, 3 días/sem, ≥ 8 semanas; ruedas en vivifrail.com). Si no hay
  SPPB pero sí velocidad de marcha 6 m, usa esa columna; si no hay ninguno, indícalo y recomienda
  completar el SPPB. **Consulta vivifrail.es / vivifrail.com** para la rueda concreta si la usuaria lo pide.
- **Nutrición — ESPEN (driver: MNA / GLIM).** Si MNA normal y GLIM no cumple: principios generales
  (≈30 kcal/kg/día, proteína ≥ 1,0-1,2 g/kg/día, hidratación, cribado periódico). Si MNA en
  riesgo/malnutrición o GLIM cumple: intensificar (proteína 1,2-1,5 g/kg/día; SNO ≥ 400 kcal +
  ≥ 30 g proteína/día ≥ 1 mes con revisión mensual; abordaje multidisciplinar; combinar con
  ejercicio; adaptar texturas si hay disfagia).
- **Caídas — NICE NG249 (driver: TUG / SPPB / SARC-F caídas / antecedentes).** Si hay riesgo
  (TUG alto, caídas de repetición, fragilidad): valoración multifactorial e intervención integral
  (revisión de medicación y retirada de psicofármacos, ejercicio progresivo de equilibrio-fuerza
  —se alinea con el pasaporte Vivifrail—, riesgos del hogar por TO, ortostatismo, visión, audición,
  calzado, continencia, osteoporosis; vitamina D para salud óseo-muscular). Recuerda: **NG249
  sustituye a CG161** y desaconseja las escalas de predicción de caídas.
- **Demencia — NICE NG97 + SEGG (driver: Pfeiffer / MMSE-MEC).** Si Pfeiffer ≥ 3 errores o
  MMSE/MEC ≤ 24 (cribado positivo): estudio diagnóstico (anamnesis con informante, test cognitivo,
  neuroimagen estructural, analítica de causas reversibles —TSH, B12, fólico, iones, calcio—,
  filiación de subtipo, derivación a unidad de memoria). En demencia establecida: tratamiento
  específico (IACE en Alzheimer leve-moderado; memantina en moderado-grave) + medidas no
  farmacológicas y apoyo al cuidador.

Genera solo los ejes con datos. Si falta el driver de un eje, omítelo o decláralo como pendiente.

### Paso 3 — Generar el documento Word
Construye el JSON (esquema abajo) y ejecuta (instala `docx` si no está disponible):

```bash
cd <ruta-skill> && npm ls docx >/dev/null 2>&1 || npm install docx --no-save --silent
node scripts/generar_plan.js datos.json /mnt/user-data/outputs/Plan_recomendaciones_<apellido_o_fecha>.docx
```

Valida con `python /mnt/skills/public/docx/scripts/office/validate.py <salida>` y presenta el
archivo con `present_files`. El membrete es del Hospital San Juan Grande; el campo `medico` permite
firmar al facultativo que lo emite.

## Esquema del JSON para el generador

```json
{
  "paciente": { "nombre": "", "fnac": "", "fecha_eval": "", "medico": "", "nhc": "" },
  "resumen_clinico": "",
  "clasificacion": {
    "fisico":      [ {"nombre":"SPPB","valor":"5/12","interp":"limitación moderada","conclusion":"…"} ],
    "nutricional": [ {"nombre":"MNA","valor":"19/30","interp":"riesgo","conclusion":"…"} ],
    "cognitivo":   [ {"nombre":"Pfeiffer","valor":"4 errores","interp":"deterioro leve","conclusion":"…"} ]
  },
  "recomendaciones": {
    "ejercicio": { "titulo":"Ejercicio físico multicomponente (VIVIFRAIL)", "lineas":["…"], "fuente":"Ministerio de Sanidad 2022; vivifrail.com" },
    "nutricion": { "titulo":"Nutrición (ESPEN)", "lineas":["…"], "fuente":"ESPEN 2019/2022; PROT-AGE 2013" },
    "caidas":    { "titulo":"Prevención de caídas (NICE NG249)", "lineas":["…"], "fuente":"NICE NG249, 2025" },
    "demencia":  { "titulo":"Estudio y tratamiento de demencia (NICE NG97 / SEGG)", "lineas":["…"], "fuente":"NICE NG97, 2018; SEGG" }
  },
  "referencias": [
    "Volkert D, et al. ESPEN guideline… Clin Nutr. 2019;38(1):10-47. PMID 30005900.",
    "NICE NG249. Falls… 2025."
  ]
}
```

Todos los campos son opcionales; el generador omite lo que falte y respeta cabecera y formato.
`fecha_eval`, si no se indica, se rellena con la fecha actual.

## Reglas
- Estilo clínico, conciso y en español. El documento es de **apoyo a la decisión**: la indicación
  y prescripción finales corresponden al facultativo.
- **Cada recomendación se ancla a su guía.** No mezcles ejes sin soporte ni inventes cifras.
- Incluye siempre el bloque de **Referencias** con las fuentes citadas (toma las verificadas del
  archivo de evidencia: ESPEN PMID 30005900 / 35306388, PROT-AGE PMID 23867520, NICE NG249, NICE
  NG97, Vivifrail/Min. Sanidad 2022, SEGG).
- Verifica que se cita **NG249 (vigente)** y no la antigua CG161.
- Si la usuaria solo quiere un eje (p. ej. "solo el pasaporte Vivifrail"), genera ese y no fuerces
  el documento completo salvo que lo pida.
