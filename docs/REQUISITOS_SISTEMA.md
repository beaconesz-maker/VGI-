# VGI+ — Requisitos del sistema y del servidor

Documento para el **departamento de informática** del Hospital San Juan
Grande: qué hace falta para instalar y mantener VGI+ en la red local del
centro, tal y como se diseñó con la Dra. Contreras (geriatra, encargo
original en `docs/DOCUMENTO_MAESTRO.md`).

Si algo de este documento no cuadra con la instalación real (versión de
Node.js disponible, política de red, etc.), es preferible adaptarlo aquí
antes de tocar el código de la app.

## 1. Resumen de la arquitectura en una frase

**Un único proceso Node.js** corre en un ordenador del hospital (el
"servidor"), sirve una página web y una API por un solo puerto TCP, y
guarda los datos en archivos en su propio disco. El resto de ordenadores
de la red **no instalan nada**: acceden con un navegador normal, igual que
a cualquier página web interna.

```
PC servidor (Node.js, puerto 3000)
   ├── data/*.json         ← todos los datos de pacientes, en local
   ├── backups/AAAA-MM-DD/ ← copia diaria automática, 30 días
   └── (proceso "node server/index.js" escuchando en la red local)
            ▲
            │ HTTP, mismo puerto, dentro de la red del centro
            │
   PC enfermería, PC consulta, PC planta... (solo necesitan un navegador)
```

No hay ninguna llamada a internet en tiempo de ejecución, ninguna base de
datos externa, ningún servicio en la nube. Es el requisito no negociable
del encargo original (sección 3 de `docs/DOCUMENTO_MAESTRO.md`).

## 2. Requisitos del ordenador "servidor"

No hace falta hardware especial: cualquier PC o servidor virtual del
hospital que pueda quedar encendido y conectado a la red durante el
horario de uso sirve.

| | Mínimo | Recomendado |
|---|---|---|
| CPU | 2 núcleos | 2-4 núcleos |
| RAM | 1 GB libre | 2 GB libre |
| Disco | 500 MB libres | 2 GB libres (margen para backups a medio plazo) |
| Sistema operativo | Windows 10/11, Windows Server 2016+, o Linux (cualquier distribución con Node.js empaquetado) | el que ya use el hospital para otros servicios internos |
| Red | Un puerto TCP libre (por defecto el 3000) accesible desde los PCs clientes dentro de la red del centro | — |

Los requisitos son bajos porque la app no tiene base de datos aparte
(motor propio en JSON, ver §5) ni hace ningún procesamiento pesado: la
carga esperada son formularios cortos y generación puntual de documentos
Word/PDF, no vídeo ni cálculo intensivo. El diseño está pensado y probado
para **hasta 100 usuarios conectados a la vez** (encargo original, sección
2), que es un tráfico modesto para cualquier PC de oficina actual.

### Software que hay que instalar en el servidor

- **Node.js, versión 18 o superior** (recomendado: la última LTS
  disponible — en el momento de escribir esto, Node.js 20 o 22). Es el
  único requisito de software del sistema operativo. Descarga oficial:
  https://nodejs.org (elegir la versión "LTS").
- Nada más. No hace falta instalar SQL Server, MySQL, PostgreSQL, Redis,
  IIS, Apache, ni ningún runtime adicional. `npm` (el gestor de paquetes
  de Node) se instala junto con Node.js automáticamente.

### Los PCs cliente (resto de la red)

No necesitan instalar nada. Solo un navegador moderno ya instalado en
cualquier PC de oficina actual: Chrome, Edge o Firefox (versiones de los
últimos ~3 años). No hace falta configurar nada en el cliente salvo saber
la dirección `http://<ip-del-servidor>:3000`.

## 3. Instalación (una sola vez)

```bash
# 1. Copiar la carpeta del proyecto al PC servidor
# 2. Dentro de esa carpeta:
npm install          # descarga las dependencias (única vez que hace
                      # falta internet — ver nota más abajo)
npm run seed:admin    # da de alta el primer usuario administrador
                      # (pide usuario, nombre, rol y contraseña por consola)
npm start             # arranca el servidor
```

