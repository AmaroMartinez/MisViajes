/* ============================================================
   Viajes — app de pre-viaje y equipaje (PWA sin build)
   Datos en localStorage. Todo editable, sin servidor.
   ============================================================ */

/* Los avisos son notificaciones locales nativas y solo existen en la app de Android
   (Capacitor). En la PWA (iOS/escritorio) no hay notificaciones. Ver CLAUDE.md. */

'use strict';

/* ---------- Utilidades ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const clampInt = (n) => Math.max(0, Math.floor(Number(n) || 0));

/* ---------- Estados posibles de un artículo ---------- */
const STATUSES = [
  { id: 'pending',   label: 'Pendiente',            short: 'Pend.' },
  { id: 'to_wash',   label: 'Pendiente de lavar',   short: 'Lavar' },
  { id: 'to_dry',    label: 'Pendiente de secar',   short: 'Secar' },
  { id: 'to_charge', label: 'Pendiente de cargar',  short: 'Cargar' },
  { id: 'to_buy',    label: 'Pendiente de comprar', short: 'Comprar' },
  { id: 'ready',     label: 'Listo',                short: 'Listo' },
];
const statusLabel = (id) => (STATUSES.find((s) => s.id === id) || STATUSES[0]).label;

/* Tipos de trayecto */
const LEG_TYPES = [
  { id: 'flight', label: 'Vuelo',   icon: '✈' },
  { id: 'train',  label: 'Tren',    icon: '▤' },
  { id: 'bus',    label: 'Bus',     icon: '▮' },
  { id: 'car',    label: 'Coche',   icon: '◉' },
  { id: 'boat',   label: 'Barco',   icon: '⚓' },
  { id: 'other',  label: 'Otro',    icon: '•' },
];
const legType = (id) => LEG_TYPES.find((t) => t.id === id) || LEG_TYPES[5];

/* ---------- Almacenamiento ---------- */
const KEY = 'viajes_app_v1';
const store = {
  data: { trips: [], templates: [] },
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = JSON.parse(raw);
    } catch (e) { /* datos corruptos: empezamos limpios */ }
    if (!this.data.trips) this.data.trips = [];
    if (!this.data.templates) this.data.templates = [];
    // Ajustes con valores por defecto (se conservan al exportar/importar)
    this.data.settings = Object.assign(
      { theme: 'light', legLeadMin: 60, packing2d: true, packing1d: true },
      this.data.settings || {}
    );
    this.migrate();
    if (this.data.templates.length === 0) this.seedTemplates();
  },
  save() {
    localStorage.setItem(KEY, JSON.stringify(this.data));
  },
  // Aplana el antiguo 3er nivel: los subartículos pasan a ser artículos de la lista.
  // El artículo que solo servía de contenedor se descarta. Idempotente (seguro en cada carga).
  migrate() {
    const flatten = (lists) => (lists || []).map((l) => {
      const items = [];
      for (const it of (l.items || [])) {
        if ((it.subitems || []).length) {
          for (const s of it.subitems) {
            items.push({ id: s.id || uid(), name: s.name, qtyWanted: s.qtyWanted, qtyDone: s.qtyDone, status: s.status });
          }
        } else {
          items.push({ id: it.id, name: it.name, qtyWanted: it.qtyWanted, qtyDone: it.qtyDone, status: it.status });
        }
      }
      return { id: l.id, name: l.name, items };
    });
    for (const t of this.data.trips) {
      t.lists = flatten(t.lists);
      // Salida y regreso ahora llevan hora: fechas antiguas (solo día) → salida 00:00, regreso 23:59
      if (t.startDate && /^\d{4}-\d{2}-\d{2}$/.test(t.startDate)) t.startDate += 'T00:00';
      if (t.endDate && /^\d{4}-\d{2}-\d{2}$/.test(t.endDate)) t.endDate += 'T23:59';
    }
    for (const t of this.data.templates) t.lists = flatten(t.lists);
  },
  seedTemplates() {
    // Plantilla de ejemplo para arrancar (editable/borrable)
    this.data.templates.push({
      id: uid(),
      name: 'Viaje largo (avión)',
      lists: [
        { id: uid(), name: 'Ropa Maleta', items: [
          { id: uid(), name: 'Camisetas', qtyWanted: 6, qtyDone: 0, status: 'to_wash' },
          { id: uid(), name: 'Pantalones', qtyWanted: 3, qtyDone: 0, status: 'pending' },
          { id: uid(), name: 'Ropa interior', qtyWanted: 8, qtyDone: 0, status: 'to_wash' },
          { id: uid(), name: 'Calzado', qtyWanted: 2, qtyDone: 0, status: 'pending' },
        ]},
        { id: uid(), name: 'Neceser Maleta', items: [
          { id: uid(), name: 'Cepillo de dientes', qtyWanted: 1, qtyDone: 0, status: 'pending' },
          { id: uid(), name: 'Pasta de dientes', qtyWanted: 1, qtyDone: 0, status: 'to_buy' },
        ]},
        { id: uid(), name: 'Mochila (mano)', items: [
          { id: uid(), name: 'Móvil', qtyWanted: 1, qtyDone: 0, status: 'to_charge' },
          { id: uid(), name: 'Powerbank', qtyWanted: 1, qtyDone: 0, status: 'to_charge' },
          { id: uid(), name: 'Pasaporte', qtyWanted: 1, qtyDone: 0, status: 'pending' },
          { id: uid(), name: 'Adaptador de enchufe', qtyWanted: 1, qtyDone: 0, status: 'to_buy' },
        ]},
      ],
    });
    this.save();
  },
};

