---
name: valoracion-geriatrica-integral
description: >-
  Realiza una Valoración Geriátrica Integral (VGI) completa con escalas autopuntuables e
  integración en la historia clínica final. Activa esta skill SIEMPRE que el usuario quiera
  pasar, puntuar o interpretar escalas geriátricas o redactar una VGI. Triggers: "valoración
  geriátrica integral", "VGI", "pásame las escalas", "hazme la VGI de un paciente", "calcular
  Barthel / Lawton / SPPB / FRAIL / MNA / GLIM / Mini-Mental / MMSE / MEC / Pfeiffer / TUG /
  SARC-F", "interpreta este Barthel", "escala de fragilidad", "cribado de sarcopenia",
  "valoración funcional / nutricional / cognitiva", "informe de geriatría", "historia clínica
  de geriatría", o cuando aporte puntuaciones de escalas y pida una conclusión o un documento.
  Úsala también si pide "el documento de la consulta" o "rellenar la plantilla de VGI".
---

# Valoración Geriátrica Integral (VGI)

Skill para la práctica clínica de la Dra. Contreras (Geriatría). Convierte las 10 escalas
habituales en una app clicable que autosuma e interpreta cada test, y después integra los
resultados —con una conclusión basada en evidencia— en su plantilla de historia clínica `.docx`.

## Flujo en dos fases

### Fase 1 — App interactiva de puntuación
Cuando la skill se active para pasar/puntuar escalas o hacer una VGI:

1. Lee `assets/vgi_app.html`.
2. Llama a `visualize:read_me` con el módulo `interactive` (en silencio, sin narrarlo).
3. Renderiza el HTML con `visualize:show_widget` pasando el contenido del asset **tal cual**.
   No reescribas la app; es completa y validada.

La app muestra las 10 escalas agrupadas por dominio (funcional, nutricional, cognitivo,
marcha y sarcopenia). La usuaria clica la puntuación de cada ítem, ve el total y la
interpretación en vivo, y cada escala puede marcarse "no realizada". El botón **Generar
informe VGI** envía al chat un bloque `=== RESULTADOS VGI ===` con todos los resultados; si el
envío automático no está disponible, la usuaria lo copia y lo pega.

Si la usuaria prefiere no usar la app y te dicta o pega puntuaciones sueltas, interprétalas
directamente con la base de evidencia y continúa.

### Fase 2 — Conclusión por test + documento
Al recibir el bloque de resultados (o puntuaciones dictadas):

1. **Conclusión de cada test.** Para cada escala con resultado, redacta una conclusión breve
   (1-2 frases) combinando la puntuación del paciente con su punto de corte y el significado
   pronóstico, usando `references/escalas_evidencia.md`. Es la base curada (modo híbrido).
   - **No inventes referencias.** Usa solo las de la tabla verificada (con PMID).
   - Haz **búsqueda en vivo en PubMed** (conector) SOLO si la usuaria lo pide explícitamente
     ("busca en PubMed", "evidencia más reciente de…"). Incorpora entonces la cita con su PMID.
   - Si una afirmación no está soportada, decláralo como laguna; nunca la fabriques.
2. **Apartados de texto libre.** La plantilla tiene secciones que no salen de las escalas
   (Historia actual, Caídas, Disfagia, Deposición, Social, Tratamiento, Exploración física,
   Analítica, Juicio clínico, Medidas). Pregunta por las que falten **en un solo mensaje**,
   ofreciendo rellenar lo que la usuaria te dé y dejar el resto en blanco. No bloquees la
   generación por esto: si dice "solo las escalas", genera el documento con esos apartados vacíos.
3. **Genera el `.docx`.** Construye el JSON (ver esquema abajo) y ejecuta (instala `docx` si
   no está disponible):
   ```bash
   cd <ruta-skill> && npm ls docx >/dev/null 2>&1 || npm install docx --no-save --silent
   node scripts/generar_vgi.js datos.json /mnt/user-data/outputs/VGI_<apellido_o_fecha>.docx
   ```
   Valida con `python /mnt/skills/public/docx/scripts/office/validate.py <salida>` y presenta el
   archivo con `present_files`.

## Mapa escala → plantilla
- **Físico:** Barthel, Lawton, SPPB, FRAIL, TUG, SARC-F → array `fisico`.
- **Nutricional y eliminación:** MNA, GLIM → array `nutricional`; más `disfagia` y `deposicion`.
- **Cognitivo:** Mini-Mental (MMSE/MEC), Pfeiffer → array `cognitivo`.
- **Social, Caídas, Tratamiento, Exploración, Analítica, Juicio, Medidas:** texto libre.

GLIM no es una suma: se informa como "cumple / no cumple desnutrición" con los criterios
fenotípico y etiológico presentes. Pfeiffer cuenta errores. TUG es un tiempo en segundos.

## Esquema del JSON para el generador
Cada entrada de `fisico`/`nutricional`/`cognitivo` es `{nombre, valor, interp, conclusion}`.
`conclusion` es tu redacción basada en la evidencia. Todos los campos son opcionales; el
generador deja en blanco lo que no se aporte y respeta la cabecera y el formato de la plantilla.

```json
{
  "paciente": { "nombre": "", "fnac": "", "fecha_eval": "" },
  "antecedentes": ["No RAMc"],
  "historia_actual": "",
  "fisico": [ {"nombre":"Barthel","valor":"65/100","interp":"dependencia leve","conclusion":"…"} ],
  "caidas": "",
  "nutricional": [ {"nombre":"MNA total","valor":"20/30","interp":"riesgo de malnutrición","conclusion":"…"} ],
  "disfagia": "", "deposicion": "",
  "cognitivo": [ {"nombre":"Pfeiffer","valor":"4 errores","interp":"deterioro leve","conclusion":"…"} ],
  "social": "",
  "tratamiento": [],
  "exploracion": {"general":"","cardiopulmonar":"","abdomen":"","extremidades":"","neurologico":"","marcha":""},
  "analitica": "",
  "juicio_clinico": [],
  "medidas": []
}
```

La fecha de evaluación, si no se indica, se rellena con la fecha actual.

## Reglas
- Mantén el estilo clínico, conciso y en español de la usuaria.
- La interpretación de los puntos de corte es determinista (la calcula la app); tu aportación es
  la conclusión razonada y, si se pide, la actualización en PubMed.
- No diagnostiques por tu cuenta más allá de lo que sostienen las escalas y la evidencia citada;
  la VGI es una herramienta de apoyo a la decisión clínica de la facultativa.
- Si la usuaria solo quiere puntuar una escala suelta, basta con la app o la interpretación
  directa: no fuerces la generación del documento completo.
