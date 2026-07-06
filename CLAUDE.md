# Mis Viajes — documentación técnica

PWA de gestión de viajes (listas de equipaje, trayectos y avisos). Sin framework ni paso de build: HTML + CSS + JS puros. Datos en `localStorage`.

Los avisos con la app cerrada se envían **sin servidor propio**: un workflow de **GitHub Actions** se despierta cada 5 minutos y manda las notificaciones push que toquen.

## Estructura de archivos

```
Mis Viajes/
├── index.html                  # Shell de la app
├── app.js                      # Lógica: store, render, eventos, notificaciones, push
├── styles.css                  # Estilos (tema oscuro, mobile-first)
├── sw.js                       # Service Worker: caché offline + listener 'push'
├── manifest.webmanifest
├── icons/
├── notifier/                   # Lo ejecuta GitHub Actions (NO es un servidor encendido)
│   ├── send.js                 # Lee suscripciones, envía los push que tocan
│   ├── generate-keys.js        # Genera las claves VAPID (una sola vez)
│   ├── package.json
│   └── sent.json               # Registro de avisos ya enviados (lo actualiza el workflow)
├── subscriptions/              # Un .json por dispositivo (los crea la app automáticamente)
│   └── .gitkeep
└── .github/workflows/
    └── send-notifications.yml  # cron cada 5 min + envío + commit del estado
```

## Cómo funcionan los avisos

### Con la app abierta (sin nada más)

`checkReminders()` en `app.js` corre al arrancar y cada 60 s (`setInterval`). Comprueba fechas en `localStorage` y muestra notificaciones locales vía la API `Notification`.

### Con la app cerrada (GitHub Actions)

```
App (app.js)                         GitHub                        Google/Apple (FCM/APNs)
    │                                  │                                    │
    │ 1. al activar / cambiar fechas:  │                                    │
    │    escribe su suscripción +      │                                    │
    │    calendario en el repo ───────▶│  subscriptions/<deviceId>.json     │
    │    (API de GitHub, con token)    │                                    │
    │                                  │ 2. cron cada 5 min:                │
    │                                  │    notifier/send.js lee los .json  │
    │                                  │    ¿algún aviso vencido? ─────push─▶│
    │                                  │                                    │──▶ 🔔 dispositivo
    │                                  │ 3. marca el aviso como enviado     │
    │                                  │    (sent.json) y hace commit       │
```

- **`buildPushSchedule()`** (en `app.js`) genera el calendario: avisos 2 días y 1 día antes de cada viaje, y 1 día / 1 hora antes de cada trayecto. Solo incluye avisos futuros.
- Cada elemento es `{ id, title, body, sendAt }`, con `sendAt` = timestamp Unix (ms).
- **`send.js`** compara `sendAt` con la hora actual, envía los vencidos y los apunta en `sent.json` como `id@sendAt` para no repetirlos.
- Si una suscripción caduca (respuesta 410/404), `send.js` borra su fichero automáticamente.

### Sincronización del calendario

`syncPushSchedule()` (con retardo de 2,5 s) reescribe el fichero del dispositivo en el repo cuando:
- Cambia la fecha de salida de un viaje
- Cambia la fecha/hora de un trayecto
- Se borra o se crea un viaje o trayecto

## Puesta en marcha (una sola vez)

### 1. Generar las claves VAPID

Son el "DNI" del sistema de avisos. Se generan una vez y se reutilizan siempre.

```bash
cd notifier
npm install
npm run keys
```

Te imprime `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`. Guárdalas.

### 2. Configurar `app.js`

En la parte superior de `app.js`, rellena:

```js
const GITHUB_OWNER = 'tu-usuario';     // usuario u organización de GitHub
const GITHUB_REPO = 'mis-viajes';      // nombre del repositorio
const VAPID_PUBLIC_KEY = 'BNc4...';    // la clave PÚBLICA del paso 1
```

La clave **privada NO** va aquí (sería visible desde el móvil).

### 3. Subir el proyecto a GitHub

Crea un repositorio (**recomendado: privado**) y sube todos los archivos. GitHub Pages puede servir la app (`index.html`), y GitHub Actions ejecutará el workflow.

### 4. Guardar las claves como Secrets del repositorio

En GitHub: repositorio → **Settings → Secrets and variables → Actions → New repository secret**. Crea tres:

| Secret | Valor |
|---|---|
| `VAPID_PUBLIC_KEY` | la clave pública |
| `VAPID_PRIVATE_KEY` | la clave privada |
| `VAPID_EMAIL` | tu email (formato de contacto que exige el estándar) |

### 5. Crear un token de acceso (para que la app escriba en el repo)

La app necesita permiso para guardar su suscripción en el repo. En GitHub:

**Settings (de tu cuenta) → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
- Repository access: **Only select repositories** → elige el repo de la app
- Permissions → Repository permissions → **Contents: Read and write**
- Genera y copia el token (empieza por `github_pat_...`)

### 6. Activar los avisos en cada dispositivo

En la app instalada (PWA), abre **Avisos** (barra inferior) y:
1. **Activar avisos** → concede el permiso del navegador.
2. **Conectar con GitHub (una vez)** → pega el token del paso 5.

A partir de ahí el dispositivo queda registrado. Repite este paso 6 en cada móvil (el tuyo y el de tus familiares). El token puede ser el mismo para todos o uno por persona.

## Seguridad del token

- El token se guarda **solo en el dispositivo** (`localStorage`), nunca en el código ni en el repo.
- Usa un token **fine-grained** limitado a **un solo repositorio** y a **Contents: write**. Así, en el peor caso, solo permitiría tocar ese repo.
- Se recomienda que el repositorio sea **privado**.
- Botón "Olvidar token de GitHub" en Avisos para borrarlo del dispositivo.

## Compatibilidad

| Plataforma | App abierta | App cerrada |
|---|---|---|
| Android (Chrome, PWA instalada) | ✅ | ✅ |
| iOS 16.4+ (Safari, PWA instalada) | ✅ | ✅ |
| iOS < 16.4 | ✅ | ❌ |
| Desktop (Chrome/Edge) | ✅ | ✅ |

**Requisito iOS**: la PWA debe estar añadida a la pantalla de inicio.

**Precisión**: el cron de GitHub Actions se ejecuta cada 5 min y puede retrasarse unos minutos si GitHub está ocupado. Para avisos tipo "faltan 2 días" o "tren en 1 hora" es más que suficiente. No esperes precisión al minuto exacto.

## Modelo de datos

### En el dispositivo (`localStorage`)

```js
// clave 'viajes_app_v1'
{
  trips: [{
    id, name, startDate, endDate,
    notified2d, notified1d,   // flags del motor local (checkReminders)
    lists: [{ id, name, items: [{ id, name, qtyWanted, qtyDone, status }] }],  // 2 niveles: lista → artículo
    legs: [{ id, type, name, datetime, notified1d, notified1h }]
  }],
  templates: [{ id, name, lists }]
}
// clave 'viajes_device_id' → id único del dispositivo
// clave 'viajes_gh_token'  → token de GitHub (solo en este dispositivo)
```

### En el repo (`subscriptions/<deviceId>.json`)

```js
{
  subscription: { endpoint, keys: { p256dh, auth } },  // suscripción push del navegador
  schedule: [{ id, title, body, sendAt }],             // avisos futuros
  updatedAt: 1234567890
}
```

Los flags `notifiedXx` son solo para el motor local. El estado de "ya enviado" del segundo plano lo lleva `notifier/sent.json` en el repo.