/* ---------- Constructores de datos ---------- */
function newItem(name = '') {
  return { id: uid(), name, qtyWanted: 1, qtyDone: 0, status: 'pending' };
}
function newList(name = 'Nueva lista') {
  return { id: uid(), name, items: [] };
}
// Copia profunda de listas (para clonar plantillas) reseteando cantidades introducidas
function cloneLists(lists, reset = true) {
  return lists.map((l) => ({
    id: uid(),
    name: l.name,
    items: (l.items || []).map((it) => ({
      id: uid(),
      name: it.name,
      qtyWanted: it.qtyWanted,
      qtyDone: reset ? 0 : it.qtyDone,
      status: it.status,
    })),
  }));
}

/* ---------- Cálculo de pendientes ---------- */
// Un artículo está pendiente si faltan unidades por meter o el estado no es "listo".
function nodePending(n) {
  const missing = clampInt(n.qtyWanted) - clampInt(n.qtyDone);
  return missing > 0 || n.status !== 'ready';
}
function tripPendingCount(trip) {
  let count = 0;
  for (const l of trip.lists) for (const it of l.items) if (nodePending(it)) count++;
  return count;
}
function tripTotalCount(trip) {
  let count = 0;
  for (const l of trip.lists) count += l.items.length;
  return count;
}

/* ---------- Fechas ---------- */
const DAY = 86400000, HOUR = 3600000;
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
// Interpreta "YYYY-MM-DD" como hora local (no UTC); deja datetime-local tal cual.
function toLocalDate(iso) {
  return new Date(/T/.test(iso) ? iso : iso + 'T00:00:00');
}
// Cuenta atrás legible hasta una fecha. Si se pasa endIso (regreso), al haber empezado
// distingue "EN CURSO" (aún dentro del viaje) de "PASADO" (después del regreso).
function countdown(iso, endIso) {
  if (!iso) return { text: 'SIN FECHA', past: false };
  const now = Date.now();
  const ms = toLocalDate(iso).getTime() - now;
  if (ms > 0) {
    const d = Math.floor(ms / DAY);
    const h = Math.floor((ms % DAY) / HOUR);
    const m = Math.floor((ms % HOUR) / 60000);
    if (d > 0) return { text: `${d}D ${String(h).padStart(2, '0')}H ${String(m).padStart(2, '0')}M`, past: false };
    if (h > 0) return { text: `${h}H ${String(m).padStart(2, '0')}M`, past: false };
    return { text: `${m}M`, past: false };
  }
  // Ya ha empezado. Con fecha+hora de regreso distinguimos en curso (hasta ese momento) de pasado.
  if (endIso) {
    if (now < toLocalDate(endIso).getTime()) return { text: 'EN CURSO', past: false };
    return { text: 'PASADO', past: true };
  }
  return { text: 'EN CURSO / PASADO', past: true };
}

/* ============================================================
   ROUTER / ESTADO DE VISTA
   ============================================================ */
const view = { name: 'home', tripId: null, templateId: null, tab: 'lists' };
const app = $('#app');

function go(name, opts = {}) {
  Object.assign(view, { tripId: null, templateId: null }, opts, { name });
  render();
  window.scrollTo(0, 0);
}
function currentTrip() { return store.data.trips.find((t) => t.id === view.tripId); }
function currentTemplate() { return store.data.templates.find((t) => t.id === view.templateId); }

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  if (view.name === 'trip' && !currentTrip()) view.name = 'home';
  if (view.name === 'template' && !currentTemplate()) view.name = 'templates';

  let html = '';
  if (view.name === 'home') html = renderHome();
  else if (view.name === 'templates') html = renderTemplates();
  else if (view.name === 'template') html = renderTemplateEditor();
  else if (view.name === 'trip') html = renderTrip();
  else if (view.name === 'settings') html = renderSettings();
  app.innerHTML = html;
  bindDynamic();
}

/* ---------- Cabecera / navegación inferior ---------- */
function bottomNav(active) {
  const item = (id, label, icon) =>
    `<button class="nav-item ${active === id ? 'is-active' : ''}" data-nav="${id}">
       <span class="nav-ico">${icon}</span><span>${label}</span>
     </button>`;
  return `<nav class="bottomnav">
    ${item('home', 'Viajes', '✈')}
    ${item('templates', 'Plantillas', '❑')}
    ${item('settings', 'Ajustes', '⚙')}
  </nav>`;
}

