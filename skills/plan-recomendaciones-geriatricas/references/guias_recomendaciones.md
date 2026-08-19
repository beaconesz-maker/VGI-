# Base de evidencia del motor de recomendaciones

Todas las afirmaciones de las recomendaciones deben anclarse a las fuentes verificadas de esta
tabla. **No añadas recomendaciones que no estén soportadas aquí salvo que la usuaria pida una
búsqueda en vivo (PubMed / web) y la cita se obtenga de ese conector.** Si una afirmación no
está soportada, decláralo como laguna ("dato no verificado") en lugar de inventarlo. Las dosis,
cifras y umbrales son una ayuda a la decisión; la prescripción final es responsabilidad del
facultativo.

---

## Tabla de fuentes verificadas

| Clave | Ámbito | Cita | Verificación |
|-------|--------|------|--------------|
| vivifrail_sns | Ejercicio | Ministerio de Sanidad. Actualización del documento de consenso sobre prevención de fragilidad y caídas en el SNS (2022). Guía para programas de actividad física multicomponente. | sanidad.gob.es (tabla SPPB→pasaporte) |
| vivifrail_web | Ejercicio | Programa VIVIFRAIL. Pasaportes y ruedas de ejercicio multicomponente. | vivifrail.com |
| espen_2019 | Nutrición | Volkert D, et al. ESPEN guideline on clinical nutrition and hydration in geriatrics. Clin Nutr. 2019;38(1):10-47. | PMID 30005900 · DOI 10.1016/j.clnu.2018.05.024 |
| espen_2022 | Nutrición | Volkert D, et al. ESPEN practical guideline: clinical nutrition and hydration in geriatrics. Clin Nutr. 2022;41(4):958-989. | PMID 35306388 · DOI 10.1016/j.clnu.2022.01.024 |
| protage | Nutrición | Bauer J, et al. (PROT-AGE Study Group). J Am Med Dir Assoc. 2013;14(8):542-559. | PMID 23867520 · DOI 10.1016/j.jamda.2013.05.021 |
| nice_ng249 | Caídas | NICE. Falls: assessment and prevention in older people and in people 50 and over at higher risk. NICE guideline NG249. 2025. (Sustituye a CG161.) | nice.org.uk/guidance/ng249 · NBK615910 |
| nice_ng97 | Demencia | NICE. Dementia: assessment, management and support for people living with dementia and their carers. NICE guideline NG97. 2018. | nice.org.uk/guidance/ng97 |
| segg_demencia | Demencia | SEGG. Guía de buena práctica clínica en geriatría: Decisiones terapéuticas en la demencia / "Demencia: de la enfermedad a la persona" (2023). | segg.es |

---

## 1. EJERCICIO FÍSICO MULTICOMPONENTE — VIVIFRAIL (driver: SPPB)

El programa VIVIFRAIL clasifica al paciente en un "pasaporte" según el SPPB (o, si no se puede
realizar, la velocidad de marcha en 6 m) y asigna una rueda de ejercicio multicomponente.
**Fuente de la tabla:** consenso del Ministerio de Sanidad 2022 (`vivifrail_sns`); materiales en
vivifrail.com (`vivifrail_web`).

### Tabla SPPB → pasaporte
| SPPB | Velocidad marcha 6 m | Pasaporte | Estado funcional |
|------|----------------------|-----------|------------------|
| 0-3 | < 0,5 m/s | **A** | Persona con discapacidad |
| 4-6 | 0,5-0,8 m/s | **B** | Persona con fragilidad |
| 7-9 | 0,9-1 m/s | **C** | Persona con pre-fragilidad |
| 10-12 | > 1 m/s | **D** | Persona robusta |

### Variante "+" (riesgo de caídas)
Los pasaportes con símbolo **"+"** (B+, C+) corresponden a personas con **riesgo de caídas**.
Recomienda la variante "+" cuando haya señales de riesgo de caídas en el resumen VGI:
TUG ≥ 20 s (o ≥ 13,5 s como umbral sensible), SARC-F con ítem de caídas positivo, antecedente de
≥ 2 caídas, o cuando la propia VGI lo indique. (El pasaporte A ya integra el trabajo de equilibrio;
el D no lleva "+".)

