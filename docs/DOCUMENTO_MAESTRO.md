# VGI+ — Documento maestro

Encargo original de Bea (geriatra, Hospital San Juan Grande, Jerez de la Frontera), literal.

## 1. Objetivo
Facilitar el registro e interpretación de las distintas escalas de la valoración geriátrica integral.

## 2. Usuarios
- Quien la usa: enfermera, fisioterapeuta, médicos especialistas.
- Cuantos a la vez: 100.
- Nivel técnico: app que facilite el registro de la escala, debe ofrecer todas las escalas necesarias con sus distintos ítems, incluyendo aquellos que contengan imágenes como Mini Mental o MOCA. Debe interpretar el resultado y ofrecer plan de intervención según las guías aportadas. Seguimiento de los resultados mediante tabla con fecha y código del usuario que registró el dato, generación de gráfica de puntos para visualización de variaciones.
- Contexto de uso: pase de escalas a pie de cama y en consulta externa.

## 3. Requisitos no negociables
- Todo en local. Ningún dato de paciente sale del equipo ni de la red del centro.
- No usar servicios de datos en la nube, ni para almacenamiento ni para autenticación.
- Funciona en red local, varios PCs a la vez, con memoria compartida.
- Base de datos: JSON al inicio, diseñada para migrar a SQLite sin rehacer la app.
- Puente app-datos mediante Node.js.
- Copias de seguridad automáticas diarias en carpeta local.
- Toda propuesta automática requiere validación humana antes de tener efecto.

## 4. Funcionalidades de la versión 1
- Solicitará usuario y contraseña, serán los mismos que se usan para loguearse en la red del hospital.
- Datos del paciente: NHC y fecha de nacimiento. Fecha de registro. Localización: U3, U4, U8.
- Peso y estatura dentro de la pestaña morfofuncional.
- Registro de cada una de las escalas que podrá seleccionarse de un desplegable donde están agrupadas por dominio: morfofuncional, comorbilidades, fragilidad, cognitivo. Debe poder seleccionarse cada ítem dentro de la escala como si estuviésemos usándola en papel, con el mismo aspecto que las escalas ofrecen habitualmente, sobre todo aquellas que contienen imágenes como MMSE o MOCA.
- Interpretación de los resultados, clasificación.
- Creación de tabla de resultados agrupados y seguimiento que al clicar el ítem mostrará una gráfica de puntos.
- Exportación a Word y PDF de los resultados y las recomendaciones. Debe poder seleccionarse qué registro según fecha queremos descargar (porque podemos tener un registro previo, por ejemplo).
- Exportación a Excel y CSV de datos agregados y anonimizados.

## 5. Reglas de negocio
1. Se mostrará por defecto en la pantalla de introducción de datos la fecha de hoy, ofreciendo un calendario desplegable para seleccionar una distinta si se desea.
2. Interfaz tomando como paleta de color el logotipo de San Juan Grande: fondo blanco, letras en azul oscuro, pestañas en azul. Logotipo del hospital arriba a la derecha.
3. Nombre de la app arriba a la izquierda, debajo en letra pequeña y cursiva una frase que deje claro que es una herramienta de apoyo que no sustituye el juicio clínico.
4. Prioridad absoluta a la usabilidad y a la velocidad de introducción de datos. Nada de scroll infinito ni menús anidados.

## 6. Reglas de trabajo para la IA
- Planifica antes de ejecutar.
- No sobrescribas lo que ya funciona: construye sobre lo consolidado.
- No te pongas creativo ni regeneres módulos enteros sin pedirlo.
- Cada vez que una funcionalidad quede terminada y probada, haz un commit.
- Documenta en README.md cómo arrancar y usar la app, en lenguaje no técnico.
- Si una decisión tiene más de una opción razonable, pregunta antes de elegir.

## 10. Estado del proyecto
- [x] Documento maestro cerrado
- [ ] Modelo de datos definido
- [ ] Registro funcionando
- [ ] Seguimiento funcionando
- [ ] Cuadro de mando funcionando
- [ ] Exportaciones
- [ ] Probado con datos sintéticos
- [ ] Desplegado en red local

---

## Decisiones ya tomadas con Bea (no volver a preguntar)

1. **Repositorio**: este es un proyecto nuevo e independiente
   (`beaconesz-maker/vgi-`), separado de su web personal
   (`beatrizcontrerasgeriatra`) y separado también de la app genérica
   `VGI_.html` de un solo archivo (esa es otro producto: sin marca de
   hospital, sin servidor, para cualquier clínico en cualquier centro —
   ver `docs/VGI_GENERICO_CONTEXTO.md`). **Este repo es la versión
   específica de San Juan Grande**, con backend Node.js.
2. **Autenticación v1**: cuentas locales propias (usuario + contraseña
   con hash seguro) guardadas solo en la base de datos local de la app.
   No hay integración con el Active Directory/LDAP del hospital en esta
   versión — sería un paso posterior si el departamento de informática
   del hospital lo facilita. Un administrador local da de alta a los
   usuarios (ver `scripts/`).
3. **Vivifrail**: no ha sido posible acceder a vivifrail.es ni a
   vivifrail.com desde el entorno de desarrollo (bloqueado por la
   política de red del sandbox), tampoco a la guía del Ministerio de
   Sanidad ni a otras fuentes externas sobre Vivifrail. Los pasaportes
   A/B/C/D y sus puntos de corte de SPPB que usa la app son los que ya
   estaban validados en el prototipo `VGI_.html` de Bea (consistentes
   con el consenso Vivifrail/Ministerio de Sanidad 2022). Pendiente:
   cuando Bea tenga acceso, adjuntar el PDF oficial de las "ruedas de
   ejercicio" de cada pasaporte para enriquecer el detalle de
   ejercicios concretos; mientras tanto la app enlaza a vivifrail.com
   para que el clínico imprima la rueda oficial.