/* ---------- HOME: lista de viajes ---------- */
function renderHome() {
  const trips = [...store.data.trips].sort((a, b) =>
    (a.startDate || '9999').localeCompare(b.startDate || '9999'));

  const cards = trips.map((t) => {
    const cd = countdown(t.startDate, t.endDate);
    const pend = tripPendingCount(t);
    const total = tripTotalCount(t);
    return `<button class="trip-card" data-open-trip="${t.id}">
      <div class="board">
        <div class="board-row">
          <span class="board-label">DESTINO</span>
          <span class="board-dest">${esc(t.name || 'Sin nombre')}</span>
        </div>
        <div class="board-row">
          <span class="board-label">SALIDA</span>
          <span class="board-mono">${t.startDate ? fmtDateTime(t.startDate).toUpperCase() : '— — —'}</span>
        </div>
        <div class="board-row">
          <span class="board-label">CUENTA ATRÁS</span>
          <span class="board-count ${cd.past ? 'past' : ''}">${cd.text}</span>
        </div>
      </div>
      <div class="trip-foot">
        <span class="pill ${pend ? 'warn' : 'ok'}">${pend ? pend + ' pendientes' : 'Todo listo'}</span>
        <span class="muted">${total} artículos · ${t.legs?.length || 0} trayectos</span>
      </div>
    </button>`;
  }).join('');

  const empty = `<div class="empty">
      <p class="empty-title">Aún no hay viajes</p>
      <p class="muted">Crea tu primer viaje para preparar listas y trayectos.</p>
    </div>`;

  return `
  <header class="topbar">
    <div class="brand"><span class="brand-mark">◑</span> Mis Viajes</div>
    <button class="btn btn-primary" data-new-trip>+ Nuevo viaje</button>
  </header>
  <main class="wrap">
    ${trips.length ? `<div class="grid">${cards}</div>` : empty}
  </main>
  ${bottomNav('home')}`;
}

/* ---------- PLANTILLAS ---------- */
function renderTemplates() {
  const cards = store.data.templates.map((t) => `
    <div class="tpl-card">
      <button class="tpl-open" data-open-tpl="${t.id}">
        <span class="tpl-name">${esc(t.name)}</span>
        <span class="muted">${t.lists.length} listas</span>
      </button>
      <button class="icon-btn danger" data-del-tpl="${t.id}" title="Borrar plantilla">✕</button>
    </div>`).join('');

  return `
  <header class="topbar">
    <div class="brand"><span class="brand-mark">◑</span> Mis Viajes</div>
    <button class="btn btn-primary" data-new-tpl>+ Nueva plantilla</button>
  </header>
  <main class="wrap">
    <p class="muted intro">Guarda listas base y reutilízalas al crear un viaje. Empieza desde cero o desde una plantilla.</p>
    ${store.data.templates.length ? `<div class="stack">${cards}</div>`
      : `<div class="empty"><p class="empty-title">Sin plantillas</p><p class="muted">Crea una o guarda un viaje como plantilla desde su pantalla.</p></div>`}
  </main>
  ${bottomNav('templates')}`;
}

function renderTemplateEditor() {
  const t = currentTemplate();
  return `
  <header class="topbar">
    <button class="btn ghost" data-nav="templates">‹ Plantillas</button>
    <div class="topbar-title">Editar plantilla</div>
    <span></span>
  </header>
  <main class="wrap">
    <label class="field">
      <span class="field-label">Nombre de la plantilla</span>
      <input class="input" data-tpl-name value="${esc(t.name)}" placeholder="p. ej. Escapada fin de semana">
    </label>
    ${renderListsBlock(t.lists, { context: 'template' })}
    <button class="btn wide" data-add-list-tpl>+ Añadir lista</button>
  </main>
  ${bottomNav('templates')}`;
}

/* ---------- VIAJE ---------- */
function renderTrip() {
  const t = currentTrip();
  const cd = countdown(t.startDate, t.endDate);
  const pend = tripPendingCount(t);

  const header = `
  <div class="trip-board">
    <div class="tb-row"><span class="tb-label">DESTINO</span>
      <input class="tb-dest" data-trip-name value="${esc(t.name)}" placeholder="¿A dónde vas?"></div>
    <div class="tb-dates">
      <label class="tb-date"><span>SALIDA</span>
        <input type="datetime-local" data-trip-start value="${t.startDate || ''}"></label>
      <label class="tb-date"><span>REGRESO</span>
        <input type="datetime-local" data-trip-end value="${t.endDate || ''}"></label>
    </div>
    <div class="tb-count ${cd.past ? 'past' : ''}">${cd.text}</div>
    <div class="tb-status">${pend ? `<span class="pill warn">${pend} pendientes</span>` : `<span class="pill ok">Todo listo</span>`}</div>
  </div>`;

  const tabs = `
  <div class="tabs">
    <button class="tab ${view.tab === 'lists' ? 'is-active' : ''}" data-tab="lists">Listas</button>
    <button class="tab ${view.tab === 'legs' ? 'is-active' : ''}" data-tab="legs">Trayectos</button>
  </div>`;

  let body = '';
  if (view.tab === 'lists') {
    body = `${renderListsBlock(t.lists, { context: 'trip' })}
      <button class="btn wide" data-add-list>+ Añadir lista</button>`;
  } else {
    body = renderLegs(t);
  }

  return `
  <header class="topbar">
    <button class="btn ghost" data-nav="home">‹ Viajes</button>
    <div class="topbar-actions">
      <button class="btn ghost small" data-save-as-tpl>Guardar como plantilla</button>
      <button class="icon-btn danger" data-del-trip="${t.id}" title="Borrar viaje">🗑</button>
    </div>
  </header>
  <main class="wrap">
    ${header}
    ${tabs}
    ${body}
  </main>
  ${bottomNav('home')}`;
}

