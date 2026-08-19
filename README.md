# VGI+

App de Valoración Geriátrica Integral (VGI) para la práctica clínica de la Dra. Beatriz
Contreras Escámez (Geriatría, Hospital San Juan Grande, Jerez de la Frontera).

VGI+ convierte las 10 escalas geriátricas habituales en una app clicable que autosuma e
interpreta cada test, y a partir de esos resultados genera dos documentos Word editables:
la historia clínica de la VGI y el plan de recomendaciones y medidas.

## Contenido

- **`vgi_app.html`** — app interactiva de puntuación. Muestra las 10 escalas agrupadas por
  dominio (funcional, nutricional, cognitivo, marcha y sarcopenia). El botón "Generar informe
  VGI" produce un bloque `=== RESULTADOS VGI ===` con todos los resultados.

- **`skills/valoracion-geriatrica-integral/`** — skill de Claude que sirve la app y, con el
  bloque de resultados, redacta la conclusión de cada test (basada en evidencia) y genera el
  documento de historia clínica `.docx` a partir de `assets/VGI_plantilla.dotx` con
  `scripts/generar_vgi.js`.

- **`skills/plan-recomendaciones-geriatricas/`** — skill hermana. A partir del mismo bloque de
  resultados de la VGI, clasifica cada escala con su evidencia y genera el
  **plan de recomendaciones y medidas** en Word con `scripts/generar_plan.js`, pensado para los
  médicos de San Juan Grande (pauta Vivifrail, ESPEN, medidas NICE de caídas, etc.).

## Escalas incluidas

Barthel, Lawton, SPPB, FRAIL, TUG, SARC-F (físico) · MNA, GLIM (nutricional) ·
Mini-Mental (MMSE/MEC), Pfeiffer (cognitivo).

## Flujo

1. Se pasa la VGI con `vgi_app.html` (o se dictan puntuaciones sueltas).
2. Con el bloque `=== RESULTADOS VGI ===`, la skill `valoracion-geriatrica-integral` genera la
   historia clínica.
3. Con el mismo bloque, la skill `plan-recomendaciones-geriatricas` genera el plan de
   recomendaciones y medidas.

Las bases de evidencia curadas están en `references/escalas_evidencia.md` (ambas skills) y
`references/guias_recomendaciones.md` (plan de recomendaciones).