### Prescripción general del ejercicio multicomponente
- **Componentes:** fuerza y potencia de miembros, equilibrio y coordinación (prevención de
  caídas), reentrenamiento de la marcha, flexibilidad y resistencia aeróbica.
- **Dosis:** sesiones de **30-45 min, 3 veces/semana**, intensidad baja-moderada y progresiva,
  duración mínima **8 semanas**. Puede realizarse en comunidad, domicilio, hospital o residencia.
- **Material:** ruedas de ejercicio y vídeos por pasaporte disponibles en vivifrail.com.
- **Reevaluación:** repetir SPPB/Vivifrail para monitorizar progreso y reasignar pasaporte.
- **Evidencia:** el ejercicio multicomponente es la intervención que mejores resultados ha
  mostrado para revertir la fragilidad y reducir caídas. **Refs:** vivifrail_sns, vivifrail_web.

### Redacción (plantilla)
"Rendimiento físico SPPB {n}/12 → **Pasaporte VIVIFRAIL {tipo}{+}** ({estado}). Se recomienda
programa de ejercicio multicomponente (fuerza-potencia, equilibrio, marcha, flexibilidad y
resistencia aeróbica), 30-45 min, 3 días/semana, mínimo 8 semanas, con la rueda correspondiente
de vivifrail.com y reevaluación funcional periódica."

> Si no consta SPPB pero sí velocidad de marcha, usa la columna de velocidad. Si no hay ninguno,
> declara que no puede asignarse pasaporte y recomienda completar el SPPB / Test Vivifrail.

---

## 2. NUTRICIÓN — GUÍAS ESPEN (driver: MNA y/o GLIM)

**Fuentes:** ESPEN 2019 (`espen_2019`) y guía práctica ESPEN 2022 (`espen_2022`); proteínas
también PROT-AGE (`protage`).

### Principios generales (todo paciente)
- **Cribado nutricional rutinario** a todo mayor; ante cribado positivo, valoración sistemática.
- **Energía orientativa: 30 kcal/kg/día**, ajustada a estado nutricional, actividad, enfermedad y
  tolerancia (ESPEN R1, grado B). **Ref:** espen_2022.
- **Proteínas:** **≥ 1,0-1,2 g/kg/día** en mayores sanos. **Ref:** protage, espen_2019.
- **Hidratación:** considerar a todo mayor en riesgo de deshidratación por baja ingesta;
  objetivo orientativo **mujeres ~1,6 L/día y hombres ~2,0 L/día** de bebidas. **Ref:** espen_2019.
- Evitar dietas restrictivas no justificadas; las dietas de adelgazamiento solo en obesidad con
  problemas de salud asociados y combinadas con ejercicio. **Ref:** espen_2019.

### Si MNA en riesgo / malnutrición o GLIM cumple desnutrición → intensificar
- **Proteínas 1,2-1,5 g/kg/día** (más en enfermedad aguda/crónica o lesión grave; excepción ERC
  grave sin diálisis: restringir). **Ref:** protage, espen_2019.
- **Suplementos nutricionales orales (SNO/ONS):** cuando la dieta no cubre necesidades, ofrecer
  SNO que aporten **≥ 400 kcal/día y ≥ 30 g de proteína/día**, mantenidos **al menos 1 mes** y
  con **revisión mensual** de eficacia. **Ref:** espen_2022 (R, grado A).
- Intervención nutricional **multimodal y multidisciplinar** (apoyo en la comida, consejo
  dietético, modificación de texturas, enriquecimiento); priorizar siempre la vía oral.
  Nutrición enteral si la oral es insuficiente y el pronóstico global es favorable. **Ref:** espen_2019.