/* ---------- Bloque de listas (compartido viaje/plantilla) ---------- */
function renderListsBlock(lists, { context }) {
  if (!lists.length) {
    return `<div class="empty small"><p class="muted">Sin listas todavía.</p></div>`;
  }
  return lists.map((l) => {
    const pend = context === 'trip' ? l.items.filter(nodePending).length : 0;
    return `<section class="list-card" data-list="${l.id}">
      <div class="list-head">
        <input class="list-title" data-list-name="${l.id}" value="${esc(l.name)}" placeholder="Nombre de la lista">
        ${context === 'trip' && pend ? `<span class="pill warn tiny">${pend}</span>` : ''}
        <button class="icon-btn danger" data-del-list="${l.id}" title="Borrar lista">✕</button>
      </div>
      <div class="items">
        ${l.items.map((it) => renderItem(l.id, it, context)).join('')}
      </div>
      <button class="btn ghost small add-item" data-add-item="${l.id}">+ Artículo</button>
    </section>`;
  }).join('');
}

function statusChip(node, kind, ids) {
  const attr = `data-status-${kind}="${ids}"`;
  const opts = STATUSES.map((s) =>
    `<option value="${s.id}" ${node.status === s.id ? 'selected' : ''}>${s.label}</option>`).join('');
  return `<select class="status status-${node.status}" ${attr}>${opts}</select>`;
}

function qtyControl(node, kind, ids) {
  const missing = clampInt(node.qtyWanted) - clampInt(node.qtyDone);
  return `<div class="qty">
    <span class="qty-label">En maleta</span>
    <div class="stepper">
      <button class="step" data-qtydone-dec-${kind}="${ids}">−</button>
      <span class="qty-num">${clampInt(node.qtyDone)}</span>
      <button class="step" data-qtydone-inc-${kind}="${ids}">+</button>
    </div>
    <span class="qty-sep">/</span>
    <div class="stepper">
      <button class="step" data-qtywant-dec-${kind}="${ids}">−</button>
      <span class="qty-num want">${clampInt(node.qtyWanted)}</span>
      <button class="step" data-qtywant-inc-${kind}="${ids}">+</button>
    </div>
    <span class="qty-want-label">objetivo</span>
    ${missing > 0 ? `<span class="missing">faltan ${missing}</span>` : `<span class="missing done">completo</span>`}
  </div>`;
}

function renderItem(listId, it, context) {
  const ids = `${listId}:${it.id}`;
  return `<div class="item ${context === 'trip' && !nodePending(it) ? 'is-done' : ''}">
    <div class="item-main">
      <input class="item-name" data-item-name="${ids}" value="${esc(it.name)}" placeholder="Artículo">
      ${context === 'trip' ? qtyControl(it, 'item', ids) : ''}
      ${statusChip(it, 'item', ids)}
      <button class="icon-btn danger tiny" data-del-item="${ids}" title="Borrar">✕</button>
    </div>
  </div>`;
}

/* ---------- Trayectos ---------- */
function renderLegs(t) {
  const legs = [...(t.legs || [])].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
  const rows = legs.map((leg) => {
    const ty = legType(leg.type);
    const cd = countdown(leg.datetime);
    return `<div class="leg" data-leg="${leg.id}">
      <div class="leg-line">
        <span class="leg-ico">${ty.icon}</span>
        <select class="leg-type" data-leg-type="${leg.id}">
          ${LEG_TYPES.map((x) => `<option value="${x.id}" ${x.id === leg.type ? 'selected' : ''}>${x.label}</option>`).join('')}
        </select>
        <input class="leg-name" data-leg-name="${leg.id}" value="${esc(leg.name)}" placeholder="p. ej. Seúl → Busan">
        <button class="icon-btn danger tiny" data-del-leg="${leg.id}" title="Borrar">✕</button>
      </div>
      <div class="leg-line">
        <input type="datetime-local" class="leg-dt" data-leg-dt="${leg.id}" value="${leg.datetime || ''}">
        <span class="leg-count ${cd.past ? 'past' : ''}">${cd.text}</span>
      </div>
    </div>`;
  }).join('');

  return `<div class="legs">
    ${legs.length ? rows : `<div class="empty small"><p class="muted">Sin trayectos. Añade trenes, buses o vuelos internos.</p></div>`}
    <button class="btn wide" data-add-leg>+ Añadir trayecto</button>
  </div>`;
}

/* ============================================================
   EVENTOS (delegación)
   ============================================================ */
function bindDynamic() {
  // Navegación inferior / botones de volver
  $$('[data-nav]').forEach((b) => b.onclick = () => go(b.dataset.nav));
}

