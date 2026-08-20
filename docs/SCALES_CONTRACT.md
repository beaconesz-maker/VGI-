# Contrato del motor clínico (`shared/`)

`shared/` es JavaScript puro: nada de `document`, nada de `require('express')`,
nada de acceso a archivos. Tiene que poder cargarse tanto con
`require('../shared/scales.js')` desde Node como con
`<script src="/shared/scales.js"></script>` desde el navegador (Express
sirve `shared/` como estático además de `public/`). Usa este patrón UMD en
la cabecera de cada archivo de `shared/`:

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VGIScales = factory(); // o VGIPlanEngine, etc.
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // ... contenido ...
  return { DOMINIOS, ESCALAS, interpretar, catalogo };
});
```

## `shared/scales.js`

### Dominios (grupo mostrado en el desplegable de la pestaña Escalas)

```
morfofuncional  → Barthel, Lawton-Brody, Katz, velocidad de marcha, Hand Grip,
                   TUG, SPPB   (peso/talla NO son una escala: van en su propio
                   endpoint /morfo, pero se muestran en la misma pestaña)
nutricional     → MNA, GLIM, SARC-F
comorbilidad    → Charlson, CIRS-G
fragilidad      → FRAIL, Fried, Clinical Frailty Scale, Índice Frágil-VIG
cognitivo       → MMSE/MEC, MoCA, Pfeiffer (SPMSQ), Test del Reloj
```

(El encargo original agrupa en solo 4 dominios: morfofuncional,
comorbilidades, fragilidad, cognitivo. Se añade "nutricional" como quinto
grupo porque MNA/GLIM/SARC-F no encajan bien ni en morfofuncional ni en
cognitivo y así lo hacía ya el prototipo de referencia. Si Bea prefiere
fusionarlo dentro de morfofuncional, es un cambio de una línea en
`DOMINIOS`.)

### Catálogo completo a implementar (21 escalas)

Los ítems, opciones, puntuaciones y cortes de interpretación **ya están
verificados y listos para copiar tal cual** en
`docs/ESCALAS_REFERENCIA.txt` (19 escalas) y en el prototipo de referencia
`docs/VGI_prototipo_generico_referencia.html` (buscar el objeto `DATA` y
las funciones `rXxx`/`upd` — la lógica de cálculo ya está escrita y
probada, es un puerto, no hay que reinventarla). Referencias bibliográficas
completas en `docs/GUIAS_REFERENCIA.txt`.

Barthel · Lawton-Brody · Katz · Charlson · CIRS-G · FRAIL · Fried ·
Clinical Frailty Scale · Índice Frágil-VIG · velocidad de marcha ·
Hand Grip · TUG · SPPB · MNA · GLIM · SARC-F · MMSE/MEC · Pfeiffer ·
Test del Reloj (Shulman) · **MoCA** (nueva, no estaba en el prototipo — ver
abajo).

### MoCA (Montreal Cognitive Assessment) — a añadir de cero

No estaba en el prototipo. Dominios y puntuación máxima de la versión
estándar (v8.1, la de dominio público más citada):
visuoespacial/ejecutivo (5) · identificación (3) · memoria/atención,
sin puntuar directamente, es recuerdo diferido más abajo · atención (6) ·
lenguaje (3) · abstracción (2) · recuerdo diferido (5) · orientación (6).
Total /30; +1 punto si escolaridad ≤12 años (máx. 30). Corte estándar:
≥26 normal, <26 sugiere deterioro cognitivo leve. Referencia: Nasreddine
ZS, et al. The Montreal Cognitive Assessment (MoCA). J Am Geriatr Soc.
2005;53:695-699. doi:10.1111/j.1532-5415.2005.53221.x. **Verificar los
puntos por subapartado contra el original antes de dar la escala por
cerrada** — la regla de "sin referencias no verificadas" aplica igual a
escalas nuevas que a recomendaciones.

### Ítems con imagen (MMSE/MEC y MoCA)

Requisito explícito de Bea: estas escalas deben verse "con el mismo
aspecto que las escalas ofrecen habitualmente". Los ítems visuales son:

- MMSE/MEC: copia del pentágono entrelazado (ítem de praxis constructiva).
- MoCA: copia del cubo 3D, dibujo del reloj (11:10), y la figura de
  "trail making" alterna número-letra (1-A-2-B-3-C-4-D-5).

**No reproducir el test comercial protegido tal cual** (el MMSE original
tiene copyright de PAR Inc.; el MoCA es de uso clínico gratuito con
registro en mocacognition.com, pero redistribuir su maquetación exacta no
es necesario). En su lugar: dibujar **figuras geométricas propias en SVG**
que cumplen la misma función de evaluación (copiar un pentágono
entrelazado, un cubo, un reloj) sin ser una reproducción del documento
comercial. Guardar en `public/assets/scales/*.svg`. Cada ítem con imagen
en `shared/scales.js` lleva `{tipo:"imagen", src:"/assets/scales/xxx.svg", instrucciones:"..."}`
y se puntúa igual que el resto (opciones con puntuación, no reconocimiento
automático de la imagen — la puntúa el clínico mirando lo que ha dibujado
el paciente en papel aparte, la app solo muestra el modelo a copiar).

### Forma de cada escala en el catálogo

```js
{
  id: "sppb", nombre: "SPPB", sub: "rendimiento físico", dominio: "morfofuncional",
  unidad: "/12",
  items: [ { id, pregunta, ayuda, opciones: [{etiqueta, valor}] }, ... ],
  // o, para escalas sin ítems discretos (marcha, grip, TUG, IF-VIG): 
  entrada: { tipo: "numero", etiqueta, unidad, min, max, paso },
  referencia: { texto: "Guralnik JM, et al. ...", pmid: "..." },
  nota: "texto opcional visible bajo la escala"
}
```

### `interpretar(escalaId, valores, contexto) → {raw, label, cls, texto, completo}`

`contexto` trae lo que algunas escalas necesitan del paciente: `{sexo,
edadAnios}` (Charlson ajusta por edad; Hand Grip y velocidad de marcha
tienen corte distinto según sexo). `cls` es uno de `"ok" | "warn" | "alert" | "neutro"`
(el frontend decide el color, el motor solo clasifica). Esta función es la
**única** fuente de verdad de la puntuación — la usa el backend al guardar
un `record` y el frontend para la vista previa en vivo antes de guardar.

## `shared/plan-engine.js`

Puerto del generador de plan del prototipo (busca `buildPlan()` en
`docs/VGI_prototipo_generico_referencia.html`): a partir de los últimos
`records` + `morfo` + `clinical` de un paciente, genera recomendaciones por
eje (ejercicio/Vivifrail, nutrición ESPEN, caídas NICE NG249, deterioro
cognitivo NICE NG97, anemia, vitamina D, control glucémico ADA,
STOPP/START), cada una con su lista de medidas y su referencia
bibliográfica. Firma:

```js
generarPlan({ records, morfo, clinical, paciente }) → { clasificacion: [...], recomendaciones: { ejercicio, nutricion, caidas, demencia, anemia, vitd, glucemia, stopstart } }
```

Vivifrail: el corte de pasaporte por SPPB y la variante "+" (por
TUG≥13,5s, SARC-F≥4 o marcha≤0,8 m/s) ya están validados en el prototipo —
pórtalos tal cual. No se ha podido acceder a vivifrail.es/vivifrail.com
desde este entorno (bloqueado por la red del sandbox) para ampliar el
detalle de ejercicios por pasaporte; mantén el enlace de salida a
vivifrail.com para que el clínico consulte la rueda oficial impresa, tal y
como hacía el prototipo. No inventar dosis o ejercicios concretos que no
estén ya verificados en el prototipo o en `docs/GUIAS_REFERENCIA.txt`.