- Tratar causas reversibles de baja ingesta (dolor, fármacos, salud bucodental, estreñimiento,
  depresión) y **combinar con ejercicio** para preservar masa y función muscular. **Ref:** espen_2019, protage.
- Si hay **disfagia** declarada en la VGI: adaptación de texturas y viscosidad, valoración logopédica
  y medidas de seguridad en la deglución.

### Redacción (plantilla)
- Normal: "Estado nutricional adecuado (MNA {n}/30). Mantener ingesta ≈30 kcal/kg/día y ≥1,0-1,2
  g/kg/día de proteína, hidratación adecuada y cribado nutricional periódico (ESPEN)."
- En riesgo / desnutrición: "MNA {n}/30 ({categoría}){; GLIM cumple desnutrición}. Plan ESPEN:
  proteína 1,2-1,5 g/kg/día y SNO ≥400 kcal + ≥30 g proteína/día ≥1 mes con revisión mensual,
  abordaje multidisciplinar y combinación con ejercicio."

---

## 3. CAÍDAS — NICE NG249 (2025) (driver: TUG, SPPB, SARC-F caídas, antecedentes)

**Fuente:** NICE NG249 (2025), que **sustituye a CG161** (`nice_ng249`). Verificar siempre que se
cita la versión vigente.

### Punto de partida
- **No usar escalas de predicción de riesgo de caídas** para predecir quién caerá (NG249 1.1.1);
  la decisión se basa en el cribado clínico y los factores individuales.
- Indican **valoración multifactorial e intervención integral de caídas** las personas que han
  caído en el último año con cualquiera de: vivir con fragilidad, caída con lesión que requirió
  tratamiento, pérdida de conciencia, incapacidad de levantarse tras la caída, o **≥ 2 caídas**
  en el último año (NG249 1.1.3). En hospital y residencia, valoración a todos (1.1.7).
- En este flujo, considera indicada la valoración multifactorial si en la VGI hay: TUG elevado
  (alto riesgo de caídas), SARC-F con caídas, antecedente de caídas de repetición, o fragilidad
  (FRAIL/SPPB).

### Dominios de la valoración multifactorial (NG249 1.2.2)
TA en decúbito y bipedestación (ortostatismo) y examen cardiovascular; cognición y ánimo;
delirium (hospital/residencia); dieta, líquidos y pérdida de peso; mareo/vértigo (Dix-Hallpike si
vértigo rotatorio); calzado y estado del pie; capacidad funcional y miedo a caer; marcha,
equilibrio, movilidad y fuerza muscular; audición; enfermedades crónicas (artrosis, demencia,
diabetes, Parkinson…); **revisión de la medicación**; examen neurológico; riesgo de osteoporosis;
continencia urinaria; visión.

### Intervenciones (NG249 1.3)
- **Revisión estructurada de la medicación**; revisar y, si procede, retirar **psicofármacos** y
  fármacos que aumenten el riesgo de caídas (NG249 1.3.2-1.3.3).
- **Programa de ejercicio de prevención de caídas**: progresivo, individualizado, centrado en
  equilibrio, coordinación, fuerza y potencia, con revisiones de progreso (NG249 1.3.9-1.3.10).
  *(Se alinea con el pasaporte Vivifrail asignado.)*
- **Evaluación e intervención sobre riesgos del hogar** con herramienta validada, preferiblemente
  por terapeuta ocupacional (NG249 1.3.5-1.3.6).
- **Vitamina D:** evidencia insuficiente para indicarla específicamente para reducir caídas; seguir
  el consejo del sistema sanitario para mantener salud ósea y muscular (NG249 1.3.4).
- **Cirugía/cardiología:** derivar a oftalmología si cataratas; en caídas de causa no explicada,
  investigar hipersensibilidad del seno carotídeo y considerar marcapasos si procede (1.3.7-1.3.8).
- **TCC** para el miedo a caer que no mejora con ejercicio de fuerza y equilibrio (NG249 1.3.11).