// Delegación global para clicks
app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-open-trip],[data-open-tpl],[data-new-trip],[data-new-tpl],[data-tab],[data-del-trip],[data-del-tpl],[data-del-list],[data-del-item],[data-del-leg],[data-add-list],[data-add-list-tpl],[data-add-item],[data-add-leg],[data-save-as-tpl],[data-qtydone-inc-item],[data-qtydone-dec-item],[data-qtywant-inc-item],[data-qtywant-dec-item],[data-set-theme],[data-notif-toggle],[data-notif-test],[data-export],[data-wipe]');
  if (!el) return;
  const d = el.dataset;

  if (d.openTrip) return go('trip', { tripId: d.openTrip, tab: 'lists' });
  if (d.openTpl) return go('template', { templateId: d.openTpl });
  if ('newTrip' in d) return createTripFlow();
  if ('newTpl' in d) return createTemplate();
  if ('tab' in d) { view.tab = d.tab; return render(); }

  // Ajustes
  if ('setTheme' in d) { store.data.settings.theme = d.setTheme; store.save(); applyTheme(); return render(); }
  if ('notifToggle' in d) return toggleNotifications();
  if ('notifTest' in d) return notifTest();
  if ('export' in d) return exportData();
  if ('wipe' in d) return deleteAllData();

  if (d.delTrip) return confirmDelete('¿Borrar este viaje y todas sus listas?', () => {
    store.data.trips = store.data.trips.filter((x) => x.id !== d.delTrip);
    store.save(); scheduleReminderSync(); go('home');
  });
  if (d.delTpl) return confirmDelete('¿Borrar esta plantilla?', () => {
    store.data.templates = store.data.templates.filter((x) => x.id !== d.delTpl);
    store.save(); render();
  });

  const t = currentTrip() || currentTemplate();

  if (d.delList) {
    const c = container();
    const idx = c.lists.findIndex((l) => l.id === d.delList);
    if (idx < 0) return;
    const [removed] = c.lists.splice(idx, 1);
    saveRender();
    return toastUndo('Lista borrada', () => { c.lists.splice(idx, 0, removed); saveRender(); });
  }
  if (d.delItem) {
    const [lid, iid] = d.delItem.split(':');
    const list = findList(lid);
    const idx = list.items.findIndex((i) => i.id === iid);
    if (idx < 0) return;
    const [removed] = list.items.splice(idx, 1);
    saveRender();
    return toastUndo('Artículo borrado', () => { list.items.splice(idx, 0, removed); saveRender(); });
  }
  if (d.delLeg) { const tr = currentTrip(); tr.legs = tr.legs.filter((x) => x.id !== d.delLeg); scheduleReminderSync(); return saveRender(); }

  if ('addList' in d || 'addListTpl' in d) { t.lists.push(newList()); return saveRender(); }
  if (d.addItem) { findList(d.addItem).items.push(newItem()); return saveRender(); }
  if ('addLeg' in d) {
    const tr = currentTrip(); tr.legs = tr.legs || [];
    tr.legs.push({ id: uid(), type: 'train', name: '', datetime: '', notified1d: false, notified1h: false });
    return saveRender();
  }
  if ('saveAsTpl' in d) return saveTripAsTemplate();

  // Steppers de cantidad
  const stepper = [
    ['qtydoneIncItem', 'qtyDone', +1], ['qtydoneDecItem', 'qtyDone', -1],
    ['qtywantIncItem', 'qtyWanted', +1], ['qtywantDecItem', 'qtyWanted', -1],
  ];
  for (const [key, field, delta] of stepper) {
    if (d[key]) { adjustQty(d[key], field, delta); return saveRender(); }
  }
});

// Delegación de inputs (texto/fecha/estado)
app.addEventListener('input', (e) => {
  const el = e.target, d = el.dataset;
  if ('tripName' in d) { currentTrip().name = el.value; store.save(); return updateBoards(); }
  if ('tripStart' in d) { currentTrip().startDate = el.value; resetTripFlags(); store.save(); return updateBoards(); }
  if ('tripEnd' in d) { currentTrip().endDate = el.value; store.save(); return updateBoards(); }
  if ('tplName' in d) { currentTemplate().name = el.value; store.save(); return; }

  if ('listName' in d) { findList(d.listName).name = el.value; store.save(); return; }
  if ('itemName' in d) { const [l, i] = d.itemName.split(':'); findItem(l, i).name = el.value; store.save(); return; }

  if ('legName' in d) { findLeg(d.legName).name = el.value; store.save(); return; }
  if ('legDt' in d) { const lg = findLeg(d.legDt); lg.datetime = el.value; lg.notified1d = lg.notified1h = false; store.save(); scheduleReminderSync(); return updateBoards(); }
});

// Selects (estado / tipo de trayecto)
app.addEventListener('change', (e) => {
  const el = e.target, d = el.dataset;
  if ('statusItem' in d) { const [l, i] = d.statusItem.split(':'); findItem(l, i).status = el.value; return saveRender(); }
  if ('legType' in d) { findLeg(d.legType).type = el.value; return saveRender(); }

  // Ajustes
  if ('setLeglead' in d) { store.data.settings.legLeadMin = clampInt(el.value) || 60; store.save(); scheduleReminderSync(); return; }
  if ('togglePacking2d' in d) { store.data.settings.packing2d = el.checked; store.save(); scheduleReminderSync(); return; }
  if ('togglePacking1d' in d) { store.data.settings.packing1d = el.checked; store.save(); scheduleReminderSync(); return; }
  if ('import' in d) return importData(el);
});

/* ---------- Helpers de mutación ---------- */
function container() { return currentTrip() || currentTemplate(); }
function findList(id) { return container().lists.find((l) => l.id === id); }
function findItem(lid, iid) { return findList(lid).items.find((i) => i.id === iid); }
function findLeg(id) { return currentTrip().legs.find((l) => l.id === id); }
function removeList(id) { const c = container(); c.lists = c.lists.filter((l) => l.id !== id); }
function removeItem(lid, iid) { const l = findList(lid); l.items = l.items.filter((i) => i.id !== iid); }

function adjustQty(ids, field, delta) {
  const [lid, iid] = ids.split(':');
  const node = findItem(lid, iid);
  node[field] = clampInt(node[field] + delta);
  if (node.qtyDone > node.qtyWanted && field === 'qtyDone') node.qtyWanted = node.qtyDone;
  // Autocompletar estado: si ya está todo metido, marcar listo
  if (field === 'qtyDone' && node.qtyDone >= node.qtyWanted && node.qtyWanted > 0) node.status = 'ready';
}

function saveRender() { store.save(); render(); }