Al arrancar debería verse:
```
[VGI+] Servidor escuchando en http://localhost:3000
```

**Nota sobre internet**: `npm install` descarga del registro público de
npm unas pocas dependencias (Express, docx, exceljs, pdfkit, bcryptjs —
ver tabla en §6), en total unos 70-80 MB. Es el **único momento** en que
la app necesita salir a internet. Si el PC servidor no tiene salida a
internet por política del hospital, hay dos opciones:
1. Ejecutar `npm install` una vez en cualquier otro PC con internet (no
   tiene que ser el servidor final) y copiar la carpeta `node_modules/`
   resultante junto con el resto del proyecto al servidor real.
2. Usar un servidor proxy/caché interno de npm si el hospital ya tiene
   uno para otras aplicaciones internas.

Después de este paso, la app funciona **completamente sin internet**, de
forma indefinida.

## 4. Mantener el servidor arrancado (servicio persistente)

`npm start` deja el proceso corriendo en la terminal donde se lanzó; si
esa terminal se cierra o el PC se reinicia, el servidor se para. Para uso
real en producción conviene que el departamento de informática lo
registre como **servicio del sistema operativo**, para que arranque solo
y se reinicie si falla. Tres formas habituales, de más a menos sencilla:

**Opción A — PM2 (recomendada, multiplataforma, no requiere privilegios de sistema)**
```bash
npm install -g pm2
pm2 start server/index.js --name vgiplus
pm2 save
pm2 startup   # imprime el comando exacto para que arranque con el sistema operativo
```