### Redacción (plantilla)
"Riesgo de caídas {alto/elevado} (TUG {t} s · {n.º caídas}). Indicada valoración multifactorial e
intervención integral de caídas (NICE NG249): revisión de medicación con retirada de psicofármacos,
ejercicio progresivo de equilibrio-fuerza, evaluación de riesgos del hogar (TO), valoración de
ortostatismo, visión, audición, calzado, continencia y osteoporosis, y vitamina D para salud
óseo-muscular."

---

## 4. DEMENCIA — NICE NG97 (2018) + SEGG (driver: Pfeiffer y MMSE/MEC)

**Fuentes:** NICE NG97 (`nice_ng97`) y guías de buena práctica de la SEGG (`segg_demencia`).

### Cuándo activar (cribado cognitivo positivo)
- **Pfeiffer ≥ 3 errores** (ajustado por escolaridad) o **MMSE/MEC ≤ 24** (o por debajo del corte
  ajustado por edad/escolaridad) → cribado positivo que justifica **estudio diagnóstico**.
- El cribado **no diagnostica**: orienta a confirmar/filiar el deterioro.

### Estudio diagnóstico recomendado (NG97 + SEGG)
- **Anamnesis estructurada** con informante fiable; cronología, repercusión funcional (AIVD/ABVD),
  síntomas conductuales y psicológicos.
- **Test cognitivo validado** y, si procede, evaluación neuropsicológica más amplia.
- **Neuroimagen estructural** (TC o, preferible, RM craneal) para apoyar el diagnóstico y excluir
  causas estructurales.
- **Analítica para excluir causas reversibles:** hemograma, VSG/PCR, glucosa/HbA1c, función renal
  y hepática, iones (incluido calcio), **TSH**, **vitamina B12 y ácido fólico**; ampliar según
  contexto clínico.
- **Criterios validados** para filiar el subtipo (Alzheimer, vascular, cuerpos de Lewy, DLFT…).
- **Derivación** a unidad de memoria / geriatría / neurología según disponibilidad.

### Tratamiento de la demencia establecida (NG97)
- **Inhibidores de la acetilcolinesterasa (IACE)** — donepezilo, galantamina, rivastigmina — en
  **Alzheimer leve-moderado**; también opción en demencia por cuerpos de Lewy y de Parkinson.
- **Memantina** en Alzheimer **moderado** con intolerancia/contraindicación a IACE, o en Alzheimer
  **grave**; puede asociarse a un IACE en enfermedad establecida (añadir en moderado-grave).
- **No suspender** los IACE solo por la gravedad de la enfermedad.
- **Medidas no farmacológicas** (estimulación cognitiva, rutina estructurada con ejercicio,
  manejo de síntomas conductuales) y **apoyo al cuidador** (SEGG). **Ref:** segg_demencia.
- La puntuación cognitiva orienta la gravedad (orientativo: MMSE ~21-26 leve · 10-20 moderado ·
  <10 grave) pero **no debe ser el único determinante** de iniciar/mantener tratamiento (NG97).

### Redacción (plantilla)
- Cribado positivo: "Cribado cognitivo positivo (Pfeiffer {e} errores · MMSE/MEC {n}/30). Se
  recomienda estudio de demencia (NICE NG97 / SEGG): anamnesis con informante, test cognitivo,
  neuroimagen estructural y analítica para descartar causas reversibles (TSH, B12, fólico, iones,
  calcio), con filiación del subtipo y derivación a unidad de memoria."
- Demencia establecida: "…valorar tratamiento específico: IACE en Alzheimer leve-moderado y/o
  memantina en moderado-grave, junto a medidas no farmacológicas y apoyo al cuidador."

---

## Nota sobre búsqueda en vivo
Por defecto se usa esta base curada. Solo se hará búsqueda en vivo (PubMed/web) si la usuaria lo
pide explícitamente; en ese caso incorpora la cita con su identificador (PMID/DOI/URL oficial) y
nunca presentes una referencia que no provenga del conector o de esta tabla.