// Actualiza solo las cuentas atrás/estados sin re-renderizar todo (para no perder foco al escribir)
function updateBoards() {
  const t = currentTrip();
  if (!t) return;
  const cdEl = $('.tb-count');
  if (cdEl) {
    const cd = countdown(t.startDate, t.endDate);
    cdEl.textContent = cd.text; cdEl.classList.toggle('past', cd.past);
  }
  // Recalcular las cuentas atrás de los trayectos visibles (p. ej. al poner su fecha)
  for (const leg of (t.legs || [])) {
    const el = $(`.leg[data-leg="${leg.id}"] .leg-count`);
    if (el) {
      const cd = countdown(leg.datetime);
      el.textContent = cd.text; el.classList.toggle('past', cd.past);
    }
  }
}
function resetTripFlags() {
  const t = currentTrip();
  if (t) { t.notified2d = false; t.notified1d = false; }
  scheduleReminderSync();
}

/* ============================================================
   FLUJOS: crear viaje (desde cero / plantilla), plantillas
   ============================================================ */
function createTripFlow() {
  const tpls = store.data.templates;
  const options = ['Empezar desde cero', ...tpls.map((t) => `Plantilla: ${t.name}`), 'Cancelar'];
  openSheet('Nuevo viaje', 'Elige cómo empezar', options.map((label, i) => ({
    label,
    kind: i === 0 ? 'primary' : (i === options.length - 1 ? 'ghost' : 'default'),
    action: () => {
      closeSheet();
      if (label === 'Cancelar') return;
      const trip = {
        id: uid(), name: '', startDate: '', endDate: '',
        lists: label === 'Empezar desde cero' ? [] : cloneLists(tpls[i - 1].lists, true),
        legs: [], notified2d: false, notified1d: false,
      };
      store.data.trips.push(trip); store.save(); scheduleReminderSync();
      go('trip', { tripId: trip.id, tab: 'lists' });
    },
  })));
}

function createTemplate() {
  const t = { id: uid(), name: 'Nueva plantilla', lists: [newList('Lista 1')] };
  store.data.templates.push(t); store.save();
  go('template', { templateId: t.id });
}

function saveTripAsTemplate() {
  const t = currentTrip();
  const tpl = { id: uid(), name: (t.name || 'Viaje') + ' (plantilla)', lists: cloneLists(t.lists, true) };
  store.data.templates.push(tpl); store.save();
  toast('Guardado como plantilla');
}

function saveTripAsTemplateFromLists() {} // reservado

/* ============================================================
   HOJA MODAL (sheet) + confirmaciones + toast
   ============================================================ */
