# Mis Viajes — documentación técnica

App de gestión de viajes (listas de equipaje, plantillas, trayectos y avisos). Un **mismo código web** (HTML/JS/CSS, sin build) que funciona en dos formatos:

- **PWA** (iOS / escritorio) — se instala desde el navegador. **Sin notificaciones.**
- **APK Android** (envuelta con **Capacitor**) — app nativa con **notificaciones locales fiables**.

La APK **carga la web en vivo** (GitHub Pages) mediante `server.url`, así que **los cambios web se aplican a los dos formatos sin recompilar**. Solo hay que recompilar la APK si se toca la parte nativa (plugins).

## Estructura de archivos

```
Mis Viajes/
├── index.html, app.js, styles.css   # La app web (misma para PWA y APK)
├── sw.js                            # Service Worker: solo caché offline de la PWA
├── manifest.webmanifest             # Manifest de la PWA
├── icons/                           # Iconos de la PWA
├── capacitor.config.json            # Config de la APK (appId, appName, server.url)
├── package.json                     # Capacitor + plugins (local-notifications, app)
├── assets/icon.png                  # Icono fuente (1024px) para generar los de Android
└── .github/workflows/
    └── build-android.yml            # Compila la APK en la nube y la publica como artefacto
```

Carpetas generadas (no se suben, están en `.gitignore`): `node_modules/`, `android/`.

## Cómo funcionan los avisos

**Solo en la APK de Android**, mediante **notificaciones locales nativas** (plugin `@capacitor/local-notifications`). No hay servidor, ni push, ni FCM: el propio móvil programa los avisos y Android los dispara de forma fiable aunque la app esté cerrada.

En la **PWA (iOS/escritorio) no hay notificaciones**: la pestaña Avisos muestra un mensaje indicándolo.

### Lógica (en `app.js`)

- `isNative()` — detecta si corre dentro de la APK (Capacitor).
- `buildReminders()` — genera el calendario de avisos futuros según los **ajustes**: avisos de equipaje 2 días y/o 1 día antes de cada viaje (activables por separado), y un aviso de trayecto a la antelación elegida (30 min – 3 h, por defecto 1 h). Cada aviso es `{ id, title, body, sendAt }`.
- `enableNotifications()` — pide permiso (Android 13+) y guarda `viajes_notif = 'on'`.
- `syncReminders()` — cancela los avisos pendientes y reprograma todos los futuros con `LocalNotifications.schedule`.
- `scheduleReminderSync()` — versión con retardo (1,5 s); se llama al cambiar fechas o borrar/crear viajes y trayectos.
- Al abrir la app y al volver a ella (`visibilitychange`), se llama a `syncReminders()`.

Los ids de texto (`${legId}_1h`, etc.) se convierten a enteros con `notifNumericId()` porque Android exige id numérico.

## Puesta en marcha / compilar la APK

La APK se compila **en la nube** (no hace falta Android Studio local):

1. GitHub → pestaña **Actions → "Compilar APK Android" → Run workflow**.
2. Al terminar, en la ejecución, sección **Artifacts**, descargar **`MisViajes-apk`** → contiene `MisViajes.apk`.
3. Instalar en el móvil (permitir "instalar apps de origen desconocido").

El workflow: instala Node + JDK 17 + Android SDK, ejecuta `npx cap add android`, `npx cap sync`, genera los iconos con `@capacitor/assets` y compila con Gradle (`assembleDebug`).

> ⚠️ Firma: la APK se firma con la clave "debug", que **cambia entre compilaciones**. Por eso, al instalar una versión nueva puede pedir **desinstalar la anterior** (y se perderían los viajes guardados en esa APK). Para actualizaciones sin desinstalar, habría que firmar con una **clave fija** guardada como secreto en GitHub (pendiente).

## Cambios y despliegue

- **Cambios web** (listas, viajes, UI, textos): edita los archivos, sube a `main`. GitHub Pages redespliega la web y **tanto la PWA como la APK** los cogen (la APK carga la web en vivo). No hace falta recompilar la APK.
- **Cambios nativos** (plugins, permisos, icono, nombre): hay que **recompilar la APK** (Run workflow) y reinstalarla.
- Si cambias `sw.js`, sube el número de caché (`viajes-vN`) para que la PWA se actualice.

## Compatibilidad de notificaciones

| Plataforma | App | Notificaciones |
|---|---|---|
| Android | APK (Capacitor) | ✅ locales, fiables en segundo plano |
| iOS | PWA instalada | ❌ (decisión de diseño) |
| Escritorio | PWA | ❌ |

## Interacciones

- **Deslizar hacia abajo** desde arriba recalcula las cuentas atrás (`setupPullToRefresh()`); el refresco nativo del navegador se desactiva con `overscroll-behavior-y: contain`.
- **Borrar lista o artículo** muestra un toast con **Deshacer** (`toastUndo`) durante 5 s que restaura el elemento en su posición.
- **Android**: el gesto/botón **atrás** no cierra la app (plugin `@capacitor/app`); si hay una hoja abierta, la cierra. Requiere **recompilar la APK** (cambio nativo).

## Pantalla de Ajustes

La pestaña inferior **Ajustes** (`renderSettings()`) reúne:
- **Notificaciones** (solo Android): activar/desactivar y aviso de prueba.
- **Avisos de trayecto** (solo Android): antelación 30 min – 3 h.
- **Avisos de equipaje** (solo Android): activar 2 días / 1 día antes por separado.
- **Apariencia**: tema **claro** (por defecto) u **oscuro** (`body[data-theme="dark"]` en CSS; `applyTheme()` lo aplica al arrancar).
- **Copia de seguridad**: `exportData()` descarga un `.json` con todo (viajes, plantillas y ajustes) y lo copia al portapapeles; `importData()` restaura desde un `.json`.

## Modelo de datos (`localStorage`)

```js
// clave 'viajes_app_v1'
{
  trips: [{
    id, name, startDate, endDate,
    lists: [{ id, name, items: [{ id, name, qtyWanted, qtyDone, status }] }],  // 2 niveles: lista → artículo
    legs: [{ id, type, name, datetime }]
  }],
  templates: [{ id, name, lists }],
  settings: { theme, legLeadMin, packing2d, packing1d }   // se incluye al exportar/importar
}
// clave 'viajes_notif' → 'on' | 'off' (avisos activados en la APK)
```

Los datos son **locales por dispositivo** (no se sincronizan entre móviles).