**Opción B — Windows Server / Windows 10-11, como servicio nativo**
Usar [NSSM](https://nssm.cc/) (Non-Sucking Service Manager), gratuito:
```
nssm install VGIPlus "C:\Program Files\nodejs\node.exe" "C:\ruta\al\proyecto\server\index.js"
nssm set VGIPlus AppDirectory "C:\ruta\al\proyecto"
nssm start VGIPlus
```

**Opción C — Linux, `systemd`**
Crear `/etc/systemd/system/vgiplus.service`:
```ini
[Unit]
Description=VGI+ - Valoracion Geriatrica Integral (San Juan Grande)
After=network.target

[Service]
Type=simple
WorkingDirectory=/ruta/al/proyecto
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
Environment=NODE_ENV=production
# Environment=SESSION_SECRET=<valor aleatorio largo, ver §7>
# Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```
```bash
systemctl daemon-reload
systemctl enable --now vgiplus
```

Cualquiera de las tres opciones vale; la elección depende de qué usa ya el
hospital para otros servicios internos similares.

## 5. Datos, almacenamiento y copias de seguridad

- Los datos viven en `data/*.json` dentro de la propia carpeta del
  proyecto, en el disco del servidor — nunca salen de ahí. No hay
  servidor de base de datos aparte que instalar ni mantener.
- **Copia de seguridad automática**: la app copia `data/*.json` a
  `backups/AAAA-MM-DD/` una vez al día (se comprueba al arrancar y cada
  hora), conservando los últimos 30 días; las carpetas más antiguas se
  borran solas. No requiere ninguna tarea programada externa.
- **Recomendación para informática**: aunque la app ya hace su propia
  copia diaria, esa copia vive en el mismo disco que los datos originales
  — no protege frente a un fallo del propio disco o del equipo. Se
  recomienda incluir la carpeta `backups/` (o directamente todo
  `data/` + `backups/`) en la política de copia de seguridad habitual del
  hospital (por ejemplo, réplica nocturna a una cabina de red o al
  sistema de backup corporativo), igual que con cualquier otro servicio
  interno crítico.
- **Volumen de datos esperado**: cada registro de una escala ocupa del
  orden de 0,5 KB en JSON. Incluso con varios miles de pacientes y varias
  valoraciones al año por paciente, el crecimiento anual se espera del
  orden de unos pocos MB a bajas decenas de MB — no supone un problema de
  capacidad con los discos actuales. Esta es una estimación de orden de
  magnitud, no una medición real; si el hospital quiere una cifra más
  precisa conviene revisarla pasados los primeros meses de uso real.
- **Restaurar una copia**: parar el servicio, sustituir el contenido de
  `data/` por el de la carpeta de `backups/AAAA-MM-DD/` que se quiera
  restaurar, arrancar el servicio de nuevo.

## 6. Dependencias de software (lista cerrada)

Todas son librerías JavaScript puras (sin componentes nativos que
compilar), lo que simplifica la instalación en PCs de hospital sin
herramientas de desarrollo:

| Paquete | Para qué |
|---|---|
| `express` | servidor web / API |
| `express-session` | sesión de usuario (cookie), en memoria del proceso |
| `bcryptjs` | contraseñas con hash seguro (sin dependencias nativas) |
| `docx` | generación de informes y planes en Word |
| `pdfkit` | generación de informes y planes en PDF |
| `exceljs` | exportación agregada en Excel |

No hay frameworks de frontend (React, Angular...) ni herramientas de
compilación (webpack, etc.) — el frontend es HTML/CSS/JS servido tal cual,
lo que también simplifica el mantenimiento a largo plazo.

## 7. Seguridad — puntos que debe revisar informática

- **Red cerrada**: la app está pensada para funcionar **solo dentro de la
  red local del hospital**, nunca expuesta a internet. Confirmar que el
  firewall del centro no publica el puerto 3000 (ni el que se elija) hacia
  el exterior.
- **`SESSION_SECRET`**: el servidor firma las cookies de sesión con un
  valor por defecto de desarrollo si no se indica otro. **Antes de poner
  en producción**, definir la variable de entorno `SESSION_SECRET` con un
  valor aleatorio largo propio del hospital (por ejemplo, generado con
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  y guardado igual que cualquier otro secreto de aplicación interna).
- **HTTPS**: por defecto la app sirve HTTP simple dentro de la red local
  (igual que muchas otras herramientas internas de hospital). Si el
  departamento de informática quiere cifrar también el tráfico dentro de
  la LAN, lo habitual es poner un proxy inverso (IIS, nginx o similar) con
  certificado interno delante del puerto de Node, y activar la opción
  `cookie.secure` en `server/index.js` (ya está señalada con un
  comentario en el propio código, es un cambio de una línea).
- **Cuentas de usuario**: son cuentas propias de la aplicación (usuario +
  contraseña con hash bcrypt), **no** están conectadas al Active
  Directory/LDAP del hospital en esta versión — decisión explícita del
  encargo original, ver `docs/DOCUMENTO_MAESTRO.md`. Un administrador da
  de alta cada cuenta ejecutando `npm run seed:admin` en el propio
  servidor (requiere acceso a esa máquina, por consola o escritorio
  remoto). **No hay todavía** una pantalla dentro de la app para que un
  admin dé de alta o desactive usuarios sin tocar el servidor — es una
  limitación conocida, señalada aquí para que informática sepa que dar de
  alta a cada profesional nuevo implica ese paso manual en el servidor (o
  pedir que se añada una pantalla de gestión de usuarios más adelante).
- **Login sin límite de intentos**: en esta versión no hay bloqueo tras
  varios intentos fallidos de contraseña. Al ser una red cerrada del
  hospital se ha considerado un riesgo asumible por ahora, pero es un
  punto a valorar por informática si lo prefieren reforzado.

## 8. Actualizar la app a una versión nueva

Cuando haya una versión nueva del código (por ejemplo, tras pedir un
cambio):
```bash
# con el servicio parado, o aceptando una breve interrupción:
git pull                # o sustituir los archivos del proyecto por los nuevos
npm install              # solo hace falta si cambiaron las dependencias
# reiniciar el servicio (pm2 restart vgiplus / nssm restart / systemctl restart vgiplus)
```
Los datos de `data/` no se tocan al actualizar el código — viven aparte.

## 9. Contacto / mantenimiento del código

El código y su documentación técnica completa están en el repositorio
(`docs/API_CONTRACT.md`, `docs/SCALES_CONTRACT.md`, `CLAUDE.md`). Este
documento es el resumen operativo pensado para decidir la instalación;
para dudas sobre el propio código, la Dra. Contreras es quien mantiene el
encargo funcional del proyecto.