function openSheet(title, subtitle, actions) {
  closeSheet();
  const el = document.createElement('div');
  el.className = 'sheet-backdrop';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
    <h2 class="sheet-title">${esc(title)}</h2>
    ${subtitle ? `<p class="sheet-sub muted">${esc(subtitle)}</p>` : ''}
    <div class="sheet-actions"></div>
  </div>`;
  const wrap = $('.sheet-actions', el);
  actions.forEach((a) => {
    const b = document.createElement('button');
    b.className = `btn wide ${a.kind === 'primary' ? 'btn-primary' : a.kind === 'ghost' ? 'ghost' : ''}`;
    b.textContent = a.label;
    b.onclick = a.action;
    wrap.appendChild(b);
  });
  el.addEventListener('click', (e) => { if (e.target === el) closeSheet(); });
  document.body.appendChild(el);
}
function closeSheet() { $$('.sheet-backdrop').forEach((e) => e.remove()); }
function confirmDelete(msg, onYes) {
  openSheet('Confirmar', msg, [
    { label: 'Sí, borrar', kind: 'primary', action: () => { closeSheet(); onYes(); } },
    { label: 'Cancelar', kind: 'ghost', action: closeSheet },
  ]);
}
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2200);
}
// Toast con botón "Deshacer" durante unos segundos
function toastUndo(msg, onUndo) {
  $$('.toast').forEach((e) => e.remove());
  const el = document.createElement('div');
  el.className = 'toast toast-undo';
  el.innerHTML = `<span></span><button class="toast-btn">Deshacer</button>`;
  el.querySelector('span').textContent = msg;
  const close = () => { clearTimeout(timer); el.classList.remove('show'); setTimeout(() => el.remove(), 300); };
  el.querySelector('.toast-btn').onclick = () => { close(); onUndo(); };
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  const timer = setTimeout(close, 5000);
}

/* ============================================================
   NOTIFICACIONES LOCALES (solo en la app nativa de Android)
   ============================================================ */

// Texto legible de una antelación en minutos: 60 → "1 h", 90 → "90 min".
function leadText(min) { return min % 60 === 0 ? `${min / 60} h` : `${min} min`; }

// Genera el calendario completo de avisos futuros a partir de los datos y ajustes.
function buildReminders() {
  const s = store.data.settings;
  const now = Date.now();
  const items = [];
  for (const t of store.data.trips) {
    if (t.startDate) {
      const start = toLocalDate(t.startDate).getTime();
      if (start > now) {
        const pend = tripPendingCount(t);
        const name = t.name || 'tu viaje';
        if (s.packing2d) items.push({
          id: `${t.id}_2d`,
          title: `Faltan 2 días: ${name}`,
          body: pend > 0 ? `Tienes ${pend} artículos pendientes.` : 'Revisa tu equipaje.',
          sendAt: start - 2 * DAY,
        });
        if (s.packing1d) items.push({
          id: `${t.id}_1d`,
          title: `Mañana sales: ${name}`,
          body: pend > 0 ? `Todavía quedan ${pend} artículos pendientes.` : '¡Todo listo!',
          sendAt: start - DAY,
        });
      }
    }
    for (const leg of (t.legs || [])) {
      if (!leg.datetime) continue;
      const dt = new Date(leg.datetime).getTime();
      if (dt > now) {
        const ty = legType(leg.type).label;
        const legName = leg.name || t.name || 'trayecto';
        const lead = Math.min(180, Math.max(30, s.legLeadMin || 60));
        items.push({
          id: `${leg.id}_lead`,
          title: `${ty} en ${leadText(lead)}: ${legName}`,
          body: `Salida: ${fmtDateTime(leg.datetime)}`,
          sendAt: dt - lead * 60000,
        });
      }
    }
  }
  return items.filter((item) => item.sendAt > now);
}

/* ---------- ¿Estamos dentro de la app nativa (Capacitor)? ---------- */
function isNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}
function localNotifications() {
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null;
}
function notifEnabled() { return localStorage.getItem('viajes_notif') === 'on'; }

// Android exige id numérico: convierte el id de texto del aviso en un entero estable.
function notifNumericId(strId) {
  let h = 0;
  for (let i = 0; i < strId.length; i++) { h = (Math.imul(h, 31) + strId.charCodeAt(i)) | 0; }
  return Math.abs(h) || 1;
}

// Reprograma en el sistema todos los avisos futuros (cancela los anteriores primero).
async function syncReminders() {
  const LN = localNotifications();
  if (!isNative() || !LN || !notifEnabled()) return;
  try {
    const pending = await LN.getPending();
    if (pending && pending.notifications && pending.notifications.length) {
      await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    const items = buildReminders();
    if (!items.length) return;
    await LN.schedule({
      notifications: items.map((it) => ({
        id: notifNumericId(it.id),
        title: it.title,
        body: it.body,
        schedule: { at: new Date(it.sendAt), allowWhileIdle: true },
      })),
    });
  } catch (e) { console.error('syncReminders:', e); }
}

// Debounce: reprograma tras cambiar fechas (evita hacerlo en cada tecla).
let _reminderTimer = null;
function scheduleReminderSync() {
  if (!isNative()) return;
  clearTimeout(_reminderTimer);
  _reminderTimer = setTimeout(syncReminders, 1500);
}

// Pide permiso (Android 13+) y activa los avisos.
async function enableNotifications() {
  const LN = localNotifications();
  if (!LN) return false;
  try {
    const res = await LN.requestPermissions();
    if (res.display !== 'granted') return false;
    localStorage.setItem('viajes_notif', 'on');
    await syncReminders();
    return true;
  } catch (e) { console.error('enableNotifications:', e); return false; }
}

async function disableNotifications() {
  localStorage.setItem('viajes_notif', 'off');
  const LN = localNotifications();
  if (!LN) return;
  try {
    const pending = await LN.getPending();
    if (pending && pending.notifications && pending.notifications.length) {
      await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
  } catch (e) { /* silencioso */ }
}

/* ============================================================
   AVISOS (hoja de ajustes)
   ============================================================ */
/* ---------- Tema (claro/oscuro) ---------- */
function applyTheme() {
  document.body.dataset.theme = (store.data.settings && store.data.settings.theme) || 'light';
}

/* ---------- Acciones de ajustes ---------- */
async function toggleNotifications() {
  if (notifEnabled()) { await disableNotifications(); toast('Avisos desactivados'); }
  else { const ok = await enableNotifications(); toast(ok ? 'Avisos activados' : 'Permiso denegado'); }
  render();
}
async function notifTest() {
  const LN = localNotifications();
  if (!LN) return;
  try {
    await LN.schedule({ notifications: [{
      id: 999999, title: 'Aviso de prueba',
      body: 'Las notificaciones funcionan en este dispositivo.',
      schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
    }] });
    toast('Te llegará en ~5 segundos');
  } catch (e) { toast('No se pudo programar el aviso'); }
}
// Exporta todos los datos (viajes, plantillas y ajustes) a un archivo .json.
async function exportData() {
  const json = JSON.stringify(store.data, null, 2);
  const filename = `mis-viajes-${new Date().toISOString().slice(0, 10)}.json`;
  const P = window.Capacitor?.Plugins;
  if (isNative() && P?.Filesystem && P?.Share) {
    // App nativa: guarda el archivo y abre el diálogo de guardar/compartir
    try {
      const res = await P.Filesystem.writeFile({ path: filename, data: json, directory: 'CACHE', encoding: 'utf8' });
      await P.Share.share({ title: filename, url: res.uri, dialogTitle: 'Guardar copia de seguridad' });
    } catch (e) { console.error('export:', e); toast('No se pudo exportar'); }
    return;
  }
  // Web/PWA: descarga directa del archivo
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Copia descargada');
}
// Importa un .json previamente exportado, reemplazando todos los datos.
function importData(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.trips) || !Array.isArray(data.templates)) throw new Error('formato');
      store.data = data;
      store.data.settings = Object.assign(
        { theme: 'light', legLeadMin: 60, packing2d: true, packing1d: true },
        store.data.settings || {}
      );
      store.migrate();
      store.save();
      applyTheme();
      scheduleReminderSync();
      go('home');
      toast('Datos importados');
    } catch (e) { toast('Archivo no válido'); }
  };
  reader.readAsText(file);
}

// Borra TODO (viajes, plantillas y ajustes) tras confirmar. Vuelve al estado inicial.
function deleteAllData() {
  confirmDelete('¿Borrar TODOS los datos? Se eliminarán todos los viajes, plantillas y ajustes. No se puede deshacer.', () => {
    closeSheet();
    localStorage.removeItem('viajes_app_v1');
    store.data = { trips: [], templates: [] };
    store.load();          // reaplica ajustes por defecto y la plantilla de ejemplo
    applyTheme();
    syncReminders();       // cancela los avisos programados (ya no hay viajes)
    go('home');
    toast('Todos los datos borrados');
  });
}

/* ---------- Pantalla de Ajustes ---------- */
function renderSettings() {
  const s = store.data.settings;
  const native = isNative();
  const on = notifEnabled();
  const leads = [30, 45, 60, 90, 120, 150, 180];

  const notifSection = native
    ? `<div class="set-row">
         <div><div class="set-label">Avisos</div><div class="muted">${on ? 'Activados' : 'Desactivados'}</div></div>
         <button class="btn ${on ? '' : 'btn-primary'}" data-notif-toggle>${on ? 'Desactivar' : 'Activar'}</button>
       </div>
       ${on ? `<button class="btn ghost small wide" data-notif-test>Enviar aviso de prueba</button>` : ''}`
    : `<p class="muted">Las notificaciones solo están disponibles en la app de Android.</p>`;

  const notifExtra = native && on ? `
    <section class="set-card">
      <div class="set-head">Avisos de trayecto</div>
      <label class="set-row">
        <span class="set-label">Avisar antes de la salida</span>
        <select class="input set-select" data-set-leglead>
          ${leads.map((m) => `<option value="${m}" ${s.legLeadMin === m ? 'selected' : ''}>${leadText(m)}</option>`).join('')}
        </select>
      </label>
    </section>
    <section class="set-card">
      <div class="set-head">Avisos de equipaje pendiente</div>
      <label class="set-row"><span class="set-label">2 días antes del viaje</span>
        <input type="checkbox" data-toggle-packing2d ${s.packing2d ? 'checked' : ''}></label>
      <label class="set-row"><span class="set-label">1 día antes del viaje</span>
        <input type="checkbox" data-toggle-packing1d ${s.packing1d ? 'checked' : ''}></label>
    </section>` : '';

  return `
  <header class="topbar">
    <div class="brand"><span class="brand-mark">◑</span> Mis Viajes</div>
    <span></span>
  </header>
  <main class="wrap">
    <h2 class="set-title">Ajustes</h2>

    <section class="set-card">
      <div class="set-head">Notificaciones</div>
      ${notifSection}
    </section>

    ${notifExtra}

    <section class="set-card">
      <div class="set-head">Apariencia</div>
      <div class="set-row">
        <span class="set-label">Tema</span>
        <div class="seg">
          <button class="seg-btn ${s.theme === 'light' ? 'is-active' : ''}" data-set-theme="light">Claro</button>
          <button class="seg-btn ${s.theme === 'dark' ? 'is-active' : ''}" data-set-theme="dark">Oscuro</button>
        </div>
      </div>
    </section>

    <section class="set-card">
      <div class="set-head">Copia de seguridad</div>
      <p class="muted">Exporta todos tus viajes, plantillas y ajustes a un archivo, e impórtalo para restaurarlo.</p>
      <button class="btn wide import-btn" data-export>Exportar datos</button>
      <label class="btn wide import-btn">Importar datos
        <input type="file" accept="application/json,.json" data-import hidden>
      </label>
    </section>

    <section class="set-card">
      <div class="set-head">Zona de peligro</div>
      <button class="btn wide danger-btn" data-wipe>Borrar todos los datos</button>
    </section>
  </main>
  ${bottomNav('settings')}`;
}

/* ============================================================
   ARRANQUE
   ============================================================ */
function boot() {
  store.load();
  applyTheme();
  go('home');
  // Service worker (solo para caché offline de la PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  // Avisos: solo en la app nativa de Android. Reprograma al abrir y al volver a ella.
  if (isNative()) {
    syncReminders();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncReminders(); });
    // Gesto/botón "atrás" de Android: no salir de la app. Si hay una hoja abierta, se cierra.
    const capApp = window.Capacitor?.Plugins?.App;
    if (capApp) capApp.addListener('backButton', () => { if ($('.sheet-backdrop')) closeSheet(); });
  }
  setupPullToRefresh();
  // Cerrar hojas con Escape
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
}

// Deslizar hacia abajo desde arriba para refrescar (recalcula cuentas atrás).
function setupPullToRefresh() {
  const ind = document.createElement('div');
  ind.className = 'ptr-indicator';
  document.body.appendChild(ind);
  let startY = null, ready = false;
  window.addEventListener('touchstart', (e) => {
    startY = (window.scrollY <= 0 && e.touches.length === 1) ? e.touches[0].clientY : null;
    ready = false;
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (startY == null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 60 && window.scrollY <= 0) { ready = true; ind.textContent = '↑ Suelta para actualizar'; ind.classList.add('show'); }
    else if (dy < 20) { ready = false; ind.classList.remove('show'); }
  }, { passive: true });
  window.addEventListener('touchend', () => {
    ind.classList.remove('show');
    if (ready) { render(); toast('Actualizado'); }
    startY = null; ready = false;
  }, { passive: true });
}
boot();
