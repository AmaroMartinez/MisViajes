# Mis Viajes

App para **preparar viajes**: listas de equipaje, plantillas reutilizables, trayectos, datos del viaje y avisos. Los datos se guardan **en el dispositivo** (nada de cuentas ni servidores) y funciona **offline**.

Un mismo código funciona en dos formatos:

- **Android** — app nativa (APK) con **notificaciones fiables** (avisos aunque la app esté cerrada).
- **iOS / escritorio** — se instala como **PWA** desde el navegador. **Sin notificaciones** (limitación de la web en iOS).

Web en vivo: **https://amaromartinez.github.io/MisViajes/**

## Qué puedes hacer

- **Viajes** con fecha y hora de **salida** y **regreso**, y cuenta atrás. Los viajes pasados se agrupan aparte automáticamente.
- **Listas de equipaje** (lista → artículos) con **cantidad objetivo / en maleta** y **estado** (pendiente, lavar, secar, cargar, comprar, listo). Las listas se pliegan/despliegan.
- **Plantillas** reutilizables y **duplicar** un viaje entero.
- **Trayectos** (vuelo, tren, bus, coche, barco…) con fecha y hora.
- **Datos del viaje**: check-in (con hora de apertura), pares concepto/valor (nº de reserva, hotel…) y notas.
- **Avisos** (solo Android): 48 h y/o 24 h antes del viaje, X antes de cada trayecto (30 min–3 h), y 5 min antes de que abra el check-in.
- **Ajustes**: tema claro/oscuro/automático, opciones de avisos, **exportar/importar** copia de seguridad y borrar todos los datos.

## Instalar en Android (APK)

La app se distribuye como archivo `.apk` (no está en Play Store).

1. **Conseguir la APK:** en GitHub → pestaña **Actions → "Compilar APK Android" → Run workflow**. Al terminar, abre la ejecución y en **Artifacts** descarga **`MisViajes-apk`** (un zip con `MisViajes.apk` dentro). *(O pídele el `.apk` a quien ya lo tenga.)*
2. **Instalar:** pasa el `.apk` al móvil y ábrelo. Android pedirá permitir **"instalar apps de origen desconocido"** → acéptalo.
3. **Activar avisos:** abre la app → pestaña **Ajustes → Activar avisos** y concede el permiso.

> Al actualizar a una APK nueva puede pedir **desinstalar la anterior** (se firma en modo debug). Si tienes datos que no quieras perder, **exporta** antes desde Ajustes.

## Instalar en iOS / iPhone (PWA)

1. Abre **https://amaromartinez.github.io/MisViajes/** en **Safari**.
2. Botón **Compartir** → **"Añadir a pantalla de inicio"**.
3. Se abrirá a pantalla completa como una app.

> En iOS **no hay notificaciones** (es una limitación de las apps web). El resto de funciones van igual.

## Copia de seguridad

Tus datos son **locales de cada dispositivo** y no se sincronizan. Para no perderlos:

- **Ajustes → Exportar datos**: descarga un `.json` con todos los viajes, plantillas y ajustes.
- **Ajustes → Importar datos**: restaura desde un `.json` exportado.

## Para desarrolladores

Es HTML/CSS/JS puro (sin build) servido por GitHub Pages; la APK se genera con **Capacitor** y carga la web en vivo. Detalles técnicos, arquitectura y flujo de despliegue en [`CLAUDE.md`](CLAUDE.md).
