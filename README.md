# Viajes — app de preparación y equipaje (PWA)

App web instalable para preparar viajes: listas con **items y subitems**, **estados** (pendiente de lavar, cargar, comprar, secar, listo), **cantidad objetivo / en maleta**, **plantillas** reutilizables, **trayectos** (tren, bus, vuelo…) y **avisos** antes del viaje y de cada trayecto. Todo se guarda en el dispositivo (localStorage), funciona **offline** y no necesita servidor ni tiendas de apps.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub (por ejemplo `viajes`).
2. Sube **todos** estos archivos a la raíz del repo (no dentro de una subcarpeta):
   ```
   index.html
   app.js
   styles.css
   manifest.webmanifest
   sw.js
   .nojekyll
   icons/icon-192.png
   icons/icon-512.png
   icons/icon-maskable-512.png
   ```
3. En el repo: **Settings → Pages → Build and deployment → Source: "Deploy from a branch"**, rama `main`, carpeta `/ (root)`. Guarda.
4. Espera 1–2 min. Tu app estará en `https://TU_USUARIO.github.io/viajes/`.

> Las rutas son relativas, así que funciona igual en la raíz del dominio o en una subcarpeta del repo.

## Instalar en el móvil (sin App Store / Play Store)

- **Android (Chrome):** abre la URL → menú ⋮ → **"Añadir a pantalla de inicio"** / **"Instalar app"**.
- **iPhone (Safari):** abre la URL → botón compartir → **"Añadir a pantalla de inicio"**.

Se abrirá a pantalla completa como una app normal.

## Avisos (importante)

- Activa los avisos desde la pestaña **Avisos** (pide permiso al navegador).
- La app comprueba los recordatorios **al abrirla** y **mientras está abierta** (cada minuto). Dispara el aviso de "2 días antes" / "1 día antes" del viaje si hay pendientes, y "1 día" / "1 hora antes" de cada trayecto.
- **Limitación real de la web:** las páginas web **no pueden** programar de forma fiable una notificación para que salte con la app totalmente cerrada (sobre todo en iPhone). Por eso el aviso salta cuando abres o tienes abierta la app dentro de la ventana de tiempo. Funciona mejor en Android con la app instalada.
- Si necesitaras avisos con la app cerrada al 100%, haría falta un pequeño servidor de *push* (Web Push con VAPID). Se puede añadir después; dímelo si lo quieres.

## Uso rápido

- **+ Nuevo viaje** → empezar desde cero o desde una plantilla.
- Dentro del viaje: pestaña **Listas** (añade listas, artículos, subartículos; ajusta estado y cantidades con los botones − / +) y pestaña **Trayectos**.
- El contador **"En maleta / objetivo"** calcula lo que falta. Al completar la cantidad, el estado pasa a **Listo** automáticamente.
- **Guardar como plantilla** reutiliza las listas del viaje (sin las cantidades ya metidas).
- Borra viajes, listas, artículos y plantillas con la **✕** / papelera.

## Estructura del código

- `index.html` — shell de la PWA y carga de fuentes/estilos.
- `app.js` — estado, almacenamiento, render de vistas, eventos y motor de avisos.
- `styles.css` — identidad visual (panel de salidas / billete de transporte).
- `sw.js` — service worker: caché offline y clic en notificaciones.
- `manifest.webmanifest` — metadatos de instalación.

Sin dependencias ni paso de compilación: es HTML/CSS/JS puro.
